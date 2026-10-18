import { beforeEach, describe, expect, it } from '@jest/globals';

/**
 * UI-FE-086 — Bounded optimistic journal tests.
 *
 * The journal is the refresh/concurrent-tab recovery surface. It must remain
 * metadata-only, bounded, and fail closed on untrusted storage content.
 */

import {
  OPTIMISTIC_UPDATE_JOURNAL_KEY,
  clearOptimisticJournal,
  readOptimisticJournal,
  removeOptimisticJournalRecord,
  restorePreviousValues,
  toOptimisticJournalRecord,
  upsertOptimisticJournalRecord,
  writeOptimisticJournal,
} from '@/lib/optimistic-updates/journal';
import type { OptimisticJournalRecord } from '@/lib/optimistic-updates/types';
import { beginOptimisticUpdate } from '@/lib/optimistic-updates/optimistic-update';
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

function journalRecord(): OptimisticJournalRecord {
  return toOptimisticJournalRecord(
    beginOptimisticUpdate<Claim>({
      id: 'claim.status.under_review:["claims","claim-1"]',
      operationId: 'claim.status.under_review',
      queryKey: ['claims', 'claim-1'],
      current: claim(),
      patch: { status: 'UNDER_REVIEW' },
      now: NOW,
    }),
  );
}

describe('optimistic update journal', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('round-trips metadata without persisting the full projection', () => {
    const record = journalRecord();
    expect(upsertOptimisticJournalRecord(storage, record, NOW)).toBe(true);

    const raw = storage.getItem(OPTIMISTIC_UPDATE_JOURNAL_KEY) ?? '';
    expect(raw).not.toContain('Description');
    expect(raw).not.toContain('claimantAddress');
    expect(raw).not.toContain('evidence');

    expect(readOptimisticJournal(storage, NOW)).toEqual([record]);
  });

  it('upserts and removes by id', () => {
    const record = journalRecord();
    upsertOptimisticJournalRecord(storage, record, NOW);
    upsertOptimisticJournalRecord(storage, record, NOW);

    expect(readOptimisticJournal(storage, NOW)).toHaveLength(1);

    expect(removeOptimisticJournalRecord(storage, record.id, NOW)).toBe(true);
    expect(readOptimisticJournal(storage, NOW)).toEqual([]);
  });

  it('drops corrupt and unsupported journal payloads', () => {
    storage.setItem(OPTIMISTIC_UPDATE_JOURNAL_KEY, '{not-json');
    expect(readOptimisticJournal(storage, NOW)).toEqual([]);

    storage.setItem(
      OPTIMISTIC_UPDATE_JOURNAL_KEY,
      JSON.stringify({ v: 99, records: [journalRecord()] }),
    );
    expect(readOptimisticJournal(storage, NOW)).toEqual([]);
  });

  it('drops unknown operations and malformed records', () => {
    const valid = journalRecord();
    const unknown = { ...valid, operationId: 'claim.status.verified' };
    const missingFields = { ...valid, changedFields: [] };

    storage.setItem(
      OPTIMISTIC_UPDATE_JOURNAL_KEY,
      JSON.stringify({ v: 1, records: [valid, unknown, missingFields] }),
    );

    expect(readOptimisticJournal(storage, NOW)).toEqual([valid]);
  });

  it('drops expired records', () => {
    const record = journalRecord();
    writeOptimisticJournal(storage, [record]);

    expect(readOptimisticJournal(storage, NOW + 5 * 60 * 1000 + 1)).toEqual([]);
  });

  it('is a no-op without storage and never throws', () => {
    expect(readOptimisticJournal(null, NOW)).toEqual([]);
    expect(writeOptimisticJournal(null, [journalRecord()])).toBe(false);
    expect(upsertOptimisticJournalRecord(null, journalRecord(), NOW)).toBe(false);
    expect(removeOptimisticJournalRecord(null, 'missing', NOW)).toBe(false);
    expect(() => clearOptimisticJournal(null)).not.toThrow();
  });

  it('restores prior values only when the cache still shows the optimistic value', () => {
    const record = journalRecord();

    expect(restorePreviousValues(claim({ status: 'UNDER_REVIEW' }), record)).toEqual(
      claim({ status: 'OPEN' }),
    );
    // Canonical already moved on: leave the canonical value intact.
    expect(restorePreviousValues(claim({ status: 'VERIFIED' }), record)).toEqual(
      claim({ status: 'VERIFIED' }),
    );
    expect(restorePreviousValues(null, record)).toBeNull();
    expect(restorePreviousValues(undefined, record)).toBeUndefined();
  });
});
