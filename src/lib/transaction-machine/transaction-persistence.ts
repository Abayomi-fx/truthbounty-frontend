/**
 * V2-FE-009 — Shared Transaction State Machine
 * localStorage persistence helpers for reload recovery.
 *
 * Security / integrity rules:
 *  - Stored data is schema-validated before being trusted
 *  - Schema version mismatch returns null (stale records discarded)
 *  - Corrupt JSON returns null (never throws to caller)
 *  - BigInt (blockNumber) is safely serialized and deserialized
 *  - No mock/fabricated data is ever stored
 */

import type { TransactionContext, TransactionState, TransactionStatus } from './transaction-machine.types';
import { createIdleState } from './transaction-machine.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_PREFIX = 'tb-tx-v2:';
const SCHEMA_VERSION = 2 as const;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_STATUSES = new Set<TransactionStatus>([
  'idle',
  'preparing',
  'signature-requested',
  'submitted',
  'confirming',
  'safe',
  'indexing',
  'finalized',
  'dropped',
  'replaced',
  'reverted',
  'reorged',
]);

function isValidStatus(v: unknown): v is TransactionStatus {
  return typeof v === 'string' && VALID_STATUSES.has(v as TransactionStatus);
}

function isValidHex(v: unknown): v is `0x${string}` {
  return typeof v === 'string' && /^0x[0-9a-fA-F]+$/.test(v);
}

/**
 * Validate that a raw parsed object has the correct schema and reconstructs BigInt fields.
 */
function validateContext(raw: unknown): TransactionContext | null {
  if (!raw || typeof raw !== 'object') return null;

  const obj = raw as Record<string, unknown>;

  // Version guard — must match exactly
  if (obj['schemaVersion'] !== SCHEMA_VERSION) return null;

  if (typeof obj['id'] !== 'string' || obj['id'].length === 0) return null;
  if (typeof obj['label'] !== 'string') return null;
  if (typeof obj['createdAt'] !== 'number') return null;
  if (typeof obj['updatedAt'] !== 'number') return null;
  if (!obj['state'] || typeof obj['state'] !== 'object') return null;

  const rawState = obj['state'] as Record<string, unknown>;
  if (!isValidStatus(rawState['status'])) return null;

  // Validate txHash when present
  if (rawState['txHash'] !== null && !isValidHex(rawState['txHash'])) return null;

  // Validate chainId when present
  if (
    rawState['chainId'] !== null &&
    typeof rawState['chainId'] !== 'number'
  ) return null;

  // Reconstruct blockNumber as BigInt when present
  let blockNumber: bigint | null = null;
  if (rawState['blockNumber'] !== null && rawState['blockNumber'] !== undefined) {
    try {
      blockNumber = BigInt(rawState['blockNumber'] as string | number);
    } catch {
      return null;
    }
  }

  const state: TransactionState = {
    ...rawState,
    blockNumber,
  } as unknown as TransactionState;

  return {
    id: obj['id'] as string,
    schemaVersion: SCHEMA_VERSION,
    label: obj['label'] as string,
    createdAt: obj['createdAt'] as number,
    updatedAt: obj['updatedAt'] as number,
    state,
  };
}

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

function storageKey(id: string): string {
  return `${STORAGE_KEY_PREFIX}${id}`;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persist a transaction context snapshot to localStorage.
 * Safe to call server-side (no-op when `window` is undefined).
 */
export function persistTxState(ctx: TransactionContext): void {
  if (!isBrowser()) return;
  try {
    const serialized = JSON.stringify(ctx, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    window.localStorage.setItem(storageKey(ctx.id), serialized);
  } catch {
    // Storage quota exceeded or private-browsing restrictions — silently ignore
  }
}

/**
 * Hydrate a persisted transaction context from localStorage.
 * Returns `null` if:
 *  - No entry exists for the given id
 *  - JSON is malformed
 *  - Schema version does not match (stale record)
 *  - Any required field is missing or of the wrong type
 *
 * Never throws.
 */
export function hydrateTxState(id: string): TransactionContext | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    if (!raw) return null;
    return validateContext(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Remove a persisted transaction context from localStorage.
 * Called after terminal success (finalized) is acknowledged or upon reset.
 */
export function clearTxState(id: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(storageKey(id));
  } catch {
    // ignore
  }
}

/**
 * List all persisted transaction context IDs from localStorage.
 * Useful for enumerating pending transactions on app startup.
 * Invalid / stale records are automatically skipped.
 */
export function listPersistedTxIds(): string[] {
  if (!isBrowser()) return [];
  const ids: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        const id = key.slice(STORAGE_KEY_PREFIX.length);
        // Only include if it hydrates cleanly (schema-valid)
        if (hydrateTxState(id) !== null) {
          ids.push(id);
        }
      }
    }
  } catch {
    // ignore
  }
  return ids;
}

/**
 * Build a fresh TransactionContext for a new transaction.
 * The initial state is always `idle`.
 */
export function createTxContext(id: string, label: string): TransactionContext {
  const now = Date.now();
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    state: createIdleState(),
    label,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Return an updated context with the new state and an updated timestamp.
 * Does not write to localStorage — call `persistTxState` separately.
 */
export function updateTxContext(
  ctx: TransactionContext,
  nextState: TransactionState,
): TransactionContext {
  return {
    ...ctx,
    state: nextState,
    updatedAt: Date.now(),
  };
}
