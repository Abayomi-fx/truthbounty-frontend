/*
 * Query hooks for disputes.
 *
 * Authoritative source: on-chain indexed dispute projections.
 *
 * Security rules:
 *  - Dispute IDs, vote counts, and stake amounts must come from the
 *    on-chain projection API; never fabricate or increment locally.
 *  - `createDispute` mutation invalidates only the scoped projection keys
 *    for the affected claim — never the entire disputes namespace.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import {
  fetchDisputesByClaim,
  fetchDisputeDetail,
  fetchDisputeRegister,
  fetchPublicDisputeDetail,
  createDispute,
  type CreateDisputePayload,
  type Dispute,
} from '../api/disputes.api';

/**
 * Staleness threshold for dispute projections. Disputes can change
 * during active voting, so we refresh aggressively but still expose
 * issueData.isStale to the UI so it can fail closed rather than present
 * stale critical data as current.
 */
const DISPUTES_STALE_TIME_MS = 1000 * 30; // 30 s — disputes can change during active voting

/**
 * All disputes associated with a specific claim.
 */
export function useDisputesByClaim(claimId: string) {
  return useQuery<Dispute[]>({
    queryKey: queryKeys.disputes.byClaim(claimId),
    queryFn: () => fetchDisputesByClaim(claimId),
    enabled: Boolean(claimId),
    staleTime: DISPUTES_STALE_TIME_MS,
    // Keep previous data visible but flag staleness to the consumer.
    refetchOnMount: true,
    retry: 1,
  });
}

/**
 * Single dispute detail by dispute ID.
 */
export function useDisputeDetail(disputeId: string) {
  return useQuery<Dispute>({
    queryKey: queryKeys.disputes.detail(disputeId),
    queryFn: () => fetchDisputeDetail(disputeId),
    enabled: Boolean(disputeId),
    staleTime: DISPUTES_STALE_TIME_MS,
    refetchOnMount: true,
    retry: 1,
  });
}

/**
 * Public dispute register projection.
 *
 * The register is a read-only projection. Freshness is labelled by the
 * projection layer; the UI must not infer canonical authority from it.
 */
export function useDisputeRegister() {
  return useQuery({
    queryKey: queryKeys.disputes.register(),
    queryFn: fetchDisputeRegister,
    staleTime: 1000 * 30,
  });
}

/**
 * Public dispute detail projection by dispute ID.
 *
 * Resolves to `null` when the ID is unknown to the projection layer.
 */
export function usePublicDisputeDetail(disputeId: string) {
  return useQuery({
    queryKey: queryKeys.disputes.publicDetail(disputeId),
    queryFn: () => fetchPublicDisputeDetail(disputeId),
    enabled: !!disputeId,
    staleTime: 1000 * 30,
  });
}

/**
 * Mutation to create a new dispute.
 *
 * The mutation forwards the canonical payload to the API, which is a
 * projection of on-chain state. Success here means the request was
 * accepted for indexing — it does NOT mean the dispute is finalized.
 * Consumers must still read the projection to confirm chain state.
 *
 * On success: invalidates the disputes projection for the affected claim and
 * the claim detail (which may reflect the new dispute state).
 * Does NOT invalidate disputes.all — no cache-wide churn.
 */
export function useCreateDispute() {
  const queryClient = useQueryClient();

  return useMutation<Dispute, Error, CreateDisputePayload>({
    mutationFn: createDispute,
    onSuccess: (_data, variables: CreateDisputePayload) => {
      // Surgical invalidation: only the projections downstream of this claim.
      queryClient.invalidateQueries({
        queryKey: queryKeys.disputes.byClaim(variables.claimId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.claims.detail(variables.claimId),
      });
    },
  });
}
