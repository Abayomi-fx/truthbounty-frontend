'use client';

/**
 * ApiStaleBanner (UI-FE-010)
 *
 * Rendered when the API projection data for a claim is stale — i.e. the
 * freshness window has lapsed and the projected values may no longer
 * reflect on-chain state.
 *
 * Accessibility contract:
 * - `role="status"` + `aria-live="polite"` so the banner announces itself
 *   without interrupting the user (not an error — the page still shows
 *   data; it may just be slightly stale).
 * - The reconcile button has a descriptive `aria-label`.
 * - No colour-only signal: the warning icon is paired with visible text.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ApiStaleBannerProps {
  /** Called when the user clicks the reconcile / refresh button. */
  onReconcile: () => void;
  /** When `true` the button shows a reconciling/loading state. */
  isReconciling?: boolean;
  className?: string;
}

/** Warning triangle icon — aria-hidden because adjacent text conveys meaning. */
function WarningIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.15.15 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.2.2 0 0 1-.054.06.1.1 0 0 1-.066.017H1.146a.1.1 0 0 1-.066-.017.2.2 0 0 1-.054-.06.18.18 0 0 1 .002-.183L7.884 2.073a.15.15 0 0 1 .054-.057zm1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566z" />
      <path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995z" />
    </svg>
  );
}

/**
 * `ApiStaleBanner` — polite status banner shown when projected data is stale.
 *
 * All write actions in `ClaimDetailComposer` should be gated while this banner
 * is visible (the composer owns the gate; this component only renders the
 * informational strip and the reconcile affordance).
 *
 * @example
 * <ApiStaleBanner onReconcile={reconcile} isReconciling={isReconciling} />
 */
export function ApiStaleBanner({ onReconcile, isReconciling = false, className }: ApiStaleBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border',
        'border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning',
        className,
      )}
    >
      <span className="flex items-center gap-2">
        <WarningIcon />
        <span>
          Data may be outdated. Projected values might not reflect current on-chain state.
        </span>
      </span>

      <button
        type="button"
        onClick={onReconcile}
        disabled={isReconciling}
        aria-label="Refresh claim data to reconcile with on-chain state"
        className={cn(
          'shrink-0 rounded-md border border-warning/50 bg-warning/20 px-3 py-1',
          'text-xs font-medium text-warning transition',
          'hover:bg-warning/30 focus:outline-none focus:ring-2 focus:ring-warning/50 focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {isReconciling ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  );
}

export default ApiStaleBanner;
