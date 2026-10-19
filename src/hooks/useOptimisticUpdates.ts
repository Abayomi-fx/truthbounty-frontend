/**
 * V2-FE-058 — Optimistic UI Rollback on Canonical Failure
 * React hook for creating and managing reversible optimistic updates.
 *
 * Usage pattern:
 *  const { optimistic, rollbackAll } = useOptimisticUpdates('claim-1:create');
 *
 *  // Create reversible optimistic state
 *  optimistic('update-1', {
 *    label: 'Optimistic claim display',
 *    optimisticState: { claimId: 'temp-1', status: 'pending' },
 *    rollback: () => {
 *      setDisplayClaim(null);
 *    }
 *  });
 *
 *  // On canonical failure (detected by transaction state machine):
 *  rollbackAll('TRANSACTION_REVERTED');
 */

import { useCallback, useRef, useEffect } from 'react';
import type {
  OptimisticUpdateConfig,
  OptimisticUpdateResult,
  CanonicalFailureReason,
  OptimisticUpdate,
} from '@/lib/optimistic/optimistic.types';
import {
  getGlobalOptimisticStore,
  type OptimisticUpdateStore,
} from '@/lib/optimistic/optimistic-store';

export interface UseOptimisticUpdatesOptions {
  /** Optional custom store (defaults to global singleton). */
  store?: OptimisticUpdateStore;
  /** Called when any rollback occurs. */
  onRollback?: (reason: CanonicalFailureReason, update: OptimisticUpdate) => void;
}

export interface UseOptimisticUpdatesReturn {
  /** Create a reversible optimistic update. */
  optimistic: <T>(
    id: string,
    config: Omit<OptimisticUpdateConfig<T>, 'id'>,
  ) => OptimisticUpdateResult<T>;

  /** Rollback all updates tied to this transaction. */
  rollbackAll: (reason: CanonicalFailureReason) => number;

  /** Rollback a specific update. */
  rollbackOne: (id: string, reason: CanonicalFailureReason) => boolean;

  /** Get all active optimistic updates. */
  getAll: () => OptimisticUpdate[];

  /** Get a specific optimistic update. */
  getOne: <T>(id: string) => OptimisticUpdate<T> | null;

  /** Clean up an optimistic update (after finalized). */
  cleanup: (id: string) => boolean;

  /** Clear all updates (for testing/cleanup). */
  clear: () => void;
}

/**
 * Hook for creating and managing reversible optimistic updates.
 *
 * @param txId - Transaction identifier (used to group related updates)
 * @param options - Configuration options
 * @returns Methods to create, query, and rollback optimistic updates
 */
export function useOptimisticUpdates(
  txId: string,
  options?: UseOptimisticUpdatesOptions,
): UseOptimisticUpdatesReturn {
  const storeRef = useRef<OptimisticUpdateStore>();
  const onRollbackRef = useRef(options?.onRollback);

  // Initialize store on first render
  if (!storeRef.current) {
    storeRef.current = options?.store ?? getGlobalOptimisticStore();
  }

  // Update callback reference
  useEffect(() => {
    onRollbackRef.current = options?.onRollback;
  }, [options?.onRollback]);

  // Register callback listener
  useEffect(() => {
    if (!onRollbackRef.current) return;

    const store = storeRef.current!;
    const unsubscribe = store.onRollback((reason, update) => {
      onRollbackRef.current?.(reason, update);
    });

    return unsubscribe;
  }, []);

  const optimistic = useCallback(
    <T,>(
      id: string,
      config: Omit<OptimisticUpdateConfig<T>, 'id'>,
    ): OptimisticUpdateResult<T> => {
      const fullConfig: OptimisticUpdateConfig<T> = {
        ...config,
        id: `${txId}:${id}`,
      };
      return storeRef.current!.add(fullConfig);
    },
    [txId],
  );

  const rollbackAll = useCallback(
    (reason: CanonicalFailureReason): number => {
      const store = storeRef.current!;
      const updates = store.getAll();

      // Filter updates tied to this transaction
      let count = 0;
      for (const update of updates) {
        if (update.id.startsWith(`${txId}:`)) {
          if (store.rollback(update.id, reason)) {
            count++;
          }
        }
      }
      return count;
    },
    [txId],
  );

  const rollbackOne = useCallback(
    (id: string, reason: CanonicalFailureReason): boolean => {
      return storeRef.current!.rollback(`${txId}:${id}`, reason);
    },
    [txId],
  );

  const getAll = useCallback(() => {
    const store = storeRef.current!;
    const updates = store.getAll();
    return updates.filter((u) => u.id.startsWith(`${txId}:`));
  }, [txId]);

  const getOne = useCallback(
    <T,>(id: string): OptimisticUpdate<T> | null => {
      return storeRef.current!.get(`${txId}:${id}`) as OptimisticUpdate<T> | null;
    },
    [txId],
  );

  const cleanup = useCallback(
    (id: string): boolean => {
      return storeRef.current!.remove(`${txId}:${id}`);
    },
    [txId],
  );

  const clear = useCallback(() => {
    const store = storeRef.current!;
    const updates = store.getAll();
    for (const update of updates) {
      if (update.id.startsWith(`${txId}:`)) {
        store.remove(update.id);
      }
    }
  }, [txId]);

  return {
    optimistic,
    rollbackAll,
    rollbackOne,
    getAll,
    getOne,
    cleanup,
    clear,
  };
}
