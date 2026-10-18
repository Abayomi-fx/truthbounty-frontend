/**
 * UI-FE-084 — DraftStatusIndicator.
 *
 * States plainly whether the current form values exist only as a local
 * browser draft or whether persistence has been verified (canonical).
 * Announced politely to assistive technology via role="status".
 */

'use client';

import React from 'react';

export type DraftStatusKind =
  | 'clean'
  | 'dirty'
  | 'saved-local'
  | 'persisted'
  | 'rejected'
  | 'quarantined'
  | 'save-failed';

export interface DraftStatusIndicatorProps {
  status: DraftStatusKind;
  /** Epoch ms of the last successful local save (used for the local label). */
  lastSavedAt?: number | null;
  className?: string;
}

const LABELS: Record<DraftStatusKind, string> = {
  clean: 'No draft',
  dirty: 'Not saved yet',
  'saved-local': 'Saved as a local draft on this device',
  persisted: 'Saved',
  rejected: 'Local draft could not be verified and was discarded',
  quarantined: 'Local draft quarantined — account, chain, or release changed',
  'save-failed': 'Could not save the local draft',
};

const TEST_IDS: Record<DraftStatusKind, string> = {
  clean: 'draft-status-clean',
  dirty: 'draft-status-dirty',
  'saved-local': 'draft-status-local',
  persisted: 'draft-status-persisted',
  rejected: 'draft-status-rejected',
  quarantined: 'draft-status-quarantined',
  'save-failed': 'draft-status-save-failed',
};

const TEXT_CLASSES: Record<DraftStatusKind, string> = {
  clean: 'text-slate-500',
  dirty: 'text-slate-400',
  'saved-local': 'text-sky-300',
  persisted: 'text-green-400',
  rejected: 'text-amber-400',
  quarantined: 'text-amber-400',
  'save-failed': 'text-red-400',
};

function formatSavedAt(lastSavedAt: number | null | undefined): string | null {
  if (typeof lastSavedAt !== 'number' || !Number.isFinite(lastSavedAt)) return null;
  try {
    return new Date(lastSavedAt).toLocaleTimeString();
  } catch {
    return null;
  }
}

export function DraftStatusIndicator({
  status,
  lastSavedAt = null,
  className = '',
}: DraftStatusIndicatorProps) {
  const base = LABELS[status];
  const savedAt = status === 'saved-local' ? formatSavedAt(lastSavedAt) : null;
  const text = savedAt ? `${base} (${savedAt})` : base;

  return (
    <p
      role="status"
      aria-live="polite"
      data-testid={TEST_IDS[status]}
      className={`text-xs ${TEXT_CLASSES[status]} ${className}`.trim()}
    >
      {text}
    </p>
  );
}

export default DraftStatusIndicator;
