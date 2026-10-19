'use client';

import React from 'react';
import type { ClaimPhaseCounts } from '@/hooks/useClaimantDashboardData';

interface ClaimPhaseSummaryProps {
  phaseCounts: ClaimPhaseCounts;
  isLoading?: boolean;
}

const PHASES = [
  { key: 'open', label: 'Open', color: 'bg-primary', textColor: 'text-primary' },
  { key: 'underReview', label: 'Under Review', color: 'bg-pending', textColor: 'text-pending' },
  { key: 'disputed', label: 'In Dispute', color: 'bg-destructive', textColor: 'text-destructive' },
  { key: 'verified', label: 'Verified', color: 'bg-confirmed', textColor: 'text-confirmed' },
  { key: 'rejected', label: 'Rejected', color: 'bg-muted-foreground', textColor: 'text-muted-foreground' },
] as const;

export function ClaimPhaseSummary({ phaseCounts, isLoading = false }: ClaimPhaseSummaryProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 animate-pulse space-y-3">
        <div className="h-4 w-44 bg-accent rounded-md" />
        <div className="h-3 w-full bg-accent/60 rounded-full" />
      </div>
    );
  }

  const total = phaseCounts.total;

  return (
    <div
      className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4"
      aria-labelledby="phase-summary-heading"
      data-testid="claim-phase-summary"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <h3 id="phase-summary-heading" className="text-sm font-semibold text-foreground">
          Owned Claims by Lifecycle Phase
        </h3>
        <span className="text-xs text-muted-foreground">
          {total} total claim{total === 1 ? '' : 's'} submitted
        </span>
      </div>

      {total === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No claim submissions to summarize yet.
        </p>
      ) : (
        <>
          {/* Segmented Phase Progress Bar */}
          <div
            className="flex h-2.5 w-full overflow-hidden rounded-full bg-accent"
            role="progressbar"
            aria-label="Claims phase distribution"
            aria-valuenow={total}
            aria-valuemin={0}
            aria-valuemax={total}
          >
            {PHASES.map((phase) => {
              const count = phaseCounts[phase.key];
              if (count === 0) return null;
              const percent = (count / total) * 100;
              return (
                <div
                  key={phase.key}
                  style={{ width: `${percent}%` }}
                  className={`${phase.color} transition-all duration-300`}
                  title={`${phase.label}: ${count} (${Math.round(percent)}%)`}
                />
              );
            })}
          </div>

          {/* Legend with Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
            {PHASES.map((phase) => {
              const count = phaseCounts[phase.key];
              return (
                <div key={phase.key} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${phase.color} shrink-0`} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">{phase.label}</p>
                    <p className="text-xs font-semibold text-foreground">{count}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
