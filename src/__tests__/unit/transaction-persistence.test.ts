/**
 * V2-FE-009 — Unit tests for transaction persistence helpers.
 *
 * Coverage:
 *  - Persist and hydrate round-trip (valid data)
 *  - Invalid stored shape returns null
 *  - Schema version mismatch returns null
 *  - Missing fields return null
 *  - Corrupt JSON returns null (never throws)
 *  - Cleared state not returned on hydrate
 *  - listPersistedTxIds enumerates valid entries only
 *  - updateTxContext bumps updatedAt
 */

import {
  persistTxState,
  hydrateTxState,
  clearTxState,
  listPersistedTxIds,
  createTxContext,
  updateTxContext,
} from '@/lib/transaction-machine/transaction-persistence';
import {
  createIdleState,
  type TransactionContext,
} from '@/lib/transaction-machine/transaction-machine.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(id = 'test-tx', label = 'Test transaction'): TransactionContext {
  return createTxContext(id, label);
}

// ---------------------------------------------------------------------------
// Round-trip
// ---------------------------------------------------------------------------

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
    expect(hydrated!.schemaVersion).toBe(2);
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

// ---------------------------------------------------------------------------
// Schema version guard
// ---------------------------------------------------------------------------

describe('Schema version mismatch', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when schemaVersion is 1 (old format)', () => {
    const staleEntry = {
      id: 'stale-1',
      schemaVersion: 1,
      state: { status: 'idle' },
      label: 'Old entry',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem('tb-tx-v2:stale-1', JSON.stringify(staleEntry));
    expect(hydrateTxState('stale-1')).toBeNull();
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
});

// ---------------------------------------------------------------------------
// Corrupt / invalid data
// ---------------------------------------------------------------------------

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

  it('returns null when state.status is an unknown value', () => {
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
});

// ---------------------------------------------------------------------------
// clearTxState
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// listPersistedTxIds
// ---------------------------------------------------------------------------

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
    persistTxState(makeCtx('tx-valid'));
    const ids = listPersistedTxIds();
    expect(ids).not.toContain('stale-list');
    expect(ids).toContain('tx-valid');
  });
});

// ---------------------------------------------------------------------------
// updateTxContext
// ---------------------------------------------------------------------------

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
