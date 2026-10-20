'use client';

/**
 * UI-FE-025 — OperationalHealthComposition
 *
 * Privileged health composition with degraded/delayed/stale/unavailable/healthy
 * observations, ABI/manifest verification, and affected scope.
 * Stale or missing observations never render healthy.
 */

import React from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  AlertCircle,
  FileCode,
  Shield,
  Layers,
} from 'lucide-react';
import type {
  AbiManifestVerification,
  FinalizedBlockContext,
  HealthAffectedScope,
  HealthObservation,
  HealthObservationState,
} from '@/app/types/admin';
import { cn } from '@/lib/utils';

export interface OperationalHealthCompositionProps {
  observations?: HealthObservation[];
  compositeStatus?: HealthObservationState;
  freshnessLabel?: string;
  finalizedBlock?: FinalizedBlockContext | null;
  abiManifestVerification?: AbiManifestVerification | null;
  affectedScope?: HealthAffectedScope | null;
  isLoading?: boolean;
  className?: string;
}

export function OperationalHealthComposition({
  observations = [],
  compositeStatus = 'healthy',
  freshnessLabel,
  finalizedBlock,
  abiManifestVerification,
  affectedScope,
  isLoading = false,
  className = '',
}: OperationalHealthCompositionProps) {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'p-5 rounded-xl border border-border bg-card text-xs text-muted-foreground animate-pulse',
          className,
        )}
      >
        Loading operational health and release verification telemetry…
      </div>
    );
  }

  const isHealthy = compositeStatus === 'healthy';

  return (
    <section
      aria-labelledby="operational-health-heading"
      className={cn('rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs', className)}
      data-testid="operational-health-composition"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 id="operational-health-heading" className="text-base font-semibold text-foreground">
            Subsystem Health & Release Verification
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <HealthStatusBadge state={compositeStatus} />
          {freshnessLabel && (
            <span className="text-xs text-muted-foreground font-mono" data-mask="dynamic-data">
              {freshnessLabel}
            </span>
          )}
        </div>
      </div>

      {/* Grid of Subsystems */}
      {observations.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
          {observations.map((obs) => (
            <div
              key={obs.id || obs.subsystem}
              className="p-3 rounded-lg border border-border/80 bg-background space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground uppercase text-[11px] font-mono">
                  {obs.subsystem}
                </span>
                <HealthStatusBadge state={obs.state} mini />
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1">{obs.summary || obs.state}</p>
            </div>
          ))}
        </div>
      )}

      {/* Finalized Block & ABI Manifest Context */}
      <div className="grid gap-3 sm:grid-cols-2 text-xs border-t border-border/40 pt-3">
        {finalizedBlock && (
          <div className="space-y-1 font-mono text-[11px]">
            <span className="text-muted-foreground font-sans font-semibold">Finalized Block Head:</span>
            <p className="text-foreground" data-mask="dynamic-data">
              Block #{finalizedBlock.finalizedBlockNumber ?? 'N/A'} (Chain {finalizedBlock.chainId})
              {finalizedBlock.lagBlocks !== null && ` · ${finalizedBlock.lagBlocks} blocks lag`}
            </p>
          </div>
        )}

        {abiManifestVerification && (
          <div className="space-y-1 text-[11px]">
            <span className="text-muted-foreground font-semibold">Release Verification:</span>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'font-semibold uppercase px-1.5 py-0.5 rounded text-[10px] border',
                  abiManifestVerification.state === 'verified'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                    : 'bg-destructive/10 text-destructive border-destructive/30',
                )}
              >
                {abiManifestVerification.state}
              </span>
              <span className="text-muted-foreground font-mono text-[10px] truncate max-w-[200px]">
                {abiManifestVerification.manifestRef || 'manifest.json'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Affected Scope if Non-Healthy */}
      {!isHealthy && affectedScope && (
        <div
          role="alert"
          className="p-3.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs text-foreground space-y-1"
        >
          <p className="font-semibold text-amber-500 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Affected Scope & Operator Impact
          </p>
          <p className="text-muted-foreground">{affectedScope.userFacingImpact}</p>
          {!affectedScope.isTruthBountyGuarantee && (
            <p className="text-[10px] text-muted-foreground italic">
              Third-party dependency status is external and not a TruthBounty protocol guarantee.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function HealthStatusBadge({
  state,
  mini = false,
}: {
  state: HealthObservationState;
  mini?: boolean;
}) {
  const configs: Record<HealthObservationState, { label: string; class: string }> = {
    healthy: {
      label: 'Healthy',
      class: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    },
    degraded: {
      label: 'Degraded',
      class: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    },
    delayed: {
      label: 'Delayed',
      class: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    },
    stale: {
      label: 'Stale',
      class: 'bg-amber-500/15 text-amber-600 border-amber-500/40',
    },
    unavailable: {
      label: 'Unavailable',
      class: 'bg-destructive/10 text-destructive border-destructive/30',
    },
  };

  const c = configs[state] || configs.unavailable;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-semibold uppercase border tracking-wider',
        mini ? 'px-1.5 py-0.2 text-[9px]' : 'px-2 py-0.5 text-[11px]',
        c.class,
      )}
    >
      {c.label}
    </span>
  );
}
