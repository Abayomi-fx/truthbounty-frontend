// src/app/queries/claims.queries.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import {
  fetchClaims,
  fetchClaimDetail,
  submitClaim,
  fetchClaimsByStatus,
  ClaimSubmissionData,
} from '../api/claims.api';
import { fetchClaimDetailProjection } from '../api/claim-detail.api';
import type { RequestContext } from '../lib/apiLifecycle';

/**
 * Resolves the current wallet/chain/release context for lifecycle reads.
 * Callers can override this to inject a reactive source of truth.
 */
export type ContextResolver = () => RequestContext | null | undefined;

export function useClaims() {
  return useQuery({
    queryKey: queryKeys.claims.lists(),
    queryFn: fetchClaims,
  });
}

/**
 * Claim detail read routed through the bounded lifecycle adapter.
 * Late responses from a superseded context are suppressed by the adapter.
 */
export function useClaimDetail(
  claimId: string,
  options: {
    context?: RequestContext;
    getCurrentContext?: ContextResolver;
  } = {},
) {
  return useQuery({
    queryKey: queryKeys.claims.detail(claimId),
    queryFn: async ({ signal }) =>
      fetchClaimDetailProjection(claimId, {
        signal,
        context: options.context,
        getCurrentContext: options.getCurrentContext,
      }),
    staleTime: 1000 * 60 * 2, // 2 min
    enabled: !!claimId,
  });
}

export function useClaimsByStatus(status: string) {
  return useQuery({
    queryKey: queryKeys.claims.byStatus(status),
    queryFn: () => fetchClaimsByStatus(status),
    enabled: !!status,
  });
}

export function useSubmitClaim() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: ClaimSubmissionData) => submitClaim(data),
    // Non-idempotent: never retry automatically.
    retry: false,
    onSuccess: () => {
      // Only invalidate the lists; detail caches remain valid.
      queryClient.invalidateQueries({ queryKey: queryKeys.claims.lists() });
    },
  });

  return {
    ...mutation,
    isLoading: mutation.isPending,
  };
}

// Re-export fetchClaimsByStatus from claims.api
export { fetchClaimsByStatus } from '../api/claims.api';
