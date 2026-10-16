/**
 * V2-FE-008 — Wallet-scoped auth session hook (consumer API).
 *
 * Reactive replacement for the removed mock `useAuth`: authentication is only
 * possible while a wallet is connected, and any stored token is only usable
 * for the exact (address, chainId) scope it was issued for. If the wallet
 * scope changes, `isAuthenticated` flips back to false and a new token must be
 * obtained from the backend.
 *
 * This hook never fabricates a token: `authenticate()` only stores a token that
 * the caller received from the backend.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import {
  AuthSession,
  clearAuthSession,
  getAuthSession,
  isAuthSessionValidFor,
  setAuthSession,
  WalletSessionScope,
} from '@/lib/session-store';

function readValidSession(scope: WalletSessionScope | null): AuthSession | null {
  const session = getAuthSession();
  return session && isAuthSessionValidFor(scope) ? session : null;
}

export interface UseAuthSessionResult {
  session: AuthSession | null;
  isAuthenticated: boolean;
  /** Wallet scope the session is bound to (null while disconnected). */
  scope: WalletSessionScope | null;
  /** Store a backend-issued token bound to the current wallet scope. */
  authenticate: (token: string) => AuthSession;
  /** Clear the session and the query cache. */
  logout: () => void;
}

export function useAuthSession(): UseAuthSessionResult {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const queryClient = useQueryClient();

  const scope = useMemo<WalletSessionScope | null>(
    () => (isConnected && address ? { address, chainId } : null),
    [address, chainId, isConnected],
  );

  const [session, setSession] = useState<AuthSession | null>(() => readValidSession(scope));

  // Re-sync when the wallet scope changes (account switch, chain switch,
  // disconnect) so a stale token is never reported as authentic.
  useEffect(() => {
    setSession(readValidSession(scope));
  }, [scope]);

  const authenticate = useCallback(
    (token: string) => {
      if (!scope) {
        throw new Error('AUTH_REQUIRES_WALLET');
      }
      const trimmed = token.trim();
      if (!trimmed) {
        throw new Error('AUTH_TOKEN_REQUIRED');
      }
      const next = setAuthSession(trimmed, scope);
      setSession(next);
      // Auth-dependent queries may now resolve differently — refetch them.
      queryClient.invalidateQueries();
      return next;
    },
    [queryClient, scope],
  );

  const logout = useCallback(() => {
    clearAuthSession();
    setSession(null);
    queryClient.clear();
  }, [queryClient]);

  return {
    session,
    isAuthenticated: session !== null,
    scope,
    authenticate,
    logout,
  };
}
