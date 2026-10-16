/**
 * Wallet-scope cache helpers (V2-FE-063).
 *
 * When the connected address or chain changes, only wallet-scoped query
 * namespaces are removed — never a cache-wide clear that would thrash
 * unrelated projections.
 *
 * UI-FE-055: also exposes the bounded lifecycle scope signature used by the
 * API request lifecycle adapter to abort in-flight reads on route, account,
 * chain, or release changes.
 */

import type { QueryClient } from '@tanstack/react-query';
import {
  claimKeys,
  filterKeys,
  finalityKeys,
  normalizeAddress,
  projectionWatermarkKeys,
  walletKeys,
  walletScope,
} from './queryKeys';

/**
 * Lifecycle scope signature. Any change to these fields must abort in-flight
 * reads and suppress late responses from the previous scope.
 */
export interface LifecycleScope {
  address: string | null;
  chainId: number | null;
  route: string | null;
  release: string | null;
}

/**
 * Build a stable, fail-closed signature for the current lifecycle scope.
 * Returns null when any required dimension is missing so callers can abort
 * rather than attach a partial scope to a request.
 */
export function lifecycleScopeSignature(
  scope: Partial<LifecycleScope> | null | undefined,
): string | null {
  if (!scope) return null;
  const address = normalizeAddress(scope.address ?? null);
  const chainId = typeof scope.chainId === 'number' ? scope.chainId : null;
  const route = typeof scope.route === 'string' && scope.route.length > 0
    ? scope.route
    : null;
  const release = typeof scope.release === 'string' && scope.release.length > 0
    ? scope.release
    : null;

  if (!address || !chainId || !route || !release) return null;
  return `${address}:${chainId}:${route}:${release}`;
}

/** Roots that are inherently wallet / chain scoped. */
export const WALLET_SCOPED_ROOTS = [
  walletKeys.all,
  filterKeys.all,
  finalityKeys.all,
  projectionWatermarkKeys.all,
] as const;

/**
 * Build the narrow key list for a specific wallet+chain pair.
 * Returns an empty list when scope inputs are unsupported (fail closed).
 */
export function keysForWalletScope(
  address: string | null | undefined,
  chainId: number | null | undefined,
) {
  const scope = walletScope(address, chainId);
  if (!scope) return [] as const;

  return [
    walletKeys.scope(scope.address, scope.chainId),
    walletKeys.balance(scope.address, scope.chainId),
    walletKeys.nonce(scope.address, scope.chainId),
    claimKeys.byWallet(scope.address, scope.chainId),
    filterKeys.activity(scope.address),
    projectionWatermarkKeys.byChain(scope.chainId),
  ] as const;
}

/**
 * Remove cache entries that belong to a prior wallet/chain scope.
 * Prefer `removeQueries` over blanket `clear` to avoid unrelated churn.
 */
export function invalidateWalletScope(
  queryClient: QueryClient,
  address: string | null | undefined,
  chainId: number | null | undefined,
): number {
  const keys = keysForWalletScope(address, chainId);
  if (keys.length === 0) return 0;

  for (const queryKey of keys) {
    queryClient.removeQueries({ queryKey: [...queryKey] });
  }
  return keys.length;
}

/**
 * UI-FE-055: on any lifecycle scope change (route, account, chain, release),
 * drop the previous wallet scope so late responses cannot overwrite the new
 * context. Returns whether the scope actually changed.
 */
export function onLifecycleScopeChange(
  queryClient: QueryClient,
  previous: Partial<LifecycleScope> | null,
  next: Partial<LifecycleScope> | null,
): { changed: boolean; previousSignature: string | null; nextSignature: string | null } {
  const previousSignature = lifecycleScopeSignature(previous);
  const nextSignature = lifecycleScopeSignature(next);

  if (previousSignature === nextSignature) {
    return { changed: false, previousSignature, nextSignature };
  }

  const prevAddr = normalizeAddress(previous?.address ?? null);
  const prevChain =
    typeof previous?.chainId === 'number' ? previous.chainId : null;

  if (prevAddr && prevChain) {
    invalidateWalletScope(queryClient, prevAddr, prevChain);
  }

  return { changed: true, previousSignature, nextSignature };
}

/**
 * On account or chain change: drop the previous scope, keep the new one cold.
 * Callers must pass the *previous* scope that is leaving the session.
 */
export function onWalletScopeChange(
  queryClient: QueryClient,
  previous: { address?: string | null; chainId?: number | null } | null,
  next: { address?: string | null; chainId?: number | null } | null,
): { removed: number; previousScope: string | null; nextScope: string | null } {
  const prevAddr = normalizeAddress(previous?.address ?? null);
  const nextAddr = normalizeAddress(next?.address ?? null);
  const prevChain =
    typeof previous?.chainId === 'number' ? previous.chainId : null;
  const nextChain = typeof next?.chainId === 'number' ? next.chainId : null;

  const previousScope =
    prevAddr && prevChain ? `${prevAddr}:${prevChain}` : null;
  const nextScope = nextAddr && nextChain ? `${nextAddr}:${nextChain}` : null;

  if (previousScope && previousScope !== nextScope) {
    const removed = invalidateWalletScope(queryClient, prevAddr, prevChain);
    return { removed, previousScope, nextScope };
  }

  // Disconnect: clear last known wallet roots without touching global claims.
  if (previousScope && !nextScope) {
    const removed = invalidateWalletScope(queryClient, prevAddr, prevChain);
    return { removed, previousScope, nextScope };
  }

  return { removed: 0, previousScope, nextScope };
}
