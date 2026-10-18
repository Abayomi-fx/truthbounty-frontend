'use client';

/**
 * ClaimDetailErrorBoundary — Error boundary for claim detail views
 *
 * Wraps ClaimDetailView with error isolation. Provides custom fallback
 * UI that matches the claim detail design system.
 */

import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ClaimDetailError } from './ClaimDetailError';
import type { ReactNode } from 'react';

export interface ClaimDetailErrorBoundaryProps {
  children: ReactNode;
  claimId?: string;
  onReset?: () => void;
}

export function ClaimDetailErrorBoundary({
  children,
  claimId,
  onReset,
}: ClaimDetailErrorBoundaryProps) {
  return (
    <ErrorBoundary
      scope={`feature:claim-detail${claimId ? `:${claimId}` : ''}`}
      fallback={({ message, onRetry }) => (
        <ClaimDetailError
          error={new Error(message)}
          errorCode="UNKNOWN"
          onRetry={onRetry}
        />
      )}
      onReset={onReset}
      resetKeys={[claimId]}
    >
      {children}
    </ErrorBoundary>
  );
}
