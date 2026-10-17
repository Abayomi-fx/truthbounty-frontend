/**
 * UI-FE-022 — Dispute entry hook (useDisputeEntry).
 *
 * Reads dispute eligibility inputs from the pinned contracts and feeds them
 * into the pure derivation in `@/lib/dispute/eligibility`:
 *
 *   1. artifact    — fail-closed pinned authority (never fabricated)
 *   2. phase       — `disputePhase(claimId)` (contract canonical)
 *   3. dispute     — `getDispute(claimId)` (existing-dispute gate)
 *   4. window      — `disputeWindow(claimId)` (expired/not-open gates)
 *   5. bond        — `requiredDisputeBond(claimId)` (bond-change gate)
 *   6. balance     — ERC-20 `balanceOf(account)` on the pinned bond token
 *
 * The hook fails closed end-to-end: when the dispute artifact is not pinned
 * for the expected chain, no reads are issued, the snapshot stays `null`,
 * and the derived eligibility is `protocol-unpinned` — a state under which
 * every mutation path stays unavailable. API projections and UI context are
 * never consulted for authority.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useAccount, useBlockNumber, useChainId, useReadContract } from 'wagmi';
import {
  DisputeArtifact,
  disputeRegistryAbi,
  erc20Abi,
  getDisputeArtifact,
} from '@/config/protocol/dispute-artifact';
import {
  DisputeContractSnapshot,
  DisputeEligibility,
} from '@/app/types/dispute-entry';
import {
  canAttemptDisputeMutation,
  deriveDisputeEligibility,
  phaseNameFromIndex,
} from '@/lib/dispute/eligibility';

export interface UseDisputeEntryConfig {
  /** Claim id in any accepted format ("123", "0x7b", "claim-123"). */
  claimId: string;
  /** Chain the composition targets; defaults to Optimism Sepolia. */
  expectedChainId?: number;
  /** Bond (wei) recorded when the current draft was created, if any. */
  bondAtDraft?: bigint | null;
  /** Override now() (unix seconds) for deterministic tests. */
  nowSecondsOverride?: bigint;
}

export interface UseDisputeEntryResult {
  artifact: DisputeArtifact;
  eligibility: DisputeEligibility;
  snapshot: DisputeContractSnapshot | null;
  /** True while any required contract read is still resolving. */
  isLoading: boolean;
  /** Convenience gate mirroring the derivation. */
  canAttemptMutation: boolean;
  refreshState: () => Promise<void>;
}

const OPTIMISM_SEPOLIA_CHAIN_ID = 11155420;

/**
 * Normalize a frontend claim id into the on-chain uint256 id. Returns `null`
 * when the id is not resolvable so eligibility fails closed to `loading`
 * instead of guessing.
 */
export function parseDisputeClaimId(claimId: string): bigint | null {
  const trimmed = claimId.trim();
  if (/^\d+$/.test(trimmed)) return BigInt(trimmed);
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) return BigInt(trimmed);
  const labelMatch = trimmed.match(/^claim[-_ ]?(\d+)$/i);
  if (labelMatch) return BigInt(labelMatch[1]);
  return null;
}

function nowInSeconds(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

/** Read a tuple as either named fields or positional elements. */
function readTuple<T extends Record<string, unknown>>(
  data: unknown,
  names: Array<keyof T & string>
): T | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  const hasNamed = names.every((name) => record[name] !== undefined);
  if (hasNamed) return record as T;
  if (Array.isArray(data)) {
    const positional = Object.fromEntries(
      names.map((name, index) => [name, data[index]])
    );
    return positional as T;
  }
  return null;
}

export function useDisputeEntry(
  config: UseDisputeEntryConfig
): UseDisputeEntryResult {
  const {
    claimId,
    expectedChainId = OPTIMISM_SEPOLIA_CHAIN_ID,
    bondAtDraft = null,
    nowSecondsOverride,
  } = config;

  const { address, isConnected } = useAccount();
  const activeChainId = useChainId();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  // Fail-closed artifact resolution for the chain this composition targets.
  const artifact = useMemo(
    () => getDisputeArtifact(expectedChainId),
    [expectedChainId]
  );
  const isPinned = artifact.isPinned;

  const disputeRegistry = isPinned
    ? artifact.addresses.disputeRegistry
    : undefined;
  const bondToken = isPinned ? artifact.addresses.bondToken : undefined;

  const claimIdBigInt = useMemo(() => parseDisputeClaimId(claimId), [claimId]);
  const readsEnabled = isPinned && claimIdBigInt !== null;

  // -------------------------------------------------------------------------
  // On-chain reads (disabled — and therefore inert — when not pinned)
  // -------------------------------------------------------------------------

  const phaseRead = useReadContract({
    address: disputeRegistry,
    abi: disputeRegistryAbi,
    functionName: 'disputePhase',
    args: claimIdBigInt !== null ? [claimIdBigInt] : undefined,
    query: { enabled: readsEnabled },
  });

  const disputeRead = useReadContract({
    address: disputeRegistry,
    abi: disputeRegistryAbi,
    functionName: 'getDispute',
    args: claimIdBigInt !== null ? [claimIdBigInt] : undefined,
    query: { enabled: readsEnabled },
  });

  const windowRead = useReadContract({
    address: disputeRegistry,
    abi: disputeRegistryAbi,
    functionName: 'disputeWindow',
    args: claimIdBigInt !== null ? [claimIdBigInt] : undefined,
    query: { enabled: readsEnabled },
  });

  const bondRead = useReadContract({
    address: disputeRegistry,
    abi: disputeRegistryAbi,
    functionName: 'requiredDisputeBond',
    args: claimIdBigInt !== null ? [claimIdBigInt] : undefined,
    query: { enabled: readsEnabled },
  });

  const balanceRead = useReadContract({
    address: bondToken,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: readsEnabled && Boolean(address) },
  });

  // -------------------------------------------------------------------------
  // Snapshot assembly — only when every canonical read has resolved
  // -------------------------------------------------------------------------

  const disputeTuple = readTuple<{
    disputeId: bigint;
    challenger: `0x${string}`;
    openedAt: bigint;
  }>(disputeRead.data, ['disputeId', 'challenger', 'openedAt']);

  const windowTuple = readTuple<{
    opensAt: bigint;
    closesAt: bigint;
  }>(windowRead.data, ['opensAt', 'closesAt']);

  const requiredBond = bondRead.data as bigint | undefined;
  const phaseRaw = phaseRead.data as number | bigint | undefined;

  const snapshot: DisputeContractSnapshot | null = useMemo(() => {
    if (!readsEnabled || claimIdBigInt === null) return null;
    if (
      phaseRaw === undefined ||
      !disputeTuple ||
      !windowTuple ||
      requiredBond === undefined
    ) {
      return null;
    }
    return {
      claimId: claimIdBigInt.toString(),
      chainId: expectedChainId,
      observedAtBlock: blockNumber ?? 0n,
      phase: phaseNameFromIndex(phaseRaw),
      dispute: {
        disputeId: disputeTuple.disputeId ?? 0n,
        challenger: disputeTuple.challenger ?? '0x0000000000000000000000000000000000000000',
        openedAt: disputeTuple.openedAt ?? 0n,
      },
      window: {
        opensAt: windowTuple.opensAt ?? 0n,
        closesAt: windowTuple.closesAt ?? 0n,
      },
      requiredBond,
      accountBalance:
        balanceRead.data === undefined ? null : (balanceRead.data as bigint),
    };
  }, [
    readsEnabled,
    claimIdBigInt,
    phaseRaw,
    disputeTuple,
    windowTuple,
    requiredBond,
    expectedChainId,
    balanceRead.data,
    blockNumber,
  ]);

  // -------------------------------------------------------------------------
  // Derivation (pure; contract data is the only authority)
  // -------------------------------------------------------------------------

  const eligibility = useMemo<DisputeEligibility>(
    () =>
      deriveDisputeEligibility({
        artifact,
        chainId: isConnected ? activeChainId : null,
        account: address ?? null,
        nowSeconds: nowSecondsOverride ?? nowInSeconds(),
        snapshot,
        bondAtDraft,
      }),
    [
      artifact,
      isConnected,
      activeChainId,
      address,
      nowSecondsOverride,
      snapshot,
      bondAtDraft,
    ]
  );

  const refreshState = useCallback(async () => {
    await Promise.all([
      phaseRead.refetch(),
      disputeRead.refetch(),
      windowRead.refetch(),
      bondRead.refetch(),
      balanceRead.refetch(),
    ]);
  }, [
    phaseRead.refetch,
    disputeRead.refetch,
    windowRead.refetch,
    bondRead.refetch,
    balanceRead.refetch,
  ]);

  const isLoading =
    readsEnabled &&
    (phaseRead.isLoading ||
      disputeRead.isLoading ||
      windowRead.isLoading ||
      bondRead.isLoading);

  return {
    artifact,
    eligibility,
    snapshot,
    isLoading,
    canAttemptMutation: canAttemptDisputeMutation(eligibility),
    refreshState,
  };
}
