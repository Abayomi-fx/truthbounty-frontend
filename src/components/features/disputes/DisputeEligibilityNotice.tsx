'use client';

import { AlertTriangle, CheckCircle2, Info, Loader2, Lock } from 'lucide-react';
import type { DisputeEligibility } from '@/app/types/dispute-entry';
import { explainEligibility } from '@/lib/dispute/eligibility';

export interface DisputeEligibilityNoticeProps {
  eligibility: DisputeEligibility;
  /** Re-pin the draft to the current contract bond (bond-changed state). */
  onAcknowledgeBond?: (requiredBond: string) => void;
}

/**
 * Renders the contract-derived eligibility state explicitly. Every
 * unsupported state is non-interactive: no action affordances are offered,
 * and the mutation gate stays unavailable (UI-FE-022 acceptance:
 * "Unsupported action is explicit and non-interactive").
 */
export function DisputeEligibilityNotice({
  eligibility,
  onAcknowledgeBond,
}: DisputeEligibilityNoticeProps) {
  const explanation = explainEligibility(eligibility);

  const tone = (() => {
    switch (eligibility.status) {
      case 'eligible':
        return 'border-green-800/60 bg-green-950/20 text-green-300';
      case 'protocol-unpinned':
      case 'unsupported-chain':
      case 'unsupported-phase':
      case 'existing-dispute':
      case 'expired-window':
      case 'window-not-open':
        return 'border-yellow-900/60 bg-yellow-950/20 text-yellow-200';
      case 'bond-changed':
        return 'border-orange-900/60 bg-orange-950/20 text-orange-200';
      default:
        return 'border-zinc-700 bg-zinc-900/50 text-zinc-300';
    }
  })();

  const Icon =
    eligibility.status === 'eligible'
      ? CheckCircle2
      : eligibility.status === 'loading'
        ? Loader2
        : eligibility.status === 'protocol-unpinned'
          ? Lock
          : eligibility.status === 'bond-changed'
            ? Info
            : AlertTriangle;

  return (
    <div
      role="status"
      data-testid="dispute-eligibility-notice"
      data-status={eligibility.status}
      className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${tone}`}
    >
      <Icon
        size={18}
        aria-hidden="true"
        className={`mt-0.5 shrink-0 motion-reduce:animate-none ${
          eligibility.status === 'loading' ? 'animate-spin' : ''
        }`}
      />
      <div className="min-w-0">
        <p data-testid="dispute-eligibility-explanation">{explanation}</p>

        {eligibility.status === 'eligible' && (
          <p className="mt-1 text-xs text-green-400/90">
            Required bond {eligibility.requiredBond} wei · dispute window ends{' '}
            {eligibility.windowEnd} · observed at block{' '}
            {eligibility.observedAtBlock}
          </p>
        )}

        {eligibility.status === 'existing-dispute' && (
          <p className="mt-1 break-all font-mono text-xs text-yellow-400/90">
            Challenger: {eligibility.challenger}
          </p>
        )}

        {eligibility.status === 'bond-changed' && (
          <div className="mt-2">
            <p className="text-xs text-orange-300/90">
              Previous draft bond: {eligibility.bondAtDraft ?? 'unknown'} wei ·
              Current contract bond: {eligibility.requiredBond} wei
            </p>
            <button
              type="button"
              onClick={() => onAcknowledgeBond?.(eligibility.requiredBond)}
              className="mt-2 rounded-lg border border-orange-700 bg-orange-900/40 px-3 py-2 text-xs font-semibold text-orange-100 transition-colors hover:bg-orange-900/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 motion-reduce:transition-none"
              aria-label={`Use updated dispute bond of ${eligibility.requiredBond} wei`}
            >
              Use updated bond
            </button>
          </div>
        )}

        {eligibility.status === 'protocol-unpinned' && (
          <p className="mt-1 text-xs text-yellow-400/90">
            This action cannot be enabled from the UI: contract authority is
            pinned at deployment time, not selected in the interface.
          </p>
        )}
      </div>
    </div>
  );
}

export default DisputeEligibilityNotice;
