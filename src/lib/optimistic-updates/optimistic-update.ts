/**
 * UI-FE-086 — Pure optimistic-update lifecycle.
 *
 * No React, no cache, no storage. Callers supply the current canonical snapshot
 * and receive an immutable record containing the exact prior object. Canonical
 * failures roll back to that object; canonical success commits the overlay.
 */

import type { TransactionStatus } from '@/lib/transaction-machine/transaction-machine.types';
import { validateOptimisticPatch } from './allowlist';
import {
  OptimisticUpdateError,
  type CanonicalFailureReason,
  type OptimisticOperationId,
  type OptimisticTransactionStatus,
  type OptimisticUpdateRecord,
} from './types';

export interface BeginOptimisticUpdateInput<T extends object> {
  readonly id: string;
  readonly operationId: OptimisticOperationId;
  readonly queryKey: readonly unknown[];
  readonly current: T;
  readonly patch: Record<string, unknown>;
  readonly now?: number;
}

export interface OptimisticRollback<T> {
  readonly data: T;
  readonly record: OptimisticUpdateRecord<T>;
}

export type OptimisticAction = 'none' | 'commit' | 'rollback';

export interface OptimisticTransactionDecision {
  readonly action: OptimisticAction;
  readonly reason: CanonicalFailureReason | null;
}

export type OptimisticReconciliation<T> =
  | {
      readonly action: 'keep';
      readonly data: T;
      readonly record: OptimisticUpdateRecord<T>;
    }
  | {
      readonly action: 'commit';
      readonly data: T;
      readonly record: OptimisticUpdateRecord<T>;
    }
  | {
      readonly action: 'rollback';
      readonly data: T;
      readonly record: OptimisticUpdateRecord<T>;
      readonly reason: CanonicalFailureReason;
    };

const TRANSACTION_ROLLBACK_REASONS: Partial<
  Record<OptimisticTransactionStatus, CanonicalFailureReason>
> = {
  rejected: 'rejected',
  reverted: 'reverted',
  replaced: 'replaced',
  dropped: 'dropped',
  reorged: 'reorged',
};

/**
 * Build a stable journal/cache id. Query keys are canonical cache identities,
 * so their JSON serialization is sufficient as a suffix.
 */
export function buildOptimisticUpdateId(
  operationId: OptimisticOperationId,
  queryKey: readonly unknown[],
): string {
  if (!Array.isArray(queryKey) || queryKey.length === 0) {
    throw new OptimisticUpdateError(
      'INVALID_QUERY_KEY',
      'optimistic updates require a non-empty query key',
    );
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(queryKey);
  } catch {
    throw new OptimisticUpdateError(
      'INVALID_QUERY_KEY',
      'query key must be serializable',
    );
  }
  if (!serialized || serialized === '[]') {
    throw new OptimisticUpdateError(
      'INVALID_QUERY_KEY',
      'query key must be serializable and non-empty',
    );
  }
  return `${operationId}:${serialized}`;
}

/**
 * Begin an optimistic overlay. Fails closed when the operation is not
 * allowlisted, the snapshot is missing, or the patch touches an authoritative
 * outcome.
 */
export function beginOptimisticUpdate<T extends object>(
  input: BeginOptimisticUpdateInput<T>,
): OptimisticUpdateRecord<T> {
  if (typeof input.id !== 'string' || input.id.length === 0) {
    throw new OptimisticUpdateError('INVALID_RECORD', 'id must be non-empty');
  }
  if (input.current === null || input.current === undefined) {
    throw new OptimisticUpdateError(
      'MISSING_SNAPSHOT',
      'an optimistic update requires a current canonical snapshot',
    );
  }

  const { optimistic, changedFields } = validateOptimisticPatch(
    input.operationId,
    input.current,
    input.patch,
  );

  return Object.freeze({
    id: input.id,
    operationId: input.operationId,
    queryKey: Object.freeze([...input.queryKey]),
    previous: input.current,
    optimistic,
    changedFields: Object.freeze([...changedFields]),
    createdAt: input.now ?? Date.now(),
    status: 'pending',
    rollbackReason: null,
  });
}

/**
 * Withdraw an optimistic overlay and restore the exact prior object.
 * `data === record.previous` by design.
 */
export function rollbackOptimisticUpdate<T>(
  record: OptimisticUpdateRecord<T>,
  reason: CanonicalFailureReason,
): OptimisticRollback<T> {
  if (record.status !== 'pending') {
    throw new OptimisticUpdateError(
      'INVALID_RECORD',
      `only a pending optimistic update can roll back (got ${record.status})`,
    );
  }
  return {
    data: record.previous,
    record: Object.freeze({
      ...record,
      status: 'rolled-back',
      rollbackReason: reason,
    }),
  };
}

/**
 * Mark the overlay as committed against canonical authority. The caller must
 * already have observed the canonical projection; this function never invents
 * an outcome.
 */
export function commitOptimisticUpdate<T>(
  record: OptimisticUpdateRecord<T>,
): OptimisticUpdateRecord<T> {
  if (record.status !== 'pending') {
    throw new OptimisticUpdateError(
      'INVALID_RECORD',
      `only a pending optimistic update can commit (got ${record.status})`,
    );
  }
  return Object.freeze({
    ...record,
    status: 'committed',
    rollbackReason: null,
  });
}

/**
 * Reconcile an in-flight overlay against a canonical projection.
 *
 * - canonical reflects every optimistic value -> commit
 * - canonical still shows every prior value -> keep waiting
 * - canonical differs from both -> projection contradiction -> rollback
 * - canonical is missing/opaque -> fail closed and rollback
 */
export function reconcileOptimisticUpdate<T extends object>(
  record: OptimisticUpdateRecord<T>,
  canonical: T | null | undefined,
): OptimisticReconciliation<T> {
  if (record.status !== 'pending') {
    throw new OptimisticUpdateError(
      'INVALID_RECORD',
      `only a pending optimistic update can reconcile (got ${record.status})`,
    );
  }

  if (canonical === null || canonical === undefined) {
    const rolled = rollbackOptimisticUpdate(record, 'projection-contradiction');
    return {
      action: 'rollback',
      data: rolled.data,
      record: rolled.record,
      reason: 'projection-contradiction',
    };
  }

  const canonicalRecord = canonical as unknown as Record<string, unknown>;
  const previousRecord = record.previous as unknown as Record<string, unknown>;
  const optimisticRecord = record.optimistic as unknown as Record<string, unknown>;

  let allOptimistic = true;
  for (const field of record.changedFields) {
    const value = canonicalRecord[field];
    if (!Object.is(value, optimisticRecord[field])) {
      allOptimistic = false;
    }
    if (
      !Object.is(value, optimisticRecord[field]) &&
      !Object.is(value, previousRecord[field])
    ) {
      const rolled = rollbackOptimisticUpdate(record, 'projection-contradiction');
      return {
        action: 'rollback',
        data: rolled.data,
        record: rolled.record,
        reason: 'projection-contradiction',
      };
    }
  }

  if (allOptimistic) {
    return {
      action: 'commit',
      data: canonical,
      record: commitOptimisticUpdate(record),
    };
  }

  return { action: 'keep', data: canonical, record };
}

/**
 * Map a transaction terminal state to the required optimistic action.
 *
 * Canonical failure withdraws the overlay. Finalization clears it because the
 * canonical projection is now authoritative; no optimistic finality is ever
 * displayed.
 */
export function resolveOptimisticTransactionDecision(
  status: OptimisticTransactionStatus,
): OptimisticTransactionDecision {
  const reason = TRANSACTION_ROLLBACK_REASONS[status];
  if (reason) {
    return { action: 'rollback', reason };
  }
  if (status === 'finalized') {
    return { action: 'commit', reason: null };
  }
  return { action: 'none', reason: null };
}

/** Convenience predicate for callers that render a pending affordance. */
export function isOptimisticFailureStatus(
  status: TransactionStatus | 'rejected',
): boolean {
  return resolveOptimisticTransactionDecision(status).action === 'rollback';
}
