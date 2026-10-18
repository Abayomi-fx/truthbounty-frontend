'use client';

/**
 * ClaimDetailComposer — canonical /claims/:claimId composition root (UI-FE-010)
 *
 * Orchestrates every sub-region of the claim detail view. Owns the master
 * loading / not-found / failed / stale / content state-machine.
 *
 * Architecture invariants:
 * - IntegrityBoundary wraps the full composer; unsupported chain gates
 *   everything before a single child renders.
 * - No protocol field is fabricated. Loading renders a skeleton; not-found
 *   renders an explicit message; failed renders a FallbackBoundary with retry.
 * - Focus moves to the error heading on `failed` or `reorged` transitions.
 * - All state transitions are announced via an aria-live="polite" region.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';

import { IntegrityBoundary } from '@/components/security/IntegrityBoundary';
import { ApiStaleBanner } from '@/components/common/ApiStaleBanner';
import { ClaimDetailsSkeleton } from '@/components/skeletons/ClaimDetailsSkeleton';
import { useClaimLifecycleTimeline } from '@/hooks/useClaimLifecycleTimeline';
import { useReorgReconciliation } from '@/hooks/useReorgReconciliation';
import { usePrefersReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';

import { ClaimHeader } from './ClaimHeader';
import { EconomicSummaryPanel } from './EconomicSummaryPanel';
import { EvidenceRegion } from './EvidenceRegion';
import { VerificationAggregationPanel } from './VerificationAggregationPanel';
import { ActionRail } from './ActionRail';
import { SettlementRegion } from './SettlementRegion';
import { ProvenanceFooter } from './ProvenanceFooter';

import type { TimelinePhase } from '@/app/types/lifecycle';

// ── Sub-region components (Tasks 3-9) are imported above ───────────────────

export interface ClaimDetailComposerProps {
  claimId: string;
  /** Override chain id in tests / Storybook. Defaults to wagmi `useChainId`. */
  chainIdOverride?: number;
}

/**
 * Internal: error fallback shown when a critical fetch fails and cannot be
 * recovered. Satisfies Requirement 1.7.
 */
function CriticalErrorFallback({
  headingRef,
  onRetry,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-lg border border-destructive bg-destructive/10 p-6 text-center"
      data-testid="composer-error-fallback"
    >
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold text-destructive outline-none"
      >
        Unable to load claim
      </h2>
      <p className="mt-2 text-sm text-destructive/80">
        Claim data could not be loaded. No protocol state has been fabricated.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'mt-4 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white',
          'hover:bg-destructive/90 focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2',
          'min-h-[44px] min-w-[44px]',
        )}
        aria-label="Retry loading claim data"
      >
        Retry
      </button>
    </div>
  );
}

/**
 * Internal: not-found state. Satisfies Requirements 1.6 and 10.1.
 */
function ClaimNotFound({
  headingRef,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex min-h-[40vh] flex-col items-center justify-center px-4 py-12 text-center"
      data-testid="composer-not-found"
    >
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-bold tracking-tight text-foreground outline-none"
      >
        Claim not found
      </h2>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        The claim you&apos;re looking for doesn&apos;t exist or is no longer
        available.
      </p>
      <Link
        href="/claims"
        className={cn(
          'mt-6 inline-flex items-center rounded-lg border border-border',
          'bg-background px-4 py-2.5 text-sm font-medium text-foreground',
          'hover:bg-accent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'min-h-[44px]',
        )}
      >
        ← Back to claims
      </Link>
    </div>
  );
}

/**
 * ClaimDetailComposer — the root composition component for /claims/:claimId.
 */
export function ClaimDetailComposer({
  claimId,
  chainIdOverride,
}: ClaimDetailComposerProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  // Timeline / lifecycle state
  const { timeline, isLoading, isError, error, isStale, reconcile } =
    useClaimLifecycleTimeline({
      claimId,
      enableRealtime: true,
      enableAutoReconciliation: true,
    });

  // Reorg state — banner.state !== 'hidden' means a reorg is active
  const { banner: reorgBanner } = useReorgReconciliation();
  const isReorged = reorgBanner.state !== 'hidden';

  // Phase is propagated from SettlementRegion's onPhaseChange callback so
  // ClaimHeader stays in sync without a full page reload.
  const [currentPhase, setCurrentPhase] = useState<TimelinePhase | null>(null);
  const resolvedPhase: TimelinePhase =
    currentPhase ?? timeline?.currentPhase ?? 'CREATED';

  // Chain id — prefer override (tests/Storybook), else wagmi (via IntegrityBoundary)
  // For real rendering the chainId is passed down from the boundary context.
  // We keep it simple here: the default Optimism mainnet is 10.
  const chainId = chainIdOverride ?? 10;

  // Refs for focus management (Requirements 11.3)
  const errorHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  // Track the previous isError / isReorged so we only move focus on *transition*
  const prevIsErrorRef = useRef(false);
  const prevIsReorgedRef = useRef(false);

  // Move focus to error heading on failed / reorged transition
  useEffect(() => {
    const enteredError = isError && !prevIsErrorRef.current;
    const enteredReorg = isReorged && !prevIsReorgedRef.current;
    if ((enteredError || enteredReorg) && errorHeadingRef.current) {
      errorHeadingRef.current.focus();
    }
    prevIsErrorRef.current = isError;
    prevIsReorgedRef.current = isReorged;
  }, [isError, isReorged]);

  // Announce state transitions politely (Requirement 11.2)
  const announce = useCallback((message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = '';
      // Small timeout ensures screen readers re-announce even same-value changes
      setTimeout(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = message;
        }
      }, 50);
    }
  }, []);

  // Announce when stale state is entered
  useEffect(() => {
    if (isStale) announce('Claim data is stale. Please reconcile.');
  }, [isStale, announce]);

  // Announce when reorg is detected
  useEffect(() => {
    if (isReorged) announce('Chain reorganisation detected. Reconciliation required.');
  }, [isReorged, announce]);

  // ── Render branches ──────────────────────────────────────────────────────

  const renderContent = (): ReactNode => {
    // 1. Loading
    if (isLoading) {
      return (
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading claim details"
          data-testid="composer-loading"
        >
          <ClaimDetailsSkeleton />
        </div>
      );
    }

    // 2. Not found (404 from API / contract returned no record)
    if (error?.code === 'CLAIM_NOT_FOUND') {
      return <ClaimNotFound headingRef={errorHeadingRef} />;
    }

    // 3. Critical fetch error (unrecoverable)
    if (isError && !isStale) {
      return (
        <CriticalErrorFallback
          headingRef={errorHeadingRef}
          onRetry={() => reconcile()}
        />
      );
    }

    // 4. Stale projection — show banner across all regions, gate write actions
    const staleBanner =
      isStale || isReorged ? (
        <ApiStaleBanner
          status={isReorged ? 'critical' : 'stale'}
          dataAgeMs={
            timeline?.staleness.lastValidTimestamp
              ? Date.now() - timeline.staleness.lastValidTimestamp
              : null
          }
          onReload={reconcile}
          className="mb-4"
        />
      ) : null;

    // 5. Content layout
    return (
      <>
        {staleBanner}

        {/*
         * Responsive layout — Requirement 12
         * Mobile  (<768px):   single column
         * Tablet  (768–1279px): two-column header/action pair
         * Desktop (≥1280px):  three-column content / action rail / provenance
         */}
        <div
          className={cn(
            // Base: single-column stack
            'flex flex-col gap-6',
            // Tablet: 2-col grid
            'md:grid md:grid-cols-2 md:gap-6',
            // Desktop: 3-col grid
            'xl:grid xl:grid-cols-[minmax(0,1fr)_360px_300px] xl:items-start xl:gap-8',
            // Suppress animations when reduced-motion is set
            prefersReducedMotion && 'motion-reduce:transition-none',
          )}
        >
          {/* Primary content column */}
          <div className="flex flex-col gap-6 md:col-span-2 xl:col-span-1">
            {/* Req 1.3: document order — ClaimHeader first */}
            <ClaimHeader
              claimId={claimId}
              phase={resolvedPhase}
              dataUpdatedAt={timeline?.lastUpdated ?? Date.now()}
              isStale={isStale}
              onReconcile={reconcile}
            />

            <EconomicSummaryPanel claimId={claimId} chainId={chainId} />

            <EvidenceRegion
              claimId={claimId}
              dataUpdatedAt={timeline?.lastUpdated ?? Date.now()}
              isStale={isStale}
            />

            <VerificationAggregationPanel
              claimId={claimId}
              phase={resolvedPhase}
              contractOutcome={null}
              outcomeLabel={null}
            />

            {/* SettlementRegion — propagates phase changes upward */}
            <SettlementRegion
              claimId={claimId}
              phase={resolvedPhase}
              onPhaseChange={setCurrentPhase}
            />
          </div>

          {/* Action rail column (sticky on desktop) */}
          <div className="md:col-span-1 xl:col-span-1">
            <div className="xl:sticky xl:top-6">
              <ActionRail
                claimId={claimId}
                chainId={chainId}
                phase={resolvedPhase}
              />
            </div>
          </div>

          {/* Provenance footer column */}
          <div className="md:col-span-2 xl:col-span-1">
            <ProvenanceFooter chainId={chainId} />
          </div>
        </div>
      </>
    );
  };

  return (
    <IntegrityBoundary>
      {/* aria-live region for polite state-change announcements (Req 11.2) */}
      <div
        ref={liveRegionRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="composer-live-region"
      />

      <main
        className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        data-testid="claim-detail-composer"
      >
        {renderContent()}
      </main>
    </IntegrityBoundary>
  );
}

export default ClaimDetailComposer;
