/**
 * Wallet-scope cache helpers (V2-FE-063).
 *
 * When the connected address or chain changes, only wallet-scoped query
 * namespaces are removed — never a cache-wide clear that would thrash
 * unrelated projections.
 *
 * These helpers are purely a cache-hygiene concern. They must not be
 * construed as authorization: a wallet connection or chain selection is a
 * context selection, not a capability grant. Contract state remains
 * canonical for mutations; API data is a freshness-labelled projection.
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

export interface ProtocolContextSnapshot {
  address?: string | null;
  chainId?: number | null;
  releaseId?: string | null;
  deploymentBlock?: number | null;
  artifactChecksum?: string | null;
}

export function buildProtocolContextKey(
  context: ProtocolContextSnapshot | null | undefined,
): string {
  const address = normalizeAddress(context?.address ?? null) ?? 'unknown';
  const chainId =
    typeof context?.chainId === 'number' && Number.isInteger(context.chainId)
      ? String(context.chainId)
      : 'unknown';
  const releaseId = context?.releaseId?.trim() || 'unknown';
  const deploymentBlock =
    typeof context?.deploymentBlock === 'number' && Number.isInteger(context.deploymentBlock)
      ? String(context.deploymentBlock)
      : 'unknown';
  const artifactChecksum = context?.artifactChecksum?.trim() || 'unknown';

  return `${address}:${chainId}:${releaseId}:${deploymentBlock}:${artifactChecksum}`;
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
): readonly (readonly unknown[])[] {
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

  queryClient.cancelQueries();
  queryClient.getMutationCache().clear();

  for (const queryKey of keys) {
    queryClient.removeQueries({ queryKey: [...queryKey] });
  }
  return keys.length;
}

/**
 * On account or chain change: drop the previous scope, keep the new one cold.
 * Callers must pass the *previous* scope that is leaving the session.
 *
 * This is a cache-invalidation signal only. It must not be used to
 * grant or revoke authority, and it must not assume the next scope is
 * valid or authorized. The next scope is reported as a context label only.
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

  const releaseAwarePrevious = buildProtocolContextKey({
    address: prevAddr,
    chainId: prevChain,
  });
  const releaseAwareNext = buildProtocolContextKey({
    address: nextAddr,
    chainId: nextChain,
  });

  if (previousScope && previousScope !== nextScope) {
    const removed = invalidateWalletScope(queryClient, prevAddr, prevChain);
    return { removed, previousScope: releaseAwarePrevious, nextScope: releaseAwareNext };
  }

  // Disconnect: clear last known wallet roots without touching global claims.
  if (previousScope && !nextScope) {
    const removed = invalidateWalletScope(queryClient, prevAddr, prevChain);
    return { removed, previousScope: releaseAwarePrevious, nextScope: releaseAwareNext };
  }

  return { removed: 0, previousScope: releaseAwarePrevious, nextScope: releaseAwareNext };
}
