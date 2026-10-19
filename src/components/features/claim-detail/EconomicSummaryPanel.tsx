'use client';

/**
 * EconomicSummaryPanel — bounty, stake, deadlines, and protocol parameters (UI-FE-010 Task 4)
 *
 * All amounts come from canonical sources or are rendered as "—" when unavailable.
 * No amount, gas estimate, or deadline is ever fabricated.
 */

import * as React from 'react';
import { useClaimDetail } from '@/app/queries/claims.queries';
import { TokenAmount } from '@/components/ui/primitives/TokenAmount';
import { EconomicRiskDisclosure } from '@/components/features/economics/EconomicRiskDisclosure';
import { ProtocolContractBoundary } from '@/components/protocol/ProtocolContractBoundary';
import { SourceBadge } from './SourceBadge';
import { FreshnessLabel } from './FreshnessLabel';
import { cn } from '@/lib/utils';

export interface EconomicSummaryPanelProps {
  claimId: string;
  chainId: number;
}

/** Renders "—" with accessible title when a value is unavailable — Req 4.5 */
function UnavailableValue({ reason }: { reason: string }) {
  return (
    <span
      className="tb-data font-semibold tabular-nums text-ink-muted"
      title={reason}
      aria-label={`Unavailable — ${reason}`}
    >
      —
    </span>
  );
}

/** Row skeleton for loading state — Req 4.6 */
function RowSkeleton() {
  return (
    <div className="h-6 animate-pulse rounded bg-muted/40" aria-hidden="true" />
  );
}

export function EconomicSummaryPanel({ claimId, chainId }: EconomicSummaryPanelProps) {
  const { data: claim, isLoading, dataUpdatedAt } = useClaimDetail(claimId);

  const isStale = React.useMemo(() => {
    if (!dataUpdatedAt) return false;
    // Stale when last update was > 2 min ago (matches staleTime in claims.queries.ts)
    return Date.now() - dataUpdatedAt > 2 * 60 * 1000;
  }, [dataUpdatedAt]);

  const deadlinePassed =
    claim?.expiresAt != null && new Date(claim.expiresAt).getTime() <= Date.now();

  return (
    <section
      aria-labelledby="economic-summary-heading"
      className="rounded-xl border border-border bg-surface p-5 sm:p-6"
      data-testid="economic-summary-panel"
    >
      <h2
        id="economic-summary-heading"
        className="tb-section text-ink mb-4 font-semibold"
      >
        Economic summary
      </h2>

      {/* Loading skeletons — Req 4.6 */}
      {isLoading && (
        <div
          aria-busy="true"
          aria-label="Loading economic summary"
          className="space-y-3"
          data-testid="economic-summary-skeleton"
        >
          {[1, 2, 3, 4].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && (
        <dl className="grid gap-4 sm:grid-cols-2">
          {/* Bounty amount — Req 4.1 */}
          <div>
            <dt className="tb-label text-ink-muted uppercase tracking-wide">
              Bounty
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              {claim?.bountyAmount != null ? (
                <TokenAmount
                  amount={String(claim.bountyAmount)}
                  symbol="TBNT"
                  aria-label={`Bounty: ${claim.bountyAmount} TBNT`}
                />
              ) : (
                <UnavailableValue reason="Bounty amount not yet available" />
              )}
              <SourceBadge
                source="projected"
                asOf={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : 'unknown'}
              />
            </dd>
          </div>

          {/* Total staked — Req 4.2 */}
          <div>
            <dt className="tb-label text-ink-muted uppercase tracking-wide">
              Total staked
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              {claim?.totalStaked != null ? (
                <TokenAmount
                  amount={String(claim.totalStaked)}
                  symbol="TBNT"
                  aria-label={`Total staked: ${claim.totalStaked} TBNT`}
                />
              ) : (
                <UnavailableValue reason="Staked amount not yet available" />
              )}
              <SourceBadge
                source="projected"
                asOf={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : 'unknown'}
              />
            </dd>
          </div>

          {/* Verification deadline — Req 4.3 & 4.4 */}
          <div className="sm:col-span-2">
            <dt className="tb-label text-ink-muted uppercase tracking-wide">
              Verification deadline
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              {claim?.expiresAt == null ? (
                <UnavailableValue reason="No deadline set for this claim" />
              ) : deadlinePassed ? (
                /* Closed — never show negative countdown (Req 4.4) */
                <span
                  className="tb-data font-semibold text-ink-muted"
                  aria-label="Verification period is closed"
                >
                  Closed
                </span>
              ) : (
                <span className="tb-data font-semibold text-ink">
                  {new Date(claim.expiresAt).toLocaleString()}
                </span>
              )}
              {claim?.expiresAt != null && (
                <>
                  <SourceBadge
                    source={isStale ? 'stale projection' : 'projected'}
                    asOf={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : 'unknown'}
                  />
                  <FreshnessLabel dataUpdatedAt={dataUpdatedAt ?? 0} isStale={isStale} />
                </>
              )}
            </dd>
          </div>
        </dl>
      )}

      {/* Protocol fee and bond parameters — Req 4.7 */}
      {!isLoading && (
        <div className="mt-5 border-t border-divider pt-5">
          <ProtocolContractBoundary chainId={chainId} blockWhenNotReady={false}>
            <EconomicRiskDisclosure action="Verify" />
          </ProtocolContractBoundary>
        </div>
      )}
    </section>
  );
}

export default EconomicSummaryPanel;
