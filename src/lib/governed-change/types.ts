/**
 * UI-FE-029 — Governed Change & Timelock Execution State Model.
 *
 * Pure, fail-closed types for the governed configuration-change preparation
 * and timelock execution review surfaces.
 *
 * Security invariants:
 * - Optimism/EVM only; UI context, wallet connection, API data, or fixtures
 *   never grant authority.
 * - Contracts are canonical for mutations; API data is freshness-labelled
 *   projection data.
 * - Only catalogued configuration changes may be composed; arbitrary calls are
 *   rejected by {@link resolveGovernedChangeCall}.
 * - Execution is disabled until the timelock is genuinely ready and authority
 *   is revalidated at action time.
 */

import type { TransactionStatus } from '@/lib/transaction-machine';

/** Applicable-surface states per FRONTEND_IMPLEMENTATION_MATRIX.md. */
export type GovernedChangeSurfaceState =
  | 'loading'
  | 'empty'
  | 'stale'
  | 'offline'
  | 'error'
  | 'denied'
  | 'wrong-chain'
  | 'unavailable'
  | 'ready';

/** Where a displayed value is allowed to come from, shown to the user. */
export type GovernedChangeSourceClass =
  | 'pinned-contract'
  | 'fresh-api-projection'
  | 'verified-release-manifest'
  | 'wallet-session-local';

/** The supported timelock operation vocabulary. */
export type GovernedChangeTimelockOperation =
  | 'schedule'
  | 'execute'
  | 'cancel'
  | 'updateDelay';

/** A single configuration value shown as current vs proposed. */
export interface GovernedChangeParameter {
  readonly key: string;
  readonly label: string;
  readonly currentValue: string;
  readonly proposedValue: string;
  readonly source: GovernedChangeSourceClass;
  readonly changed: boolean;
}

/** A declared dependency that must be satisfied before execution. */
export interface GovernedChangeDependency {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly satisfied: boolean;
  readonly evidence: string | null;
}

/** The rollback plan shown before confirmation. */
export interface GovernedChangeRollbackPlan {
  readonly steps: readonly string[];
  readonly verified: boolean;
  readonly evidence: string | null;
}

/** Exact target/method/parameters a timelock executor would invoke. */
export interface GovernedChangeTarget {
  /** Exact contract target, e.g. `TimelockController`. */
  readonly target: string;
  /** Exact supported method name on the target contract. */
  readonly method: string;
  /** ABI-encoded parameter list; exactly what will be sent, never fabricated. */
  readonly parameters: readonly string[];
  /** Function selector resolved from the pinned ABI; null until resolved. */
  readonly selector: `0x${string}` | null;
}

/** A composed, supported governed call. */
export interface GovernedChangeCall {
  readonly changeKey: string;
  readonly label: string;
  readonly summary: string;
  /** Human summary of the exact target, e.g. `TimelockController#schedule`. */
  readonly targetResource: string;
  /** How the timelock operation is submitted. */
  readonly timelockOperation: GovernedChangeTimelockOperation;
  readonly target: GovernedChangeTarget;
}

/** Why a call composition was rejected. */
export type GovernedChangeCallRejectionCode =
  | 'UNKNOWN_CHANGE'
  | 'UNSUPPORTED_TARGET'
  | 'UNSUPPORTED_METHOD'
  | 'UNKNOWN_PARAMETER'
  | 'MISSING_PARAMETER'
  | 'INVALID_PARAMETER_TYPE';

export interface GovernedChangeCallRejection {
  readonly code: GovernedChangeCallRejectionCode;
  readonly reason: string;
}

/** Timelock readiness derived from the queued proposal state. */
export interface TimelockReadiness {
  readonly queued: boolean;
  readonly proposalId: string | null;
  /** ISO timestamp; null until queued. */
  readonly earliestExecution: string | null;
  readonly delaySeconds: number | null;
  /** True only when queued AND earliestExecution <= now. */
  readonly ready: boolean;
  /** Whole seconds remaining; 0 when ready, null when not queued. */
  readonly secondsRemaining: number | null;
  readonly blockNumber: number | null;
}

/** Authority state, always revalidated at action time. */
export interface GovernedChangeAuthority {
  readonly account: `0x${string}` | null;
  readonly requiredRole: string;
  readonly authorized: boolean;
  readonly reasons: readonly string[];
  /** Freshness label for the authority source. */
  readonly source: GovernedChangeSourceClass;
}

/** Canonical execution lifecycle, reusing the shared transaction machine. */
export interface GovernedChangeExecutionState {
  readonly status: TransactionStatus;
  readonly txHash: `0x${string}` | null;
  readonly confirmations: number | null;
  readonly replacedBy: `0x${string}` | null;
}

export interface GovernedChangeSnapshot {
  readonly surfaceState: GovernedChangeSurfaceState;
  readonly changeKey: string | null;
  readonly label: string | null;
  readonly call: GovernedChangeCall | null;
  readonly parameters: readonly GovernedChangeParameter[];
  readonly dependencies: readonly GovernedChangeDependency[];
  readonly rollback: GovernedChangeRollbackPlan;
  readonly timelock: TimelockReadiness;
  readonly authority: GovernedChangeAuthority;
  readonly currentChainId: number | null;
  readonly requiredChainIds: readonly number[];
  readonly execution: GovernedChangeExecutionState;
  /** Any reason execution must stay blocked. */
  readonly blockedReasons: readonly string[];
  /** True only when every gate passes and the call is supported. */
  readonly executionEnabled: boolean;
}
