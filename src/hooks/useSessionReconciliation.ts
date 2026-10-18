/**
 * V2-FE-008 — Wallet / chain / auth session reconciliation.
 *
 * Watches the connected wallet scope (account address + chain id) and keeps
 * authentication and cached data coherent with it:
 *
 *  - When the connected account changes, the stored auth session is
 *    invalidated and the query cache is cleared so no data from the previous
 *    account can leak into the new session.
 *  - When the required chain changes, the auth session is invalidated, chain
 *    scoped storage caches are dropped, and the query cache is cleared.
 *  - When the wallet disconnects, the auth session and query cache are cleared.
 *  - Reconnect (wagmi) and explicit logout / re-authentication are coordinated
 *    through this hook so there is a single place that owns invalidation.
 *
 * The hook is intentionally logic-only: it renders nothing and changes no UI.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useChainId, useDisconnect, useReconnect } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import {
  clearAuthSession,
  getAuthSession,
  isAuthSessionValidFor,
  scopeKey,
  WalletSessionScope,
} from '@/lib/session-store';
import { clearChainScopedStorage } from '@/hooks/useWalletNetwork';
import { DEFAULT_CURSOR_STORAGE_KEY as WS_CURSOR_STORAGE_KEY } from '@/hooks/useWebSocket';

export type SessionInvalidationReason = 'account-changed' | 'chain-changed' | 'disconnected';

export interface SessionInvalidation {
  reason: SessionInvalidationReason;
  at: string;
}

function clearPersistedWsCursor(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(WS_CURSOR_STORAGE_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

export interface SessionReconciliationResult {
  /** Current wallet scope (address + chain id), or null when disconnected/connecting. */
  sessionScope: WalletSessionScope | null;
  isConnected: boolean;
  isReconnecting: boolean;
  /** True when a stored auth session is still valid for the current wallet scope. */
  hasValidSession: boolean;
  /** Most recent invalidation event (null until the scope first changes). */
  lastInvalidation: SessionInvalidation | null;
  /** Re-establish the wagmi connection (e.g. after a page reload). */
  reconnect: () => void;
  /** Disconnect the wallet and clear the auth session + query cache. */
  logout: () => void;
  /** Drop the auth session so a new one must be issued for the current scope. */
  reauthenticate: () => void;
}

export function useSessionReconciliation(): SessionReconciliationResult {
  const { address, isConnected, status } = useAccount();
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const { disconnect } = useDisconnect();
  const { reconnect } = useReconnect();

  const scopeRef = useRef<WalletSessionScope | null>(null);
  const hasObservedRef = useRef(false);
  const [lastInvalidation, setLastInvalidation] = useState<SessionInvalidation | null>(null);
  // Bumped whenever the stored session is cleared/invalidated so consumers
  // observe the change even when the wallet scope itself did not move.
  const [, setSessionRevision] = useState(0);

  // Reactive view of the current scope for consumers.
  const sessionScope = useMemo<WalletSessionScope | null>(() => {
    if (status === 'disconnected') return null;
    if (isConnected && address) return { address, chainId };
    return null;
  }, [address, chainId, isConnected, status]);

  // Invalidate whenever the settled wallet scope changes.
  useEffect(() => {
    const settledDisconnected = status === 'disconnected';
    let nextScope: WalletSessionScope | null;
    let unsettled = false;

    if (settledDisconnected) {
      nextScope = null;
    } else if (isConnected && address) {
      nextScope = { address, chainId };
    } else {
      // Connecting / reconnecting — do not act until the wallet settles, so a
      // page reload never wipes a still-valid session mid-reconnect.
      nextScope = scopeRef.current;
      unsettled = true;
    }

    if (!hasObservedRef.current) {
      // First observation is a baseline (e.g. restored session after reload).
      hasObservedRef.current = true;
      scopeRef.current = nextScope;
      return;
    }

    if (unsettled) return;

    const previous = scopeRef.current;
    scopeRef.current = nextScope;

    const previousKey = scopeKey(previous);
    const nextKey = scopeKey(nextScope);
    if (previousKey === nextKey) return;

    // 1. Invalidate authentication when the account or required chain changed.
    const session = getAuthSession();
    if (session && !isAuthSessionValidFor(nextScope)) {
      clearAuthSession();
    }

    // 2. Drop chain-scoped caches when the chain leg of the scope changed.
    if (previous?.chainId !== nextScope?.chainId) {
      clearChainScopedStorage();
      clearPersistedWsCursor();
    }

    // 3. Clear the query cache — it may hold data for the previous account/chain.
    queryClient.clear();

    // 4. Record the invalidation for observability/tests.
    const reason: SessionInvalidationReason = nextScope === null
      ? 'disconnected'
      : previous?.chainId !== nextScope.chainId
        ? 'chain-changed'
        : 'account-changed';
    setLastInvalidation({ reason, at: new Date().toISOString() });
    setSessionRevision((revision) => revision + 1);
  }, [address, chainId, isConnected, status, queryClient]);

  const logout = useCallback(() => {
    clearAuthSession();
    queryClient.clear();
    clearChainScopedStorage();
    clearPersistedWsCursor();
    setSessionRevision((revision) => revision + 1);
    disconnect();
  }, [disconnect, queryClient]);

  const reauthenticate = useCallback(() => {
    clearAuthSession();
    // Invalidate (not clear) so auth-dependent queries refetch for the new
    // session while unrelated cache entries are preserved.
    queryClient.invalidateQueries();
    setSessionRevision((revision) => revision + 1);
  }, [queryClient]);

  // Re-read the store on every render; `setSessionRevision` is called on
  // invalidation so a cleared token is observed without a scope change.
  const hasValidSession = isAuthSessionValidFor(sessionScope);

  return {
    sessionScope,
    isConnected,
    isReconnecting: status === 'connecting' || status === 'reconnecting',
    hasValidSession,
    lastInvalidation,
    reconnect,
    logout,
    reauthenticate,
  };
}
