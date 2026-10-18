'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDisputeEntry } from '@/hooks/useDisputeEntry';
import type {
  DisputeDraftInput,
  DisputeDraftV1,
  DisputeEntrySubmission,
  DisputeProjectionOverlay,
} from '@/app/types/dispute-entry';
import {
  DisputeDraftStore,
  resolveBrowserDraftStore,
} from '@/lib/dispute/draft';
import { DisputeEntryForm } from './DisputeEntryForm';

export interface DisputeEntryCompositionProps {
  claimId: string;
  /** Chain this composition targets; defaults to Optimism Sepolia. */
  expectedChainId?: number;
  /**
   * Freshness-labelled API projection (display only). Never grants
   * eligibility or mutation authority.
   */
  projection?: DisputeProjectionOverlay | null;
  /**
   * Mutation sink. Invoked only when the exact contract authority is pinned
   * and every contract-derived gate has passed.
   */
  onOpenDispute?: (submission: DisputeEntrySubmission) => void;
  /** Draft storage override (tests / Storybook). */
  draftStore?: DisputeDraftStore;
}

/**
 * Client wiring for the dispute eligibility & evidence-entry composition:
 * contract reads via `useDisputeEntry`, draft persistence via a sanitized
 * draft store, and the presentational `DisputeEntryForm`.
 */
export function DisputeEntryComposition({
  claimId,
  expectedChainId,
  projection = null,
  onOpenDispute,
  draftStore,
}: DisputeEntryCompositionProps) {
  const store = useMemo(
    () => draftStore ?? resolveBrowserDraftStore(),
    [draftStore]
  );

  const [storedDraft, setStoredDraft] = useState<DisputeDraftV1 | null>(null);
  const [bondAtDraft, setBondAtDraft] = useState<bigint | null>(null);

  // Recover any stored draft once mounted (localStorage is client-only).
  useEffect(() => {
    const recovered = store.load(claimId);
    setStoredDraft(recovered);
    setBondAtDraft(
      recovered?.bondAtDraft != null ? BigInt(recovered.bondAtDraft) : null
    );
  }, [store, claimId]);

  const { artifact, eligibility, refreshState } = useDisputeEntry({
    claimId,
    expectedChainId,
    bondAtDraft,
  });

  const handleDraftPersist = useCallback(
    (input: DisputeDraftInput) => {
      const saved = store.save(input);
      setStoredDraft(saved.draft);
      setBondAtDraft(
        saved.draft.bondAtDraft != null ? BigInt(saved.draft.bondAtDraft) : null
      );
    },
    [store]
  );

  const handleDraftDiscard = useCallback(() => {
    store.discard(claimId);
    setStoredDraft(null);
    setBondAtDraft(null);
  }, [store, claimId]);

  const handleAcknowledgeBond = useCallback(
    (requiredBond: string) => {
      setBondAtDraft(BigInt(requiredBond));
      // Keep the persisted draft in sync with the acknowledged bond so a
      // reload does not resurrect the stale bond.
      if (storedDraft) {
        store.save({
          claimId,
          reason: storedDraft.reason,
          evidence: storedDraft.evidence,
          bondAtDraft: requiredBond,
          updatedAt: new Date().toISOString(),
        });
      }
    },
    [store, claimId, storedDraft]
  );

  const handleSubmit = useCallback(
    (submission: { reason: string; evidence: DisputeDraftInput['evidence']; bondAmount: string }) => {
      // Guard once more at the boundary: the mutation is only handed to the
      // sink under an eligible, contract-derived state with pinned authority.
      if (eligibility.status !== 'eligible' || !artifact.isPinned) return;
      onOpenDispute?.({
        claimId,
        reason: submission.reason,
        evidence: submission.evidence,
        bondAmount: submission.bondAmount,
        artifact,
      });
    },
    [artifact, claimId, eligibility.status, onOpenDispute]
  );

  return (
    <DisputeEntryForm
      claimId={claimId}
      eligibility={eligibility}
      storedDraft={storedDraft}
      projection={projection}
      onDraftPersist={handleDraftPersist}
      onDraftDiscard={handleDraftDiscard}
      onAcknowledgeBond={handleAcknowledgeBond}
      onRefresh={() => void refreshState()}
      onSubmit={handleSubmit}
    />
  );
}

export default DisputeEntryComposition;
