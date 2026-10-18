/**
 * UI-FE-086 — Explicit optimistic-update boundary.
 *
 * Optimistic UI is opt-in by operation. Only reversible, non-authoritative
 * presentation changes may be represented here; canonical failures always
 * restore the exact prior snapshot. Finality, settlement, rewards, permissions,
 * and dispute outcomes are never optimistic.
 */

import type { TransactionStatus } from '@/lib/transaction-machine/transaction-machine.types';

/**
 * Every operation that is allowed to be applied optimistically must appear in
 * the allowlist. Adding a new operation is a deliberate, reviewable change.
 */
export type OptimisticOperationId = 'claim.status.under_review';

export type OptimisticEntity = 'claim';

/** Reasons a canonical authority may require the presentation overlay to be withdrawn. */
export type CanonicalFailureReason =
  | 'rejected'
  | 'reverted'
  | 'replaced'
  | 'dropped'
  | 'reorged'
  | 'projection-contradiction'
  | 'refresh'
  | 'tab-conflict';

export type OptimisticUpdateStatus = 'pending' | 'committed' | 'rolled-back';

/**
 * Transaction states that can influence an optimistic overlay. The transaction
 * machine is the source of truth; `rejected` is included because wallet
 * rejection returns the machine to `idle` and is reported separately.
 */
export type OptimisticTransactionStatus = TransactionStatus | 'rejected';

export type OptimisticUpdateErrorReason =
  | 'UNKNOWN_OPERATION'
  | 'PROHIBITED_OUTCOME'
  | 'UNSAFE_FIELD'
  | 'INVALID_PATCH'
  | 'INVALID_QUERY_KEY'
  | 'MISSING_SNAPSHOT'
  | 'UPDATE_ALREADY_ACTIVE'
  | 'INVALID_RECORD'
  | 'UNSERIALIZABLE_VALUE';

export class OptimisticUpdateError extends Error {
  readonly code: OptimisticUpdateErrorReason;

  constructor(code: OptimisticUpdateErrorReason, message: string) {
    super(`[OptimisticUpdate] ${code}: ${message}`);
    this.name = 'OptimisticUpdateError';
    this.code = code;
  }
}

/**
 * In-memory optimistic update. `previous` is the exact object returned by the
 * cache before the overlay was applied, so rollback can restore it without
 * reconstructing state.
 */
export interface OptimisticUpdateRecord<T = unknown> {
  readonly id: string;
  readonly operationId: OptimisticOperationId;
  readonly queryKey: readonly unknown[];
  readonly previous: T;
  readonly optimistic: T;
  readonly changedFields: readonly string[];
  readonly createdAt: number;
  readonly status: OptimisticUpdateStatus;
  readonly rollbackReason: CanonicalFailureReason | null;
}

/**
 * Browser-persisted journal record. It deliberately stores only presentation
 * metadata (changed field names and previous/optimistic primitive values), not
 * the whole projection, so no claim content or evidence payload is persisted.
 */
export interface OptimisticJournalRecord {
  readonly id: string;
  readonly operationId: OptimisticOperationId;
  readonly queryKey: readonly unknown[];
  readonly changedFields: readonly string[];
  readonly previousValues: Readonly<Record<string, unknown>>;
  readonly optimisticValues: Readonly<Record<string, unknown>>;
  readonly createdAt: number;
  readonly status: 'pending';
}
