'use client';

/**
 * ClaimDetailError — Error state for claim detail view
 *
 * Displays user-friendly error messages with retry capability.
 * Maps canonical error codes to actionable UI. Includes focus management
 * to meet accessibility requirements.
 *
 * Aligned with the canonical system-state contract: meaning never depends
 * on color alone, denied/unavailable/not-found remain semantically distinct,
 * and recoverable identifiers are preserved.
 *
 * Note: when this error represents a transaction recovery state (e.g.
 * pending on-chain submission), focus must remain on the recovery control
 * rather than jumping to a field. The `preserveFocus` prop enforces this.
 */

import React from 'react';
import {
  XCircle,
  RefreshCw,
  ShieldAlert,
  Lock,
  FileQuestion,
  WifiOff,
} from 'lucide-react';
import type { ClaimDetailError as ClaimDetailErrorType } from '@/app/types/claim-detail-projection';

export type SystemStateKind =
  | 'error'
  | 'denied'
  | 'unavailable'
  | 'not-found'
  | 'offline'
  | 'stale';

export interface ClaimDetailErrorProps {
  error: Error | ClaimDetailErrorType | null;
  errorCode?: string;
  onRetry?: () => void;
  /** Preserved recoverable identifier (e.g. claim id). */
  claimId?: string;
  /** Optional freshness metadata for the failed projection. */
  freshness?: { label?: string; timestamp?: string };
  /**
   * When true, the component does not move focus on mount. Use this for
   * transaction recovery states where focus must remain on the recovery
   * control.
   */
  preserveFocus?: boolean;
}

interface StateDescriptor {
  kind: SystemStateKind;
  title: string;
  message: string;
  canRetry: boolean;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  /** Short non-color semantic tag for screen readers and low-color users. */
  tag: string;
}

function describeState(
  error: Error | ClaimDetailErrorType | null,
  errorCode?: string,
): StateDescriptor {
  switch (errorCode) {
    case 'PROJECTION_UNAVAILABLE':
      return {
        kind: 'unavailable',
        title: 'Claim Details Unavailable',
        message:
          'Could not load claim details. The service may be temporarily unavailable.',
        canRetry: true,
        icon: ShieldAlert,
        tag: 'Unavailable',
      };
    case 'PROJECTION_MALFORMED':
      return {
        kind: 'error',
        title: 'Claim Details Error',
        message: 'Received invalid data from the server. Please try again.',
        canRetry: true,
        icon: XCircle,
        tag: 'Error',
      };
    case 'PROJECTION_STALE':
      return {
        kind: 'stale',
        title: 'Claim Details Stale',
        message:
          'Claim data is temporarily unavailable due to indexer lag. Please try again shortly.',
        canRetry: true,
        icon: RefreshCw,
        tag: 'Stale',
      };
    case 'UNSUPPORTED_CHAIN':
      return {
        kind: 'unavailable',
        title: 'Unsupported Network',
        message:
          'This claim is on an unsupported network. Please switch to Optimism or OP Sepolia.',
        canRetry: false,
        icon: WifiOff,
        tag: 'Unavailable',
      };
    case 'CLAIM_NOT_FOUND':
      return {
        kind: 'not-found',
        title: 'Claim Not Found',
        message: 'We could not find this claim. It may have been removed or the identifier is incorrect.',
        canRetry: false,
        icon: FileQuestion,
        tag: 'Not found',
      };
    case 'ACCESS_DENIED':
      return {
        kind: 'denied',
        title: 'Access Denied',
        message: 'You do not have permission to view this claim.',
        canRetry: false,
        icon: Lock,
        tag: 'Denied',
      };
    case 'OFFLINE':
      return {
        kind: 'offline',
        title: 'You Are Offline',
        message: 'Claim details cannot be loaded while offline. Please reconnect and try again',
        canRetry: true,
        icon: WifiOff,
        tag: 'Offline',
      };
    default:
      return {
        kind: 'error',
        title: 'Failed to Load Claim',
        message: error?.message || 'Failed to load claim details.',
        canRetry: true,
        icon: XCircle,
        tag: 'Error',
      };
  }
}

export function ClaimDetailError({
  error,
  errorCode,
  onRetry,
  claimId,
  freshness,
  preserveFocus = false,
}: ClaimDetailErrorProps) {
  const state = describeState(error, errorCode);
  const canRetry = state.canRetry && Boolean(onRetry);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const HeadingIcon = state.icon;

  // Focus management: move focus to error heading when error appears.
  // Skipped when preserveFocus is true (transaction recovery states).
  React.useEffect(() => {
    if (preserveFocus) return;
    if (headingRef.current) {
      headingRef.current.focus();
    }
  }, [preserveFocus]);

  return (
    <div
      className="bg-[18181b] border border-red-500/20 rounded-xl p-6"
      role="alert"
      aria-live="assertive"
      data-system-state={state.kind}
    >
      <div className="flex items-start gap-4">
        <HeadingIcon
          className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5"
          aria-hidden={true}
        />

        <div className="flex-1">
          <span className="inline-flex items-center rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-red-300 mb-2">
            {state.tag}
          </span>

          <h2
            ref={headingRef}
            className="text-lg font-bold text-red-500 mb-2 focus:outline-none"
            id="claim-detail-error-heading"
            tabIndex={-1}
          >
            {state.title}
          </h2>

          <p className="text-gray-300 text-sm mb-4">{state.message}</p>

          {freshness && (freshness.label || freshness.timestamp) && (
            <p className="text-xs text-gray-400 mb-3">
              Freshness: {freshness.label ?? 'Unknown'}
              {freshness.timestamp ? ` (${freshness.timestamp})` : ''}
            </p>
          )}

          {canRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[#18181b] motion-reduce:transition-none"
              aria-label="Retry loading claim details"
            >
              <RefreshCw className="h-4 w-4 motion-reduce:animate-none" aria-hidden={true} />
              Try Again
            </button>
          )}

          {claimId && (
            <p className="text-xs text-gray-400 mt-3">
              Claim ID: <span className="font-mono text-gray-300">{claimId}</span>
            </p>
          )}

          {errorCode && (
            <p className="text-xs text-gray-500 mt-3">Error code: {errorCode}</p>
          )}
        </div>
      </div>
    </div>
  );
}