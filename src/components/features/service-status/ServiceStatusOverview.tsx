'use client';

/**
 * ServiceStatusOverview — public /status overview.
 *
 * Renders sanitized public observations only. Never reuses protected
 * administrator health responses. Missing or stale observations are
 * surfaced as non-healthy and third-party components are labelled as
 * dependencies, not guarantees.
 *
 * UIF-FE-036
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import {
  adaptPublicServiceStatus,
  fetchPublicServiceStatus,
  type PublicServiceStatusObservation,
  type PublicServiceStatusPayload,
  type ServiceComponentObservation,
  type ServiceStatusTone,
} from '@/app/queries/status.queries';

export interface ServiceStatusOverviewProps {
  /** Optional pre-fetched sanitized observation. When provided, no
   * network request is made. */
  observation?: PublicServiceStatusObservation | null;
  /** Optional fetcher override for testing. Defaults to the public
   * telemetry adapter. */
  fetcher?: (signal?: AbortSignal) => Promise<PublicServiceStatusPayload>;
  /** Optional clock for deterministic rendering in tests. */
  now?: () => number;
}

type FetchStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; observation: PublicServiceStatusObservation }
  | { kind: 'error'; message: string };

type FetchAction =
  | { type: 'loading' }
  | { type: 'ready'; observation: PublicServiceStatusObservation }
  | { type: 'error'; message: string };

function fetchReducer(state: FetchStatus, action: FetchAction): FetchStatus {
  switch (action.type) {
    case 'loading':
      return { kind: 'loading' };
    case 'ready':
      return { kind: 'ready', observation: action.observation };
    case 'error':
      return { kind: 'error', message: action.message };
    default:
      return state;
  }
}

const TONE_STYLES: Record<
  ServiceStatusTone,
  { label: string; dotClass: string; badgeClass: string }
> = {
  operational: {
    label: 'Operational',
    dotClass: 'bg-emerald-500',
    badgeClass:
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200',
  },
  degraded: {
    label: 'Degraded',
    dotClass: 'bg-amber-500',
    badgeClass:
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200',
  },
  delayed: {
    label: 'Delayed',
    dotClass: 'bg-orange-500',
    badgeClass:
      'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/40 dark:bg-orange-950/40 dark:text-orange-200',
  },
  stale: {
    label: 'Stale',
    dotClass: 'bg-slate-400',
    badgeClass:
      'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200',
  },
  unavailable: {
    label: 'Unavailable',
    dotClass: 'bg-red-500',
    badgeClass:
      'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200',
  },
  unknown: {
    label: 'Unknown',
    dotClass: 'bg-gray-400',
    badgeClass:
      'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-200',
  },
};

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'No observation recorded';
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return 'No observation recorded';
  }
  return new Date(parsed).toISOString();
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'Unknown';
  }
  return value.toLocaleString('en-US');
}

function ToneBadge({ tone }: { tone: ServiceStatusTone }) {
  const style = TONE_STYLES[tone];
  return (
    <span
      className={` inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.badgeClass}`}
      data-testid={`status-tone-${tone}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-2 w-2 rounded-full ${style.dotClass}`}
      />
      {style.label}
    </span>
  );
}

function ComponentCard({ component }: { component: ServiceComponentObservation }) {
  const isThirdParty = component.dependencyKind === 'third-party';
  const lastObserved = formatTimestamp(component.lastObservedAt);

  return (
    <li
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      data-testid={`status-component-${component.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {component.name}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {component.description}
          </span>
        </div>
        <ToneBadge tone={component.tone} />
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300">
        {component.message}
      </p>

      <dl className="grid grid-cols-1 gap-2 text-xs text-gray-500 dark:text-gray-400 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-gray-600 dark:text-gray-300">
            Last observation
          </dt>
          <dd data-testid={`status-component-${component.id}-last-observed`}>
            {lastObserved}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-600 dark:text-gray-300">
            Freshness
          </dt>
          <dd data-testid={`status-component-${component.id}-freshness`}>
            {component.freshnessLevel}
          </dd>
        </div>
        {component.lagDescription && (
          <div className="sm:col-span-2">
            <dt className="font-medium text-gray-600 dark:text-gray-300">
              Lag
            </dt>
            <dd data-testid={`status-component-${component.id}-lag`}>
              {component.lagDescription}
            </dd>
          </div>
        )}
      </dl>

      {isThirdParty && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Third-party dependency — not a guarantee.
        </p>
      )}
    </li>
  );
}

export function ServiceStatusOverview({
  observation,
  fetcher,
  now,
}: ServiceStatusOverviewProps) {
  const [state, dispatch] = useReducer((fetchReducer as unknown) as (s: FetchStatus, a: FetchAction) => FetchStatus, {
    kind: observation ? 'ready' : 'idle',
    ...(observation ? { observation } : {}),
  } as FetchStatus);
  const [reloadKey, setReloadKey] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  const loadObservation = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    dispatch({ type: 'loading' });

    const activeFetcher = fetcher ?? fetchPublicServiceStatus;
    activeFetcher(controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }
        const adapted = adaptPublicServiceStatus(payload, now ? now() : Date.now());
        dispatch({ type: 'ready', observation: adapted });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Unable to load public service status.';
        dispatch({ type: 'error', message });
      });

    return () => {
      controller.abort();
    };
  }, [fetcher, now]);

  useEffect(() => {
    if (observation) {
      return;
    }
    const cleanup = loadObservation();
    return cleanup;
  }, [observation, loadObservation, reloadKey]);

  const effectiveObservation =
    observation ?? ((state.kind === 'ready' ? state.observation : null) as PublicServiceStatusObservation | null);

  const handleRetry = () => {
    setReloadKey((key) => key + 1);
  };

  if (state.kind === 'loading' && !effectiveObservation) {
    return (
      <section
        aria-label="Service status overview"
        data-testid="service-status-loading"
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Loading public service status...
        </p>
      </section>
    );
  }

  if (state.kind === 'error' && !effectiveObservation) {
    return (
      <section
        aria-label="Service status overview"
        data-testid="service-status-error"
        className="flex flex-col gap-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/40"
      >
        <p className="text-sm text-red-800 dark:text-red-200">
          {state.message}
        </p>
        <button
          type="button"
          onClick={handleRetry}
          className="self-start rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 focus:outline-none focus-ring-2 focus:ring-red-500 focus:ring-offset-2 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
        >
          Retry
        </button>
      </section>
    );
  }

  if (!effectiveObservation) {
    return (
      <section
        aria-label="Service status overview"
        data-testid="service-status-empty"
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          No public service status observation is available.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Service status overview"
      data-testid="service-status-overview"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Service status
          </h1>
          <ToneBadge tone={effectiveObservation.overallTone} />
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {effectiveObservation.overallMessage}
        </p>
        {effectiveObservation.isPartial && (
          <p
            className="text-xs text-amber-700 dark:text-amber-300"
            data-testid="service-status-partial"
          >
            Some observations are missing. This overview is partial.
          </p>
        )}
        <dl className="grid grid-cols1-1 gap-3 text-xs text-gray-600 dark:text-gray-300 sm:grid-cols-3">
          <div>
            <dt className="font-medium text-gray-500 dark:text-gray-400">
              Last observation
            </dt>
            <dd data-testid="service-status-last-observed">
              {formatTimestamp(effectiveObservation.lastObservedAt)}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500 dark:text-gray-400">
              Finalized block
            </dt>
            <dd data-testid="service-status-finalized-block">
              {formatNumber(effectiveObservation.finalizedBlock)}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500 dark:text-gray-400">
              Lag
            </dt>
            <dd data-testid="service-status-lag">
              {effectiveObservation.lagBlocks === null
                ? 'Unknown'
                : `${formatNumber(effectiveObservation.lagBlocks)} blocks`}
            </dd>
          </div>
        </dl>
      </div>

      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {effectiveObservation.components.map((component) => (
          <ComponentCard key={component.id} component={component} />
        ))}
      </ul>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Third-party components are dependencies, not guarantees.
      </p>
    </section>
  );
}
