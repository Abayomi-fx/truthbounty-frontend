'use client';

import React from 'react';
import { ShieldAlert, Lock } from 'lucide-react';

/**
 * Unified fail-closed surface for the upgrade/unpause review.
 *
 * - Unauthorized reviewers never see review content.
 * - Unverified manifest, layout, or rollback blocks action, and the
 *   blocking reasons are always visible.
 */
export interface UpgradeReviewBlockedStateProps {
  unauthorizedReason?: string | null;
  blockingReasons?: string[];
  className?: string;
}

export function UpgradeReviewBlockedState({
  unauthorizedReason,
  blockingReasons = [],
  className = '',
}: UpgradeReviewBlockedStateProps) {
  return (
    <section
      className={`space-y-4 ${className}`}
      data-testid="upgrade-review-state"
      aria-labelledby="upgrade-review-state-heading"
    >
      {unauthorizedReason ? (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="upgrade-review-unauthorized"
          className="rounded-xl border border-destructive/40 bg-card p-6 space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-destructive/15 p-3 text-destructive shrink-0">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-2 flex-1">
              <h2
                id="upgrade-review-state-heading"
                className="text-base font-bold text-foreground"
              >
                Upgrade Review Unavailable
              </h2>
              <p className="text-sm text-destructive font-medium">
                {unauthorizedReason}
              </p>
              <p className="text-xs text-muted-foreground">
                Connect the canonical protocol administrator address to review
                upgrade readiness.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="upgrade-review-blocked"
          className="rounded-xl border border-amber-500/40 bg-card p-6 space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-500/15 p-3 text-amber-500 shrink-0">
              <Lock className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-2 flex-1">
              <h2
                id="upgrade-review-state-heading"
                className="text-base font-bold text-foreground"
              >
                Upgrade Execution Blocked
              </h2>
              <p className="text-sm font-medium text-amber-500">
                Verification is incomplete — governed execution is withheld.
              </p>
              <p className="text-xs text-muted-foreground">
                The review remains read-only, and every exact governed call is
                listed with its current lifecycle.
              </p>
            </div>
          </div>

          {blockingReasons.length > 0 ? (
            <ul
              className="space-y-1 text-xs text-amber-300"
              aria-label="Blocking reasons"
              data-testid="upgrade-blocking-reasons"
            >
              {blockingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid="no-blocking-reasons">
              All verification gates pass.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default UpgradeReviewBlockedState;
