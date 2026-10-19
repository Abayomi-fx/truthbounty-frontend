'use client';

/**
 * SettlementRegion — lifecycle timeline with provisional/finalized state guards (UI-FE-010 Task 8)
 *
 * SETTLED and APPEAL_SETTLED always carry the "provisional" qualifier (Req 8.2).
 * FINALIZED is only displayed when phase === 'FINALIZED' (Req 8.4).
 * Phase changes propagate upward via onPhaseChange without a full reload (Req 8.5).
 */

import * as React from 'react';
import { ClaimLifecycleTimeline } from '@/components/features/claim-lifecycle/ClaimLifecycleTimeline';
import { ApiStaleBanner } from '@/components/common/ApiStaleBanner';
import { SourceBadge } from './SourceBadge';
import { useClaimLifecycleTimeline } from '@/hooks/useClaimLifecycleTimeline';
import type { TimelinePhase } from '@/app/types/lifecycle';

export interface SettlementRegionProps {
  claimId: string;
  phase: TimelinePhase;
  onPhaseChange: (phase: TimelinePhase) => void;
}

/** Phases that carry a "provisional" qualifier on their settlement outcome */
const PROVISIONAL_SETTLEMENT_PHASES = new Set<TimelinePhase>([
  'PENDING_SETTLEMENT',
  'SETTLED',
  'PENDING_APPEAL_SETTLEMENT',
  'APPEAL_SETTLED',
]);

export function SettlementRegion({ claimId, phase, onPhaseChange }: SettlementRegionProps) {
  const { isStale, reconcile, isReconciling, timeline } = useClaimLifecycleTimeline({
    claimId,
    enableRealtime: true,
    enableAutoReconciliation: true,
  });

  const isProvisionalSettlement = PROVISIONAL_SETTLEMENT_PHASES.has(phase);
  const isFinalized = phase === 'FINALIZED';

  const dataUpdatedAt = timeline?.lastUpdated ?? 0;
  const asOf = dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : 'unknown';

  return (
    <section
      id="settlement-region"
      aria-labelledby="settlement-heading"
      className="rounded-xl border border-border bg-surface p-5 sm:p-6"
      data-testid="settlement-region"
    >
      <h2 id="settlement-heading" className="tb-section text-ink mb-4 font-semibold">
        Settlement &amp; lifecycle timeline
      </h2>

      {/* Stale banner — Req 8.3 */}
      {isStale && (
        <ApiStaleBanner
          status="stale"
          dataAgeMs={
            timeline?.staleness.lastValidTimestamp
              ? Date.now() - timeline.staleness.lastValidTimestamp
              : null
          }
          onReload={reconcile}
          className="mb-4"
        />
      )}

      {/* Settlement outcome summary (Req 8.2 & 8.4) */}
      {(isProvisionalSettlement || isFinalized) && (
        <div
          className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-4 py-3"
          data-testid="settlement-outcome-summary"
        >
          {isFinalized ? (
            <>
              <span
                className="text-sm font-semibold text-finalized"
                aria-label="Claim outcome is final and immutable"
              >
                🔒 Finalized
              </span>
              {/* FINALIZED uses contract as source */}
              <SourceBadge source="contract" asOf={asOf} />
            </>
          ) : (
            <>
              <span className="text-sm font-medium text-ink">Settlement outcome</span>
              {/* Provisional qualifier — outcome not yet established truth (Req 8.2) */}
              <span
                className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning"
                data-testid="settlement-provisional-qualifier"
              >
                provisional
              </span>
              <SourceBadge source={isStale ? 'stale projection' : 'projected'} asOf={asOf} />
            </>
          )}
        </div>
      )}

      {/* ClaimLifecycleTimeline — Req 8.1: enableRealtime, onPhaseChange propagation */}
      <ClaimLifecycleTimeline
        claimId={claimId}
        enableRealtime={true}
        onPhaseChange={onPhaseChange}
        showReconcileButton={!isStale}
      />
    </section>
  );
}

export default SettlementRegion;
