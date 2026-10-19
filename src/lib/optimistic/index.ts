/**
 * V2-FE-058 — Optimistic UI Rollback on Canonical Failure
 * Public API for optimistic update management.
 */

export {
  OptimisticUpdateStore,
  getGlobalOptimisticStore,
  resetGlobalOptimisticStore,
} from './optimistic-store';

export type {
  CanonicalFailureReason,
  OptimisticUpdate,
  OptimisticUpdateConfig,
  OptimisticUpdateResult,
  RollbackCallback,
  OptimisticUpdateStore as IOptimisticUpdateStore,
  OptimisticUpdateLifecycle,
} from './optimistic.types';
