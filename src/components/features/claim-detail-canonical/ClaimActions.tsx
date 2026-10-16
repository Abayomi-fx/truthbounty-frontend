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
 * projection disable the buttons with accessible reasons. Action availability
 * is derived from canonical state only — never from a displayed countdown.
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
  onActionVerify?: () => void;
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

export function ClaimActions({ claim, freshness, onActionVerify, onDispute }: ClaimActionsProps) {
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