'use client';

import { useCallback, useId, useState } from 'react';
import { AlertTriangle, Lock, ShieldCheck } from 'lucide-react';
import type {
  DisputeDraftInput,
  DisputeDraftV1,
  DisputeEligibility,
  DisputeEvidenceEntry as DisputeEvidenceEntryValue,
  DisputeProjectionOverlay,
} from '@/app/types/dispute-entry';
import {
  MAX_EVIDENCE_ENTRIES,
  MAX_REASON_LENGTH,
  normalizeEvidenceDigest,
  validateEvidenceSet,
} from '@/lib/dispute/evidence';
import { explainEligibility } from '@/lib/dispute/eligibility';
import { DisputeDraftBanner } from './DisputeDraftBanner';
import { DisputeEligibilityNotice } from './DisputeEligibilityNotice';
import { DisputeEvidenceEntry } from './DisputeEvidenceEntry';

export const MIN_DISPUTE_REASON_LENGTH = 10;

export interface DisputeEntryFormSubmission {
  claimId: string;
  reason: string;
  evidence: DisputeEvidenceEntryValue[];
  /** Exact contract-required bond in wei. */
  bondAmount: string;
}

export interface DisputeEntryFormProps {
  claimId: string;
  /** Contract-derived eligibility — the only mutation authority. */
  eligibility: DisputeEligibility;
  /** Previously saved draft, when one exists (recovery banner). */
  storedDraft?: DisputeDraftV1 | null;
  /** Freshness-labelled API projection (display only, never authority). */
  projection?: DisputeProjectionOverlay | null;
  /** Called with a sanitized draft input whenever the user edits content. */
  onDraftPersist?: (input: DisputeDraftInput) => void;
  /** Called when the user discards the recovered draft. */
  onDraftDiscard?: () => void;
  /** Re-pin the draft bond after a contract-side bond change. */
  onAcknowledgeBond?: (requiredBond: string) => void;
  /** Refresh the underlying contract reads. */
  onRefresh?: () => void;
  /** Invoked only when every gate (contract authority, eligibility, input
   * integrity) has passed. */
  onSubmit?: (submission: DisputeEntryFormSubmission) => void;
  initialReason?: string;
  initialEvidence?: DisputeEvidenceEntryValue[];
}

function bondFromEligibility(
  eligibility: DisputeEligibility
): string | null {
  if (eligibility.status === 'eligible' || eligibility.status === 'bond-changed') {
    return eligibility.requiredBond;
  }
  return null;
}

/**
 * Dispute eligibility & evidence-entry composition (UI-FE-022).
 *
 * All contract data (phase, existing dispute, window, bond, balance) is
 * injected through `eligibility`, which must be contract-derived. Every
 * unsupported state renders an explicit, non-interactive action area; the
 * mutation is unavailable until the exact contract authority is pinned and
 * every contract-derived gate passes.
 */
export function DisputeEntryForm({
  claimId,
  eligibility,
  storedDraft = null,
  projection = null,
  onDraftPersist,
  onDraftDiscard,
  onAcknowledgeBond,
  onRefresh,
  onSubmit,
  initialReason = '',
  initialEvidence,
}: DisputeEntryFormProps) {
  const baseId = useId();
  const reasonId = `${baseId}-reason`;
  const reasonHelpId = `${baseId}-reason-help`;
  const actionAvailabilityId = `${baseId}-action-availability`;

  const [reason, setReason] = useState(initialReason);
  const [evidence, setEvidence] = useState<DisputeEvidenceEntryValue[]>(
    initialEvidence ?? []
  );
  const [draftState, setDraftState] = useState<'offered' | 'restored' | 'dismissed'>(
    'offered'
  );

  const currentBond = bondFromEligibility(eligibility);
  const evidenceValidation = validateEvidenceSet(evidence);
  const reasonValid = reason.trim().length >= MIN_DISPUTE_REASON_LENGTH;
  const isEligible = eligibility.status === 'eligible';
  const canSubmit =
    isEligible && reasonValid && evidenceValidation.isValid;

  const persistDraft = useCallback(
    (nextReason: string, nextEvidence: DisputeEvidenceEntryValue[]) => {
      const hasContent =
        nextReason.trim() !== '' || nextEvidence.some((e) => e.uri.trim() !== '');
      if (!hasContent) {
        onDraftDiscard?.();
        return;
      }
      onDraftPersist?.({
        claimId,
        reason: nextReason,
        evidence: nextEvidence.filter((e) => e.uri.trim() !== ''),
        bondAtDraft: currentBond,
        updatedAt: new Date().toISOString(),
      });
    },
    [claimId, currentBond, onDraftDiscard, onDraftPersist]
  );

  const handleReasonChange = useCallback(
    (value: string) => {
      setReason(value);
      persistDraft(value, evidence);
    },
    [evidence, persistDraft]
  );

  const handleEvidenceChange = useCallback(
    (index: number, patch: Partial<DisputeEvidenceEntryValue>) => {
      setEvidence((previous) => {
        const next = previous.map((entry, entryIndex) =>
          entryIndex === index ? { ...entry, ...patch } : entry
        );
        persistDraft(reason, next);
        return next;
      });
    },
    [persistDraft, reason]
  );

  const handleEvidenceAdd = useCallback(() => {
    setEvidence((previous) => {
      if (previous.length >= MAX_EVIDENCE_ENTRIES) return previous;
      const next = [...previous, { uri: '' }];
      persistDraft(reason, next);
      return next;
    });
  }, [persistDraft, reason]);

  const handleEvidenceRemove = useCallback(
    (index: number) => {
      setEvidence((previous) => {
        const next = previous.filter((_, entryIndex) => entryIndex !== index);
        persistDraft(reason, next);
        return next;
      });
    },
    [persistDraft, reason]
  );

  const handleRestoreDraft = useCallback(() => {
    if (!storedDraft) return;
    setReason(storedDraft.reason);
    setEvidence(storedDraft.evidence);
    setDraftState('restored');
  }, [storedDraft]);

  const handleDiscardDraft = useCallback(() => {
    setDraftState('dismissed');
    onDraftDiscard?.();
  }, [onDraftDiscard]);

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      // The submission is unreachable unless every contract-derived gate
      // passed; eligibility is never inferred from form state.
      if (!canSubmit || eligibility.status !== 'eligible') return;
      onSubmit?.({
        claimId,
        reason: reason.trim(),
        evidence: evidence
          .filter((entry) => entry.uri.trim() !== '')
          .map((entry) =>
            entry.digest !== undefined && entry.digest.trim() !== ''
              ? { ...entry, uri: entry.uri.trim(), digest: normalizeEvidenceDigest(entry.digest) }
              : { ...entry, uri: entry.uri.trim() }
          ),
        bondAmount: eligibility.requiredBond,
      });
    },
    [canSubmit, claimId, eligibility, evidence, onSubmit, reason]
  );

  const unavailableExplanation = canSubmit
    ? 'Contract authority is pinned and eligibility is contract-derived. Submitting opens the dispute on-chain.'
    : !isEligible
      ? explainEligibility(eligibility)
      : !reasonValid
        ? `Provide a reason for the dispute (at least ${MIN_DISPUTE_REASON_LENGTH} characters).`
        : 'Fix the evidence integrity problems above before submitting.';

  return (
    <section
      aria-labelledby={`${baseId}-title`}
      data-testid="dispute-entry-form"
      className="w-full max-w-xl rounded-xl border border-zinc-800 bg-[#111111] p-4 sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle size={18} aria-hidden="true" className="text-red-500" />
        <h2
          id={`${baseId}-title`}
          className="text-base font-bold text-white sm:text-lg"
        >
          Open a dispute
        </h2>
      </div>

      <div className="space-y-3">
        <DisputeEligibilityNotice
          eligibility={eligibility}
          onAcknowledgeBond={onAcknowledgeBond}
        />

        {storedDraft && draftState === 'offered' && (
          <DisputeDraftBanner
            draft={storedDraft}
            restored={false}
            onRestore={handleRestoreDraft}
            onDiscard={handleDiscardDraft}
          />
        )}
        {storedDraft && draftState === 'restored' && (
          <DisputeDraftBanner
            draft={storedDraft}
            restored
            onRestore={() => undefined}
            onDiscard={() => undefined}
          />
        )}


        {projection && (
          <p
            data-testid="dispute-projection-freshness"
            className="text-xs text-zinc-400"
          >
            API projection for claim {projection.claimId} · fetched{' '}
            <time dateTime={projection.asOf}>{projection.asOf}</time>. Projection
            data is informational; contract state governs every action here.
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div>
            <label
              htmlFor={reasonId}
              className="mb-1 block text-sm font-medium text-zinc-300"
            >
              Reason for dispute
            </label>
            <textarea
              id={reasonId}
              value={reason}
              onChange={(event) => handleReasonChange(event.target.value)}
              rows={4}
              maxLength={MAX_REASON_LENGTH}
              required
              aria-required="true"
              aria-describedby={reasonHelpId}
              placeholder="Explain why this claim's verification is incorrect (minimum 10 characters)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900/50 p-2.5 text-base text-white placeholder:text-zinc-600 focus:border-red-500 focus:outline-none"
            />
            <p id={reasonHelpId} className="mt-1 text-xs text-zinc-400">
              Provide a clear, detailed explanation. Drafts are stored on this
              device only and are stripped of credentials before saving.
            </p>
          </div>

          <div className="mt-4">
            <DisputeEvidenceEntry
              entries={evidence}
              problems={evidenceValidation.problems}
              onAdd={handleEvidenceAdd}
              onChange={handleEvidenceChange}
              onRemove={handleEvidenceRemove}
            />
          </div>

          <div className="mt-5 flex flex-col justify-end gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onRefresh}
              disabled={!onRefresh}
              className="min-h-[44px] rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:opacity-50 motion-reduce:transition-none"
            >
              Refresh contract state
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              aria-disabled={!canSubmit}
              aria-describedby={actionAvailabilityId}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              {canSubmit ? (
                <>
                  <ShieldCheck size={16} aria-hidden="true" />
                  Open dispute
                </>
              ) : (
                <>
                  <Lock size={16} aria-hidden="true" />
                  Open dispute (unavailable)
                </>
              )}
            </button>
          </div>

          <p
            id={actionAvailabilityId}
            data-testid="dispute-action-availability"
            data-available={canSubmit ? 'true' : 'false'}
            className="mt-2 text-right text-xs text-zinc-400"
          >
            {unavailableExplanation}
          </p>
        </form>
      </div>
    </section>
  );
}

export default DisputeEntryForm;
