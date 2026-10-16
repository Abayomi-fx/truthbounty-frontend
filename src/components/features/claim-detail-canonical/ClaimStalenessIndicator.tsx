'use client';

/**
 * ClaimStalenessIndicator — Freshness warning banner
 *
 * Displays when projection data is stale or degraded, with refresh action.
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { UseClaimDetailFreshnessResult } from '@/hooks/useClaimDetailFreshness';

export interface ClaimStalenessIndicatorProps {
  freshness: UseClaimDetailFreshnessResult;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function ClaimStalenessIndicator({
  freshness,
  onRefresh,
  isRefreshing = false,
}: ClaimStalenessIndicatorProps) {
  if (freshness.status === 'fresh') return null;

  const isDegraded = freshness.status === 'degraded';
  const borderColor = isDegraded ? 'border-amber-500/20' : 'border-yellow-500/20';
  const bgColor = isDegraded ? 'bg-amber-500/10' : 'bg-yellow-500/10';
  const textColor = isDegraded ? 'text-amber-500' : 'text-yellow-500';
  const iconColor = isDegraded ? 'text-amber-500' : 'text-yellow-500';

  let message = 'Data may be out of date.';
  if (isDegraded) {
    message = freshness.reason || 'Some data is temporarily unavailable.';
  } else if (freshness.isStale) {
    message = `Data may be out of date. Last updated ${freshness.lastUpdated}.`;
  }

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border ${borderColor} ${bgColor} mb-4`}
      role="status"
      aria-live="polite"
    >
      <AlertTriangle
        className={`h-5 w-5 ${iconColor} flex-shrink-0 mt-0.5`}
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${textColor}`}>{message}</p>

        {freshness.blockLag !== null && freshness.blockLag > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            Indexer is {freshness.blockLag} blocks behind chain finality.
          </p>
        )}
      </div>

      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border ${borderColor} ${textColor} hover:bg-yellow-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-[#18181b] text-sm font-medium`}
          aria-label={isRefreshing ? 'Refreshing data…' : 'Refresh data'}
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      )}
    </div>
  );
}
