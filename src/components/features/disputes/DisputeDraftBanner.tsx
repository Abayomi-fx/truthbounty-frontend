'use client';

import { History } from 'lucide-react';
import type { DisputeDraftV1 } from '@/app/types/dispute-entry';

export interface DisputeDraftBannerProps {
  draft: DisputeDraftV1;
  /** True once the draft has been restored into the form. */
  restored: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}

/**
 * Draft recovery banner. A previously saved draft is offered back to the
 * user explicitly — it is never applied silently, and discarding is a first
 * class keyboard-reachable action.
 */
export function DisputeDraftBanner({
  draft,
  restored,
  onRestore,
  onDiscard,
}: DisputeDraftBannerProps) {
  const savedAt = new Date(draft.updatedAt);
  const savedLabel = Number.isNaN(savedAt.getTime())
    ? draft.updatedAt
    : savedAt.toISOString();

  return (
    <div
      role="status"
      data-testid="dispute-draft-banner"
      data-restored={restored ? 'true' : 'false'}
      className="flex flex-col gap-3 rounded-lg border border-sky-900/60 bg-sky-950/20 p-3 text-sm text-sky-200 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <History size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
        {restored ? (
          <p data-testid="dispute-draft-restored-note">
            Draft restored. Review it below before submitting.
          </p>
        ) : (
          <p>
            A saved dispute draft for this claim was found (saved{' '}
            <time dateTime={draft.updatedAt}>{savedLabel}</time>
            {draft.evidence.length > 0
              ? `, ${draft.evidence.length} evidence link${draft.evidence.length === 1 ? '' : 's'}`
              : ''}
            ).
          </p>
        )}
      </div>
      {!restored && (
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onRestore}
            className="min-h-[44px] rounded-lg bg-sky-800 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 motion-reduce:transition-none"
          >
            Restore draft
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="min-h-[44px] rounded-lg border border-sky-800 px-3 py-2 text-xs font-medium text-sky-200 transition-colors hover:bg-sky-900/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 motion-reduce:transition-none"
          >
            Discard draft
          </button>
        </div>
      )}
    </div>
  );
}

export default DisputeDraftBanner;
