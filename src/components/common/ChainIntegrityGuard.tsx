
'use client';

/**
 * ChainIntegrityGuard — Context-aware wrapper that evaluates chain + API
 * integrity and feeds FallbackBoundary.
 * V2-FE-136

 * Reads the current wagmi chain, checks it against supported chains,
 * integrates RPC fallback state, and renders children inside FallbackBoundary.
 *
 * Usage:
 *   <ChainIntegrityGuard>
 *     <ClaimSubmissionForm />
 *   </ChainIntegrityGuard>
 */

import type { ReactNode } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { isSupportedChain } from '@/config/chains';
import { useRpcFallback } from '@/hooks/useRpcFallback';
import { FallbackBoundary } from './FallbackBoundary';
import type { IntegrityStatus } from '@/lib/rpc-fallback/types';
import { useReleaseContext } from '@/hooks/useReleaseContext';
import { useIdentityTrust } from '@/hooks/useIdentityTrust';
import { useProtectedStateInvalidation } from '@/hooks/useProtectedStateInvalidation';

export interface ChainIntegrityGuardProps {
  children: ReactNode;
  /** Override the wagmi chainId (useful for testing). */
  chainIdOverride?: number;
  /** Pass through to FallbackBoundary. */
  fallback?: ReactNode;
  blockActions?: boolean;
  /** Override the connected account address (useful for testing). */
  accountOverride?: `0x${string}` | undefined;
  /** Override the pinned release identifier (useful for testing). */
  releaseOverride?: string | null;
  /** Override the identity/trust status (useful for testing). */
  identityStatusOverride?: 'verified' | 'stale' | 'revoked' | 'unavailable';
}

export function ChainIntegrityGuard({
  children,
  chainIdOverride,
  fallback,
  blockActions = true,
  accountOverride,
  releaseOverride,
  identityStatusOverride,
}: ChainIntegrityGuardProps) {
  const wagmiChainId = useChainId();
  const chainId = chainIdOverride ?? wagmiChainId;
  const { address: wagmiAddress } = useAccount();
  const address = accountOverride ?? wagmiAddress;

  const { state: rpcState, allUnhealthy, isDegraded } = useRpcFallback(chainId, {
    disableProbing: false,
  });

  const release = useReleaseContext(releaseOverride);
  const identity = useIdentityTrust(address, identityStatusOverride);

  // Account/chain/release changes invalidate protected UI state.
  useProtectedStateInvalidation({ chainId, address, releaseId: release.releaseId });

  const supported = isSupportedChain(chainId);

  let integrityStatus: IntegrityStatus = 'valid';
  let statusReason: string | null = null;

  if (!address) {
    integrityStatus = 'blocked';
    statusReason = 'Wallet not connected. Connect a wallet to view protocol context.';
  } else if (!supported) {
    integrityStatus = 'blocked';
    statusReason = `Chain ${chainId} is not supported. Please switch to Optimism or Optimism Sepolia.`;
  } else if (release.status === 'changed' || release.status === 'unavailable') {
    integrityStatus = 'blocked';
    statusReason =
      release.status === 'changed'
        ? 'Pinned release changed. Protected UI state was invalidated; re-verify before continuing.'
        : 'Pinned release manifest is unavailable. Protocol actions are disabled.';
  } else if (identity.status === 'revoked') {
    integrityStatus = 'blocked';
    statusReason = 'Identity attestation is revoked. Protocol actions are disabled.';
  } else if (allUnhealthy) {
    integrityStatus = 'error';
    statusReason = 'All RPC providers are unreachable. Protocol actions are disabled until connectivity is restored.';
  } else if (rpcState?.circuitOpen) {
    integrityStatus = 'blocked';
    statusReason = 'RPC circuit breaker is open. Please wait before retrying.';
  } else if (isDegraded || rpcState?.isUsingFallback) {
    integrityStatus = 'degraded';
    statusReason = rpcState?.isUsingFallback
      ? 'Primary RPC provider is unreachable. A fallback provider is in use; data may be slightly delayed.'
      : 'RPC provider is experiencing degraded performance. Data may be slightly delayed.';
  } else if (identity.status === 'stale') {
    integrityStatus = 'degraded';
    statusReason = 'Identity attestation is stale. Trust is non-authoritative; re-verify before continuing.';
  } else if (identity.status === 'unavailable') {
    integrityStatus = 'degraded';
    statusReason = 'Identity attestation is unavailable. Trust is non-authoritative.';
  }

  return (
    <FallbackBoundary
      status={integrityStatus}
      reason={statusReason}
      fallback={fallback}
      blockActions={blockActions}
    >
      {children}
    </FallbackBoundary>
  );
}
