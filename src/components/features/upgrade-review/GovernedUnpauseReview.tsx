'use client';

import React from 'react';
import { GitCommitHorizontal, ShieldAlert } from 'lucide-react';
import type {
  ProtocolLifecycleState,
} from '@/lib/protocol-contract';
import type {
  UpgradeGovernedCall,
} from '@/lib/upgrade-review/types';

/**
 * Exact governed calls and transaction lifecycle visibility.
 *
 * This surface renders only: the exact governed call a timelock executor
 * would perform, and the current protocol lifecycle state. It never invokes
 * a call and it never exposes an emergency control of any kind.
 */
export interface GovernedUnpauseReviewProps {
  governedCalls: readonly UpgradeGovernedCall[];
  currentLifecycleState: ProtocolLifecycleState;
  currentLifecycleLabel: string;
  currentLifecycleBlockingReasons: string[];
  candidateExecutionBlocked: boolean;
  className?: string;
}

export function GovernedUnpauseReview({
  governedCalls,
  currentLifecycleState,
  currentLifecycleLabel,
  currentLifecycleBlockingReasons,
  candidateExecutionBlocked,
  className = '',
}: GovernedUnpauseReviewProps) {
  return (
    <section
      className={`space-y-4 ${className}`}
      data-testid="governed-unpause-review"
      aria-labelledby="governed-unpause-heading"
    >
      <div className="flex items-center gap-2">
        <GitCommitHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2
          id="governed-unpause-heading"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          Governed Execution Readiness
        </h2>
      </div>

      <p className="text-xs text-muted-foreground">
        Emergency operations are not exposed by this interface. The exact
        governed call required to execute a verified upgrade is listed below,
        together with the current transaction lifecycle.
      </p>

      {/* Exact governed calls */}
      <ul className="space-y-3" data-testid="governed-calls">
        {governedCalls.map((call) => (
          <li
            key={call.targetResource}
            className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs"
            data-testid={`governed-call-${call.targetResource}`}
          >
            <p className="font-mono text-xs text-primary font-semibold break-all">
              {call.targetResource}
            </p>
            <p className="text-sm text-foreground">{call.summary}</p>
          </li>
        ))}
      </ul>

      {/* Current transaction lifecycle */}
      <div
        className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs"
        data-testid="current-transaction-lifecycle"
        data-lifecycle={currentLifecycleState}
        role="status"
        aria-live="polite"
      >
        <h3 className="text-sm font-bold text-foreground">Current Transaction Lifecycle</h3>
        <p className="text-sm">
          <span className="text-muted-foreground">State: </span>
          <span
            className={
              currentLifecycleBlockingReasons.length > 0
                ? 'font-semibold text-amber-400'
                : 'font-semibold text-emerald-400'
            }
          >
            {currentLifecycleLabel}
          </span>
        </p>
        {currentLifecycleBlockingReasons.length > 0 ? (
          <ul
            className="space-y-1 text-xs text-amber-300"
            aria-label="Transaction lifecycle blocking reasons"
            data-testid="lifecycle-blocking-reasons"
          >
            {currentLifecycleBlockingReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            No blocking lifecycle state is currently reported.
          </p>
        )}
      </div>

      {candidateExecutionBlocked && (
        <p
          className="text-xs text-amber-300 flex items-start gap-2"
          role="alert"
          data-testid="governed-execution-blocked"
        >
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Governed execution is blocked until every verification gate passes.
          </span>
        </p>
      )}
    </section>
  );
}

export default GovernedUnpauseReview;
