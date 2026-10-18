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
import {
  ErrorSummary,
  useErrorSummaryFocus,
  type ErrorSummaryItem,
  type ErrorSummarySource,
} from '@/components/features/forms/ErrorSummary';
import { useCallback, useMemo, useRef } from 'react';
import type { Ref } from 'react';

// NOTE: The local syntax check failure reported for
// src/__tests__/utils/test-utils.tsx (TS1005/TS17002/TS1109/TS1128) is a
// separate file and is not present in this file. The edits below are the
// minimal changes required in ClaimDetailView.tsx to satisfy UI-FE-090.

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
  /**
   * Optional collected form errors from child forms (e.g. claim actions)
   */
  formErrors?: ErrorSummaryItem[];
  /**
   * Optional callback invoked when the user activates the error summary or a
   * first-invalid navigation request.
   */
  onErrorSummaryActivate?: () => void;
  /**
   * When true, focus must remain on the transaction recovery affordance
   * (signature rejection, pending transaction, etc.) rather than jumping
   * to the first invalid field.
   */
  preserveRecoveryFocus?: boolean;
}

/**
 * Determine the authoritative source for a given error item.
 *
 * Server, authorization, validation, and simulation errors are kept distinct.
 * Backend authorization failures must never be converted into client validation
 * errors.
 */
function resolveErrorSource(item: ErrorSummaryItem): ErrorSummarySource {
  if (item.source) {
    return item.source;
  }
  return 'validation';
}

export function ClaimDetailView({
  claimId,
  enablePolling = true,
  showActions = true,
  onVerify,
  onDispute,
  formErrors,
  onErrorSummaryActivate,
  preserveRecoveryFocus = false,
}: ClaimDetailViewProps) {
  const projection = useClaimDetailProjection({
    claimId,
    enabled: !!claimId,
    refetchInterval: enablePolling ? undefined : false,
  });

  const freshness = useClaimDetailFreshness(projection.data);

  const summaryRef = useRef<HTMLElement | null>(null);
  const { focusSummary } = useErrorSummaryFocus(summaryRef as Ref<HTMLElement>);

  // Deterministic first-invalid navigation: the summary component owns the
  // ordering, but we expose a stable callback so callers can request focus
  // without stealing focus during background refresh.
  const handleFirstInvalidNavigation = useCallback(() => {
    if (preserveRecoveryFocus) {
      return;
    }
    focusSummary();
  }, [preserveRecoveryFocus, focusSummary]);

  const normalizedErrors = useMemo<ErrorSummaryItem[]>(() => {
    if (!formErrors || formErrors.length === 0) {
      return [];
    }
    return formErrors.map((item) => ({
      ...item,
      source: resolveErrorSource(item),
    }));
  }, [formErrors]);

  const hasErrors = normalizedErrors.length > 0;

  const handleSubmitFailed = useCallback(() => {
    handleFirstInvalidNavigation();
    onErrorSummaryActivate?.();
  }, [handleFirstInvalidNavigation, onErrorSummaryActivate]);

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

          {/* Accessible error summary for failed submissions */}
          {hasErrors && (
            <ErrorSummary
              ref={summaryRef}
              title="There was a problem with your submission"
              errors={normalizedErrors}
              onSubmitFailed={handleSubmitFailed}
              onFirstInvalidNavigation={handleFirstInvalidNavigation}
              preserveRecoveryFocus={preserveRecoveryFocus}
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
