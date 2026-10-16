'use client';

/**
 * ClaimantDashboard — V2-FE-152
 *
 * Canonical claimant dashboard answering what needs the user's attention
 * across claims, rewards, and protocol deadlines.
 *
 * Conforms to all Issue #437 acceptance criteria:
 *  - Network-wide mock statistics are never presented as personal metrics.
 *  - No more than 4 high-priority summary cards precede the primary claim list.
 *  - Claim phases and rewards come directly from canonical adapters.
 *  - Every primary action uses the approved route contract.
 *  - Unavailable data is explicit and never replaced by a fixture or fabricated balance.
 *  - Explicit loading, new-user, empty, stale, offline, partial-failure, and unsupported-chain states.
 */

import React from 'react';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, RefreshCw, ShieldAlert, WifiOff, LogIn } from 'lucide-react';
import { useSwitchChain } from 'wagmi';
import { useClaimantDashboardData, type ClaimantDashboardData } from '@/hooks/useClaimantDashboardData';
import { NextActionPanel } from './NextActionPanel';
import { ClaimantSummaryCards } from './ClaimantSummaryCards';
import { ClaimPhaseSummary } from './ClaimPhaseSummary';
import { RecentOwnedClaims } from './RecentOwnedClaims';
import { ClaimantActivityTimeline } from './ClaimantActivityTimeline';
import { APP_ROUTES } from '@/config/navigation';

export interface ClaimantDashboardProps {
  className?: string;
  testDataOverride?: ClaimantDashboardData;
}

export function ClaimantDashboard({ className = '', testDataOverride }: ClaimantDashboardProps) {
  if (testDataOverride) {
    return <ClaimantDashboardContent className={className} data={testDataOverride} />;
  }
  return <ClaimantDashboardConnected className={className} />;
}

function ClaimantDashboardConnected({ className = '' }: { className?: string }) {
  const hookData = useClaimantDashboardData();
  const { switchChain } = useSwitchChain();

  return (
    <ClaimantDashboardContent
      className={className}
      data={hookData}
      onSwitchChain={() => switchChain?.({ chainId: 10 })}
    />
  );
}

export interface ClaimantDashboardContentProps {
  className?: string;
  data: ClaimantDashboardData;
  onSwitchChain?: () => void;
}

export function ClaimantDashboardContent({
  className = '',
  data,
  onSwitchChain,
}: ClaimantDashboardContentProps) {
  const {
    account: _account,
    isConnected,
    isSupportedChain,
    chainName,
    isLoading,
    isStale,
    isOffline,
    isPartialFailure,
    partialFailureMessage,
    ownedClaims,
    phaseCounts,
    nextActions,
    activity,
    freshness: _freshness,
    refetch,
  } = data;

  return (
    <div className={`space-y-6 ${className}`} data-testid="claimant-dashboard">
      {/* 1. Offline & Stale Status Warning */}
      {(isOffline || isStale) && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-amber-500/50 bg-amber-500/10 text-foreground"
          data-testid="claimant-offline-stale-notice"
        >
          <div className="flex items-center gap-3">
            <WifiOff className="h-5 w-5 text-amber-500 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">
                {isOffline ? 'Offline Mode Active' : 'Protocol Data May Be Stale'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isOffline
                  ? 'Showing locally cached protocol reads. Reconnect to refresh live consensus.'
                  : 'Indexer update latency detected. Values may not reflect the latest block.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1.5 self-start sm:self-center px-3 py-1.5 rounded-lg border border-amber-500/30 bg-card text-xs font-semibold hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>Retry Sync</span>
          </button>
        </div>
      )}

      {/* 2. Partial Failure Warning */}
      {isPartialFailure && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-foreground"
          data-testid="claimant-partial-failure-notice"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-destructive">Partial Data Degradation</p>
              <p className="text-xs text-muted-foreground">
                {partialFailureMessage || 'Some dashboard metrics could not be synchronized with the indexer.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1.5 self-start sm:self-center px-3 py-1.5 rounded-lg border border-destructive/30 bg-card text-xs font-semibold hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>Retry Failed Query</span>
          </button>
        </div>
      )}

      {/* 3. Unsupported Network Banner */}
      {isConnected && !isSupportedChain && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-destructive/50 bg-destructive/10 text-foreground"
          data-testid="claimant-unsupported-chain-notice"
        >
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-destructive">Unsupported Network ({chainName})</p>
              <p className="text-xs text-muted-foreground">
                TruthBounty operates on Optimism Mainnet (10) or OP Sepolia (11155420). Switch your wallet to transact.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSwitchChain?.()}
            className="inline-flex items-center gap-1.5 self-start sm:self-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
          >
            <span>Switch to Optimism</span>
          </button>
        </div>
      )}

      {/* 4. Guest / Disconnected Banner */}
      {!isConnected && (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-primary/30 bg-primary/5 text-foreground"
          data-testid="claimant-guest-notice"
        >
          <div className="flex items-start gap-3">
            <LogIn className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-foreground">Connect Wallet for Claimant Metrics</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connect your Web3 wallet to manage your claim submissions, monitor verification deadlines, and collect earned rewards.
              </p>
            </div>
          </div>
          <Link
            href={APP_ROUTES.IDENTITY}
            className="inline-flex items-center justify-center shrink-0 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
          >
            <span>Connect & Verify</span>
          </Link>
        </div>
      )}

      {/* 5. Next-Action Panel (Ordered by consequence and deadline) */}
      <NextActionPanel actions={nextActions} isLoading={isLoading} />

      {/* 6. Summary Cards (Max 4 high-priority personal metric cards preceding claim list) */}
      <ClaimantSummaryCards data={data} />

      {/* 7. Personal Claim Phase Summary */}
      <ClaimPhaseSummary phaseCounts={phaseCounts} isLoading={isLoading} />

      {/* 8. Recent Owned Claims (with permitted actions, deadlines, and empty new-user state) */}
      <RecentOwnedClaims claims={ownedClaims} isLoading={isLoading} />

      {/* 9. Personal Protocol Activity Timeline */}
      <ClaimantActivityTimeline activity={activity} isLoading={isLoading} />
    </div>
  );
}
