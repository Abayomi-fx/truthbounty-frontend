'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { ShieldAlert, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { useGuardianPauseControl } from '@/hooks/useGuardianPauseControl';
import {
  APPROVED_PAUSE_SCOPES,
  GUARDIAN_SCOPE_LABELS,
  validateIncidentContext,
  type GuardianIncidentContext,
  type GuardianModuleState,
  type GuardianPauseRequestState,
  type GuardianPauseScope,
  type GuardianPauseSnapshot,
} from '@/lib/guardian';
import type { GuardianPauseRequestResult } from '@/hooks/useGuardianPauseControl';
import { GuardianPauseStatus } from './GuardianPauseStatus';
import { GuardianIncidentReview } from './GuardianIncidentReview';
import { GuardianScopeSelector } from './GuardianScopeSelector';
import { GuardianPausePhaseBadge } from './GuardianPausePhaseBadge';
import { GuardianPauseConfirmationModal } from './GuardianPauseConfirmationModal';

export interface GuardianPauseControlData {
  snapshot: GuardianPauseSnapshot;
  moduleStates: readonly GuardianModuleState[];
  requestState: GuardianPauseRequestState;
  isReadingAuthority: boolean;
  requestPause: (scope: GuardianPauseScope) => Promise<GuardianPauseRequestResult>;
  resetRequest: () => void;
  refetchAuthority: () => void;
}

export interface GuardianPauseControlProps {
  className?: string;
  /** Incident context supplied by the authoritative incident feed. */
  incident: GuardianIncidentContext | null;
  /** Deterministic data for tests/stories. Omit for the connected control. */
  data?: GuardianPauseControlData;
}

/**
 * Emergency Guardian Pause Control — UI-FE-032.
 *
 * Fail-closed operation-scoped pause initiation. All authority derives from the
 * pinned manifest/ABI and canonical reads; the connected control reads those
 * through `useGuardianPauseControl`.
 */
export function GuardianPauseControl({
  className = '',
  incident,
  data,
}: GuardianPauseControlProps) {
  if (data) {
    return (
      <GuardianPauseControlView
        className={className}
        incident={incident}
        data={data}
      />
    );
  }
  return <GuardianPauseControlConnected className={className} incident={incident} />;
}

function GuardianPauseControlConnected({
  className = '',
  incident,
}: {
  className?: string;
  incident: GuardianIncidentContext | null;
}) {
  const control = useGuardianPauseControl();
  const data: GuardianPauseControlData = useMemo(
    () => ({
      snapshot: control.snapshot,
      moduleStates: control.moduleStates,
      requestState: control.requestState,
      isReadingAuthority: control.isReadingAuthority,
      requestPause: control.requestPause,
      resetRequest: control.resetRequest,
      refetchAuthority: control.refetchAuthority,
    }),
    [control],
  );
  return (
    <GuardianPauseControlView className={className} incident={incident} data={data} />
  );
}

export interface GuardianPauseControlViewProps {
  className?: string;
  incident: GuardianIncidentContext | null;
  data: GuardianPauseControlData;
}

export function GuardianPauseControlView({
  className = '',
  incident,
  data,
}: GuardianPauseControlViewProps) {
  const {
    snapshot,
    moduleStates,
    requestState,
    isReadingAuthority,
    requestPause,
    resetRequest,
    refetchAuthority,
  } = data;

  const [selectedScope, setSelectedScope] = useState<GuardianPauseScope | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null);

  const incidentValidation = useMemo(
    () => validateIncidentContext(incident),
    [incident],
  );
  const incidentScopes = incident?.affectedScopes ?? [];
  const canExecute = snapshot.allowsPause && incidentValidation.complete;

  const activeModuleState = useMemo(
    () =>
      selectedScope
        ? moduleStates.find((state) => state.scope === selectedScope) ?? null
        : null,
    [moduleStates, selectedScope],
  );

  const handleConfirm = useCallback(
    async (scope: GuardianPauseScope) => {
      const result = await requestPause(scope);
      if (result.ok) {
        setFeedback({
          type: 'success',
          message:
            'Pause request submitted. The module is not paused until a canonical read confirms it on-chain.',
        });
      } else {
        setFeedback({ type: 'error', message: result.reason ?? 'Pause request failed.' });
      }
    },
    [requestPause],
  );

  const handleReset = useCallback(() => {
    resetRequest();
    setSelectedScope(null);
    setFeedback(null);
  }, [resetRequest]);

  return (
    <div
      className={`space-y-6 ${className}`}
      data-testid="guardian-pause-control"
      data-allows-pause={snapshot.allowsPause ? 'true' : 'false'}
    >
      <div className="flex flex-col justify-between gap-4 border-b border-border/60 pb-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Emergency Guardian Pause
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Operation-scoped pause control. Authority is proven by the pinned
            manifest/ABI and canonical contract state only.
          </p>
        </div>
        <button
          type="button"
          onClick={refetchAuthority}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent sm:self-center"
          aria-label="Re-read guardian authority from chain"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{isReadingAuthority ? 'Reading…' : 'Re-read authority'}</span>
        </button>
      </div>

      <GuardianPauseStatus snapshot={snapshot} />

      {!canExecute && (
        <div
          role="alert"
          data-testid="guardian-pause-blocked"
          className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-semibold text-destructive">
              Pause actions are disabled
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {snapshot.allowsPause
                ? 'The incident context is incomplete. No pause can be requested until the incident and its blast radius are fully described.'
                : 'The control fails closed: no pause can be requested until every authority, network, and freshness invariant is satisfied.'}
            </p>
          </div>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          data-testid="guardian-pause-feedback"
          className={`flex items-center justify-between rounded-xl border p-4 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          <span className="flex items-center gap-2">
            {feedback.type === 'success' && (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {feedback.message}
          </span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      <GuardianIncidentReview incident={incident} />

      <GuardianPausePhaseBadge
        requestState={requestState}
        moduleState={activeModuleState}
      />

      <GuardianScopeSelector
        scopes={APPROVED_PAUSE_SCOPES}
        actionableScopes={snapshot.actionableScopes}
        incidentScopes={incidentScopes}
        selectedScope={selectedScope}
        onSelect={setSelectedScope}
        disabled={!canExecute}
        blastRadius={incident?.blastRadius ?? []}
      />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          disabled={!canExecute || selectedScope === null}
          className="inline-flex items-center gap-2 rounded-lg bg-destructive px-5 py-2 text-xs font-bold text-destructive-foreground shadow-xs transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          Request pause
          {selectedScope ? `: ${GUARDIAN_SCOPE_LABELS[selectedScope]}` : ''}
        </button>
      </div>

      <GuardianPauseConfirmationModal
        isOpen={isModalOpen}
        scope={selectedScope}
        incident={incident}
        moduleState={activeModuleState}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

export default GuardianPauseControl;
