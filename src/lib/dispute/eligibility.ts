/**
 * UI-FE-022 — Pure dispute eligibility derivation.
 *
 * Eligibility is contract-derived, never selected: every input here comes
 * from reads against the pinned contracts (`DisputeContractSnapshot`) or
 * from the fail-closed artifact resolution. Nothing in this module talks to
 * the network, the wallet, or the API projection — it is deterministic and
 * side-effect free so every scoped state can be unit tested in isolation.
 */

import type { DisputeArtifact } from '@/config/protocol/dispute-artifact';
import { DISPUTE_SUPPORTED_CHAINS } from '@/config/protocol/dispute-artifact';
import {
  DISPUTE_CLAIM_PHASE,
  DisputeClaimPhaseName,
  DisputeContractSnapshot,
  DisputeEligibility,
} from '@/app/types/dispute-entry';

const PHASE_LABELS: Record<DisputeClaimPhaseName, string> = {
  NONE: 'No claim phase',
  VERIFICATION: 'Verification round',
  DISPUTE_WINDOW: 'Dispute window',
  DISPUTE_ACTIVE: 'Active dispute',
  FINALIZED: 'Finalized',
};

export function phaseLabel(phase: DisputeClaimPhaseName): string {
  return PHASE_LABELS[phase] ?? `Unknown phase (${String(phase)})`;
}

/** Map the on-chain uint8 phase to its canonical name; fails closed to NONE. */
export function phaseNameFromIndex(
  raw: number | bigint | undefined
): DisputeClaimPhaseName {
  const value = typeof raw === 'bigint' ? Number(raw) : raw;
  const match = Object.entries(DISPUTE_CLAIM_PHASE).find(
    ([, enumValue]) => enumValue === value
  );
  return (match?.[0] ?? 'NONE') as DisputeClaimPhaseName;
}

export interface DisputeEligibilityInput {
  /** Resolved artifact for the active chain (fail-closed result). */
  artifact: DisputeArtifact;
  /** Active wallet chain id, or null when no wallet is connected. */
  chainId: number | null;
  /** Connected account, or null. */
  account: `0x${string}` | null;
  /** Current time in unix seconds (injected for deterministic tests). */
  nowSeconds: bigint;
  /**
   * Contract reads for the claim. `null` until every required read has
   * resolved — the derivation never guesses protocol state.
   */
  snapshot: DisputeContractSnapshot | null;
  /** Bond (wei) recorded when the current draft was created, if any. */
  bondAtDraft: bigint | null;
}

/**
 * Derive the dispute entry eligibility state.
 *
 * Ordering is fail-closed: pinned authority first, then chain, then wallet,
 * then loading, then every contract gate in protocol order (phase → existing
 * dispute → window → bond change → balance). The last state — `eligible` —
 * is the only one under which a mutation may be attempted.
 */
export function deriveDisputeEligibility(
  input: DisputeEligibilityInput
): DisputeEligibility {
  const { artifact, chainId, account, nowSeconds, snapshot, bondAtDraft } =
    input;

  // 1. Contract authority must be pinned. UI context, wallet connection, API
  //    data, or fixtures never grant authority.
  if (!artifact.isPinned) {
    return {
      status: 'protocol-unpinned',
      reasons:
        artifact.disabledReasons.length > 0
          ? artifact.disabledReasons
          : ['dispute contract authority is not pinned'],
    };
  }

  // 2. Chain gate (Optimism / EVM only).
  if (chainId === null) {
    return { status: 'wallet-not-connected' };
  }
  if (!(DISPUTE_SUPPORTED_CHAINS as readonly number[]).includes(chainId)) {
    return {
      status: 'unsupported-chain',
      chainId,
      supportedChains: [...DISPUTE_SUPPORTED_CHAINS],
    };
  }

  // 3. Account gate for account-scoped reads.
  if (!account) {
    return { status: 'wallet-not-connected' };
  }

  // 4. Contract reads have not resolved — no eligibility is asserted.
  if (!snapshot) {
    return { status: 'loading' };
  }

  // 5. Phase gate: only claims inside the dispute window phase can be
  //    challenged. Everything else is explicit and non-interactive.
  const phase = snapshot.phase;
  if (phase !== 'DISPUTE_WINDOW') {
    return {
      status: 'unsupported-phase',
      phase,
      phaseLabel: phaseLabel(phase),
    };
  }

  // 6. Existing-dispute gate (one dispute per claim).
  if (snapshot.dispute.disputeId > 0n) {
    return {
      status: 'existing-dispute',
      disputeId: snapshot.dispute.disputeId.toString(),
      challenger: snapshot.dispute.challenger,
      openedAt: new Date(Number(snapshot.dispute.openedAt) * 1000).toISOString(),
    };
  }

  // 7. Window gates (block/time authority from the contract).
  if (nowSeconds < snapshot.window.opensAt) {
    return {
      status: 'window-not-open',
      windowStart: new Date(
        Number(snapshot.window.opensAt) * 1000
      ).toISOString(),
    };
  }
  if (nowSeconds >= snapshot.window.closesAt) {
    return {
      status: 'expired-window',
      windowEnd: new Date(Number(snapshot.window.closesAt) * 1000).toISOString(),
    };
  }

  // 8. Bond-change gate: the required bond must match the bond the user
  //    started this draft against. A contract-side bond change (or a draft
  //    created before the bond was known) invalidates the mutation until the
  //    current bond is explicitly acknowledged.
  if (bondAtDraft !== null && bondAtDraft !== snapshot.requiredBond) {
    return {
      status: 'bond-changed',
      requiredBond: snapshot.requiredBond.toString(),
      bondAtDraft: bondAtDraft.toString(),
    };
  }

  // 9. Balance gate (bond-token balance from the pinned ERC-20).
  const balance = snapshot.accountBalance;
  if (balance === null || balance < snapshot.requiredBond) {
    return {
      status: 'insufficient-balance',
      requiredBond: snapshot.requiredBond.toString(),
      balance: (balance ?? 0n).toString(),
    };
  }

  // 10. Every contract-derived gate passed.
  return {
    status: 'eligible',
    requiredBond: snapshot.requiredBond.toString(),
    windowEnd: new Date(Number(snapshot.window.closesAt) * 1000).toISOString(),
    observedAtBlock: snapshot.observedAtBlock.toString(),
  };
}

/** True only for the single state under which a mutation may be attempted. */
export function canAttemptDisputeMutation(
  eligibility: DisputeEligibility
): boolean {
  return eligibility.status === 'eligible';
}

/** Human-readable explanation for why the mutation is unavailable. */
export function explainEligibility(
  eligibility: DisputeEligibility
): string {
  switch (eligibility.status) {
    case 'protocol-unpinned':
      return (
        'Dispute actions are unavailable: the exact contract authority for ' +
        `this deployment is not pinned. ${eligibility.reasons.join(' ')}`
      );
    case 'unsupported-chain':
      return `Dispute actions are unavailable on chain ${eligibility.chainId}. Supported chains: ${eligibility.supportedChains.join(', ')}.`;
    case 'wallet-not-connected':
      return 'Connect a wallet on a supported Optimism network to check dispute eligibility.';
    case 'loading':
      return 'Reading dispute eligibility from the contract…';
    case 'unsupported-phase':
      return `Opening a dispute is unavailable: this claim is in the ${eligibility.phaseLabel} phase, not an open dispute window.`;
    case 'existing-dispute':
      return `A dispute already exists for this claim (dispute #${eligibility.disputeId}). Only one dispute per claim is allowed.`;
    case 'expired-window':
      return `The dispute window for this claim closed on ${eligibility.windowEnd}.`;
    case 'window-not-open':
      return `The dispute window for this claim opens on ${eligibility.windowStart}.`;
    case 'bond-changed':
      return `The required dispute bond changed since you started this draft (was ${eligibility.bondAtDraft ?? 'unknown'} wei, now ${eligibility.requiredBond} wei). Review the updated bond before continuing.`;
    case 'insufficient-balance':
      return `Your bond-token balance (${eligibility.balance} wei) is below the required dispute bond (${eligibility.requiredBond} wei).`;
    case 'eligible':
      return 'All contract-derived eligibility checks passed.';
    default:
      return 'Dispute eligibility could not be determined.';
  }
}
