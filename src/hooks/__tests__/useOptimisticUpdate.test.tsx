import { beforeEach, describe, expect, it } from '@jest/globals';

/**
 * UI-FE-086 — React Query optimistic boundary tests.
 *
 * Verifies cache application, exact rollback, terminal-state handling,
 * refresh recovery, concurrent-tab recovery, and projection contradictions.
 */

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOptimisticUpdate } from '@/hooks/useOptimisticUpdate';
import {
  OPTIMISTIC_UPDATE_JOURNAL_KEY,
  readOptimisticJournal,
  removeOptimisticJournalRecord,
  upsertOptimisticJournalRecord,
  type OptimisticJournalRecord,
} from '@/lib/optimistic-updates';
import { OptimisticUpdateError } from '@/lib/optimistic-updates/types';
import type { Claim } from '@/app/types/claim';

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const QUERY_KEY = ['claims', 'claim-1'] as const;
const JOURNAL_ID = 'claim.status.under_review:["claims","claim-1"]';
const NOW = 1_000_000;

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 'claim-1',
    title: 'A claim',
    description: 'Description',
    claimantAddress: '0x0000000000000000000000000000000000000001',
    status: 'OPEN',
    bountyAmount: 100,
    totalStaked: 10,
    evidence: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function setup(options: { storage?: Storage; eventTarget?: EventTarget } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const storage = options.storage ?? new MemoryStorage();
  const eventTarget = options.eventTarget ?? new EventTarget();

  const rendered = renderHook(
    () =>
      useOptimisticUpdate<Claim>({
        operationId: 'claim.status.under_review',
        queryKey: QUERY_KEY,
        storage,
        eventTarget,
        now: () => NOW,
      }),
    { wrapper: createWrapper(queryClient) },
  );

  return { ...rendered, queryClient, storage, eventTarget };
}

function journalRecord(): OptimisticJournalRecord {
  return {
    id: JOURNAL_ID,
    operationId: 'claim.status.under_review',
    queryKey: QUERY_KEY,
    changedFields: ['status'],
    previousValues: { status: 'OPEN' },
    optimisticValues: { status: 'UNDER_REVIEW' },
    createdAt: NOW,
    status: 'pending',
  };
}

describe('useOptimisticUpdate', () => {
  it('applies the allowlisted overlay and journals metadata', () => {
    const { result, queryClient, storage } = setup();
    const previous = claim();
    queryClient.setQueryData(QUERY_KEY, previous);

    act(() => {
      result.current.begin({ status: 'UNDER_REVIEW' });
    });

    expect((queryClient.getQueryData(QUERY_KEY) as Claim).status).toBe('UNDER_REVIEW');
    expect(result.current.isPending).toBe(true);
    expect(readOptimisticJournal(storage, NOW)).toEqual([journalRecord()]);
  });

  it('rejects non-allowlisted presentation changes', () => {
    const { result, queryClient } = setup();
    queryClient.setQueryData(QUERY_KEY, claim());

    expect(() =>
      act(() => {
        result.current.begin({ status: 'VERIFIED' });
      }),
    ).toThrow(OptimisticUpdateError);

    expect((queryClient.getQueryData(QUERY_KEY) as Claim).status).toBe('OPEN');
    expect(result.current.isPending).toBe(false);
  });

  it('fails closed without a current snapshot', () => {
    const { result } = setup();
    expect(() =>
      act(() => {
        result.current.begin({ status: 'UNDER_REVIEW' });
      }),
    ).toThrow(OptimisticUpdateError);
  });

  it('restores the exact prior snapshot on rollback and clears the journal', () => {
    const { result, queryClient, storage } = setup();
    const previous = claim();
    queryClient.setQueryData(QUERY_KEY, previous);

    act(() => {
      result.current.begin({ status: 'UNDER_REVIEW' });
    });
    act(() => {
      result.current.rollback('reverted');
    });

    expect(queryClient.getQueryData(QUERY_KEY)).toStrictEqual(previous);
    expect(result.current.isPending).toBe(false);
    expect(readOptimisticJournal(storage, NOW)).toEqual([]);
  });

  it.each(['rejected', 'reverted', 'replaced', 'dropped', 'reorged'] as const)(
    'rolls back on transaction terminal failure "%s"',
    (status) => {
      const { result, queryClient, storage } = setup();
      const previous = claim();
      queryClient.setQueryData(QUERY_KEY, previous);

      act(() => {
        result.current.begin({ status: 'UNDER_REVIEW' });
      });
      act(() => {
        result.current.handleTransactionStatus(status);
      });

      expect(queryClient.getQueryData(QUERY_KEY)).toStrictEqual(previous);
      expect(result.current.isPending).toBe(false);
      expect(readOptimisticJournal(storage, NOW)).toEqual([]);
    },
  );

  it('withdraws the overlay on finalized without fabricating a final outcome', () => {
    const { result, queryClient, storage } = setup();
    queryClient.setQueryData(QUERY_KEY, claim());

    act(() => {
      result.current.begin({ status: 'UNDER_REVIEW' });
    });
    act(() => {
      result.current.handleTransactionStatus('finalized');
    });

    expect(result.current.isPending).toBe(false);
    expect(readOptimisticJournal(storage, NOW)).toEqual([]);
  });

  it('rolls back on projection contradiction', () => {
    const { result, queryClient } = setup();
    const previous = claim();
    queryClient.setQueryData(QUERY_KEY, previous);

    act(() => {
      result.current.begin({ status: 'UNDER_REVIEW' });
    });
    act(() => {
      result.current.reconcile(claim({ status: 'VERIFIED' }));
    });

    expect(queryClient.getQueryData(QUERY_KEY)).toStrictEqual(previous);
    expect(result.current.isPending).toBe(false);
  });

  it('restores prior values after a refresh and removes the pending journal entry', async () => {
    const storage = new MemoryStorage();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(QUERY_KEY, claim({ status: 'UNDER_REVIEW' }));
    upsertOptimisticJournalRecord(storage, journalRecord(), NOW);

    const { result } = renderHook(
      () =>
        useOptimisticUpdate<Claim>({
          operationId: 'claim.status.under_review',
          queryKey: QUERY_KEY,
          storage,
          eventTarget: new EventTarget(),
          now: () => NOW,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect((queryClient.getQueryData(QUERY_KEY) as Claim).status).toBe('OPEN');
      expect(readOptimisticJournal(storage, NOW)).toEqual([]);
    });
    expect(result.current.isPending).toBe(false);
  });

  it('rolls back when a concurrent tab commits or rolls back the same operation', () => {
    const { result, queryClient, storage, eventTarget } = setup();
    const previous = claim();
    queryClient.setQueryData(QUERY_KEY, previous);

    act(() => {
      result.current.begin({ status: 'UNDER_REVIEW' });
    });

    // Simulate another tab resolving the same optimistic operation.
    removeOptimisticJournalRecord(storage, JOURNAL_ID, NOW);
    act(() => {
      eventTarget.dispatchEvent(new Event('storage'));
    });

    expect(queryClient.getQueryData(QUERY_KEY)).toStrictEqual(previous);
    expect(result.current.isPending).toBe(false);
  });

  it('keeps the journal untouched when a concurrent tab is still pending', () => {
    const { result, storage, eventTarget, queryClient } = setup();
    queryClient.setQueryData(QUERY_KEY, claim());

    act(() => {
      result.current.begin({ status: 'UNDER_REVIEW' });
    });
    const journalBefore = storage.getItem(OPTIMISTIC_UPDATE_JOURNAL_KEY);

    act(() => {
      eventTarget.dispatchEvent(new Event('storage'));
    });

    expect(result.current.isPending).toBe(true);
    expect(storage.getItem(OPTIMISTIC_UPDATE_JOURNAL_KEY)).toBe(journalBefore);
  });
});
