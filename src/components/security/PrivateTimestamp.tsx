'use client';

/**
 * PrivateTimestamp — Privacy-preserving relative time display
 *
 * V2-FE Evidence Privacy Protection — Displays generalized relative timestamps
 * to prevent temporal correlation while maintaining UX clarity.
 *
 * Format:
 *   < 1 hour: ~{minutes}m ago
 *   1-24 hours: ~{hours}h ago
 *   1-7 days: ~{days}d ago
 *   7-28 days: ~{weeks}w ago
 *   > 4 weeks: Date only (YYYY-MM-DD)
 *
 * See: docs/EVIDENCE_PRIVACY_MODEL.md §3.4
 */

import React from 'react';
import { formatRelativeTime } from '@/lib/security/evidence-privacy';

export interface PrivateTimestampProps {
  /** ISO timestamp or Date */
  timestamp: string | Date;
  /** Optional CSS classes */
  className?: string;
  /** Optional prefix text (e.g., "Submitted") */
  prefix?: string;
  /** Show tooltip with exact timestamp (default: false for privacy) */
  showTooltip?: boolean;
}

/**
 * Display timestamp as generalized relative time for privacy.
 *
 * Examples:
 *   - "~2h ago"
 *   - "~3d ago"
 *   - "2026-09-15" (> 4 weeks)
 */
export function PrivateTimestamp({
  timestamp,
  className = '',
  prefix,
  showTooltip = false,
}: PrivateTimestampProps) {
  const relative = formatRelativeTime(timestamp);

  const displayText = prefix ? `${prefix} ${relative.display}` : relative.display;

  const tooltipText = showTooltip
    ? `Approximately ${relative.display} (exact time hidden for privacy)`
    : undefined;

  return (
    <time
      dateTime={typeof timestamp === 'string' ? timestamp : timestamp.toISOString()}
      className={`text-gray-400 text-xs ${className}`}
      title={tooltipText}
      aria-label={`${prefix ? prefix + ' ' : ''}${relative.display}`}
    >
      {displayText}
    </time>
  );
}

export default PrivateTimestamp;
