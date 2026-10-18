/**
 * UI-FE-084 — useRecoverableFormDraft.
 *
 * Coordinates a form's local draft with the recoverable-draft store:
 *  - debounced local autosave while the form holds nontrivial input
 *  - explicit restore of a compatible draft (never applied silently)
 *  - explicit discard, or clearing after verified canonical persistence
 *  - quarantine of drafts pinned to another account/chain/release
 *
 * The draft is always browser-local. Nothing here writes to the server or
 * chain, and nothing here marks data as canonically persisted.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearLocalDraft,
  clearQuarantinedDraft,
  markDraftPersisted,
  readLocalDraftPayload,
  readQuarantinedDraft,
  saveLocalDraft,
  type DraftPayloadGuard,
  type DraftScope,
} from '@/lib/drafts/recoverable-draft';

export type RecoverableDraftStatus =
  /** No nontrivial input and no stored draft. */
  | 'clean'
  /** Nontrivial input exists but no local draft has been written (yet). */
  | 'dirty'
  /** Nontrivial input has been written to local draft storage. */
  | 'saved-local'
  /** Local draft was cleared because persistence was verified (or discarded). */
  | 'persisted'
  /** A stored draft was rejected (corrupt/invalid/stale) — fail closed. */
  | 'rejected'
  /** The stored draft belongs to another account/chain/release and was quarantined. */
  | 'quarantined'
  /** The last local save failed (e.g. storage unavailable) — draft is not durable. */
  | 'save-failed';

export interface UseRecoverableFormDraftOptions<TPayload> {
  /** Stable identifier for the form surface (e.g. 'claim-statement'). */
  formId: string;
  /** Wallet/release scope the draft is pinned to. */
  scope: DraftScope;
  /** Current form values. */
  payload: TPayload;
  /** True while the form holds nontrivial input that is not yet canonically persisted. */
  isDirty: boolean;
  /** Guard applied to untrusted stored payloads before they reach state. */
  validatePayload?: DraftPayloadGuard<TPayload>;
  /** Persist automatically while dirty (default true). */
  autosave?: boolean;
  /** Autosave debounce in milliseconds (default 600). */
  autosaveDelayMs?: number;
}

export interface UseRecoverableFormDraftResult<TPayload> {
  status: RecoverableDraftStatus;
  /** Timestamp of the last successful local save, if any. */
  lastSavedAt: number | null;
  /** A compatible stored draft is available for explicit restore. */
  hasRestoredDraft: boolean;
  /** Payload of the compatible stored draft (validated), if available. */
  restoredPayload: TPayload | null;
  savedAtOfRestored: number | null;
  /** A stored draft was quarantined because the scope changed. */
  quarantined: boolean;
  /** Reason the draft was quarantined, when known. */
  quarantinedReason: string | null;
  /** Acknowledge the restored draft (e.g. after hydrating or dismissing it). */
  acknowledgeRestoredDraft: () => void;
  /** Acknowledge the quarantine notice and drop the quarantined record. */
  acknowledgeQuarantine: () => void;
  /** Write the current payload to local storage immediately. */
  saveDraft: () => boolean;
  /** Explicitly discard the local draft (and quarantine) for this form. */
  discardDraft: () => void;
  /**
   * Clear the local draft after the caller verified canonical persistence
   * (confirmed transaction or verified API write). Releases navigation guards.
   */
  markPersisted: () => void;
}

export function useRecoverableFormDraft<TPayload>(
  options: UseRecoverableFormDraftOptions<TPayload>,
): UseRecoverableFormDraftResult<TPayload> {
  const {
    formId,
    scope,
    payload,
    isDirty,
    validatePayload,
    autosave = true,
    autosaveDelayMs = 600,
  } = options;

  const scopeKey = `${scope.address?.toLowerCase() ?? 'disconnected'}:${scope.chainId ?? 'unknown'}:${scope.releaseId}`;

  const [status, setStatus] = useState<RecoverableDraftStatus>('clean');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [restored, setRestored] = useState<{
    payload: TPayload;
    savedAt: number;
  } | null>(null);
  const [quarantined, setQuarantined] = useState(false);
  const [quarantinedReason, setQuarantinedReason] = useState<string | null>(null);

  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const validateRef = useRef(validatePayload);
  validateRef.current = validatePayload;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Load/quarantine on mount and whenever the wallet/release scope changes.
  useEffect(() => {
    const result = readLocalDraftPayload<TPayload>(formId, scope, validateRef.current);

    if (result.status === 'restored') {
      setRestored({ payload: result.payload, savedAt: result.savedAt });
      setQuarantined(false);
      setQuarantinedReason(null);
      setStatus('saved-local');
      setLastSavedAt(result.savedAt);
      return;
    }

    if (result.status === 'quarantined') {
      setRestored(null);
      setQuarantined(true);
      setQuarantinedReason(result.reason);
      setStatus('quarantined');
      return;
    }

    if (result.status === 'rejected') {
      setRestored(null);
      setQuarantined(false);
      setQuarantinedReason(null);
      setStatus('rejected');
      return;
    }

    // 'none' — surface any quarantine record left by a previous sweep.
    const record = readQuarantinedDraft(formId);
    if (record) {
      setQuarantined(true);
      setQuarantinedReason(record.reason);
      setStatus('quarantined');
    } else {
      setQuarantined(false);
      setQuarantinedReason(null);
      setStatus(isDirtyRef.current ? 'dirty' : 'clean');
      setRestored(null);
    }
  }, [formId, scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps -- scope identity is derived from scopeKey

  const saveDraft = useCallback((): boolean => {
    const draft = saveLocalDraft(formId, scope, payloadRef.current, validateRef.current);
    if (draft) {
      setLastSavedAt(draft.savedAt);
      setStatus('saved-local');
      return true;
    }
    setStatus('save-failed');
    return false;
  }, [formId, scope]);

  // Debounced local autosave while dirty.
  useEffect(() => {
    if (!autosave) return undefined;
    if (!isDirty) {
      if (status === 'dirty') setStatus('clean');
      return undefined;
    }
    if (status === 'quarantined' || status === 'persisted') return undefined;

    const timer = setTimeout(() => {
      saveDraft();
    }, autosaveDelayMs);
    return () => clearTimeout(timer);
  }, [autosave, autosaveDelayMs, isDirty, payload, saveDraft, status]); // eslint-disable-line react-hooks/exhaustive-deps -- payload identity drives the debounce

  const discardDraft = useCallback(() => {
    clearLocalDraft(formId);
    setRestored(null);
    setLastSavedAt(null);
    setStatus('clean');
  }, [formId]);

  const markPersisted = useCallback(() => {
    markDraftPersisted(formId);
    setRestored(null);
    setLastSavedAt(null);
    setStatus('persisted');
  }, [formId]);

  const acknowledgeRestoredDraft = useCallback(() => {
    setRestored(null);
  }, []);

  const acknowledgeQuarantine = useCallback(() => {
    clearQuarantinedDraft(formId);
    setQuarantined(false);
    setQuarantinedReason(null);
    setStatus(isDirtyRef.current ? 'dirty' : 'clean');
  }, [formId]);

  return useMemo(
    () => ({
      status,
      lastSavedAt,
      hasRestoredDraft: restored !== null,
      restoredPayload: restored ? restored.payload : null,
      savedAtOfRestored: restored ? restored.savedAt : null,
      quarantined,
      quarantinedReason,
      acknowledgeRestoredDraft,
      acknowledgeQuarantine,
      saveDraft,
      discardDraft,
      markPersisted,
    }),
    [
      status,
      lastSavedAt,
      restored,
      quarantined,
      quarantinedReason,
      acknowledgeRestoredDraft,
      acknowledgeQuarantine,
      saveDraft,
      discardDraft,
      markPersisted,
    ],
  );
}
