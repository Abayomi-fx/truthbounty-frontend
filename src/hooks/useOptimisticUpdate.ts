'use client';

/**
 * UI-FE-086 — React Query adapter for the explicit optimistic-update boundary.
 *
 * The hook never allows an arbitrary cache write. Callers must name an
 * allowlisted operation, and every overlay is journaled so a refresh or a
 * concurrent tab can withdraw it instead of showing stale anticipated state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  beginOptimisticUpdate,
  buildOptimisticUpdateId,
  commitOptimisticUpdate,
  readOptimisticJournal,
  reconcileOptimisticUpdate,
  removeOptimisticJournalRecord,
  resolveOptimisticTransactionDecision,
  restorePreviousValues,
  rollbackOptimisticUpdate,
  toOptimisticJournalRecord,
  upsertOptimisticJournalRecord,
  type CanonicalFailureReason,
  type OptimisticOperationId,
  type OptimisticReconciliation,
  type OptimisticTransactionDecision,
  type OptimisticTransactionStatus,
  type OptimisticUpdateRecord,
  OptimisticUpdateError,
} from '@/lib/optimistic-updates';

export interface UseOptimisticUpdateOptions {
  readonly operationId: OptimisticOperationId;
  readonly queryKey: readonly unknown[];
  /** Injectable for tests; defaults to localStorage when available. */
  readonly storage?: Storage | null;
  /** Injectable event target for tests; defaults to window. */
  readonly eventTarget?: EventTarget | null;
  /** Injectable clock for deterministic tests. */
  readonly now?: () => number;
}

export interface UseOptimisticUpdateResult<T extends object> {
  readonly record: OptimisticUpdateRecord<T> | null;
  readonly isPending: boolean;
  readonly begin: (patch: Record<string, unknown>) => OptimisticUpdateRecord<T>;
  readonly rollback: (reason?: CanonicalFailureReason) => OptimisticUpdateRecord<T> | null;
  readonly commit: () => OptimisticUpdateRecord<T> | null;
  readonly reconcile: (canonical: T | null | undefined) => OptimisticReconciliation<T> | null;
  readonly handleTransactionStatus: (
    status: OptimisticTransactionStatus,
  ) => OptimisticTransactionDecision;
}

function defaultStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function defaultEventTarget(): EventTarget | null {
  return typeof window !== 'undefined' ? window : null;
}

export function useOptimisticUpdate<T extends object>(
  options: UseOptimisticUpdateOptions,
): UseOptimisticUpdateResult<T> {
  const queryClient = useQueryClient();
  const [record, setRecord] = useState<OptimisticUpdateRecord<T> | null>(null);
  const recordRef = useRef<OptimisticUpdateRecord<T> | null>(null);
  const queryKeyRef = useRef(options.queryKey);
  queryKeyRef.current = options.queryKey;

  const now = options.now ?? Date.now;
  const nowRef = useRef(now);
  nowRef.current = now;

  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const eventTarget =
    options.eventTarget === undefined ? defaultEventTarget() : options.eventTarget;

  const serializedQueryKey = JSON.stringify(options.queryKey);
  const journalId = useMemo(
    () => buildOptimisticUpdateId(options.operationId, options.queryKey),
    // The serialized key is the stable identity of the query key tuple.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.operationId, serializedQueryKey],
  );

  const clearRecord = useCallback(() => {
    recordRef.current = null;
    setRecord(null);
  }, []);

  // A pending overlay must not survive a refresh or a remount without a
  // canonical confirmation. Restore the prior presentation values when the
  // cache still shows the optimistic ones, then refetch canonical state.
  useEffect(() => {
    const journal = readOptimisticJournal(storage, nowRef.current());
    const existing = journal.find((entry) => entry.id === journalId);
    if (!existing) return;

    const current = queryClient.getQueryData<T>(queryKeyRef.current);
    const restored = restorePreviousValues(current, existing);
    if (restored !== undefined && restored !== current) {
      queryClient.setQueryData(queryKeyRef.current, restored);
    }
    removeOptimisticJournalRecord(storage, journalId, nowRef.current());
    clearRecord();
    void queryClient.invalidateQueries({ queryKey: queryKeyRef.current });
  }, [journalId, storage, queryClient, clearRecord]);

  // If another tab commits or rolls back the same operation, withdraw this
  // tab's overlay and converge on canonical data.
  useEffect(() => {
    if (!eventTarget) return;

    const onStorage = () => {
      const active = recordRef.current;
      if (!active) return;
      const journal = readOptimisticJournal(storage, nowRef.current());
      if (journal.some((entry) => entry.id === active.id)) return;

      queryClient.setQueryData(active.queryKey, active.previous);
      clearRecord();
      void queryClient.invalidateQueries({ queryKey: active.queryKey });
    };

    eventTarget.addEventListener('storage', onStorage);
    return () => eventTarget.removeEventListener('storage', onStorage);
  }, [eventTarget, storage, queryClient, clearRecord]);

  const begin = useCallback(
    (patch: Record<string, unknown>): OptimisticUpdateRecord<T> => {
      if (recordRef.current) {
        throw new OptimisticUpdateError(
          'UPDATE_ALREADY_ACTIVE',
          'an optimistic update is already active for this query key',
        );
      }

      const current = queryClient.getQueryData<T>(queryKeyRef.current);
      if (current === null || current === undefined) {
        throw new OptimisticUpdateError(
          'MISSING_SNAPSHOT',
          'cannot apply an optimistic update without a current snapshot',
        );
      }

      const next = beginOptimisticUpdate<T>({
        id: journalId,
        operationId: options.operationId,
        queryKey: queryKeyRef.current,
        current,
        patch,
        now: nowRef.current(),
      });

      queryClient.setQueryData(queryKeyRef.current, next.optimistic);
      upsertOptimisticJournalRecord(
        storage,
        toOptimisticJournalRecord(next),
        nowRef.current(),
      );
      recordRef.current = next;
      setRecord(next);
      return next;
    },
    [queryClient, journalId, options.operationId, storage],
  );

  const rollback = useCallback(
    (reason: CanonicalFailureReason = 'rejected'): OptimisticUpdateRecord<T> | null => {
      const active = recordRef.current;
      if (!active) {
        removeOptimisticJournalRecord(storage, journalId, nowRef.current());
        return null;
      }

      const rolled = rollbackOptimisticUpdate(active, reason);
      queryClient.setQueryData(active.queryKey, rolled.data);
      removeOptimisticJournalRecord(storage, active.id, nowRef.current());
      clearRecord();
      void queryClient.invalidateQueries({ queryKey: active.queryKey });
      return rolled.record;
    },
    [queryClient, storage, journalId, clearRecord],
  );

  const commit = useCallback((): OptimisticUpdateRecord<T> | null => {
    const active = recordRef.current;
    if (!active) {
      removeOptimisticJournalRecord(storage, journalId, nowRef.current());
      return null;
    }

    const committed = commitOptimisticUpdate(active);
    removeOptimisticJournalRecord(storage, active.id, nowRef.current());
    clearRecord();
    // Never invent a canonical outcome: refetch and let the API projection
    // (or a receipt-driven caller) provide the authoritative value.
    void queryClient.invalidateQueries({ queryKey: active.queryKey });
    return committed;
  }, [queryClient, storage, journalId, clearRecord]);

  const reconcile = useCallback(
    (canonical: T | null | undefined): OptimisticReconciliation<T> | null => {
      const active = recordRef.current;
      if (!active) return null;

      const result = reconcileOptimisticUpdate(active, canonical);
      if (result.action === 'keep') {
        return result;
      }

      removeOptimisticJournalRecord(storage, active.id, nowRef.current());
      clearRecord();

      if (result.action === 'rollback') {
        queryClient.setQueryData(active.queryKey, result.data);
        void queryClient.invalidateQueries({ queryKey: active.queryKey });
      } else {
        queryClient.setQueryData(active.queryKey, result.data);
      }
      return result;
    },
    [queryClient, storage, clearRecord],
  );

  const handleTransactionStatus = useCallback(
    (status: OptimisticTransactionStatus): OptimisticTransactionDecision => {
      const decision = resolveOptimisticTransactionDecision(status);
      if (decision.action === 'rollback' && decision.reason) {
        rollback(decision.reason);
      } else if (decision.action === 'commit') {
        commit();
      }
      return decision;
    },
    [rollback, commit],
  );

  return {
    record,
    isPending: record !== null,
    begin,
    rollback,
    commit,
    reconcile,
    handleTransactionStatus,
  };
}
