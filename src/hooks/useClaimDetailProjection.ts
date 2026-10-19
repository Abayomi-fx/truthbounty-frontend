'use client';

/**
 * useClaimDetailProjection — React Query hook for claim detail projections
 *
 * Fetches canonical claim detail from the API with explicit freshness tracking,
 * fail-closed validation, and deterministic view state derivation.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  fetchClaimDetailProjection,
  getClaimDetailErrorCode,
} from '@/app/api/claim-detail.api';
import {
  ClaimDetailEnvelope,
  ClaimDetailViewState,
  deriveClaimDetailViewState,
  CLAIM_DETAIL_FRESHNESS_DEFAULTS,
} from '@/app/types/claim-detail-projection';

export interface UseClaimDetailProjectionConfig {
  /** Claim ID to fetch */
  claimId: string;
  /** Enable/disable the query (default: true when claimId is non-empty) */
  enabled?: boolean;
  /** Stale time in ms (default: 30s) */
  staleTime?: number;
  /** Polling interval in ms when claim is in mutable state (default: 10s) */
  refetchInterval?: number | false;
}

export interface UseClaimDetailProjectionResult {
  /** Validated claim detail envelope (null when loading or error) */
  data: ClaimDetailEnvelope | null;
  /** Canonical view state for rendering */
  viewState: ClaimDetailViewState;
  /** True when initial fetch is in progress */
  isLoading: boolean;
  /** True when background refetch is in progress */
  isRefetching: boolean;
  /** True when an error occurred */
  isError: boolean;
  /** Error instance (null when no error) */
  error: Error | null;
  /** Canonical error code (null when no error) */
  errorCode: ReturnType<typeof getClaimDetailErrorCode> | null;
  /** Manual refetch function */
  refetch: () => void;
}

/**
 * Fetch claim detail projection with canonical state handling.
 */
export function useClaimDetailProjection(
  config: UseClaimDetailProjectionConfig
): UseClaimDetailProjectionResult {
  const {
    claimId,
    enabled = true,
    staleTime = CLAIM_DETAIL_FRESHNESS_DEFAULTS.staleAfterMs,
    refetchInterval = false,
  } = config;

  const queryEnabled = enabled && !!claimId && claimId.trim().length > 0;

  const query = useQuery({
    queryKey: ['claim-detail-projection', claimId] as const,
    queryFn: ({ signal }) => fetchClaimDetailProjection(claimId, signal),
    enabled: queryEnabled,
    staleTime,
    refetchInterval: (query) => {
      // Poll when claim is in mutable state (OPEN, UNDER_REVIEW, DISPUTED)
      if (!query.state.data) return false;
      const status = query.state.data.claim.status;
      const isMutable = status === 'OPEN' || status === 'UNDER_REVIEW' || status === 'DISPUTED';
      return isMutable && refetchInterval !== false
        ? refetchInterval || CLAIM_DETAIL_FRESHNESS_DEFAULTS.pollIntervalMs
        : false;
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      // Don't retry on 404 (claim not found) — it's a terminal state.
      const code = getClaimDetailErrorCode(error);
      if (code === 'CLAIM_NOT_FOUND') return false;
      // Retry up to 2 times for transient errors.
      return failureCount < 2;
    },
  });

  const errorCode = useMemo(
    () => (query.error ? getClaimDetailErrorCode(query.error) : null),
    [query.error]
  );

  const viewState = useMemo(
    () =>
      deriveClaimDetailViewState(
        query.isLoading && !query.data,
        query.isError,
        errorCode,
        query.data ?? null
      ),
    [query.isLoading, query.data, query.isError, errorCode]
  );

  return {
    data: query.data ?? null,
    viewState,
    isLoading: query.isLoading && !query.data,
    isRefetching: query.isFetching && !!query.data,
    isError: query.isError,
    error: query.error ?? null,
    errorCode,
    refetch: query.refetch,
  };
}
