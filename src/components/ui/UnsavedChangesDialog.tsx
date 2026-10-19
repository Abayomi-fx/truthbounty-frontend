/**
 * UI-FE-084 — UnsavedChangesDialog.
 *
 * Accessible (WCAG 2.2 AA) confirmation shown before discarding nontrivial
 * form input. Behaviour:
 *  - initial focus lands on the safe action ("Stay editing")
 *  - Escape and backdrop click both mean "stay" (never "leave")
 *  - focus is trapped while open and returned to the trigger on close
 *    (via useDialogFocus)
 *  - the description states explicitly that drafts are browser-local only,
 *    never server or on-chain persistence
 */

'use client';

import React, { useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useDialogFocus } from '@/hooks/useDialogFocus';

export interface UnsavedChangesDialogProps {
  open: boolean;
  /** Explicit user choice to discard the input and continue leaving. */
  onConfirmLeave: () => void;
  /** Explicit user choice to stay on the form (also used by Escape/backdrop). */
  onCancel: () => void;
  /** Present a third "save draft locally and leave" action. */
  onSaveDraft?: (() => void) | null;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  saveDraftLabel?: string;
  /** Optional persistence notice rendered under the description. */
  persistenceNotice?: string;
}

const DEFAULT_TITLE = 'You have unsaved changes';
const DEFAULT_DESCRIPTION =
  'Leaving now will discard the information you entered on this form.';
const DEFAULT_PERSISTENCE_NOTICE =
  'Drafts are saved only in this browser on this device. Nothing is sent to the server or recorded on-chain until you complete the submission.';
const DEFAULT_CONFIRM_LABEL = 'Discard and leave';
const DEFAULT_CANCEL_LABEL = 'Stay editing';
const DEFAULT_SAVE_DRAFT_LABEL = 'Save draft on this device';

export function UnsavedChangesDialog({
  open,
  onConfirmLeave,
  onCancel,
  onSaveDraft = null,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  confirmLabel = DEFAULT_CONFIRM_LABEL,
  cancelLabel = DEFAULT_CANCEL_LABEL,
  saveDraftLabel = DEFAULT_SAVE_DRAFT_LABEL,
  persistenceNotice = DEFAULT_PERSISTENCE_NOTICE,
}: UnsavedChangesDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useDialogFocus(open, dialogRef, cancelRef, onCancel);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] modal-shell bg-black/60" role="presentation">
      <div
        ref={dialogRef}
        className="modal-panel bg-[#18181b] border border-[#232329]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        aria-describedby="unsaved-changes-description unsaved-changes-persistence"
        tabIndex={-1}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true">
            <AlertTriangle size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="unsaved-changes-title" className="text-lg font-bold text-white">
              {title}
            </h2>
            <p id="unsaved-changes-description" className="mt-2 text-sm text-slate-300">
              {description}
            </p>
            <p id="unsaved-changes-persistence" className="mt-2 text-xs text-slate-400">
              {persistenceNotice}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#232329] bg-[#232329] px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
          >
            {cancelLabel}
          </button>
          {onSaveDraft ? (
            <button
              type="button"
              onClick={onSaveDraft}
              className="rounded-lg border border-orange-500/50 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-400 transition-colors hover:bg-orange-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
            >
              {saveDraftLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onConfirmLeave}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UnsavedChangesDialog;
