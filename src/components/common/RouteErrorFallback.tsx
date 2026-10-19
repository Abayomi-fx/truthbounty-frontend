'use client';

import { useEffect, useRef } from 'react';

import { toSafeErrorMessage } from '@/lib/sanitize-error';
import {
  SystemState,
  type SystemStateAction,
} from '@/components/common/SystemState';

/**
 * Canonical route error categories. Route boundaries must distinguish
 * authorization, configuration, dependency, and missing-resource failures
 * so operators and users get an accurate recovery path.
 */
export type RouteErrorKind =
  | 'authorization'
  | 'configuration'
  | 'dependency'
  | 'missing-resource'
  | 'unknown';

export interface RouteErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Route scope label, e.g. "dashboard" or "claim detail". */
  scope: string;
  /** Show pending-transaction preservation notice (default true). */
  preserveNotice?: boolean;
  /**
   * Explicit failure category. When omitted, the category is inferred from
   * the error's `name`/`digest`/`message` so route boundaries stay accurate
   * without leaking internals.
   */
  kind?: RouteErrorKind;
}

const KIND_COPY: Record<RouteErrorKind, { title: string; hint: string }> = {
  authorization: {
    title: 'You don\u2019t have access to this section',
    hint: 'Connect the wallet that holds the required role, then try again.',
  },
  configuration: {
    title: 'This section is misconfigured',
    hint: 'A required setting is missing or invalid. Retrying will not help until it is fixed.',
  },
  dependency: {
    title: 'A required service is unavailable',
    hint: 'A dependency did not respond. Retrying is safe and will not submit a duplicate transaction.',
  },
  'missing-resource': {
    title: 'This resource could not be found',
    hint: 'It may have been retired or moved. Use the link below to return to a known route.',
  },
  unknown: {
    title: 'This section couldn\u2019t load',
    hint: 'Retrying is safe and will not submit a duplicate transaction.',
  },
};

function inferKind(error: Error & { digest?: string }): RouteErrorKind {
  const name = error.name ?? '';
  const digest = error.digest ?? '';
  const message = error.message ?? '';
  const haystack = `${name} ${digest} ${message}`.toLowerCase();

  if (/(unauthor|forbidden|401|403|not\s*authorized|permission)/.test(haystack)) {
    return 'authorization';
  }
  if (/(config|env|missing\s*key|invalid\s*key|misconfig)/.test(haystack)) {
    return 'configuration';
  }
  if (/(network|fetch|timeout|rpc|dependency|upstream|503|502|504)/.test(haystack)) {
    return 'dependency';
  }
  if (/(not\s*found|404|missing|retired|gone|410)/.test(haystack)) {
    return 'missing-resource';
  }
  return 'unknown';
}

/**
 * Shared fallback for Next.js `error.ts` route boundaries.
 * Uses canonical `reset()` for safe retry and never renders stacks.
 */
export function RouteErrorFallback({
  error,
  reset,
  scope,
  preserveNotice = true,
  kind,
}: RouteErrorFallbackProps) {
  const message = toSafeErrorMessage(error);
  const resolvedKind = kind ?? inferKind(error);
  const copy = KIND_COPY[resolvedKind];
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const actions: SystemStateAction[] = [
    {
      label: 'Try again',
      onClick: reset,
      variant: 'primary',
      autoFocus: true,
    },
    {
      label: 'Go back',
      onClick: () => window.history.back(),
      variant: 'secondary',
    },
  ];

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-label={`${scope} error`}
      className="flex min-h-[50vh] items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-bold tracking-tight text-gray-900 outline-none dark:text-white"
        >
          {copy.title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{message}</p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{copy.hint}</p>
        {preserveNotice ? (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Your pending transactions are preserved. Retrying is safe and will not
            submit a duplicate transaction.
          </p>
        ) : null}
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
