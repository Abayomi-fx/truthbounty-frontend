'use client';

import * as React from 'react';

import { Icon } from '@/components/ui/icons';
import type { GovernedChangeCall, GovernedChangeSnapshot } from '@/lib/governed-change';
import { resolvePreparationGate } from '@/lib/governed-change';
import { cn } from '@/lib/utils';

import { GovernedChangeBlockedState } from './GovernedChangeBlockedState';
import { SOURCE_LABELS } from './source';

/**
 * UI-FE-029 — Governed configuration change preparation.
 *
 * Read-only comparison of the current and proposed configuration plus the
 * declared dependencies and rollback plan. The only action is "Prepare", which
 * is enabled solely when a supported call is composed, dependencies are
 * satisfied, and the rollback plan is verified. Nothing is scheduled here.
 */
export interface GovernedChangePreparationProps {
  snapshot: GovernedChangeSnapshot;
  /** Invoked with the exact supported call when preparation is confirmed. */
  onPrepare?: (call: GovernedChangeCall) => void;
  /** Disables the action while a preparation request is in flight. */
  pending?: boolean;
  className?: string;
}

export function GovernedChangePreparation({
  snapshot,
  onPrepare,
  pending = false,
  className,
}: GovernedChangePreparationProps) {
  const gate = resolvePreparationGate(snapshot);
  const call = snapshot.call;

  const handlePrepare = React.useCallback(() => {
    if (call && gate.enabled) onPrepare?.(call);
  }, [call, gate.enabled, onPrepare]);

  return (
    <section
      className={cn('space-y-6', className)}
      data-testid="governed-change-preparation"
      aria-labelledby="governed-change-preparation-heading"
    >
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon name="settings" size="lg" tone="info" />
          <h1
            id="governed-change-preparation-heading"
            className="text-2xl font-bold tracking-tight text-foreground"
          >
            Prepare Governed Change
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Review the exact configuration change, its dependencies, and its
          rollback plan. Preparing schedules the change behind the timelock; it
          does not execute anything.
        </p>
      </header>

      {snapshot.surfaceState !== 'ready' ? (
        <GovernedChangeBlockedState
          surfaceState={snapshot.surfaceState}
          reasons={gate.reasons}
        />
      ) : (
        <>
          <ChangeSummary snapshot={snapshot} />

          <ParameterComparison snapshot={snapshot} />

          <DependencyList snapshot={snapshot} />

          <RollbackPlan snapshot={snapshot} />

          {!gate.enabled ? (
            <GovernedChangeBlockedState reasons={gate.reasons} />
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrepare}
              disabled={!gate.enabled || pending}
              data-testid="governed-change-prepare-button"
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold',
                'bg-primary text-primary-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <Icon name="calendar" size="sm" />
              Prepare governed change
            </button>
            {pending ? (
              <span
                className="text-xs text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                Preparing…
              </span>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function ChangeSummary({ snapshot }: { snapshot: GovernedChangeSnapshot }) {
  const call = snapshot.call;
  return (
    <div
      className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs"
      data-testid="governed-change-summary"
    >
      <div className="flex items-center gap-2">
        <Icon name="file-text" size="sm" tone="neutral" />
        <h2 className="text-base font-semibold text-foreground">
          {snapshot.label ?? 'Unnamed change'}
        </h2>
      </div>
      {call ? (
        <>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {call.summary}
          </p>
          <p
            className="text-xs font-mono text-foreground/80"
            data-testid="governed-change-call-resource"
          >
            {call.targetResource}
          </p>
          <p className="text-xs text-muted-foreground">
            Timelock operation: {call.timelockOperation}
          </p>
        </>
      ) : (
        <p className="text-sm text-warning">
          No supported governed call is composed for this change.
        </p>
      )}
    </div>
  );
}

function ParameterComparison({ snapshot }: { snapshot: GovernedChangeSnapshot }) {
  return (
    <div className="space-y-3" data-testid="governed-change-parameters">
      <div className="flex items-center gap-2">
        <Icon name="layers" size="sm" tone="info" />
        <h2 className="text-base font-semibold text-foreground">
          Configuration comparison
        </h2>
      </div>
      {snapshot.parameters.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This change declares no displayable parameters.
        </p>
      ) : (
        <ul className="space-y-3">
          {snapshot.parameters.map((parameter) => (
            <li
              key={parameter.key}
              className="rounded-xl border border-border bg-card p-4 space-y-2"
              data-testid={`governed-parameter-${parameter.key}`}
              data-changed={parameter.changed ? 'true' : 'false'}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <p className="text-sm font-semibold text-foreground">
                  {parameter.label}
                </p>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {SOURCE_LABELS[parameter.source]}
                </span>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Current</dt>
                  <dd className="font-mono text-foreground">
                    {parameter.currentValue}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Proposed</dt>
                  <dd className="font-mono font-semibold text-info">
                    {parameter.proposedValue}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DependencyList({ snapshot }: { snapshot: GovernedChangeSnapshot }) {
  return (
    <div className="space-y-3" data-testid="governed-change-dependencies">
      <div className="flex items-center gap-2">
        <Icon name="list-checks" size="sm" tone="info" />
        <h2 className="text-base font-semibold text-foreground">Dependencies</h2>
      </div>
      {snapshot.dependencies.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This change declares no external dependencies.
        </p>
      ) : (
        <ul className="space-y-2">
          {snapshot.dependencies.map((dependency) => (
            <li
              key={dependency.id}
              className="flex items-start gap-2 text-sm"
              data-testid={`governed-dependency-${dependency.id}`}
              data-satisfied={dependency.satisfied ? 'true' : 'false'}
            >
              <Icon
                name={dependency.satisfied ? 'check-circle' : 'x-circle'}
                size="sm"
                tone={dependency.satisfied ? 'success' : 'danger'}
              />
              <div>
                <p className="font-medium text-foreground">{dependency.label}</p>
                <p className="text-xs text-muted-foreground">
                  {dependency.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RollbackPlan({ snapshot }: { snapshot: GovernedChangeSnapshot }) {
  const { rollback } = snapshot;
  return (
    <div
      className="space-y-3"
      data-testid="governed-change-rollback"
      data-rolled-back={rollback.verified ? 'true' : 'false'}
    >
      <div className="flex items-center gap-2">
        <Icon name="undo" size="sm" tone="warning" />
        <h2 className="text-base font-semibold text-foreground">Rollback plan</h2>
        <span
          className={cn(
            'rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
            rollback.verified
              ? 'bg-success/10 text-success border border-success/30'
              : 'bg-danger/10 text-danger border border-danger/30',
          )}
        >
          {rollback.verified ? 'Verified' : 'Not verified'}
        </span>
      </div>
      {rollback.steps.length === 0 ? (
        <p className="text-sm text-warning">
          No rollback steps are declared.
        </p>
      ) : (
        <ol className="list-decimal list-inside space-y-1 text-sm text-foreground">
          {rollback.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default GovernedChangePreparation;
