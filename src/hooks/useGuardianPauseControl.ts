'use client';

/**
 * UI-FE-032 — useGuardianPauseControl
 *
 * Coordinates the Emergency Guardian Pause Control at the UI boundary:
 *   - Discovers operation-scoped pause authority from the pinned ABI.
 *   - Reads guardian authority from canonical contract state (never from the
 *     wallet, route, or an API projection alone).
 *   - Fails closed on wrong network, revoked authority, missing reads, or
 *     stale data.
 *   - Keeps a pause *request* distinct from a confirmed on-chain module pause.
 *
 * The pinned release ABI declares no pause entrypoint, so this hook honestly
 * reports `no_abi_pause_support` and disables every action by default.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useAccount,
  useBlockNumber,
  useChainId,
  useReadContract,
  useWriteContract,
} from 'wagmi';
import { keccak256, toHex, type Abi } from 'viem';

import {
  APPROVED_PAUSE_SCOPES,
  derivePauseProofs,
  resolveGuardianPauseAuthority,
  scopeId,
  type GuardianAuthorityRead,
  type GuardianFreshness,
  type GuardianModuleState,
  type GuardianPauseRequestState,
  type GuardianPauseScope,
  type GuardianPauseSnapshot,
} from '@/lib/guardian';
import { getAddressValidationError } from '@/lib/contracts/address-guard';
import {
  getContractAbi,
  getContractAddress,
  getProtocolRelease,
  getReleaseChainId,
} from '@/lib/contracts/registry';

/** Canonical role bytes32 used by the pause entrypoint authorization. */
export const GUARDIAN_PAUSE_ROLE = keccak256(toHex('GUARDIAN_PAUSE_ROLE'));

const DEFAULT_STALE_AFTER_MS = 120_000;

export interface UseGuardianPauseControlOptions {
  /** Override ABI (tests/wiring). Defaults to the pinned release ABI. */
  abi?: readonly unknown[];
  /** Stale threshold for authority reads. Defaults to 120s. */
  staleAfterMs?: number;
}

export interface GuardianPauseRequestResult {
  ok: boolean;
  reason?: string;
  /** Only ever a Wagmi-returned hash; never fabricated. */
  txHash?: `0x${string}`;
}

export interface UseGuardianPauseControlReturn {
  snapshot: GuardianPauseSnapshot;
  requestState: GuardianPauseRequestState;
  moduleStates: readonly GuardianModuleState[];
  isReadingAuthority: boolean;
  requestPause: (
    scope: GuardianPauseScope,
  ) => Promise<GuardianPauseRequestResult>;
  resetRequest: () => void;
  refetchAuthority: () => void;
}

interface RoleReadShape {
  data?: unknown;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/**
 * Resolve the pinned guardian role holder from the canonical release roles
 * artifact. Returns null when unset or invalid (fail closed).
 */
export function resolvePinnedGuardianAddress(
  roles: Record<string, unknown> | null | undefined,
): `0x${string}` | null {
  const raw = roles?.guardian;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  if (getAddressValidationError(raw) !== null) return null;
  return raw.toLowerCase() as `0x${string}`;
}

export function useGuardianPauseControl(
  options: UseGuardianPauseControlOptions = {},
): UseGuardianPauseControlReturn {
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;

  const release = useMemo(() => getProtocolRelease(), []);
  const abi = useMemo<readonly unknown[]>(
    () => options.abi ?? safeGetAbi(),
    [options.abi],
  );
  const contractAddress = useMemo(() => safeGetAddress(), []);
  const releaseChainId = useMemo(() => safeReleaseChainId(), []);

  const { address: account } = useAccount();
  const chainId = useChainId();
  const { data: blockNumber } = useBlockNumber({ watch: false });
  const { writeContractAsync } = useWriteContract() ?? {};

  const pauseProofs = useMemo(() => derivePauseProofs(abi), [abi]);

  const supportsRoleRead = useMemo(
    () =>
      (abi as readonly { type?: string; name?: string; inputs?: unknown[] }[]).some(
        (entry) =>
          entry?.type === 'function' &&
          entry.name === 'hasRole' &&
          Array.isArray(entry.inputs) &&
          entry.inputs.length === 2,
      ),
    [abi],
  );

  const {
    data: hasRoleData,
    isLoading: isRoleLoading,
    isError: isRoleError,
    error: roleError,
    refetch: refetchRole,
  } = useReadContract({
    address: contractAddress ?? undefined,
    abi: abi as Abi,
    functionName: 'hasRole',
    args: [GUARDIAN_PAUSE_ROLE, account] as readonly unknown[],
    query: { enabled: supportsRoleRead && Boolean(account) && Boolean(contractAddress) },
  } as never) as unknown as RoleReadShape;

  const guardianAddress = useMemo(
    () => resolvePinnedGuardianAddress(release.roles as Record<string, unknown>),
    [release],
  );

  const [observedAtMs, setObservedAtMs] = useState<number | null>(null);
  useEffect(() => {
    if (hasRoleData !== undefined) setObservedAtMs(Date.now());
  }, [hasRoleData]);

  const authorityRead = useMemo<GuardianAuthorityRead | null>(() => {
    if (!supportsRoleRead) return null;
    if (isRoleLoading) {
      return {
        status: 'loading',
        hasPauseRole: false,
        revoked: false,
        blockNumber: null,
      };
    }
    if (isRoleError) {
      return {
        status: 'error',
        hasPauseRole: false,
        revoked: false,
        blockNumber: null,
        error: roleError instanceof Error ? roleError.message : 'role read failed',
      };
    }
    if (typeof hasRoleData !== 'boolean') {
      return {
        status: 'idle',
        hasPauseRole: false,
        revoked: false,
        blockNumber: null,
      };
    }
    return {
      status: 'success',
      hasPauseRole: hasRoleData,
      revoked: false,
      blockNumber: typeof blockNumber === 'bigint' ? blockNumber : null,
    };
  }, [
    supportsRoleRead,
    isRoleLoading,
    isRoleError,
    roleError,
    hasRoleData,
    blockNumber,
  ]);

  const freshness = useMemo<GuardianFreshness | null>(() => {
    if (observedAtMs === null) return null;
    const ageMs = Date.now() - observedAtMs;
    return {
      status: ageMs > staleAfterMs ? 'stale' : 'fresh',
      ageMs,
      observedAtBlock: typeof blockNumber === 'bigint' ? blockNumber : null,
    };
  }, [observedAtMs, staleAfterMs, blockNumber]);

  const snapshot = useMemo(
    () =>
      resolveGuardianPauseAuthority({
        chainId,
        abi,
        releaseChainId,
        account: account ?? null,
        guardianAddress,
        authorityRead,
        freshness,
        manifestVerified: true,
      }),
    [
      chainId,
      abi,
      releaseChainId,
      account,
      guardianAddress,
      authorityRead,
      freshness,
    ],
  );

  const moduleStates = useMemo<readonly GuardianModuleState[]>(
    () =>
      APPROVED_PAUSE_SCOPES.map((scope) => ({
        scope,
        pauseState: 'unknown' as const,
        observedAtBlock:
          typeof blockNumber === 'bigint' ? blockNumber : null,
        confirmedOnChain: false,
      })),
    [blockNumber],
  );

  const [requestState, setRequestState] =
    useState<GuardianPauseRequestState>('idle');
  const requestSeq = useRef(0);

  const resetRequest = useCallback(() => {
    requestSeq.current += 1;
    setRequestState('idle');
  }, []);

  const refetchAuthority = useCallback(() => {
    if (supportsRoleRead) {
      void refetchRole();
    }
  }, [supportsRoleRead, refetchRole]);

  const requestPause = useCallback(
    async (scope: GuardianPauseScope): Promise<GuardianPauseRequestResult> => {
      if (!snapshot.allowsPause) {
        return {
          ok: false,
          reason:
            snapshot.blockingReasons[0] ??
            'Guardian pause authority is not established.',
        };
      }
      if (!snapshot.actionableScopes.includes(scope)) {
        return {
          ok: false,
          reason: `Pause scope "${scope}" is not ABI-proven.`,
        };
      }
      const proof = pauseProofs.find((item) => item.scope === scope);
      if (!proof) {
        return { ok: false, reason: `No pause entrypoint proven for "${scope}".` };
      }
      if (typeof writeContractAsync !== 'function' || !contractAddress) {
        return { ok: false, reason: 'Wallet write path unavailable.' };
      }

      const args =
        proof.inputs.length === 0
          ? []
          : proof.inputs.length === 1 && proof.inputs[0] === 'bytes32'
            ? [scopeId(scope)]
            : null;
      if (args === null) {
        return {
          ok: false,
          reason: `Unsupported pause entrypoint shape for "${scope}".`,
        };
      }

      const seq = ++requestSeq.current;
      setRequestState('requesting');
      try {
        const txHash = (await writeContractAsync({
          address: contractAddress,
          abi: abi as Abi,
          functionName: proof.functionName,
          args,
        } as never)) as `0x${string}`;
        if (seq === requestSeq.current) setRequestState('submitted');
        return { ok: true, txHash };
      } catch (error) {
        if (seq === requestSeq.current) {
          const message = error instanceof Error ? error.message : String(error);
          setRequestState(
            /reject|4001/i.test(message) ? 'rejected' : 'failed',
          );
        }
        return {
          ok: false,
          reason: error instanceof Error ? error.message : 'Pause request failed.',
        };
      }
    },
    [snapshot, pauseProofs, writeContractAsync, contractAddress, abi],
  );

  return {
    snapshot,
    requestState,
    moduleStates,
    isReadingAuthority: isRoleLoading,
    requestPause,
    resetRequest,
    refetchAuthority,
  };
}

function safeGetAbi(): readonly unknown[] {
  try {
    return getContractAbi('TruthBountyWeighted');
  } catch {
    return [];
  }
}

function safeGetAddress(): `0x${string}` | null {
  try {
    return getContractAddress('TruthBountyWeighted');
  } catch {
    return null;
  }
}

function safeReleaseChainId(): number | null {
  try {
    const id = getReleaseChainId();
    return typeof id === 'number' && Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}
