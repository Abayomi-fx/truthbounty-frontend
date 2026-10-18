'use client';

/**
 * VerificationAggregationPanel — verification counts, stakes, and dispute status (UI-FE-010 Task 6)
 *
 * Three-condition "Verified" gate (Req 6.4):
 *   phase === 'FINALIZED' AND contractOutcome !== null AND outcomeLabel === contractOutcome
 * All three must be satisfied simultaneously.
 */

import * as React from 'react';
import { useClaimDetail } from '@/app/queries/claims.queries';
import { TokenAmount } from '@/components/ui/primitives/TokenAmount';
import { SourceBadge } from './SourceBadge';
import { FreshnessLabel } from './FreshnessLabel';
import { cn } from '@/lib/utils';
import type { TimelinePhase } from '@/app/types/lifecycle';

export interface VerificationAggregationPanelProps {
  claimId: string;
  phase: TimelinePhase;
  /** Final outcome from a contract read — null until FINALIZED and confirmed. */
  contractOutcome: 'TRUE' | 'FALSE' | null;
  /** Outcome label from API projection — may lag behind contract state. */
  outcomeLabel: string | null;
}

export function VerificationAggregationPanel({
  claimId,
  phase,
  contractOutcome,
  outcomeLabel,
}: VerificationAggregationPanelProps) {
  const { data: claim, isLoading, dataUpdatedAt, isStale } = useClaimDetail(claimId);

  const asOf = dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : 'unknown';

  /**
   * Three-condition "Verified" gate — Req 6.4.
   * All three must be simultaneously true:
   *   1. Phase is FINALIZED
   *   2. Contract read has confirmed the outcome (contractOutcome !== null)
   *   3. API outcomeLabel matches the contract outcome
   */
  const isVerified =
    phase === 'FINALIZED' &&
    contractOutcome !== null &&
    outcomeLabel === contractOutcome;

  const outcomeDisplay = isVerified
    ? 'Verified'
    : phase === 'DISPUTED' || claim?.status === 'DISPUTED'
    ? 'Disputed'
    : phase === 'FINALIZED'
    ? 'Finalized'
    : 'Pending';

  return (
    <section
      aria-labelledby="aggregation-heading"
      className="rounded-xl border border-border bg-surface p-5 sm:p-6"
      data-testid="verification-aggregation-panel"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="aggregation-heading" className="tb-section text-ink font-semibold">
          Verification summary
        </h2>
        {dataUpdatedAt && (
          <FreshnessLabel dataUpdatedAt={dataUpdatedAt} isStale={!!isStale} />
        )}
      </div>

      {isLoading ? (
        <div aria-busy="true" aria-label="Loading verification summary" className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-muted/40" aria-hidden="true" />
          ))}
        </div>
      ) : (
        <>
          {/* Stale banner — Req 6.2 */}
          {isStale && (
            <div
              className="mb-4 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
              data-testid="aggregation-stale-notice"
            >
              <SourceBadge source="stale projection" asOf={asOf} />
              <span className="flex-1">Aggregation data may be outdated.</span>
              <button
                type="button"
                className={cn(
                  'rounded border border-warning/60 bg-warning/20 px-2.5 py-1 text-xs font-medium',
                  'hover:bg-warning/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning',
                  'min-h-[44px] min-w-[44px]',
                )}
                aria-label="Refresh verification aggregation data"
              >
                Refresh
              </button>
            </div>
          )}

          {/* Outcome label */}
          <div className="mb-4">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold',
                isVerified
                  ? 'bg-success/10 text-success'
                  : phase === 'DISPUTED'
                  ? 'bg-warning/10 text-warning'
                  : 'bg-muted/40 text-ink-muted',
              )}
              data-testid="outcome-label"
            >
              {isVerified && <span aria-hidden="true">✅</span>}
              {phase === 'DISPUTED' && <span aria-hidden="true">⚠</span>}
              {!isVerified && phase !== 'DISPUTED' && <span aria-hidden="true">⏳</span>}
              {outcomeDisplay}
            </span>
            {!isVerified && (
              <SourceBadge source={isStale ? 'stale projection' : 'projected'} asOf={asOf} className="ml-2" />
            )}
            {isVerified && (
              <SourceBadge source="contract" asOf={asOf} className="ml-2" />
            )}
          </div>

          {/* Stake totals — Req 6.1, 6.6 */}
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="tb-label text-ink-muted uppercase tracking-wide text-xs">
                Verifications
              </dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <span className="tb-data font-semibold tabular-nums text-ink">
                  {claim?.evidence?.length ?? '—'}
                </span>
                <SourceBadge source={isStale ? 'stale projection' : 'projected'} asOf={asOf} />
              </dd>
            </div>

            <div>
              <dt className="tb-label text-ink-muted uppercase tracking-wide text-xs">
                True stake
              </dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                {claim?.totalStaked != null ? (
                  <TokenAmount
                    amount={String(claim.totalStaked)}
                    symbol="TBNT"
                    aria-label={`True stake: ${claim.totalStaked} TBNT`}
                  />
                ) : (
                  <span className="tb-data text-ink-muted" title="True stake not available">—</span>
                )}
                <SourceBadge source={isStale ? 'stale projection' : 'projected'} asOf={asOf} />
              </dd>
            </div>

            <div>
              <dt className="tb-label text-ink-muted uppercase tracking-wide text-xs">
                False stake
              </dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <span className="tb-data text-ink-muted" title="False stake not yet available">—</span>
                <SourceBadge source={isStale ? 'stale projection' : 'projected'} asOf={asOf} />
              </dd>
            </div>
          </dl>

          {/* Dispute status — Req 6.3, 6.5 */}
          {(phase === 'DISPUTED' || claim?.status === 'DISPUTED') && (
            <div
              className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-4"
              data-testid="dispute-status"
            >
              <dl>
                <div className="flex items-start gap-2">
                  <dt className="tb-label shrink-0 text-warning">
                    <span aria-hidden="true">⚠ </span>Dispute open
                  </dt>
                  <dd className="flex items-center gap-2">
                    <SourceBadge source="projected" asOf={asOf} />
                    <a
                      href="#settlement-region"
                      className="text-xs text-info underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                      aria-label="Jump to settlement timeline"
                    >
                      View timeline ↓
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default VerificationAggregationPanel;
