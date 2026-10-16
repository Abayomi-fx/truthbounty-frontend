/**
 * ClaimDetailPage — Example page component showing complete integration
 *
 * This file demonstrates how to integrate ClaimDetailView with:
 * - Error boundary
 * - Wallet integration
 * - Navigation
 * - Error recovery
 *
 * NOT FOR PRODUCTION USE - This is a reference implementation.
 */

'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ClaimDetailView } from './ClaimDetailView';
import { ClaimDetailErrorBoundary } from './ClaimDetailErrorBoundary';

export interface ClaimDetailPageProps {
  params: Promise<{ claimId: string }>;
}

/**
 * Example page component for claim detail route.
 * Typically placed at: app/(dashboard)/claim-detail/[claimId]/page.tsx
 */
export default function ClaimDetailPage({ params }: ClaimDetailPageProps) {
  const resolvedParams = React.use(params);
  const { claimId } = resolvedParams;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <ClaimDetailErrorBoundary claimId={claimId}>
        <ClaimDetailView claimId={claimId} />
      </ClaimDetailErrorBoundary>
    </div>
  );
}

/**
 * Alternative: With custom error recovery
 */
export function ClaimDetailPageWithRecovery({ params }: ClaimDetailPageProps) {
  const resolvedParams = React.use(params);
  const { claimId } = resolvedParams;
  const [resetKey, setResetKey] = React.useState(0);

  const handleReset = React.useCallback(() => {
    setResetKey((prev) => prev + 1);
  }, []);

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <ClaimDetailErrorBoundary
        claimId={claimId}
        key={resetKey}
        onReset={handleReset}
      >
        <ClaimDetailView claimId={claimId} />
      </ClaimDetailErrorBoundary>
    </div>
  );
}
