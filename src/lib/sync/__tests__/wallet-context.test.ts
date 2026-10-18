/**
 * UI-FE-059 — Wallet-context policy unit tests.
 */

import {
  StaleContextError,
  WALLET_CONTEXT_STORAGE_KEY,
  buildWalletContextSnapshot,
  classifyContextTransition,
  contextAllowsMutation,
  createContextGuard,
  describeContextRecovery,
  normalizeContextIdentity,
  readWalletContextSnapshot,
  transitionRevokesContext,
  walletContextKey,
  writeWalletContextSnapshot,
  type WalletContextSnapshot,
} from '../wallet-context';

const ACCOUNT_A = '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E';
const ACCOUNT_B = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

function identity(account: string | null, chainId: number | null) {
  return normalizeContextIdentity(account, chainId);
}

describe('wallet context — transition classification', () => {
  it('classifies connect, disconnect, account and chain changes', () => {
    expect(classifyContextTransition(identity(null, null), identity(ACCOUNT_A, 10))).toBe('connect');
    expect(classifyContextTransition(identity(ACCOUNT_A, 10), identity(null, null))).toBe('disconnect');
    expect(classifyContextTransition(identity(ACCOUNT_A, 10), identity(ACCOUNT_B, 10))).toBe('account-change');
    expect(classifyContextTransition(identity(ACCOUNT_A, 10), identity(ACCOUNT_A, 11155420))).toBe('chain-change');
    expect(classifyContextTransition(identity(ACCOUNT_A, 10), identity(ACCOUNT_A, 10))).toBe('none');
  });

  it('revokes the prior context on disconnect/account/chain, not on connect', () => {
    expect(transitionRevokesContext('disconnect')).toBe(true);
    expect(transitionRevokesContext('account-change')).toBe(true);
    expect(transitionRevokesContext('chain-change')).toBe(true);
    expect(transitionRevokesContext('connect')).toBe(false);
    expect(transitionRevokesContext('none')).toBe(false);
  });

  it('compares contexts case-insensitively', () => {
    expect(walletContextKey(identity(ACCOUNT_A, 10))).toBe(
      walletContextKey(identity(ACCOUNT_A.toLowerCase(), 10)),
    );
  });
});

describe('wallet context — mutation gating', () => {
  it('allows mutation only while the live scope matches the context', () => {
    const context = buildWalletContextSnapshot(identity(ACCOUNT_A, 10), 1, 'connect', 0);
    expect(contextAllowsMutation(identity(ACCOUNT_A, 10), context, false)).toBe(true);
    expect(contextAllowsMutation(identity(ACCOUNT_B, 10), context, false)).toBe(false);
    expect(contextAllowsMutation(identity(ACCOUNT_A, 11155420), context, false)).toBe(false);
    expect(contextAllowsMutation(identity(null, null), context, false)).toBe(false);
  });

  it('fails closed while recovery is pending even if the scope matches', () => {
    const context = buildWalletContextSnapshot(identity(ACCOUNT_A, 10), 1, 'connect', 0);
    expect(contextAllowsMutation(identity(ACCOUNT_A, 10), context, true)).toBe(false);
  });
});

describe('wallet context — stale guard', () => {
  it('captures an epoch and detects revocation', () => {
    let epoch = 1;
    const guard = createContextGuard(() => epoch);
    const token = guard.capture();
    expect(guard.isCurrent(token)).toBe(true);

    epoch = 2;
    expect(guard.isCurrent(token)).toBe(false);
    expect(() => guard.assertCurrent(token)).toThrow(StaleContextError);
    expect(() => guard.assertCurrent(token)).toThrow(/changed in another tab/);
  });
});

describe('wallet context — recovery copy', () => {
  it('provides explicit user-visible recovery for each revocation', () => {
    expect(describeContextRecovery('account-change')?.message).toMatch(/account changed/i);
    expect(describeContextRecovery('chain-change')?.message).toMatch(/network changed/i);
    expect(describeContextRecovery('disconnect')?.message).toMatch(/disconnected/i);
    expect(describeContextRecovery('connect')).toBeNull();
    expect(describeContextRecovery('none')).toBeNull();
  });
});

describe('wallet context — resume snapshot', () => {
  function storage() {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
      map,
    };
  }

  it('round-trips a valid snapshot', () => {
    const store = storage();
    const snapshot = buildWalletContextSnapshot(identity(ACCOUNT_A, 10), 3, 'account-change', 1);
    expect(writeWalletContextSnapshot(snapshot, store)).toBe(true);
    expect(readWalletContextSnapshot(store)).toEqual(snapshot);
  });

  it('returns null for corrupt or absent snapshots', () => {
    const store = storage();
    expect(readWalletContextSnapshot(store)).toBeNull();
    store.setItem(WALLET_CONTEXT_STORAGE_KEY, '{not json');
    expect(readWalletContextSnapshot(store)).toBeNull();
    store.setItem(WALLET_CONTEXT_STORAGE_KEY, JSON.stringify({ epoch: -1 }));
    expect(readWalletContextSnapshot(store)).toBeNull();
  });

  it('rejects a snapshot with a non-canonical account', () => {
    const store = storage();
    const bad: WalletContextSnapshot = {
      account: '0xdeadbeef' as `0x${string}`,
      chainId: 10,
      epoch: 1,
      reason: 'connect',
      updatedAt: 1,
    };
    store.setItem(WALLET_CONTEXT_STORAGE_KEY, JSON.stringify(bad));
    expect(readWalletContextSnapshot(store)).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    expect(writeWalletContextSnapshot(
      buildWalletContextSnapshot(identity(ACCOUNT_A, 10), 1, 'connect', 1),
      null,
    )).toBe(false);
    expect(readWalletContextSnapshot(null)).toBeNull();
  });
});
