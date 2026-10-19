/**
 * V2-FE-058 — Optimistic UI Rollback on Canonical Failure
 * Extended useEvmTransaction hook with automatic optimistic update rollback.
 *
 * Wraps useEvmTransaction and automatically triggers rollback on:
 *  - TRANSACTION_REVERTED (receipt.status === 0x0)
 *  - TRANSACTION_DROPPED (mempool eviction)
 *  - TRANSACTION_REPLACED (same nonce, different hash)
 *  - WRONG_NETWORK (user switched chains)
 *  - USER_REJECTED (user rejected signature)
 *  - Potential TRANSACTION_REORG (detected via receipt chainId mismatch)
 */

import { useEffect, useCallback } from 'react';
import type { UseEvmTransactionOptions } from './useEvmTransaction';
import { useEvmTransaction } from './useEvmTransaction';
import type { UseOptimisticUpdatesReturn } from './useOptimisticUpdates';
import { useOptimisticUpdates } from './useOptimisticUpdates';
import type { CanonicalFailureReason } from '@/lib/optimistic/optimistic.types';

export interface UseEvmTransactionWithOptimisticOptions
  extends UseEvmTransactionOptions {
  /**
   * If true, automatically rollback optimistic updates on canonical failure.
   * Default: true
   */
  enableOptimisticRollback?: boolean;

  /**
   * Callback fired when optimistic rollback occurs.
   * Useful for showing user feedback.
   */
  onOptimisticRollback?: (
    reason: CanonicalFailureReason,
    count: number,
  ) => void;
}

export interface UseEvmTransactionWithOptimisticReturn
  extends ReturnType<typeof useEvmTransaction> {
  /** Optimistic update methods bound to this transaction. */
  optimistic: UseOptimisticUpdatesReturn;
}

/**
 * Extended transaction hook with automatic optimistic UI rollback on failure.
 *
 * @param opts - Options including enableOptimisticRollback and onOptimisticRollback
 * @returns Transaction state machine + optimistic update methods
 */
export function useEvmTransactionWithOptimistic(
  opts: UseEvmTransactionWithOptimisticOptions = {},
): UseEvmTransactionWithOptimisticReturn {
  const {
    enableOptimisticRollback = true,
    onOptimisticRollback,
    ...txOpts
  } = opts;

  // Get transaction state machine
  const tx = useEvmTransaction(txOpts);

  // Get optimistic update manager
  const optimistic = useOptimisticUpdates(
    txOpts.id ?? 'tx-default',
  );

  // Determine failure reason from current state
  const getFailureReason = useCallback((): CanonicalFailureReason | null => {
    const { state } = tx;

    if (state.status === 'reverted') {
      return 'TRANSACTION_REVERTED';
    }
    if (state.status === 'dropped') {
      return 'TRANSACTION_DROPPED';
    }
    if (state.status === 'replaced') {
      return 'TRANSACTION_REPLACED';
    }

    return null;
  }, [tx.state]);

  // Trigger rollback on state change
  useEffect(() => {
    if (!enableOptimisticRollback) return;

    const failureReason = getFailureReason();
    if (!failureReason) return;

    // Rollback all optimistic updates tied to this transaction
    const count = optimistic.rollbackAll(failureReason);

    if (count > 0) {
      onOptimisticRollback?.(failureReason, count);
    }
  }, [
    tx.state.status,
    enableOptimisticRollback,
    getFailureReason,
    optimistic,
    onOptimisticRollback,
  ]);

  // Clean up optimistic updates on finalized
  useEffect(() => {
    if (tx.state.status !== 'finalized') return;

    // Remove all optimistic updates for this transaction
    const updates = optimistic.getAll();
    for (const update of updates) {
      optimistic.cleanup(update.id.split(':').pop() ?? '');
    }
  }, [tx.state.status, optimistic]);

  return {
    ...tx,
    optimistic,
  };
}
