/**
 * UI-FE-086 — Bounded, cross-tab optimistic-update journal.
 *
 * The journal stores metadata only (operation, query key, changed field names,
 * and the previous/optimistic primitive values). It never stores the full
 * projection, claim content, evidence, receipts, or wallet material.
 *
 * Reads are fail-closed: corrupt, oversized, expired, unknown-operation, or
 * malformed records are dropped rather than trusted.
 */

import { isAllowedOptimisticOperationId } from './allowlist';
import type {
  OptimisticJournalRecord,
  OptimisticUpdateRecord,
} from './types';

export const OPTIMISTIC_UPDATE_JOURNAL_KEY = 'truthbounty.optimistic-updates.v1';
export const OPTIMISTIC_UPDATE_JOURNAL_VERSION = 1;
export const OPTIMISTIC_UPDATE_JOURNAL_MAX_BYTES = 16 * 1024;
export const OPTIMISTIC_UPDATE_JOURNAL_RETENTION_MS = 5 * 60 * 1000;

interface JournalEnvelope {
  readonly v: typeof OPTIMISTIC_UPDATE_JOURNAL_VERSION;
  readonly records: readonly unknown[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPrimitive(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

function defaultStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isValidRecord(
  value: unknown,
  now: number,
  retentionMs: number,
): value is OptimisticJournalRecord {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (!isAllowedOptimisticOperationId(value.operationId)) return false;
  if (!Array.isArray(value.queryKey) || value.queryKey.length === 0) return false;
  if (!Array.isArray(value.changedFields) || value.changedFields.length === 0) {
    return false;
  }
  if (!value.changedFields.every((field) => typeof field === 'string')) {
    return false;
  }
  if (!isPlainObject(value.previousValues) || !isPlainObject(value.optimisticValues)) {
    return false;
  }
  if (!Object.values(value.previousValues).every(isPrimitive)) return false;
  if (!Object.values(value.optimisticValues).every(isPrimitive)) return false;
  if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) {
    return false;
  }
  if (value.status !== 'pending') return false;
  if (retentionMs > 0 && now - value.createdAt > retentionMs) return false;
  return true;
}

function parseJournal(raw: string | null): unknown[] | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(parsed)) return null;
  const envelope = parsed as Partial<JournalEnvelope>;
  if (envelope.v !== OPTIMISTIC_UPDATE_JOURNAL_VERSION) return null;
  if (!Array.isArray(envelope.records)) return null;
  return envelope.records;
}

/**
 * Read the journal. Unknown/corrupt records are omitted; an unreadable journal
 * is treated as empty. The effective retention is bounded by the caller.
 */
export function readOptimisticJournal(
  storage: Storage | null = defaultStorage(),
  now: number = Date.now(),
  retentionMs: number = OPTIMISTIC_UPDATE_JOURNAL_RETENTION_MS,
): OptimisticJournalRecord[] {
  if (!storage) return [];

  let raw: string | null = null;
  try {
    raw = storage.getItem(OPTIMISTIC_UPDATE_JOURNAL_KEY);
  } catch {
    return [];
  }

  const records = parseJournal(raw);
  if (!records) return [];

  return records.filter((record): record is OptimisticJournalRecord =>
    isValidRecord(record, now, retentionMs),
  );
}

/**
 * Replace the journal. Returns false instead of throwing when storage is
 * unavailable, serialization fails, or the record set exceeds the bound.
 */
export function writeOptimisticJournal(
  storage: Storage | null = defaultStorage(),
  records: readonly OptimisticJournalRecord[],
): boolean {
  if (!storage) return false;
  if (!records.every((record) => isValidRecord(record, Date.now(), 0))) {
    return false;
  }

  const envelope: JournalEnvelope = {
    v: OPTIMISTIC_UPDATE_JOURNAL_VERSION,
    records,
  };

  let serialized: string;
  try {
    serialized = JSON.stringify(envelope);
  } catch {
    return false;
  }

  if (byteLength(serialized) > OPTIMISTIC_UPDATE_JOURNAL_MAX_BYTES) {
    return false;
  }

  try {
    storage.setItem(OPTIMISTIC_UPDATE_JOURNAL_KEY, serialized);
  } catch {
    return false;
  }
  return true;
}

export function upsertOptimisticJournalRecord(
  storage: Storage | null,
  record: OptimisticJournalRecord,
  now: number = Date.now(),
): boolean {
  const existing = readOptimisticJournal(storage, now).filter(
    (entry) => entry.id !== record.id,
  );
  return writeOptimisticJournal(storage, [...existing, record]);
}

export function removeOptimisticJournalRecord(
  storage: Storage | null,
  id: string,
  now: number = Date.now(),
): boolean {
  if (!storage) return false;
  const existing = readOptimisticJournal(storage, now);
  const next = existing.filter((entry) => entry.id !== id);
  if (next.length === existing.length) return true;
  return writeOptimisticJournal(storage, next);
}

export function clearOptimisticJournal(storage: Storage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(OPTIMISTIC_UPDATE_JOURNAL_KEY);
  } catch {
    // Best effort: an unavailable journal must not break the UI.
  }
}

/**
 * Convert an in-memory record to the metadata-only journal shape. Only the
 * changed fields are persisted, and only primitive values are accepted.
 */
export function toOptimisticJournalRecord<T>(
  record: OptimisticUpdateRecord<T>,
): OptimisticJournalRecord {
  const previous = record.previous as unknown as Record<string, unknown>;
  const optimistic = record.optimistic as unknown as Record<string, unknown>;
  const previousValues: Record<string, unknown> = {};
  const optimisticValues: Record<string, unknown> = {};

  for (const field of record.changedFields) {
    const previousValue = previous[field];
    const optimisticValue = optimistic[field];
    if (!isPrimitive(previousValue) || !isPrimitive(optimisticValue)) {
      // Fail closed: non-primitive presentation values are not journaled.
      continue;
    }
    previousValues[field] = previousValue;
    optimisticValues[field] = optimisticValue;
  }

  return Object.freeze({
    id: record.id,
    operationId: record.operationId,
    queryKey: Object.freeze([...record.queryKey]),
    changedFields: Object.freeze(
      record.changedFields.filter((field) => field in previousValues),
    ),
    previousValues: Object.freeze(previousValues),
    optimisticValues: Object.freeze(optimisticValues),
    createdAt: record.createdAt,
    status: 'pending' as const,
  });
}

/**
 * Restore the previous presentation values on a cache snapshot when (and only
 * when) it still shows the optimistic values. Anything else is left untouched
 * and will be replaced by the canonical refetch.
 */
export function restorePreviousValues<T extends object>(
  current: T | null | undefined,
  journalRecord: OptimisticJournalRecord,
): T | null | undefined {
  if (current === null || current === undefined) return current;
  if (!isPlainObject(current)) return current;

  const next: Record<string, unknown> = { ...current };
  for (const field of journalRecord.changedFields) {
    if (Object.is(next[field], journalRecord.optimisticValues[field])) {
      next[field] = journalRecord.previousValues[field];
    }
  }
  return next as T;
}
