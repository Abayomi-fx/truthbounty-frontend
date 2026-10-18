'use client';

import React from 'react';
import { Undo2, ShieldAlert } from 'lucide-react';
import type { RollbackReview } from '@/lib/upgrade-review/types';

/**
 * Rollback plan evidence.
 *
 * The rollback plan is maintainer-confirmed before any execution path may
 * rely on it. Unverified rollback blocks the candidate execution.
 */
export interface RollbackPlanReviewProps {
  rollback: RollbackReview;
  className?: string;
}

export function RollbackPlanReview({
  rollback,
  className = '',
}: RollbackPlanReviewProps) {
  const verified = rollback.verified;

  return (
    <section
      className={`space-y-4 ${className}`}
      data-testid="upgrade-rollback-plan"
      aria-labelledby="upgrade-rollback-heading"
    >
      <div className="flex items-center gap-2">
        <Undo2 className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2
          id="upgrade-rollback-heading"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          Rollback Plan
        </h2>
      </div>

      <ol className="space-y-3" data-testid="rollback-steps">
        {rollback.steps.map((step, index) => (
          <li
            key={`${index}-${step}`}
            className="rounded-xl border border-border bg-card p-4 space-y-1 shadow-xs"
          >
            <p className="text-sm font-bold text-foreground">
              Step {index + 1}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
          </li>
        ))}
      </ol>

      {verified ? (
        <p
          className="text-xs text-emerald-500 flex items-center gap-2"
          role="status"
          data-testid="rollback-verified"
        >
          <span aria-hidden="true">✓</span> Rollback plan verified by a maintainer.
        </p>
      ) : (
        <p
          className="text-xs text-amber-300 flex items-start gap-2"
          role="alert"
          data-testid="rollback-blocked"
        >
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            The rollback plan is not verified. Executed upgrades require a
            verified rollback path.
          </span>
        </p>
      )}

      {rollback.blockedReasons.length > 0 && (
        <ul
          className="space-y-1 text-xs text-amber-300"
          aria-label="Rollback blocking reasons"
          data-testid="rollback-blocking-reasons"
        >
          {rollback.blockedReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default RollbackPlanReview;
