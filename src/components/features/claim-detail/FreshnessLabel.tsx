'use client';

/**
 * FreshnessLabel (UI-FE-010)
 *
 * Renders a live "Updated X ago" label sourced from the React Query
 * `dataUpdatedAt` Unix timestamp.  The element carries `role="status"` so
 * assistive technology can pick up freshness changes without an intrusive
 * alert.  When stale, the `text-warning` token is applied (the project's
 * canonical stale colour; the spec draft calls this `text-semantic-stale`
 * but that token is not declared in src/lib/design-tokens.ts).
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FreshnessLabelProps {
  /**
   * Unix timestamp in milliseconds returned by React Query's `dataUpdatedAt`.
   * The component derives the human-readable "X ago" string from this value.
   */
  dataUpdatedAt: number;
  /**
   * When `true` the label renders in the `text-warning` token colour
   * (design spec: `text-semantic-stale`) to signal that the data may be
   * out of date.
   */
  isStale: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a millisecond diff into a compact human-readable "X ago" string.
 * Mirrors the `formatTimeSince` helper already used in `ClaimLifecycleTimeline`.
 */
function formatAgo(diffMs: number): string {
  if (diffMs < 5_000) return 'just now';
  if (diffMs < 60_000) return `${Math.floor(diffMs / 1_000)}s ago`;
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `FreshnessLabel` — lightweight "Updated X ago" indicator.
 *
 * Renders with `role="status"` so screen readers can announce freshness
 * changes politely without interrupting the user.
 *
 * @example
 * <FreshnessLabel dataUpdatedAt={Date.now() - 120_000} isStale={false} />
 * // → "Updated 2m ago"
 *
 * <FreshnessLabel dataUpdatedAt={Date.now() - 3_600_000} isStale={true} />
 * // → "Updated 1h ago"  (rendered in text-warning colour)
 */
export function FreshnessLabel({ dataUpdatedAt, isStale, className }: FreshnessLabelProps) {
  const [now, setNow] = React.useState(() => Date.now());

  // Re-compute the "ago" string every 30 s to keep it live without hammering
  // the React scheduler for rapid re-renders.
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const diffMs = Math.max(0, now - dataUpdatedAt);
  const label = `Updated ${formatAgo(diffMs)}`;

  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'tb-label inline-block',
        isStale
          ? // text-warning is the canonical stale colour token in this project.
            'text-warning'
          : 'text-ink-muted',
        className,
      )}
    >
      {label}
    </span>
  );
}

export default FreshnessLabel;
