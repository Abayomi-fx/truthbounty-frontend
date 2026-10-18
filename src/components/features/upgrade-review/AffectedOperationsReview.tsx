'use client';

import React from 'react';
import { ListChecks, Zap } from 'lucide-react';
import type { AffectedOperationReview } from '@/lib/upgrade-review/types';

/**
 * Cross-reference of the candidate's affected operations against the live
 * operational queue snapshot.
 *
 * Read-only: nothing here executes an operation.
 */
export interface AffectedOperationsReviewProps {
  affectedOperations: readonly AffectedOperationReview[];
  className?: string;
}

export function AffectedOperationsReview({
  affectedOperations,
  className = '',
}: AffectedOperationsReviewProps) {
  return (
    <section
      className={`space-y-4 ${className}`}
      data-testid="upgrade-affected-operations"
      aria-labelledby="upgrade-affected-operations-heading"
    >
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2
          id="upgrade-affected-operations-heading"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          Affected Operations
        </h2>
      </div>

      {affectedOperations.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="affected-operations-empty">
          The candidate declares no affected operational queue items.
        </p>
      ) : (
        <ul className="space-y-3" data-testid="affected-operations-list">
          {affectedOperations.map((entry) => (
            <li
              key={entry.operationId}
              className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs"
              data-testid={`affected-operation-${entry.operationId}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-sm font-bold text-foreground">
                  {entry.operationId}
                </p>
                {entry.queued ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-500 border border-indigo-500/30">
                    Queued
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border">
                    Review only
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {entry.reason}
              </p>
              {entry.queueAge && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3 w-3" aria-hidden="true" />
                  Queue age: {entry.queueAge}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Cross-referencing uses the current operational queue snapshot. No
        operation is executed from this review.
      </p>
    </section>
  );
}

export default AffectedOperationsReview;
