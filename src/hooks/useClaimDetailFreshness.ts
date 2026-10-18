'use client';

/**
 * useClaimDetailFreshness — Freshness detection for claim detail projections
 *
 * Determines staleness from projection metadata and provides user-visible
 * freshness status and last-updated timestamps.
 */

import { useMemo } from 'react';
import {
  ClaimDetailEnvelope,
  isProjectionStale,
  CLAIM_DETAIL_FRESHNESS_DEFAULTS,
} from '@/app/types/claim-detail-projection';

export type FreshnessStatus = 'fresh' | 'stale' | 'degraded' | 'unknown';

export interface UseClaimDetailFreshnessResult {
  /** Canonical freshness status */
  status: FreshnessStatus;
  /** True when projection is stale (age > threshold or API reports stale) */
  isStale: boolean;
  /** True when projection is degraded (partial data) */
  isDegraded: boolean;
  /** ISO timestamp of when projection was generated */
  generatedAt: string | null;
  /** Human-readable "last updated" string */
  lastUpdated: string;
  /** Reason for staleness/degradation (from API envelope) */
  reason: string | null;
  /** Indexer block height at projection time */
  indexedAtBlock: number | null;
  /** Chain finalized block height at projection time */
  finalizedBlock: number | null;
  /** Block lag (finalizedBlock - indexedAtBlock) */
  blockLag: number | null;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 10) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Analyze projection freshness and return user-facing status.
 */
export function useClaimDetailFreshness(
  envelope: ClaimDetailEnvelope | null,
  staleThresholdMs: number = CLAIM_DETAIL_FRESHNESS_DEFAULTS.staleAfterMs
): UseClaimDetailFreshnessResult {
  return useMemo(() => {
    if (!envelope) {
      return {
        status: 'unknown',
        isStale: false,
        isDegraded: false,
        generatedAt: null,
        lastUpdated: 'unknown',
        reason: null,
        indexedAtBlock: null,
        finalizedBlock: null,
        blockLag: null,
      };
    }

    const { projection } = envelope;
    const apiReportsStale = projection.freshness === 'stale';
    const apiReportsDegraded = projection.freshness === 'degraded';
    const ageStale = isProjectionStale(projection.generatedAt, staleThresholdMs);

    const isStale = apiReportsStale || ageStale;
    const isDegraded = apiReportsDegraded;

    let status: FreshnessStatus;
    if (isDegraded) {
      status = 'degraded';
    } else if (isStale) {
      status = 'stale';
    } else {
      status = 'fresh';
    }

    const blockLag =
      projection.finalizedBlock && projection.indexedAtBlock
        ? projection.finalizedBlock - projection.indexedAtBlock
        : null;

    return {
      status,
      isStale,
      isDegraded,
      generatedAt: projection.generatedAt,
      lastUpdated: formatTimestamp(projection.generatedAt),
      reason: projection.reason ?? null,
      indexedAtBlock: projection.indexedAtBlock,
      finalizedBlock: projection.finalizedBlock,
      blockLag,
    };
  }, [envelope, staleThresholdMs]);
}
