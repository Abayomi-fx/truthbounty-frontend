'use client';

import * as React from 'react';

import { TransactionStatusBadge } from '@/components/transactions';
import { Icon } from '@/components/ui/icons';
import type {
  AuthorityRevalidationInput,
  GovernedChangeCall,
  GovernedChangeSnapshot,
} from '@/lib/governed-change';
import { formatCountdown, revalidateAuthority } from '@/lib/governed-change';
import { cn } from '@/lib/utils';

import { GovernedChangeBlockedState } from './GovernedChangeBlockedState';
import { SOURCE_LABELS, truncateHex } from './source';

/**
 * UI-FE-029 — Timelock execution review.
 *
 * Shows the exact target/method/parameters that a timelock executor would
 * invoke, the timelock readiness (queued, earliest execution, countdown), and
 * the authority. Execution is disabled until the timelock is ready, and the
 * authority is revalidated at action time — never assumed from the review.
 */
export interface TimelockExecutionReviewProps {
  snapshot: GovernedChangeSnapshot;
  /**
   * Fresh authority sampled at action time. When provided, a mismatch blocks
   * execution even if the reviewed snapshot was authorized.
   */
  revalidatedAuthority?: AuthorityRevalidationInput | null;
  /** Invoked with the exact supported call when execution is confirmed. */
  onExecute?: (call: GovernedChangeCall) => void;
  /** Disables the action while an execution request is in flight. */
  executing?: boolean;
  className?: string;
}

export function TimelockExecutionReview({
  snapshot,
  revalidatedAuthority = null,
  onExecute,
  executing = false,
  className,
}: TimelockExecutionReviewProps) {
  const [authorityErrors, setAuthorityErrors] = React.useState<string[] | null>(
    null,
  );
  const call = snapshot.call;

  const handleExecute = React.useCallback(() => {
    if (!call || !snapshot.executionEnabled) return;

    if (revalidatedAuthority) {
      const result = revalidateAuthority(snapshot, revalidatedAuthority);
      if (!result.authorized) {
        setAuthorityErrors(result.reasons);
        return;
      }
    }

    setAuthorityErrors(null);
    onExecute?.(call);
  }, [call, snapshot, revalidatedAuthority, onExecute]);

  const executionBlocked =
    !snapshot.executionEnabled || authorityErrors !== null;

  return (
    <section
      className={cn('space-y-6', className)}
      data-testid="timelock-execution-review"
      aria-labelledby="timelock-execution-review-heading"
    >
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon name="shield-check" size="lg" tone="info" />
          <h1
            id="timelock-execution-review-heading"
            className="text-2xl font-bold tracking-tight text-foreground"
          >
            Timelock Execution Review
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Confirm the exact governed call and timelock readiness. Execution is
          only possible once the timelock delay has elapsed and authority is
          revalidated.
        </p>
      </header>

      {snapshot.surfaceState !== 'ready' ? (
        <GovernedChangeBlockedState
          surfaceState={snapshot.surfaceState}
          reasons={snapshot.blockedReasons}
        />
      ) : (
        <>
          <ExactCallPanel snapshot={snapshot} />

          <TimelockReadinessPanel snapshot={snapshot} />

          <AuthorityPanel snapshot={snapshot} />

          {authorityErrors !== null ? (
            <GovernedChangeBlockedState
              surfaceState="denied"
              title="Authority changed since review"
              reasons={authorityErrors}
              data-testid="timelock-authority-rejected"
            />
          ) : null}

          {snapshot.blockedReasons.length > 0 ? (
            <GovernedChangeBlockedState
              reasons={snapshot.blockedReasons}
              data-testid="timelock-execution-blocked"
            />
          ) : null}

          <ExecutionStatus snapshot={snapshot} />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExecute}
              disabled={executionBlocked || executing}
              data-testid="timelock-execute-button"
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold',
                'bg-primary text-primary-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <Icon name="zap" size="sm" />
              Execute governed change
            </button>
            {executing ? (
              <span
                className="text-xs text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                Executing…
              </span>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function ExactCallPanel({ snapshot }: { snapshot: GovernedChangeSnapshot }) {
  const call = snapshot.call;
  if (!call) {
    return (
      <div
        className="rounded-xl border border-border bg-card p-4"
        data-testid="timelock-exact-call"
      >
        <p className="text-sm text-warning">
          No supported governed call is composed.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs"
      data-testid="timelock-exact-call"
    >
      <div className="flex items-center gap-2">
        <Icon name="file-check" size="sm" tone="info" />
        <h2 className="text-base font-semibold text-foreground">
          Exact governed call
        </h2>
      </div>
      <dl className="space-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Target</dt>
          <dd
            className="font-mono text-foreground"
            data-testid="timelock-call-target"
          >
            {call.target.target}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Method</dt>
          <dd
            className="font-mono text-foreground"
            data-testid="timelock-call-method"
          >
            {call.target.method}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Parameters</dt>
          <dd className="font-mono text-foreground">
            {call.target.parameters.length === 0
              ? '(none)'
              : call.target.parameters.join(', ')}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Timelock operation</dt>
          <dd className="font-mono text-foreground" data-testid="timelock-operation">
            {call.timelockOperation}
          </dd>
        </div>
      </dl>
      <p className="text-[10px] text-muted-foreground">
        {call.targetResource} · selector{' '}
        {call.target.selector ?? 'unresolved from pinned ABI'}
      </p>
    </div>
  );
}

function TimelockReadinessPanel({
  snapshot,
}: {
  snapshot: GovernedChangeSnapshot;
}) {
  const { timelock } = snapshot;
  const countdown = formatCountdown(timelock.secondsRemaining);

  return (
    <div
      className="rounded-xl border border-border bg-card p-4 space-y-3"
      data-testid="timelock-readiness"
      data-ready={timelock.ready ? 'true' : 'false'}
    >
      <div className="flex items-center gap-2">
        <Icon
          name={timelock.ready ? 'check-circle' : 'clock'}
          size="sm"
          tone={timelock.ready ? 'success' : 'pending'}
        />
        <h2 className="text-base font-semibold text-foreground">
          Timelock readiness
        </h2>
        <span
          className={cn(
            'rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
            timelock.ready
              ? 'bg-success/10 text-success border border-success/30'
              : 'bg-pending/10 text-pending border border-pending/30',
          )}
        >
          {timelock.ready ? 'Ready' : timelock.queued ? 'Pending delay' : 'Not queued'}
        </span>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Proposal</dt>
          <dd className="font-mono text-foreground" data-testid="timelock-proposal-id">
            {timelock.proposalId ? truncateHex(timelock.proposalId, 10, 8) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Earliest execution</dt>
          <dd className="font-mono text-foreground" data-testid="timelock-earliest">
            {timelock.earliestExecution ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Delay</dt>
          <dd className="font-mono text-foreground">
            {timelock.delaySeconds !== null ? `${timelock.delaySeconds}s` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Time remaining</dt>
          <dd className="font-mono text-foreground" data-testid="timelock-countdown">
            {countdown ?? '—'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function AuthorityPanel({ snapshot }: { snapshot: GovernedChangeSnapshot }) {
  const { authority } = snapshot;
  return (
    <div
      className="rounded-xl border border-border bg-card p-4 space-y-3"
      data-testid="timelock-authority"
      data-authorized={authority.authorized ? 'true' : 'false'}
    >
      <div className="flex items-center gap-2">
        <Icon name="wallet" size="sm" tone="neutral" />
        <h2 className="text-base font-semibold text-foreground">Authority</h2>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {SOURCE_LABELS[authority.source]}
        </span>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Account</dt>
          <dd className="font-mono text-foreground" data-testid="timelock-authority-account">
            {authority.account ? truncateHex(authority.account, 10, 8) : 'Not connected'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Required role</dt>
          <dd className="font-mono text-foreground">{authority.requiredRole}</dd>
        </div>
      </dl>
    </div>
  );
}

function ExecutionStatus({ snapshot }: { snapshot: GovernedChangeSnapshot }) {
  const { execution } = snapshot;

  if (execution.status === 'reorged') {
    return (
      <div
        role="alert"
        className="rounded-xl border border-danger/40 bg-card p-4 text-sm"
        data-testid="timelock-execution-reorged"
      >
        <p className="font-semibold text-danger">
          Execution was reorganized out of the canonical chain.
        </p>
        <p className="text-xs text-muted-foreground">
          Reconcile the canonical state with the indexer before retrying.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="timelock-execution-status">
      <TransactionStatusBadge
        status={execution.status}
        txHash={execution.txHash}
        replacedBy={execution.replacedBy}
        confirmations={execution.confirmations}
      />
    </div>
  );
}

export default TimelockExecutionReview;
