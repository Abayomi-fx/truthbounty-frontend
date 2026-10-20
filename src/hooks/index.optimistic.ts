/**
 * V2-FE-058 — Optimistic UI Rollback on Canonical Failure
 * Public API for optimistic UI hooks.
 *
 * Re-export optimistic-related hooks for convenience.
 */

export { useOptimisticUpdates } from './useOptimisticUpdates';
export type { UseOptimisticUpdatesOptions, UseOptimisticUpdatesReturn } from './useOptimisticUpdates';

export { useEvmTransactionWithOptimistic } from './useEvmTransactionWithOptimistic';
export type {
  UseEvmTransactionWithOptimisticOptions,
  UseEvmTransactionWithOptimisticReturn,
} from './useEvmTransactionWithOptimistic';
