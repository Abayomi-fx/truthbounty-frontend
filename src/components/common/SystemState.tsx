/**
 * SystemState — Canonical system-state component family.
 * UI-FE-003
 *
 * Provides the eight canonical system states used across the app:
 *  - loading
 *  - empty
 *  - stale
 *  - offline
 *  - unavailable
 *  - error
 *  - denied
 *  - not-found
 *
 * Design constraints:
 *  - Meaning must never depend on color alone (icon + text + ARIA label).
 *  - Denied, unavailable, and not-found are semantically distinct.
 *  - Source/freshness metadata is surfaced when available.
 *  - Recoverable identifiers and drafts are preserved and displayed.
 *  - Retry / return / diagnostic actions are safe and never auto-mutate.
 *  - Unpinned actions render as unavailable.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import {
  Loader2,
  Inbox,
  ClockCountdown,
  WifiOff,
  ServerOff,
  AlertTriangle,
  Lock,
  FileQuestion,
  RefreshCw,
  ArrowLeft,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { APP_ROUTES } from '@/config/navigation';

export type SystemStateKind =
  | 'loading'
  | 'empty'
  | 'stale'
  | 'offline'
  | 'unavailable'
  | 'error'
  | 'denied'
  | 'not-found';

export type SystemStateSource =
  | 'contract'
  | 'api'
  | 'cache'
  | 'wallet'
  | 'network'
  | 'unknown';

export type SystemStateFreshnessLabel =
  | 'fresh'
  | 'stale'
  | 'critical'
  | 'unknown';

export interface SystemStateMetadata {
  /** Where the displayed data originates. */
  source?: SystemStateSource;
  /** Freshness label for the projection. */
  freshness?: SystemStateFreshnessLabel;
  /** Age of the data in milliseconds. */
  dataAgeMs?: number | null;
  /** Human-readable label for the block/snapshot reference. */
  blockLabel?: string;
  /** Optional description of the source for diagnostics. */
  sourceLabel?: string;
}

export interface SystemStateAction {
  /** Visible label for the action. */
  label: string;
  /** Optional click handler. If omitted, the action renders unavailable. */
  onClick?: () => void | Promise<void>;
  /** Optional href for navigation actions. */
  href?: string;
  /** Visual variant. */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Whether this action should receive focus on mount. */
  autoFocus?: boolean;
  /** Optional accessible label override. */
 'aria-label'?: string;
  /** Optional disabled flag. */
  disabled?: boolean;
}

export interface SystemStateProps {
  /** The canonical system state. */
  state: SystemStateKind;
  /** Optional scope label, e.g. "dashboard". */
  scope?: string;
  /** Optional title override. */
  title?: string;
  /** Optional description override. */
  description?: string;
  /** Optional source/metadata. */
  metadata?: SystemStateMetadata;
  /** Optional actions. */
  actions?: SystemStateAction[];
  /** Optional recoverable identifier. */
  recoverableId?: string;
  /** Optional diagnostic reference code. */
  diagnosticId?: string;
  /** Optional preserve-notice flag. */
  preserveNotice?: boolean;
  /** Optional draft preservation note. */
  draftNote?: string;
}

interface StateDescriptor {
  kind: SystemStateKind;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  /** Short non-color semantic tag for screen readers and low-color users. */
  tag: string;
  /** Whether this state is recoverable via retry. */
  recoverable: boolean;
}

const STATE_DESCRIPTORS: Record<SystemStateKind, StateDescriptor> = {
  loading: {
    kind: 'loading',
    title: 'Loading',
    description: 'Loading the requested content.',
    icon: Loader2,
    tag: 'Loading',
    recoverable: false,
  },
  empty: {
    kind: 'empty',
    title: 'No results',
    description: 'There is nothing to show here yet.',
    icon: Inbox,
    tag: 'Empty',
    recoverable: false,
  },
  stale: {
    kind: 'stale',
    title: 'Data is stale',
    description: 'The displayed data may be out of date.',
    icon: ClockCountdown,
    tag: 'Stale',
    recoverable: true,
  },
  offline: {
    kind: 'offline',
    title: 'You are offline',
    description: 'Connect to the network to continue.',
    icon: WifiOff,
    tag: 'Offline',
    recoverable: true,
  },
  unavailable: {
    kind: 'unavailable',
    title: 'Service unavailable',
    description: 'This service is temporarily unavailable.',
    icon: ServerOff,
    tag: 'Unavailable',
    recoverable: true,
  },
  error: {
    kind: 'error',
    title: 'Something went wrong',
    description: 'An unexpected error occurred.',
    icon: AlertTriangle,
    tag: 'Error',
    recoverable: true,
  },
  denied: {
    kind: 'denied',
    title: 'Access denied',
    description: 'You do not have permission to view this content.',
    icon: Lock,
    tag: 'Denied',
    recoverable: false,
  },
  'not-found': {
    kind: 'not-found',
    title: 'Not found',
    description: 'The requested resource could not be found.',
    icon: FileQuestion,
    tag: 'Not found',
    recoverable: false,
  },
};

const PRIMARY_ACTION_CLASS =
  'inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none';

const SECONDARY_ACTION_CLASS =
  'inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none';

const GHOST_ACTION_CLASS =
  'inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none';

function sourceLabel(source?: SystemStateSource): string {
  switch (source) {
    case 'contract':
      return 'On-chain contract';
    case 'api':
      return 'API projection';
    case 'cache':
      return 'Local cache';
    case 'wallet':
      return 'Wallet';
    case 'network':
      return 'Network';
    default:
      return 'Unknown source';
  }
}

function freshnessLabel(freshness?: SystemStateFreshnessLabel): string {
  switch (freshness) {
    case 'fresh':
      return 'Fresh';
    case 'stale':
      return 'Stale';
    case 'critical':
      return 'Critical';
    default:
      return 'Unknown';
  }
}

function formatAge(ageMs?: number | null): string | null {
  if (ageMs == null || Number.isNaN(ageMs)) {
    return null;
  }
  if (ageMs < 1000) {
    return 'just now';
  }
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SystemState({
  state,
  scope,
  title,
  description,
  metadata,
  actions,
  recoverableId,
  diagnosticId,
  preserveNotice = true,
  draftNote,
}: SystemStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const descriptor = STATE_DESCRIPTORS[state];
  const Icon = descriptor.icon;
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const [sourceExpanded] = React.useState(false);

  React.useEffect(() => {
    if (headingRef.current) {
      headingRef.current.focus();
    }
  }, []);

  const resolvedTitle = title ?? descriptor.title;
  const resolvedDescription = description ?? descriptor.description;
  const ageLabel = formatAge(metadata?.dataAgeMs);
  const hasMetadata = Boolean(
    metadata &&
      (metadata.source ||
        metadata.freshness ||
        metadata.blockLabel ||
        metadata.sourceLabel ||
        ageLabel),
  );
  const hasContext = Boolean(recoverableId || diagnosticId || draftNote);
  const effectiveActions = actions ?? [];
  const autoFocusIndex = effectiveActions.findIndex((action) => action.autoFocus);

  const statusLabel = scope ? `${descriptor.tag} — ${scope}` : descriptor.tag;

  return (
    <div
      role={state === 'loading' ? 'status' : 'alert'}
      aria-live={state === 'loading' ? 'polite' : 'assertive'}
      aria-busy={state === 'loading' ? true : undefined}
      aria-label={statusLabel}
      className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center"
      data-testid="system-state"
      data-state={state}
    >
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-sm">
        <Icon
          className={`h-8 w-8 ${state === 'loading' && !prefersReducedMotion ? 'animate-spin' : ''}`}
          aria-hidden={true}
        />
      </div>

      <span className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {descriptor.tag}
      </span>

      <h1
        ref={headingRef}
        className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl focus:outline-none"
        id="system-state-heading"
        tabIndex={-1}
      >
        {resolvedTitle}
      </h1>

      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        {resolvedDescription}
      </p>

      {hasMetadata ? (
        <dl
          className="mt-4 max-w-md rounded-lg border border-border bg-card px-4 py-3 text-left text-xs text-muted-foreground"
          data-testid="system-state-metadata"
        >
          {metadata?.source ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="font-medium text-foreground">Source</dt>
              <dd className="text-right">{sourceLabel(metadata.source)}</dd>
            </div>
          ) : null}
          {metadata?.freshness ? (
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <dt className="font-medium text-foreground">Freshness</dt>
              <dd className="text-right">{freshnessLabel(metadata.freshness)}</dd>
            </div>
          ) : null}
          {ageLabel ? (
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <dt className="font-medium text-foreground">Age</dt>
              <dd className="text-right">{ageLabel}</dd>
            </div>
          ) : null}
          {metadata?.blockLabel ? (
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <dt className="font-medium text-foreground">Block</dt>
              <dd className="text-right font-mono truncate" title={metadata.blockLabel}>
                {metadata.blockLabel}
              </dd>
            </div>
          ) : null}
          {metadata?.sourceLabel ? (
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <dt className="font-medium text-foreground">Detail</dt>
              <dd className="text-right">{metadata.sourceLabel}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {hasContext ? (
        <dl
          className="mt-4 max-w-md rounded-lg border border-border bg-card px-4 py-3 text-left text-xs text-muted-foreground"
          data-testid="system-state-context"
        >
          {recoverableId ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="font-medium text-foreground">Reference</dt>
              <dd className="text-right font-mono truncate" title={recoverableId}>
                {recoverableId}
              </dd>
            </div>
          ) : null}
          {diagnosticId ? (
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <dt className="font-medium text-foreground">Diagnostic</dt>
              <dd className="text-right font-mono truncate" title={diagnosticId}>
                {diagnosticId}
              </dd>
            </div>
          ) : null}
          {draftNote ? (
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <dt className="font-medium text-foreground">Draft</dt>
              <dd className="text-right">{draftNote}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {preserveNotice ? (
        <p className="mt-4 max-w-md text-xs text-muted-foreground">
          Your work and identifiers are preserved. No changes were applied.
        </p>
      ) : null}

      {effectiveActions.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {effectiveActions.map((action, index) => {
            const variantClass =
              action.variant === 'primary'
                ? PRIMARY_ACTION_CLASS
                : action.variant === 'ghost'
                  ? GHSOT_ACTION_CLASS
                  : SECONDARY_ACTION_CLASS;
            const isUnavailable = !action.onClick && !action.href;
            const isDisabled = action.disabled || isUnavailable;
            const commonProps = {
              className: `${variantClass} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`,
              'aria-label': action['aria-label'] ?? action.label,
              'aria-disabled': isDisabled ? true : undefined,
              'title': isUnavailable ? 'This action is not available in this context.' : undefined,
            } as const;

            if (action.href && !isDisabled) {
              return (
                <Link
                  key={`${action.label}-${index}`}
                  href={action.href}
                  {...commonProps}
                >
                  {action.label}
                </Link>
              );
            }

            return (
              <button
                key={`${action.label}-${index}`}
                type="button"
                onClick={action.onClick}
                disabled={isDisabled}
                autoFocus={index === autoFocusIndex}
                {...commonProps}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
