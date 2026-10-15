'use client';

/**
 * ClaimDetailError — Error state for claim detail view
 *
 * Displays user-friendly error messages with retry capability.
 * Maps canonical error codes to actionable UI. Includes focus management
 * to meet accessibility requirements.
 */

import React from 'react';
import { XCircle, RefreshCw } from 'lucide-react';
import type { ClaimDetailError as ClaimDetailErrorType } from '@/app/types/claim-detail-projection';

export interface ClaimDetailErrorProps {
  error: Error | ClaimDetailErrorType | null;
  errorCode?: string;
  onRetry?: () => void;
}

function getErrorMessage(error: Error | ClaimDetailErrorType | null, errorCode?: string): string {
  if (!error) return 'An unexpected error occurred.';

  // Map canonical error codes to user-friendly messages
  switch (errorCode) {
    case 'PROJECTION_UNAVAILABLE':
      return 'Could not load claim details. The service may be temporarily unavailable.';
    case 'PROJECTION_MALFORMED':
      return 'Received invalid data from the server. Please try again.';
    case 'PROJECTION_STALE':
      return 'Claim data is temporarily unavailable due to indexer lag. Please try again shortly.';
    case 'UNSUPPORTED_CHAIN':
      return 'This claim is on an unsupported network. Please switch to Optimism or OP Sepolia.';
    default:
      return error.message || 'Failed to load claim details.';
  }
}

export function ClaimDetailError({ error, errorCode, onRetry }: ClaimDetailErrorProps) {
  const message = getErrorMessage(error, errorCode);
  const canRetry = errorCode !== 'UNSUPPORTED_CHAIN';
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  // Focus management: move focus to error heading when error appears
  React.useEffect(() => {
    if (headingRef.current) {
      headingRef.current.focus();
    }
  }, []);

  return (
    <div
      className="bg-[#18181b] border border-red-500/20 rounded-xl p-6"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-4">
        <XCircle
          className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />

        <div className="flex-1">
          <h2
            ref={headingRef}
            className="text-lg font-bold text-red-500 mb-2 focus:outline-none"
            id="claim-detail-error-heading"
            tabIndex={-1}
          >
            Failed to Load Claim
          </h2>

          <p className="text-gray-300 text-sm mb-4">{message}</p>

          {canRetry && onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[#18181b]"
              aria-label="Retry loading claim details"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try Again
            </button>
          )}

          {errorCode && (
            <p className="text-xs text-gray-500 mt-3">Error code: {errorCode}</p>
          )}
        </div>
      </div>
    </div>
  );
}
