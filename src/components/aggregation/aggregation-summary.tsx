'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  AggregationProjection,
  AggregationVerdict,
  summarizeAggregation,
} from '@/app/types/aggregation';
import { ConfidenceMeter } from '@/components/ui/primitives/ConfidenceMeter';
import { StakeWeightDisplay } from '@/components/ui/primitives/StakeWeightDisplay';
import { OutcomeBadge } from '@/components/ui/primitives/OutcomeBadge';

/**
 * V2-FE-056 — Aggregation visualization.
 *
 * Renders verifier weights, quorum, confidence, ties, and provisional status
 * from a canonical projection. Lifecycle/finality is driven solely by the
 * projection's own `finalized` flag and freshness — never a client timer or
 * guess — and any non-final projection is labelled provisional prominently.
 * All async states expose accessible feedback and a recovery path.
 */
export type AggregationViewState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message?: string }
  | { status: 'ready'; projection: AggregationProjection };

export interface AggregationSummaryProps {
  state: AggregationViewState;
  /** Recovery affordance for the error state (and unparseable projections). */
  onRetry?: () => void;
}

const VERDICT_LABEL: Record<AggregationVerdict, string> = {
  SUPPORTED: 'Leaning supported',
  OPPOSED: 'Leaning opposed',
  TIE: 'Tied',
  UNDECIDED: 'No weight yet',
};

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <section
      aria-label="Aggregation"
      className="rounded-lg border border-red-500/30 bg-red-500/10 p-6"
    >
      <p role="alert" className="text-sm text-red-400">
        {message}
      </p>
      {onRetry ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onRetry}
        >
          Retry
        </Button>
      ) : null}
    </section>
  );
}

export function AggregationSummary({ state, onRetry }: AggregationSummaryProps) {
  if (state.status === 'loading') {
    return (
      <section
        aria-label="Aggregation"
        aria-busy="true"
        className="rounded-lg border border-slate-700 bg-slate-900/50 p-6"
      >
        <p role="status" className="text-sm text-slate-400">
          Loading aggregation…
        </p>
        <div className="mt-4 space-y-3" aria-hidden="true">
          <div className="h-2 w-full animate-pulse rounded bg-slate-800" />
          <div className="h-2 w-2/3 animate-pulse rounded bg-slate-800" />
        </div>
      </section>
    );
  }

  if (state.status === 'empty') {
    return (
      <section
        aria-label="Aggregation"
        className="rounded-lg border border-slate-700 bg-slate-900/50 p-6"
      >
        <p className="text-sm text-slate-400">
          No aggregation data for this claim yet.
        </p>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <ErrorState
        message={state.message ?? 'Failed to load aggregation.'}
        onRetry={onRetry}
      />
    );
  }

  // Untrusted projection input: fail closed rather than showing a misleading
  // zeroed summary when weights are malformed.
  const view = summarizeAggregation(state.projection);
  if (view === null) {
    return (
      <ErrorState
        message="Aggregation data is unavailable or malformed."
        onRetry={onRetry}
      />
    );
  }

  const { projection } = state;
  const supportingPct = view.confidence;
  const opposingPct = view.total === 0n ? 0 : 1 - view.confidence;

  // Determine outcome kind
  let outcomeKind: 'verified' | 'disputed' | 'rejected' | 'inconclusive' | 'provisional' = 'inconclusive';
  if (view.total > 0n) {
    if (view.verdict === 'SUPPORTED') {
      outcomeKind = 'verified';
    } else if (view.verdict === 'OPPOSED') {
      outcomeKind = 'rejected';
    } else if (view.verdict === 'TIE') {
      outcomeKind = 'disputed';
    }
  }
  const isProvisional = !view.finalized;

  return (
    <section
      aria-label="Aggregation"
      className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6"
    >
      {/* Finality — driven only by the canonical projection, never a timer. */}
      <div className="flex flex-wrap items-center gap-2">
        <OutcomeBadge
          kind={outcomeKind}
          provisional={isProvisional}
          compact
        />
        {projection.stale ? (
          <span className="rounded bg-orange-500/20 px-2 py-1 text-xs font-medium text-orange-300">
            Stale
          </span>
        ) : null}
        <span className="text-xs text-slate-500">
          {projection.asOfBlock === null
            ? 'As of block: unknown'
            : `As of block ${projection.asOfBlock}`}
        </span>
      </div>

      {/* Confidence Meter */}
      <ConfidenceMeter
        value={view.total === 0n ? 0 : supportingPct * 100}
        label="Supporting Weight Share"
        source="Aggregation Projection"
        provisional={isProvisional}
        showValue={true}
        showBandLabel={true}
      />

      {/* Stake Weight Display */}
      <StakeWeightDisplay
        supporting={{
          label: 'Supporting',
          value: projection.supportingWeight,
          unit: 'wei',
          icon: <span aria-hidden="true">▲</span>,
          tone: 'success',
        }}
        opposing={{
          label: 'Opposing',
          value: projection.opposingWeight,
          unit: 'wei',
          icon: <span aria-hidden="true">▼</span>,
          tone: 'danger',
        }}
        total={view.total.toString()}
        quorum={view.quorum?.toString()}
        provisional={isProvisional}
        stale={projection.stale}
        source="Aggregation Projection"
        showBars={true}
        showTable={true}
      />

      {/* Verdict */}
      <div>
        <h3 className="text-sm font-medium text-slate-300">Verdict</h3>
        <p className="text-lg font-semibold text-white">
          {VERDICT_LABEL[view.verdict]}
          {view.isTie ? (
            <span className="ml-2 rounded bg-slate-500/20 px-2 py-0.5 text-xs text-slate-300">
              Tie
            </span>
          ) : null}
        </p>
      </div>

      {/* Quorum */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">Quorum</span>
        {view.quorum === null ? (
          <span className="text-slate-500">Not published</span>
        ) : view.quorumReached ? (
          <span className="text-green-400">Reached</span>
        ) : (
          <span className="text-amber-300">
            Not reached (needs {view.quorum.toString()})
          </span>
        )}
      </div>
    </section>
  );
}