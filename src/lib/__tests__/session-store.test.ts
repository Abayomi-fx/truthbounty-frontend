/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports -- test doubles and dynamic module access */
import {
  clearAuthSession,
  getAuthSession,
  getAuthSessionHeaders,
  isAuthSessionValidFor,
  scopeKey,
  setAuthSession,
  WalletSessionScope,
} from '../session-store';

const SCOPE_A: WalletSessionScope = {
  address: '0x1111111111111111111111111111111111111111',
  chainId: 10,
};

const SCOPE_B: WalletSessionScope = {
  address: '0x2222222222222222222222222222222222222222',
  chainId: 10,
};

const SCOPE_SEPOLIA: WalletSessionScope = {
  address: '0x1111111111111111111111111111111111111111',
  chainId: 11155420,
};

beforeEach(() => {
  clearAuthSession();
});

describe('session-store', () => {
  it('stores and reads a session bound to the wallet scope', () => {
    setAuthSession('token-123', SCOPE_A);

    const session = getAuthSession();
    expect(session?.token).toBe('token-123');
    expect(session?.scope).toEqual(SCOPE_A);
    expect(session?.issuedAt).toEqual(expect.any(Number));
  });

  it('persists the session to localStorage', () => {
    setAuthSession('token-123', SCOPE_A);

    const raw = window.localStorage.getItem('truthbounty:auth-session');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toMatchObject({
      token: 'token-123',
      scope: SCOPE_A,
    });
  });

  it('restores a valid persisted session after a module reload', () => {
    window.localStorage.setItem(
      'truthbounty:auth-session',
      JSON.stringify({ token: 'persisted', scope: SCOPE_A, issuedAt: 12345 }),
    );

    jest.isolateModules(() => {
      const fresh = require('../session-store');
      const session = fresh.getAuthSession();
      expect(session?.token).toBe('persisted');
      expect(session?.scope).toEqual(SCOPE_A);
    });
  });

  it('rejects a corrupt persisted payload and drops it', () => {
    window.localStorage.setItem('truthbounty:auth-session', '{not json');
    expect(getAuthSession()).toBeNull();

    window.localStorage.setItem(
      'truthbounty:auth-session',
      JSON.stringify({ token: '', scope: SCOPE_A, issuedAt: 1 }),
    );
    expect(getAuthSession()).toBeNull();
    expect(window.localStorage.getItem('truthbounty:auth-session')).toBeNull();
  });

  it('clears the session from memory and storage', () => {
    setAuthSession('token-123', SCOPE_A);
    clearAuthSession();

    expect(getAuthSession()).toBeNull();
    expect(window.localStorage.getItem('truthbounty:auth-session')).toBeNull();
  });

  describe('isAuthSessionValidFor', () => {
    it('is true when the session scope matches the wallet scope', () => {
      setAuthSession('token-123', SCOPE_A);
      expect(isAuthSessionValidFor(SCOPE_A)).toBe(true);
    });

    it('compares addresses case-insensitively', () => {
      setAuthSession('token-123', SCOPE_A);
      expect(
        isAuthSessionValidFor({
          address: '0X1111111111111111111111111111111111111111',
          chainId: 10,
        }),
      ).toBe(true);
    });

    it('is false when the connected account changed', () => {
      setAuthSession('token-123', SCOPE_A);
      expect(isAuthSessionValidFor(SCOPE_B)).toBe(false);
    });

    it('is false when the required chain changed', () => {
      setAuthSession('token-123', SCOPE_A);
      expect(isAuthSessionValidFor(SCOPE_SEPOLIA)).toBe(false);
    });

    it('is false when the wallet is disconnected (null scope)', () => {
      setAuthSession('token-123', SCOPE_A);
      expect(isAuthSessionValidFor(null)).toBe(false);
    });

    it('is false when no session exists', () => {
      expect(isAuthSessionValidFor(SCOPE_A)).toBe(false);
    });
  });

  describe('getAuthSessionHeaders', () => {
    it('returns the Bearer header only for a still-valid scope', () => {
      setAuthSession('token-123', SCOPE_A);
      expect(getAuthSessionHeaders(SCOPE_A)).toEqual({
        Authorization: 'Bearer token-123',
      });
    });

    it('returns no header when the account changed', () => {
      setAuthSession('token-123', SCOPE_A);
      expect(getAuthSessionHeaders(SCOPE_B)).toEqual({});
    });

    it('returns no header when the chain changed', () => {
      setAuthSession('token-123', SCOPE_A);
      expect(getAuthSessionHeaders(SCOPE_SEPOLIA)).toEqual({});
    });

    it('returns no header when disconnected', () => {
      setAuthSession('token-123', SCOPE_A);
      expect(getAuthSessionHeaders(null)).toEqual({});
    });

    it('returns no header after the session is cleared', () => {
      setAuthSession('token-123', SCOPE_A);
      clearAuthSession();
      expect(getAuthSessionHeaders(SCOPE_A)).toEqual({});
    });
  });

  describe('scopeKey', () => {
    it('normalizes address casing and includes chain id', () => {
      expect(scopeKey(SCOPE_A)).toBe(
        '0x1111111111111111111111111111111111111111:10',
      );
      expect(scopeKey({ address: '0X1111111111111111111111111111111111111111', chainId: 10 })).toBe(
        '0x1111111111111111111111111111111111111111:10',
      );
    });

    it('returns null for a null scope', () => {
      expect(scopeKey(null)).toBeNull();
    });
  });
});
