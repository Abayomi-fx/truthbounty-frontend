'use client';

/**
 * ClaimActions — Wallet-gated mutation triggers
 *
 * Displays verify and dispute action buttons. Actions are gated by:
 * - Wallet connection state (useCanonicalWallet)
 * - Write readiness (useWriteReadiness)
 * - Claim status (cannot verify settled claims)
 * - Projection freshness (no writes on critical stale data)
 *
 * All actions fail closed: missing wallet, unsupported chain, or stale
 * projection disable the buttons with accessible reasons.
 */

import React from 'react';
import { ThumbsUp, Shield, Wallet } from 'lucide-react';
import { useCanonicalWallet } from '@/hooks/useCanonicalWallet';
import { useWriteReadiness } from '@/hooks/useWriteReadiness';
import type { ClaimDetailProjection } from '@/app/types/claim-detail-projection';
import type { UseClaimDetailFreshnessResult } from '@/hooks/useClaimDetailFreshness';

export interface ClaimActionsProps {
  claim: ClaimDetailProjection;
  freshness: UseClaimDetailFreshnessResult;
  onVerify?: () => void;
  onDispute?: () => void;
}

function getActionBlockingReason(
  claim: ClaimDetailProjection,
  wallet: ReturnType<typeof useCanonicalWallet>,
  writeReadiness: ReturnType<typeof useWriteReadiness>,
  freshness: UseClaimDetailFreshnessResult
): string | null {
  // Check wallet state first
  if (wallet.status === 'disconnected') {
    return 'Connect your wallet to take action';
  }

  if (wallet.status === 'loading') {
    return 'Connecting wallet...';
  }

  if (wallet.status === 'unsupported') {
    return 'Switch to Optimism or OP Sepolia to take action';
  }

  if (wallet.status === 'account_error') {
    return wallet.connectorError?.message ?? 'Wallet connection error';
  }

  if (wallet.status === 'config_error') {
    return 'Wallet configuration error. Please refresh the page.';
  }

  // Check claim status
  if (claim.status === 'VERIFIED' || claim.status === 'REJECTED') {
    return 'This claim has been settled and cannot be modified';
  }

  // Check projection freshness (critical: no writes on stale data)
  if (freshness.status === 'degraded') {
    return 'Data is temporarily unavailable. Please refresh before taking action.';
  }

  // Check write readiness
  if (!writeReadiness.isReady) {
    return writeReadiness.message ?? 'Not ready for on-chain action';
  }

  return null;
}

export function ClaimActions({ claim, freshness, onVerify, onDispute }: ClaimActionsProps) {
  const wallet = useCanonicalWallet();
  const writeReadiness = useWriteReadiness({
    enabled: wallet.status === 'ready',
  });

  const blockingReason = getActionBlockingReason(
    claim,
    wallet,
    writeReadiness,
    freshness
  );

  const isBlocked = blockingReason !== null;
  const isSettled = claim.status === 'VERIFIED' || claim.status === 'REJECTED';

  // Don't show actions for settled claims
  if (isSettled) {
    return null;
  }

  return (
    <div className="pt-4 border-t border-[#232329] space-y-3">
      {/* Wallet status indicator */}
      {wallet.status === 'disconnected' && (
        <div className="flex items-center justify-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-400">
          <Wallet size={16} aria-hidden="true" />
          <span>Connect your wallet to verify or dispute this claim</span>
        </div>
      )}

      {wallet.status === 'unsupported' && (
        <div className="flex items-center justify-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-500">
          <Wallet size={16} aria-hidden="true" />
          <span>Switch to Optimism or OP Sepolia to take action</span>
          <button
            onClick={() => wallet.switchToSupportedNetwork()}
            className="ml-2 px-3 py-1 bg-yellow-500 text-black rounded font-medium hover:bg-yellow-400 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-[#18181b]"
          >
            Switch Network
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={onVerify}
          disabled={isBlocked || !onVerify}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-[#18181b] min-h-[44px]"
          aria-label={isBlocked ? `Verify claim (${blockingReason})` : 'Verify claim'}
          aria-disabled={isBlocked}
          title={isBlocked ? blockingReason : undefined}
        >
          <ThumbsUp size={18} aria-hidden="true" />
          <span>Verify</span>
        </button>

        <button
          onClick={onDispute}
          disabled={isBlocked || !onDispute}
          className="flex-1 border border-red-900 text-red-500 hover:bg-red-950/30 disabled:border-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[#18181b] min-h-[44px]"
          aria-label={isBlocked ? `Dispute claim (${blockingReason})` : 'Dispute claim'}
          aria-disabled={isBlocked}
          title={isBlocked ? blockingReason : undefined}
        >
          <Shield size={18} aria-hidden="true" />
          <span>Dispute</span>
        </button>
      </div>

      {/* Blocking reason (visible for accessibility) */}
      {isBlocked && wallet.status === 'ready' && (
        <p
          className="text-xs text-gray-500 text-center"
          role="status"
          aria-live="polite"
        >
          {blockingReason}
        </p>
      )}

      {/* Wallet info (when connected and ready) */}
      {wallet.status === 'ready' && wallet.address && !isBlocked && (
        <p className="text-xs text-gray-500 text-center">
          Connected: {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
        </p>
      )}
    </div>
  );
}
