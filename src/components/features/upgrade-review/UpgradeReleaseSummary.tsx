'use client';

import React from 'react';
import { GitCompare, Tag } from 'lucide-react';
import type {
  CurrentReleaseReview,
  UpgradeCandidateDescriptor,
} from '@/lib/upgrade-review/types';

/**
 * Current vs. proposed release comparison.
 *
 * Read-only evidence: the candidate is never activated by this surface.
 */
export interface UpgradeReleaseSummaryProps {
  currentRelease: CurrentReleaseReview;
  candidate: UpgradeCandidateDescriptor;
  className?: string;
}

export function UpgradeReleaseSummary({
  currentRelease,
  candidate,
  className = '',
}: UpgradeReleaseSummaryProps) {
  const rows: Array<{
    label: string;
    current: string;
    candidate: string;
  }> = [
    {
      label: 'Protocol version',
      current: currentRelease.protocolVersion,
      candidate: candidate.protocolVersion,
    },
    {
      label: 'Release identifier',
      current: currentRelease.releaseId,
      candidate: candidate.releaseId,
    },
    {
      label: 'Git commit',
      current: currentRelease.gitCommit.slice(0, 12),
      candidate: 'maintainer-declared',
    },
    {
      label: 'ABI version',
      current: currentRelease.abiVersion,
      candidate: candidate.compatibility.abiVersion,
    },
    {
      label: 'Event schema version',
      current: currentRelease.eventSchemaVersion,
      candidate: candidate.compatibility.eventSchemaVersion,
    },
    {
      label: 'Parameter set version',
      current: currentRelease.parameterSetVersion,
      candidate: candidate.compatibility.parameterSetVersion,
    },
  ];

  return (
    <section
      className={`space-y-4 ${className}`}
      data-testid="upgrade-release-summary"
      aria-labelledby="upgrade-release-summary-heading"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2
            id="upgrade-release-summary-heading"
            className="text-base font-semibold tracking-tight text-foreground"
          >
            Current and Proposed Implementation
          </h2>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20"
          data-testid="upgrade-candidate-badge"
        >
          <Tag className="h-3 w-3" aria-hidden="true" />
          Candidate — not activated
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {row.label}
            </p>
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Current:</span>
                <span className="ml-1 font-mono text-foreground">
                  {row.current}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Candidate:</span>
                <span className="ml-1 font-mono text-foreground">
                  {row.candidate}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        The candidate is maintainer-controlled review evidence. No candidate
        release is active until the governed timelock executes it.
      </p>
    </section>
  );
}

export default UpgradeReleaseSummary;
