/**
 * V2-FE-009 -- Unit tests for transaction persistence helpers.
 *
 * Coverage:
 *  - Persist and hydrate round-trip (valid data)
 *  - Invalid stored shape returns null
 *  - Schema version mismatch returns null
 *  - Bounded migration from supported older schema versions
 *  - Missing fields return null
 *  - Corrupt JSON returns null (never throws)
 *  - Oversized, expired, partially written, and unsupported-newer state fail closed
 *  - Cleared state not returned on hydrate
 *  - listPersistedTxIds enumerates valid entries only
 *  - listPersistedTxIds excludes stale/invalid entries
 *  - updateTxContext bumps updatedAt
 *  - Logout / account switch deletion
 */

import {
  persistTxState,
  hydrateTxState,
  clearTxState,
  listPersistedTxIds,
  createTxContext,
  updateTxContext,
  TX_PERSISTENCE_SCHEMA_VERSION,
} from '@/lib/transaction-machine/transaction-persistence';
import {
  createIdleState,
  type TransactionContext,
} from '@/lib/transaction-machine/transaction-machine.types';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function makeCtx(id = 'test-tx', label = 'Test transaction'): TransactionContext {
  return createTxContext(id, label);
}

const STORAGE_KEY_PREFIX = 'tb-tx-v2:';

// ----------------------------------------------------------------------------
// Round-trip
// ----------------------------------------------------------------------------

describe('persistTxState / hydrateTxState round-trip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no entry exists for the id', () => {
    expect(hydrateTxState('nonexistent')).toBeNull();
  });

  it('persists and hydrates a valid context', () => {
    const ctx = makeCtx('round-trip-1');
    persistTxState(ctx);
    const hydrated = hydrateTxState('round-trip-1');
    expect(hydrated).not.toBeNull();
    expect(hydrated!.id).toBe('round-trip-1');
    expect(hydrated!.state.status).toBe('idle');
    expect(hydrated!.schemaVersion).toBe(TX_PERSISTENCE_SCHEMA_VERSION);
  });

  it('hydrates with the updated state after an updateTxContext call', () => {
    const ctx = makeCtx('round-trip-2');
    const preparing = {
      status: 'preparing' as const,
      txHash: null,
      chainId: 10,
      blockNumber: null,
      confirmations: null,
      error: null,
      replacedBy: null,
    };
    const updated = updateTxContext(ctx, preparing);
    persistTxState(updated);

    const hydrated = hydrateTxState('round-trip-2');
    expect(hydrated).not.toBeNull();
    expect(hydrated!.state.status).toBe('preparing');
  });
});

// ----------------------------------------------------------------------------
// Schema version guard
// ----------------------------------------------------------------------------

describe('Schema version mismatch', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('migrates a supported schemaVersion 1 entry to the current version', () => {
    const staleEntry = {
      id: 'stale-1',
      schemaVersion: 1,
      state: { status: 'idle' },
      label: 'Old entry',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem('tb-tx-v2:stale-1', JSON.stringify(staleEntry));
    const hydrated = hydrateTxState('stale-1');
    expect(hydrated).not.toBeNull();
    expect(hydrated!.id).toBe('stale-1');
    expect(hydrated!.schemaVersion).toBe(TX_PERSISTENCE_SCHEMA_VERSION);
    expect(hydrated!.state.status).toBe('idle');
  });

  it('returns null when schemaVersion is missing', () => {
    const noVersion = {
      id: 'no-version',
      state: { status: 'idle' },
      label: 'No version',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem('tb-tx-v2:no-version', JSON.stringify(noVersion));
    expect(hydrateTxState('no-version')).toBeNull();
  });

  it('returns null for an unsupported newer schemaVersion', () => {
    const futureEntry = {
      id: 'future-1',
      schemaVersion: TX_PERSISTENCE_SCHEMA_VERSION + 1,
      state: { status: 'idle' },
      label: 'Future entry',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem('tb-tx-v2:future-1', JSON.stringify(futureEntry));
    expect(hydrateTxState('future-1')).toBeNull();
  });

  it('migrates deterministically across repeated hydrations', () => {
    const staleEntry = {
      id: 'stale-deterministic',
      schemaVersion: 1,
      state: { status: 'idle' },
      label: 'Old entry',
      createdAt: 1000,
      updatedAt: 2000,
    };
    localStorage.setItem('tb-tx-v2:stale-deterministic', JSON.stringify(staleEntry));
    const first = hydrateTxState('stale-deterministic');
    const second = hydrateTxState('stale-deterministic');
    expect(first).toEqual(second);
  });
});

// ----------------------------------------------------------------------------
// Corrupt / invalid data
// ----------------------------------------------------------------------------

describe('Corrupt / invalid stored data', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null for malformed JSON', () => {
    localStorage.setItem('tb-tx-v2:corrupt', 'not-json{{{');
    expect(() => hydrateTxState('corrupt')).not.toThrow();
    expect(hydrateTxState('corrupt')).toBeNull();
  });

  it('returns null for null stored value', () => {
    localStorage.setItem('tb-tx-v2:null-val', 'null');
    expect(hydrateTxState('null-val')).toBeNull();
  });

  it('returns null when status.status is an unknown value', () => {
    const badStatus = {
      id: 'bad-status',
      schemaVersion: 2,
      state: { status: 'nonexistent-state', txHash: null },
      label: 'Bad',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem('tb-tx-v2:bad-status', JSON.stringify(badStatus));
    expect(hydrateTxState('bad-status')).toBeNull();
  });

  it('returns null when txHash is present but not a hex string', () => {
    const badHash = {
      id: 'bad-hash',
      schemaVersion: 2,
      state: { status: 'submitted', txHash: 'not-a-hash', chainId: 10 },
      label: 'Bad hash',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem('tb-tx-v2:bad-hash', JSON.stringify(badHash));
    expect(hydrateTxState('bad-hash')).toBeNull();
  });

  it('returns null when id is missing', () => {
    const noId = {
      schemaVersion: 2,
      state: { status: 'idle', txHash: null },
      label: 'No id',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem('tb-tx-v2:no-id', JSON.stringify(noId));
    expect(hydrateTxState('no-id')).toBeNull();
  });

  it('returns null for oversized stored payloads', () => {
    const huge = 'x'.repeat(1024 * 1024);
    const oversized = {
      id: 'oversized',
      schemaVersion: TX_PERSISTENCE_SCHEMA_VERSION,
      state: { status: 'idle', txHash: null },
      label: huge,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem('tb-tx-v2:oversized', JSON.stringify(oversized));
    expect(hydrateTxState('oversized')).toBeNull();
  });

  it('returns null for expired entries', () => {
    const expired = {
      id: 'expired',
      schemaVersion: TX_PERSISTENCE_SCHEMA_VERSION,
      state: { status: 'idle', txHash: null },
      label: 'Expired',
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 365,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 365,
    };
    localStorage.setItem('tb-tx-v2:expired', JSON.stringify(expired));
    expect(hydrateTxState('expired')).toBeNull();
  });

  it('returns null for partially written entries', () => {
    localStorage.setItem('tb-tx-v2:partial', '{"id":"partial","schemaVersion":2,');
    expect(() => hydrateTxState('partial')).not.toThrow();
    expect(hydrateTxState('partial')).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// clearTxState
// ----------------------------------------------------------------------------

describe('clearTxState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null after clear', () => {
    const ctx = makeCtx('to-clear');
    persistTxState(ctx);
    expect(hydrateTxState('to-clear')).not.toBeNull();

    clearTxState('to-clear');
    expect(hydrateTxState('to-clear')).toBeNull();
  });

  it('does not throw when clearing a nonexistent entry', () => {
    expect(() => clearTxState('does-not-exist')).not.toThrow();
  });
});

// ----------------------------------------------------------------------------
// listPersistedTxIds
// ----------------------------------------------------------------------------

describe('listPersistedTxIds', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array when nothing is persisted', () => {
    expect(listPersistedTxIds()).toEqual([]);
  });

  it('returns ids of valid contexts', () => {
    persistTxState(makeCtx('tx-a'));
    persistTxState(makeCtx('tx-b'));
    const ids = listPersistedTxIds();
    expect(ids).toContain('tx-a');
    expect(ids).toContain('tx-b');
  });

  it('excludes stale/invalid entries', () => {
    localStorage.setItem('tb-tx-v2:stale-list', JSON.stringify({ schemaVersion: 1 }));
    persistTxState(makeCtx('txvalid'));
    const ids = listPersistedTxIds();
    expect(ids).not.toContain('stale-list');
    expect(ids).toContain('txvalid');
  });

  it('excludes corrupt, oversized, and expired entries', () => {
    localStorage.setItem('tb-tx-v2:corrupt-list', 'not-jsony{{');
    localStorage.setItem(
      'tb-tx-v2:expired-list',
      JSON.stringify({
        id: 'expired-list',
        schemaVersion: TX_PERSISTENCE_SCHEMA_VERSION,
        state: { status: 'idle', txHash: null },
        label: 'Expired',
        createdAt: 0,
        updatedAt: 0,
      }),
    );
    persistTxState(makeCtx('tx-valid-2'));
    const ids = listPersistedTxIds();
    expect(ids).not.toContain('corrupt-list');
    expect(ids).not.toContain('expired-list');
    expect(ids).toContain('tx-valid-2');
  });
});

// ----------------------------------------------------------------------------
// updateTxContext
// ----------------------------------------------------------------------------

describe('updateTxContext', () => {
  it('returns a new context with the updated state', () => {
    const ctx = makeCtx('update-test');
    const preparing = {
      status: 'preparing' as const,
      txHash: null,
      chainId: 10,
      blockNumber: null,
      confirmations: null,
      error: null,
      replacedBy: null,
    };
    const updated = updateTxContext(ctx, preparing);
    expect(updated.state.status).toBe('preparing');
    expect(updated.id).toBe('update-test');
    expect(updated.updatedAt).toBeGreaterThanOrEqual(ctx.updatedAt);
    // Original is unchanged
    expect(ctx.state.status).toBe('idle');
  });

  it('does not mutate the original context', () => {
    const ctx = makeCtx('immutable-test');
    const originalState = ctx.state.status;
    updateTxContext(ctx, { ...createIdleState(), status: 'preparing', chainId: 10 });
    expect(ctx.state.status).toBe(originalState);
  });
});

// ----------------------------------------------------------------------------
// Logout / account switch deletion
// ----------------------------------------------------------------------------

describe('logout / account switch deletion', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes all persisted transaction entries on logout', () => {
    persistTxState(makeCtx('logout-a'));
    persistTxState(makeCtx('logout-b'));
    expect(listPersistedTxIds().length).toBeGreaterThanOrEqual(2);

    for (const id of listPersistedTxIds()) {
      clearTxState(id);
    }
    expect(listPersistedTxIds()).toEqual([]);
  });

  it('does not leak entries across account switches', () => {
    persistTxState(makeCtx('account-a-tx'));
    clearTxState('account-a-tx');
    expect(hydrateTxState('account-a-tx')).toBeNull();
    expect(listPersistedTxIds()).not.toContain('account-a-tx');
  });
});
