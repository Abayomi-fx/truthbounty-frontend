'use client';

import * as React from 'react';

import { Icon, type IconName } from '@/components/ui/icons';
import type { StatusToneName } from '@/lib/design-tokens';
import type { GovernedChangeSurfaceState } from '@/lib/governed-change';
import { cn } from '@/lib/utils';

import { SURFACE_STATE_LABELS } from './source';

/**
 * UI-FE-029 — fail-closed blocked surface for governed change.
 *
 * Renders whenever execution or preparation is not allowed and always lists the
 * exact blocking reasons, so a reviewer can see why a governed mutation is
 * withheld. Never renders an action control.
 */

interface BlockedPresentation {
  readonly icon: IconName;
  readonly tone: StatusToneName;
  readonly title: string;
  readonly description: string;
}

const PRESENTATIONS: Record<GovernedChangeSurfaceState, BlockedPresentation> = {
  loading: {
    icon: 'loader',
    tone: 'info',
    title: 'Loading governed change',
    description: 'Review data is still being loaded; no action is available.',
  },
  empty: {
    icon: 'file-text',
    tone: 'neutral',
    title: 'No governed change selected',
    description: 'Choose a supported configuration change to prepare.',
  },
  stale: {
    icon: 'history',
    tone: 'warning',
    title: 'Governed change data is stale',
    description: 'Refresh the projection before preparing or executing.',
  },
  offline: {
    icon: 'wifi-off',
    tone: 'warning',
    title: 'You are offline',
    description: 'Reconnect before preparing or executing a governed change.',
  },
  error: {
    icon: 'alert-triangle',
    tone: 'danger',
    title: 'Governed change unavailable',
    description: 'The review could not be loaded. Try again before acting.',
  },
  denied: {
    icon: 'shield-alert',
    tone: 'danger',
    title: 'Access denied',
    description:
      'The connected account is not authorized to prepare or execute this change.',
  },
  'wrong-chain': {
    icon: 'ban',
    tone: 'danger',
    title: 'Unsupported network',
    description: 'Switch to a supported network before proceeding.',
  },
  unavailable: {
    icon: 'lock',
    tone: 'neutral',
    title: 'Governed change execution unavailable',
    description: 'This capability is not available in the current context.',
  },
  ready: {
    icon: 'list-checks',
    tone: 'warning',
    title: 'Execution blocked',
    description: 'One or more gates must pass before execution is enabled.',
  },
};

export interface GovernedChangeBlockedStateProps {
  /** The surface state driving the presentation. Defaults to `ready`. */
  surfaceState?: GovernedChangeSurfaceState;
  /** Exact reasons preparation or execution is withheld. */
  reasons?: readonly string[];
  /** Optional explicit heading override. */
  title?: string;
  className?: string;
  'data-testid'?: string;
}

export function GovernedChangeBlockedState({
  surfaceState = 'ready',
  reasons = [],
  title,
  className,
  'data-testid': testId = 'governed-change-blocked',
}: GovernedChangeBlockedStateProps) {
  const presentation = PRESENTATIONS[surfaceState];
  const heading = title ?? presentation.title;

  return (
    <section
      role="alert"
      aria-live="assertive"
      data-testid={testId}
      data-surface-state={surfaceState}
      className={cn(
        'rounded-xl border border-warning/40 bg-card p-6 space-y-3',
        className,
      )}
      aria-labelledby="governed-change-blocked-heading"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-warning/15 p-3 shrink-0">
          <Icon
            name={presentation.icon}
            size="lg"
            tone={presentation.tone}
          />
        </div>
        <div className="space-y-2 flex-1">
          <h2
            id="governed-change-blocked-heading"
            className="text-base font-bold text-foreground"
          >
            {heading}
          </h2>
          <p className="text-sm font-medium text-foreground/80">
            {presentation.description}
          </p>
          <p className="text-xs text-muted-foreground">
            Surface state: {SURFACE_STATE_LABELS[surfaceState]}. Execution stays
            disabled until every gate passes.
          </p>
        </div>
      </div>

      {reasons.length > 0 ? (
        <ul
          className="space-y-1 text-xs text-warning"
          aria-label="Blocking reasons"
          data-testid="governed-change-blocking-reasons"
        >
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default GovernedChangeBlockedState;
