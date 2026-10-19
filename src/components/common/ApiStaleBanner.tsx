'use client';

/**
 * ApiStaleBanner — Accessible announcement when API projection data is stale.
 * V2-FE-136
 *
 * Renders nothing when data is fresh.
 * Renders a polite warning when stale.
 * Renders an assertive alert when critical (actions may be blocked).
 *
 * Meaning never depends on color alone: every state carries an explicit
 * text label and a non-color icon glyph. Denied, unavailable, and not-found
 * remain semantically distinct with their own copy and action availability.
 */

import type { ApiDataStatus } from '@/lib/rpc-fallback/types';

export interface ApiStaleBannerProps {
  status: ApiDataStatus;
  /** Data age in ms — used to show human-readable duration. */
  dataAgeMs?: number | null;
  /** Called when the user requests a manual reload. */
  onReload?: () => void;
  /** Optional diagnostic action (e.g. copy correlation id); never auto-mutates. */
  onDiagnostic?: () => void;
  /** Optional return action for denied/stale contexts. */
  onReturn?: () => void;
  /** Recoverable identifier (e.g. address, tx hash) to preserve across retries. */
  recoverableId?: string;
  className?: string;
}

function formatAge(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)} seconds`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} minutes`;
  return `${Math.round(ms / 3_600_000)} hours`;
}

type StateTone = 'neutral' | 'warning' | 'critical';

interface StatePresentation {
  tone: StateTone;
  label: string;
  icon: string;
  message: string;
  alertness: 'polite' | 'assertive';
  role: 'status' | 'alert';
  actions: Array<'Reload now' | 'Retry' | 'Return' | 'Copy diagnostics'>;
}

function describeState(
  status: ApiDataStatus,
  ageLabel: string,
): StatePresentation {
  switch (status) {
    case 'unavailable':
      return {
        tone: 'critical',
        label: 'Unavailable',
        icon: '⛔',
        message:
          'Protocol data is unavailable. Actions are disabled until data is restored.',
        alertness: 'assertive',
        role: 'alert',
        actions: ['Retry'],
      };
    case 'critical':
      return {
        tone: 'critical',
        label: 'Critically stale',
        icon: '⛔',
        message: 'Protocol data is critically stale' + ageLabel + '. Actions are blocked until data refreshes.',
        alertness: 'assertive',
        role: 'alert',
        actions: ['Reload now', 'Copy diagnostics'],
      };
    case 'error':
      return {
        tone: 'critical',
        label: 'Error',
        icon: '⛔',
        message: 'Failed to load protocol data. Please retry.',
        alertness: 'assertive',
        role: 'alert',
        actions: ['Retry', 'Copy diagnostics'],
      };
    case 'denied':
      return {
        tone: 'critical',
        label: 'Access denied',
        icon: '⛔',
        message:
          'You do not have permission to view this protocol data. Request access or return.',
        alertness: 'assertive',
        role: 'alert',
        actions: ['Return'],
      };
    case 'not-found':
      return {
        tone: 'neutral',
        label: 'Not found',
        icon: '○',
        message: 'The requested protocol resource could not be found.',
        alertness: 'polite',
        role: 'status',
        actions: ['Return'],
      };
    case 'stale':
      return {
        tone: 'warning',
        label: 'Stale',
        icon: '⚠',
        message: 'Protocol data may be slightly outdated' + ageLabel + '.',
        alertness: 'polite',
        role: 'status',
        actions: ['Reload now'],
      };
    case 'fresh':
    case 'loading':
    default:
      return {
        tone: 'neutral',
        label: 'Fresh',
        icon: '🟢',
        message: 'Protocol data is fresh.',
        alertness: 'polite',
        role: 'status',
        actions: [],
      };
  }
}

const TONE_CLASSES: Record<StateTone, string> = {
  neutral:
    'border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-900/20 dark:text-slate-200',
  warning:
    'border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
  critical:
    'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300',
};

export function ApiStaleBanner({
  status,
  dataAgeMs,
  onReload,
  onDiagnostic,
  onReturn,
  recoverableId,
  className = '',
}: ApiStaleBannerProps) {
  if (status === 'fresh' || status === 'loading') return null;

  const ageLabel = dataAgeMs != null ? ' (' + formatAge(dataAgeMs) + ' ago)' : '';
  const presentation = describeState(status, ageLabel);

  const handlers: Record<string, (() => void) | undefined> = {
    'Reload now': onReload,
    Retry: onReload,
    Return: onReturn,
    'Copy diagnostics': onDiagnostic,
  };

  const visibleActions = presentation.actions.filter(
    (label) => typeof handlers[label] === 'function',
  );

  return (
    <div
      role={presentation.role}
      aria-live={presentation.alertness}
      aria-atomic="true"
      data-testid={`api-stale-banner-${status}`}
      data-state={status}
      data-tone={presentation.tone}
      className={[
        'flex items-start gap-3 rounded-md border px-4 py-3 text-sm',
        TONE_CLASSES[presentation.tone],
        className,
      ].join(' ')}
    >
      <span aria-hidden="true" className="mt-0.5 flex-none text-base">
        {presentation.icon}
      </span>
      <div className="flex-1">
        <p className="font-medium">
          <span className="font-semibold">{presentation.label}:</span>{' '}
          {presentation.message}
        </p>
        {recoverableId && (
          <p className="mt-1 text-xs opacity-80">
            Reference: <code>{recoverableId}</code>
          </p>
        )}
        {visibleActions.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {visibleActions.map((label) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={handlers[label]}
                  className="rounded underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
                  aria-label={
                    label === 'Reload now' || label === 'Retry'
                      ? 'Reload protocol data'
                      : label === 'Return'
                        ? 'Return to previous view'
                        : 'Copy diagnostic details'
                  }
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
