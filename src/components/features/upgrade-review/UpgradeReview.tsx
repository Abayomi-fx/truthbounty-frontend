'use client';

/**
 * UpgradeReview — UI-FE-031
 *
 * Composition for the upgrade and governed-unpause review.
 *
 * Shows, under governance context:
 *   - Current and proposed implementation (release comparison).
 *   - Release verification and compatibility/layout evidence.
 *   - Affected operations cross-referenced against the operational queue.
 *   - Exact governed calls and the current transaction lifecycle.
 *   - Rollback plan evidence.
 *
 * All sections are read-only evidence. Any missing verification blocks
 * governed execution, which is never exposed from this interface.
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type {
  CurrentReleaseReview,
  UpgradeCandidateDescriptor,
  UpgradeReviewSnapshot,
} from '@/lib/upgrade-review/types';
import type { ProtocolLifecycleState } from '@/lib/protocol-contract';
import { resolveCandidateVerification } from '@/lib/upgrade-review/upgrade-review';
import { useUpgradeReviewData } from '@/hooks/useUpgradeReviewData';
import { UpgradeReleaseSummary } from './UpgradeReleaseSummary';
import { ReleaseVerificationEvidence } from './ReleaseVerificationEvidence';
import { CompatibilityEvidence } from './CompatibilityEvidence';
import { AffectedOperationsReview } from './AffectedOperationsReview';
import { RollbackPlanReview } from './RollbackPlanReview';
import { GovernedUnpauseReview } from './GovernedUnpauseReview';
import { UpgradeReviewBlockedState } from './UpgradeReviewBlockedState';

export interface UpgradeReviewProps {
  className?: string;
  /** Injected snapshot for deterministic component tests. */
  snapshot?: UpgradeReviewSnapshot;
  /** When false, renders the unauthorized state (fail closed). */
  authorized?: boolean;
  unauthorizedReason?: string | null;
}

export function UpgradeReview({
  className = '',
  snapshot,
  authorized = true,
  unauthorizedReason = null,
}: UpgradeReviewProps) {
  const resolved = snapshot ?? null;

  const candidateBlockedReasons = resolved
    ? resolveCandidateVerification(resolved.candidate)
    : [];
  const candidateExecutionBlocked =
    (resolved?.blockedReasons.length ?? 0) > 0;

  return (
    <div
      className={`space-y-8 ${className}`}
      data-testid="upgrade-review-container"
    >
      <header className="space-y-2" data-testid="upgrade-review-header">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Upgrade and Governed-Unpause Review
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Read-only review of the current release, the candidate implementation,
          and the governed execution that would follow an approved upgrade.
        </p>
      </header>

      {authorized === false ? (
        <UpgradeReviewBlockedState
          unauthorizedReason={unauthorizedReason}
          blockingReasons={[]}
        />
      ) : resolved !== null ? (
        <UpgradeReviewContent
          currentRelease={resolved.currentRelease}
          candidate={resolved.candidate}
          candidateBlockedReasons={candidateBlockedReasons}
          candidateExecutionBlocked={candidateExecutionBlocked}
          lifecycleState={resolved.currentLifecycle.state}
          lifecycleLabel={resolved.currentLifecycle.label}
          lifecycleBlockingReasons={
            resolved.currentLifecycle.blockingReasons
          }
          governedCalls={resolved.governedCalls}
          affectedOperations={resolved.affectedOperations}
          rollback={resolved.rollback}
          blockingReasons={resolved.blockedReasons}
        />
      ) : (
        <UpgradeReviewConnected className={className} />
      )}
    </div>
  );
}

interface UpgradeReviewContentProps {
  currentRelease: CurrentReleaseReview;
  candidate: UpgradeCandidateDescriptor;
  candidateBlockedReasons: string[];
  candidateExecutionBlocked: boolean;
  lifecycleState: ProtocolLifecycleState;
  lifecycleLabel: string;
  lifecycleBlockingReasons: string[];
  governedCalls: readonly import('@/lib/upgrade-review/types').UpgradeGovernedCall[];
  affectedOperations:
    readonly import('@/lib/upgrade-review/types').AffectedOperationReview[];
  rollback: import('@/lib/upgrade-review/types').RollbackReview;
  blockingReasons: string[];
  className?: string;
}

function UpgradeReviewContent({
  currentRelease,
  candidate,
  candidateBlockedReasons,
  candidateExecutionBlocked,
  lifecycleState,
  lifecycleLabel,
  lifecycleBlockingReasons,
  governedCalls,
  affectedOperations,
  rollback,
  blockingReasons,
  className = '',
}: UpgradeReviewContentProps) {
  return (
    <>
      <UpgradeReleaseSummary
        currentRelease={currentRelease}
        candidate={candidate}
        className={className}
      />
      <ReleaseVerificationEvidence
        currentRelease={currentRelease}
        candidate={candidate}
        candidateBlockedReasons={candidateBlockedReasons}
        className={className}
      />
      <CompatibilityEvidence
        currentRelease={currentRelease}
        candidate={candidate}
        candidateBlockedReasons={candidateBlockedReasons}
        className={className}
      />
      <AffectedOperationsReview
        affectedOperations={affectedOperations}
        className={className}
      />
      <GovernedUnpauseReview
        governedCalls={governedCalls}
        currentLifecycleState={lifecycleState}
        currentLifecycleLabel={lifecycleLabel}
        currentLifecycleBlockingReasons={lifecycleBlockingReasons}
        candidateExecutionBlocked={candidateExecutionBlocked}
        className={className}
      />
      <RollbackPlanReview rollback={rollback} className={className} />

      {blockingReasons.length > 0 && (
        <UpgradeReviewBlockedState
          blockingReasons={blockingReasons}
          className={className}
        />
      )}
    </>
  );
}

function UpgradeReviewConnected({ className = '' }: { className?: string }) {
  const { isAuthorized, unauthorizedReason, review } = useUpgradeReviewData();
  if (!isAuthorized) {
    return (
      <UpgradeReviewBlockedState
        unauthorizedReason={unauthorizedReason}
        blockingReasons={[]}
        className={className}
      />
    );
  }
  return (
    <UpgradeReviewContent
      currentRelease={review.currentRelease}
      candidate={review.candidate}
      candidateBlockedReasons={resolveCandidateVerification(review.candidate)}
      candidateExecutionBlocked={!review.isFullyVerified}
      lifecycleState={review.currentLifecycle.state}
      lifecycleLabel={review.currentLifecycle.label}
      lifecycleBlockingReasons={review.currentLifecycle.blockingReasons}
      governedCalls={review.governedCalls}
      affectedOperations={review.affectedOperations}
      rollback={review.rollback}
      blockingReasons={review.blockedReasons}
      className={className}
    />
  );
}

export default UpgradeReview;
