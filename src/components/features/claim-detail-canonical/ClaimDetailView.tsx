'use client';

/**
 * ClaimDetailView — Main claim detail presentation component
 *
 * Orchestrates all claim detail sub-components and handles view state routing.
 * Renders canonical projection data with proper state handling (loading, ready,
 * ready-stale, not-found, error).
 *
 * This component never fabricates protocol state. All data comes from validated
 * canonical projections.
 */

import { useClaimDetailProjection } from '@/hooks/useClaimDetailProjection';
import { useClaimDetailFreshness } from '@/hooks/useClaimDetailFreshness';
import { ClaimDetailSkeleton } from './ClaimDetailSkeleton';
import { ClaimNotFound } from './ClaimNotFound';
import { ClaimDetailError } from './ClaimDetailError';
import { ClaimStalenessIndicator } from './ClaimStalenessIndicator';
import { ClaimHeader } from './ClaimHeader';
import { ClaimContent } from './ClaimContent';
import { ClaimVerifications } from './ClaimVerifications';
import { ClaimSettlement } from './ClaimSettlement';
import { ClaimActions } from './ClaimActions';

export interface ClaimDetailViewProps {
  claimId: string;
  /** Enable/disable polling for mutable claims (default: true) */
  enablePolling?: boolean;
  /** Enable/disable wallet-gated actions (default: true) */
  showActions?: boolean;
  /** Callback when user clicks Verify button */
  onVerify?: () => void;
  /** Callback when user clicks Dispute button */
  onDispute?: () => void;
}

export function ClaimDetailView({
  claimId,
  enablePolling = true,
  showActions = true,
  onVerify,
  onDispute,
}: ClaimDetailViewProps) {
  const projection = useClaimDetailProjection({
    claimId,
    enabled: !!claimId,
    refetchInterval: enablePolling ? undefined : false,
  });

  const freshness = useClaimDetailFreshness(projection.data);

  // Route to appropriate view state
  switch (projection.viewState) {
    case 'loading':
      return <ClaimDetailSkeleton />;

    case 'not-found':
      return <ClaimNotFound claimId={claimId} />;

    case 'error':
      return (
        <ClaimDetailError
          error={projection.error}
          errorCode={projection.errorCode ?? undefined}
          onRetry={() => projection.refetch()}
        />
      );

    case 'ready':
    case 'ready-stale': {
      // Data is guaranteed to be non-null in ready/ready-stale states
      if (!projection.data) {
        // Defensive: should never happen, but fail gracefully
        return (
          <ClaimDetailError
            error={new Error('Projection data unavailable')}
            onRetry={() => projection.refetch()}
          />
        );
      }

      const { claim } = projection.data;

      return (
        <div className="space-y-4">
          {/* Staleness indicator (shown in ready-stale state) */}
          {projection.viewState === 'ready-stale' && (
            <ClaimStalenessIndicator
              freshness={freshness}
              onRefresh={() => projection.refetch()}
              isRefreshing={projection.isRefetching}
            />
          )}

          {/* Main claim card */}
          <div className="bg-[#18181b] border border-[#232329] rounded-xl p-4 sm:p-6 space-y-4">
            <ClaimHeader claim={claim} />
            <ClaimContent claim={claim} />
            <ClaimVerifications claim={claim} />
            <ClaimSettlement claim={claim} />
            
            {/* Wallet-gated actions */}
            {showActions && (
              <ClaimActions
                claim={claim}
                freshness={freshness}
                onVerify={onVerify}
                onDispute={onDispute}
              />
            )}
          </div>
        </div>
      );
    }

    default: {
      // Exhaustiveness check: should never reach here
      const _exhaustive: never = projection.viewState;
      return (
        <ClaimDetailError
          error={new Error(`Unknown view state: ${_exhaustive}`)}
          onRetry={() => projection.refetch()}
        />
      );
    }
  }
}
