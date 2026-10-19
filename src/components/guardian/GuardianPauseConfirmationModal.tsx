'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ShieldAlert, X, Lock } from 'lucide-react';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { usePrefersReducedMotion } from '@/hooks/useReducedMotion';
import {
  GUARDIAN_SCOPE_LABELS,
  blastRadiusForScope,
  type GuardianIncidentContext,
  type GuardianModuleState,
  type GuardianPauseScope,
} from '@/lib/guardian';

export interface GuardianPauseConfirmationModalProps {
  isOpen: boolean;
  scope: GuardianPauseScope | null;
  incident: GuardianIncidentContext | null;
  moduleState?: GuardianModuleState | null;
  onClose: () => void;
  onConfirm: (scope: GuardianPauseScope) => Promise<void>;
}

const CONFIRMATION_PHRASE = 'PAUSE';

/**
 * Explicit, keyboard-accessible confirmation gate for an operation-scoped
 * guardian pause. The reviewer must type PAUSE. The dialog reiterates that
 * this initiates a pause request — not a confirmed on-chain pause.
 */
export function GuardianPauseConfirmationModal({
  isOpen,
  scope,
  incident,
  moduleState,
  onClose,
  onConfirm,
}: GuardianPauseConfirmationModalProps) {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useDialogFocus(isOpen && scope !== null, dialogRef, inputRef, onClose);

  useEffect(() => {
    if (isOpen) {
      setInput('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, scope]);

  if (!isOpen || !scope) return null;

  const isConfirmed = input.trim() === CONFIRMATION_PHRASE;
  const radius = blastRadiusForScope(incident, scope);

  const handleConfirm = async () => {
    if (!isConfirmed) {
      setError(`Type "${CONFIRMATION_PHRASE}" to authorize this pause request.`);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirm(scope);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Pause request failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-xs ${
        prefersReducedMotion ? '' : 'animate-in fade-in'
      }`}
      data-testid="guardian-pause-confirm-modal"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guardian-confirm-title"
        aria-describedby="guardian-confirm-desc"
        className="relative w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-destructive/15 p-2.5 text-destructive">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="guardian-confirm-title"
                className="text-base font-bold text-foreground"
              >
                Request emergency pause
              </h2>
              <p className="text-xs text-muted-foreground">
                {GUARDIAN_SCOPE_LABELS[scope]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pause confirmation dialog"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4 text-xs">
          <div>
            <span className="font-medium text-muted-foreground">Incident:</span>
            <p className="mt-0.5 font-semibold text-foreground">
              {incident
                ? `${incident.incidentId} · ${incident.severity.toUpperCase()}`
                : 'Unavailable'}
            </p>
          </div>
          <div>
            <span className="font-medium text-muted-foreground">Blast radius:</span>
            <p id="guardian-confirm-desc" className="mt-0.5 text-foreground/90">
              {radius
                ? `${radius.moduleLabel} — ${radius.userImpact}`
                : 'Blast radius unavailable; execution is blocked.'}
            </p>
          </div>
          <div>
            <span className="font-medium text-muted-foreground">
              On-chain pause state:
            </span>
            <p className="mt-0.5 text-muted-foreground">
              {moduleState?.confirmedOnChain === true && moduleState.pauseState === 'paused'
                ? 'Confirmed paused on-chain'
                : 'Not confirmed on-chain'}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            This submits an operation-scoped pause <strong>request</strong>. The
            module is only paused once confirmed on-chain. This control cannot
            unpause, upgrade, move treasury funds, settle claims, or transfer
            roles.
          </span>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="guardian-confirm-input"
            className="block text-xs font-semibold text-foreground"
          >
            Type{' '}
            <span className="font-mono font-bold text-primary">
              {CONFIRMATION_PHRASE}
            </span>{' '}
            to request the pause:
          </label>
          <input
            id="guardian-confirm-input"
            ref={inputRef}
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={CONFIRMATION_PHRASE}
            autoComplete="off"
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 font-mono text-sm text-foreground transition-all focus:border-primary focus:ring-2 focus:ring-primary focus:outline-hidden"
          />
          {error && (
            <p className="text-xs font-medium text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!isConfirmed || isSubmitting || !radius}
            className="inline-flex items-center gap-2 rounded-lg bg-destructive px-5 py-2 text-xs font-bold text-destructive-foreground shadow-xs transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Requesting…' : 'Request pause'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GuardianPauseConfirmationModal;
