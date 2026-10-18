'use client';

/**
 * ClaimHeader — lifecycle phase, provenance, and finality indicator (UI-FE-010 Task 3)
 *
 * Displays the claim statement, a Phase_Badge, and a FreshnessLabel.
 * Never uses colour as the sole distinguishing signal.
 * Exposes the correct ARIA roles for STALE and ERROR phases.
 */

import * as React from 'react';
import { getPhaseConfig, formatPhase } from '@/lib/phase-config';
import { FreshnessLabel } from './FreshnessLabel';
import { cn } from '@/lib/utils';
import type { TimelinePhase } from '@/app/types/lifecycle';

export interface ClaimHeaderProps {
  claimId: string;
  /** Claim statement text — sourced from API projection. */
  statement?: string;
  phase: TimelinePhase;
  dataUpdatedAt: number;
  isStale: boolean;
  onReconcile: () => void;
}

/** Phases that carry a provisional qualifier (Req 3.2) */
const PROVISIONAL_PHASES = new Set<TimelinePhase>(['SETTLED', 'APPEAL_SETTLED']);

export function ClaimHeader({
  claimId,
  statement,
  phase,
  dataUpdatedAt,
  isStale,
  onReconcile,
}: ClaimHeaderProps) {
  const { icon, className: badgeClassName } = getPhaseConfig(phase);
  const isProvisional = PROVISIONAL_PHASES.has(phase);
  const isFinalized = phase === 'FINALIZED';
  const isStalePhase = phase === 'STALE';
  const isErrorPhase = phase === 'ERROR';

  return (
    <header
      className="rounded-xl border border-border bg-surface p-5 sm:p-6"
      data-testid="claim-header"
    >
      {/* Claim statement */}
      {statement && (
        <h1 className="tb-heading text-ink mb-3 text-xl font-semibold leading-snug sm:text-2xl">
          {statement}
        </h1>
      )}

      {/* Breadcrumb / ID */}
      <p className="tb-label text-ink-muted mb-4 text-xs">
        Claim <span className="font-mono">{claimId}</span>
      </p>

      {/* Phase badge row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Phase_Badge — text + icon, never colour alone (Req 3.6) */}
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
            badgeClassName,
            isFinalized && 'border-finalized/40',
            isStalePhase && 'border-warning/40',
            isErrorPhase && 'border-destructive/40',
          )}
          aria-label={`Phase: ${formatPhase(phase)}${isProvisional ? ' (provisional)' : ''}`}
          data-testid="phase-badge"
        >
          {/* Icon glyph — aria-hidden because aria-label covers it */}
          <span aria-hidden="true">{icon}</span>
          <span>{formatPhase(phase)}</span>
        </span>

        {/* Provisional qualifier — Req 3.2 */}
        {isProvisional && (
          <span
            className="inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning"
            data-testid="provisional-qualifier"
          >
            provisional
          </span>
        )}

        {/* Finalized confirmation label — Req 3.3 */}
        {isFinalized && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium text-finalized"
            aria-label="Outcome is final and immutable"
            data-testid="finalized-label"
          >
            <span aria-hidden="true">🔒</span>
            Finalized
          </span>
        )}

        <FreshnessLabel dataUpdatedAt={dataUpdatedAt} isStale={isStale} />
      </div>

      {/* STALE phase notice — Req 3.4 */}
      {isStalePhase && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning"
          data-testid="stale-phase-notice"
        >
          <span aria-hidden="true" className="shrink-0">⏱</span>
          <span className="flex-1">
            Timeline data is stale. On-chain state may have advanced.
          </span>
          <button
            type="button"
            onClick={onReconcile}
            className={cn(
              'shrink-0 rounded-md border border-warning/60 bg-warning/20 px-3 py-1.5',
              'text-xs font-medium text-warning hover:bg-warning/30',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning',
              'min-h-[44px] min-w-[44px]',
            )}
            aria-label="Reconcile stale claim data"
          >
            Reconcile
          </button>
        </div>
      )}

      {/* ERROR phase notice — Req 3.5 */}
      {isErrorPhase && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-4 flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          data-testid="error-phase-notice"
        >
          <span aria-hidden="true" className="shrink-0">⚠</span>
          <span className="flex-1">
            A data error was detected. Please retry or contact support.
          </span>
          <button
            type="button"
            onClick={onReconcile}
            className={cn(
              'shrink-0 rounded-md border border-destructive/60 bg-destructive/20 px-3 py-1.5',
              'text-xs font-medium text-destructive hover:bg-destructive/30',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive',
              'min-h-[44px] min-w-[44px]',
            )}
            aria-label="Retry loading claim data"
          >
            Retry
          </button>
        </div>
      )}
    </header>
  );
}

export default ClaimHeader;
