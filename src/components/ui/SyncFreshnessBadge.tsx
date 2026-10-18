'use client';

/**
 * SyncFreshnessBadge — accessible freshness + manual-refresh indicator
 * (UI-FE-082).
 *
 * When automated updates are deferred (reduced-data mode), the user must still
 * be able to tell how old the currently displayed projection is and refresh it
 * on demand. This badge renders the last-synced timestamp in a polite live
 * region and exposes a keyboard-operable refresh control.
 *
 * It carries no protocol semantics: it only formats a caller-provided
 * timestamp and never fabricates freshness. Callers remain responsible for the
 * integrity of the data they hand in.
 */

import { useMemo } from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { formatLastSynced } from '@/lib/reduced-data';

export interface SyncFreshnessBadgeProps {
  /** Timestamp of the last successful read (ms epoch, ISO string, or Date). */
  lastSyncedAt: number | string | Date | null | undefined;
  /** True when automatic refresh has been deferred by reduced-data mode. */
  isDeferred?: boolean;
  /** Manual refresh handler. When omitted, no refresh button is rendered. */
  onRefresh?: () => void;
  /** True while a manual refresh is in flight. */
  isRefreshing?: boolean;
  /** Short noun for what is being synced, e.g. "claims". */
  label?: string;
  /** Override the clock (deterministic tests). */
  now?: number;
  className?: string;
}

export function SyncFreshnessBadge({
  lastSyncedAt,
  isDeferred = false,
  onRefresh,
  isRefreshing = false,
  label = 'data',
  now,
  className = '',
}: SyncFreshnessBadgeProps) {
  const formatted = useMemo(() => formatLastSynced(lastSyncedAt, now), [lastSyncedAt, now]);

  const statusText = `Last synced ${formatted}`;
  const deferredText = isDeferred ? 'Auto-refresh paused to save data.' : '';

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground ${className}`}
      data-testid="sync-freshness-badge"
      data-deferred={isDeferred}
    >
      <span
        className="inline-flex items-center gap-1.5"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          {statusText}
          {deferredText ? ` · ${deferredText}` : ''}
        </span>
        <span className="sr-only"> {label} freshness</span>
      </span>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label={isRefreshing ? `Refreshing ${label}` : `Refresh ${label} now`}
          aria-busy={isRefreshing}
          data-testid="sync-freshness-refresh"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`}
            aria-hidden="true"
          />
          <span>Refresh</span>
        </button>
      )}
    </div>
  );
}

export default SyncFreshnessBadge;
