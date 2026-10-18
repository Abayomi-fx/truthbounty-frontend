'use client';

import React from 'react';
import {
  describeGuardianPausePhase,
  type GuardianModuleState,
  type GuardianPauseRequestState,
} from '@/lib/guardian';

export interface GuardianPausePhaseBadgeProps {
  requestState: GuardianPauseRequestState;
  moduleState?: GuardianModuleState | null;
}

/**
 * Explicitly separates a guardian pause *request* (off-chain intent / pending
 * transaction) from a confirmed on-chain module pause. A submitted request is
 * never rendered as a paused module.
 */
export function GuardianPausePhaseBadge({
  requestState,
  moduleState,
}: GuardianPausePhaseBadgeProps) {
  const phase = describeGuardianPausePhase(requestState, moduleState);

  return (
    <div
      data-testid="guardian-pause-phase"
      data-request-state={phase.requestState}
      data-onchain-state={phase.onChainState}
      data-paused-onchain={phase.isPausedOnChain ? 'true' : 'false'}
      role="status"
      aria-live="polite"
      className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pause request
        </p>
        <p className="mt-0.5 text-foreground" data-testid="guardian-request-label">
          {phase.requestLabel}
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          On-chain module pause
        </p>
        <p
          className={
            phase.isPausedOnChain
              ? 'mt-0.5 font-semibold text-destructive'
              : 'mt-0.5 text-muted-foreground'
          }
          data-testid="guardian-onchain-label"
        >
          {phase.onChainLabel}
        </p>
      </div>
    </div>
  );
}

export default GuardianPausePhaseBadge;
