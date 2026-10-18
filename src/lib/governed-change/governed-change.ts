/**
 * UI-FE-029 — Governed change & timelock execution resolver.
 *
 * Pure, fail-closed derivation of the governed-change preparation and timelock
 * execution review state. Execution is enabled ONLY when every gate passes:
 * the surface is ready, the chain is supported, the authority is (re)validated,
 * a supported call is composed, the proposal is queued, the timelock delay has
 * elapsed, dependencies are satisfied, and the rollback plan is verified.
 *
 * Nothing here submits, schedules, or authorizes a mutation.
 */

import type { TransactionStatus } from '@/lib/transaction-machine';

import type {
  GovernedChangeAuthority,
  GovernedChangeCall,
  GovernedChangeDependency,
  GovernedChangeParameter,
  GovernedChangeRollbackPlan,
  GovernedChangeSnapshot,
  GovernedChangeSurfaceState,
  TimelockReadiness,
} from './types';

export interface TimelockProposalInput {
  readonly id: string;
  /** ISO timestamp the timelock allows execution; null if not yet queued. */
  readonly earliestExecution: string | null;
  readonly delaySeconds: number | null;
  readonly blockNumber: number | null;
}

export function resolveTimelockReadiness(
  proposal: TimelockProposalInput | null,
  nowMs: number,
): TimelockReadiness {
  if (!proposal) {
    return {
      queued: false,
      proposalId: null,
      earliestExecution: null,
      delaySeconds: null,
      ready: false,
      secondsRemaining: null,
      blockNumber: null,
    };
  }

  const earliestMs =
    proposal.earliestExecution !== null
      ? Date.parse(proposal.earliestExecution)
      : Number.NaN;

  if (Number.isNaN(earliestMs)) {
    return {
      queued: true,
      proposalId: proposal.id,
      earliestExecution: proposal.earliestExecution,
      delaySeconds: proposal.delaySeconds,
      ready: false,
      secondsRemaining: null,
      blockNumber: proposal.blockNumber,
    };
  }

  const ready = earliestMs <= nowMs;
  return {
    queued: true,
    proposalId: proposal.id,
    earliestExecution: proposal.earliestExecution,
    delaySeconds: proposal.delaySeconds,
    ready,
    secondsRemaining: ready ? 0 : Math.ceil((earliestMs - nowMs) / 1000),
    blockNumber: proposal.blockNumber,
  };
}

/** States in which a new execution must not be started. */
const BUSY_EXECUTION_STATES = new Set<TransactionStatus>([
  'preparing',
  'signature-requested',
  'submitted',
  'confirming',
  'safe',
  'indexing',
  'finalized',
]);

export interface ResolveGovernedChangeInput {
  surfaceState?: GovernedChangeSurfaceState;
  changeKey?: string | null;
  label?: string | null;
  call?: GovernedChangeCall | null;
  parameters?: readonly GovernedChangeParameter[];
  dependencies?: readonly GovernedChangeDependency[];
  rollback?: GovernedChangeRollbackPlan;
  proposal?: TimelockProposalInput | null;
  authority: GovernedChangeAuthority;
  currentChainId: number | null;
  requiredChainIds?: readonly number[];
  execution?: Partial<GovernedChangeSnapshot['execution']>;
  /** Injectable clock (ms) for deterministic tests. */
  now?: number;
}

const DEFAULT_ROLLBACK: GovernedChangeRollbackPlan = {
  steps: [],
  verified: false,
  evidence: null,
};

const DEFAULT_EXECUTION: GovernedChangeSnapshot['execution'] = {
  status: 'idle',
  txHash: null,
  confirmations: null,
  replacedBy: null,
};

/**
 * Resolve the governed-change snapshot. Every missing/failed gate appends a
 * blocking reason, so the surface can render exactly why execution is
 * disabled.
 */
export function resolveGovernedChange(
  input: ResolveGovernedChangeInput,
): GovernedChangeSnapshot {
  const now = input.now ?? Date.now();
  const surfaceState = input.surfaceState ?? 'ready';
  const requiredChainIds = input.requiredChainIds ?? [];
  const call = input.call ?? null;
  const dependencies = input.dependencies ?? [];
  const rollback = input.rollback ?? DEFAULT_ROLLBACK;
  const execution = { ...DEFAULT_EXECUTION, ...input.execution };

  const timelock = resolveTimelockReadiness(input.proposal ?? null, now);
  const blockedReasons: string[] = [];

  if (surfaceState !== 'ready') {
    blockedReasons.push(`Surface is "${surfaceState}"; execution is unavailable.`);
  }

  if (
    requiredChainIds.length > 0 &&
    (input.currentChainId === null || !requiredChainIds.includes(input.currentChainId))
  ) {
    blockedReasons.push(
      `Connected chain is not supported; required chain(s): ${requiredChainIds.join(', ')}.`,
    );
  }

  if (!input.authority.authorized) {
    const authorityReasons =
      input.authority.reasons.length > 0
        ? input.authority.reasons
        : [
            `Account is not authorized for role "${input.authority.requiredRole}".`,
          ];
    blockedReasons.push(...authorityReasons);
  }

  if (!call) {
    blockedReasons.push('No supported governed call is composed.');
  }

  if (!timelock.queued) {
    blockedReasons.push('Proposal is not queued in the timelock.');
  } else if (!timelock.ready) {
    blockedReasons.push('Timelock delay has not elapsed; execution is not yet ready.');
  }

  for (const dependency of dependencies) {
    if (!dependency.satisfied) {
      blockedReasons.push(`Dependency "${dependency.label}" is not satisfied.`);
    }
  }

  if (rollback.steps.length === 0) {
    blockedReasons.push('Rollback plan is empty.');
  } else if (!rollback.verified) {
    blockedReasons.push('Rollback plan is not verified.');
  }

  if (BUSY_EXECUTION_STATES.has(execution.status)) {
    blockedReasons.push(`Execution is already "${execution.status}".`);
  }

  return {
    surfaceState,
    changeKey: input.changeKey ?? null,
    label: input.label ?? null,
    call,
    parameters: input.parameters ?? [],
    dependencies,
    rollback,
    timelock,
    authority: input.authority,
    currentChainId: input.currentChainId,
    requiredChainIds,
    execution,
    blockedReasons,
    executionEnabled: blockedReasons.length === 0,
  };
}

export interface AuthorityRevalidationInput {
  account: `0x${string}` | null;
  chainId: number | null;
  authorized: boolean;
}

export interface AuthorityRevalidationResult {
  authorized: boolean;
  reasons: string[];
  /** True when the revalidated authority matches the reviewed snapshot. */
  unchanged: boolean;
}

/**
 * Revalidate authority at action time. Authority is never assumed from the
 * reviewed snapshot — the caller must supply the current account, chain, and
 * authorization result, and any change blocks execution.
 */
export function revalidateAuthority(
  snapshot: GovernedChangeSnapshot,
  current: AuthorityRevalidationInput,
): AuthorityRevalidationResult {
  const reasons: string[] = [];

  if (current.account === null) {
    reasons.push('Wallet is no longer connected.');
  } else if (
    snapshot.authority.account !== null &&
    current.account.toLowerCase() !== snapshot.authority.account.toLowerCase()
  ) {
    reasons.push('Connected account changed since review.');
  }

  if (current.chainId === null) {
    reasons.push('No chain is connected.');
  } else if (
    snapshot.requiredChainIds.length > 0 &&
    !snapshot.requiredChainIds.includes(current.chainId)
  ) {
    reasons.push('Connected chain changed to an unsupported network.');
  }

  if (!current.authorized) {
    reasons.push(`Account is not authorized for role "${snapshot.authority.requiredRole}".`);
  }

  return {
    authorized: reasons.length === 0,
    reasons,
    unchanged:
      reasons.length === 0 &&
      current.account !== null &&
      (snapshot.authority.account === null ||
        current.account.toLowerCase() === snapshot.authority.account.toLowerCase()) &&
      current.chainId === snapshot.currentChainId,
  };
}

/** Convenience: true when the reviewed snapshot and authority still allow execution. */
export function canExecute(snapshot: GovernedChangeSnapshot): boolean {
  return snapshot.executionEnabled && snapshot.blockedReasons.length === 0;
}

export interface GovernedChangePreparationGate {
  enabled: boolean;
  reasons: string[];
}

/**
 * Preparation (schedule) gate. Unlike execution, preparation does not require
 * the proposal to be queued — the proposal is what preparation creates. It does
 * require a supported call, satisfied dependencies, and a verified rollback.
 */
export function resolvePreparationGate(
  snapshot: GovernedChangeSnapshot,
): GovernedChangePreparationGate {
  const reasons: string[] = [];

  if (snapshot.surfaceState !== 'ready') {
    reasons.push(`Surface is "${snapshot.surfaceState}"; preparation is unavailable.`);
  }

  if (snapshot.call === null) {
    reasons.push('No supported governed call is composed.');
  }

  if (!snapshot.authority.authorized) {
    reasons.push(`Account is not authorized for role "${snapshot.authority.requiredRole}".`);
  }

  for (const dependency of snapshot.dependencies) {
    if (!dependency.satisfied) {
      reasons.push(`Dependency "${dependency.label}" is not satisfied.`);
    }
  }

  if (snapshot.rollback.steps.length === 0) {
    reasons.push('Rollback plan is empty.');
  } else if (!snapshot.rollback.verified) {
    reasons.push('Rollback plan is not verified.');
  }

  return { enabled: reasons.length === 0, reasons };
}

/** Whole-hour HH:MM:SS (or MM:SS) countdown for a duration in seconds. */
export function formatCountdown(seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds <= 0) return '00:00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}
