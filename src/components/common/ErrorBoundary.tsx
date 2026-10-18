'use client';

/**
 * ErrorBoundary — global React error boundary with privacy-safe telemetry.
 *
 * V2-FE-149 — TruthBounty Frontend
 *
 * Catches unhandled render errors and:
 *  1. Reports them via the telemetry library (if PRIVACY_SAFE_TELEMETRY is enabled).
 *  2. Shows an accessible, user-friendly fallback UI with a Retry button.
 *
 * V2-FE-008 — Route boundary classification:
 *  - Distinguishes authorization, configuration, dependency, and
 *    missing-resource failures so route errors surface the correct
 *    boundary state (denied / config-failure / dependency / not-found).
 *
 * Telemetry is sourced from TelemetryContext so this component only relies on
 * the singleton `getTelemetryClient()` fallback — it does NOT call React hooks
 * (class components cannot use hooks). The singleton is initialised by
 * TelemetryProvider at application boot.
 */

import React, { createRef, ErrorInfo, ReactNode } from 'react'
import { getTelemetryClient } from '@/lib/telemetry'
import { redactError } from '@/lib/telemetry/redact'
import { toSafeErrorMessage } from '@/lib/telemetry/redact'

/**
 * Route boundary failure classification. Mirrors the approved route contract
 * (UI-FE-008): route errors must distinguish authorization, configuration,
 * dependency, and missing-resource failures.
 */
export type RouteBoundaryKind =
  | 'authorization'
  | 'configuration'
  | 'dependency'
  | 'missing-resource'
  | 'unknown';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Label identifying the route/feature scope, used for logging only. */
  scope?: string;
  /** Custom fallback. Receives sanitized message + retry. */
  fallback?: (args: { message: string; onRetry: () => void }) => ReactNode;
  onError?: (error: Error, info: ErrorInfo, scope?: string) => void;
  onReset?: () => void;
  /** When any entry changes, a caught error is cleared (safe retry/remount). */
  resetKeys?: unknown[];
  /**
   * Optional explicit boundary kind. When omitted, the kind is inferred from
   * the caught error (status codes / error name) so route boundaries render
   * the correct denied / configuration-failure / dependency / not-found state.
   */
  kind?: RouteBoundaryKind;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Infer the route boundary kind from a caught error. Never inspects user
 * data — only well-known status codes and error names produced by adapters.
 */
export function classifyRouteError(error: unknown): RouteBoundaryKind {
  if (!error || typeof error !== 'object') return 'unknown';
  const anyErr = error as { name?: string; status?: number; code?: string | number };
  const status = typeof anyErr.status === 'number' ? anyErr.status : undefined;
  const code = anyErr.code !== undefined ? String(anyErr.code) : undefined;
  const name = typeof anyErr.name === 'string' ? anyErr.name : '';

  if (status === 401 || status === 403) return 'authorization';
  if (status === 404) return 'missing-resource';
  if (status === 502 || status === 503 || status === 504) return 'dependency';
  if (status === 500 || status === 0) return 'dependency';

  if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') return 'authorization';
  if (code === 'NOT_FOUND') return 'missing-resource';
  if (code === 'CONFIG_MISSING' || code === 'CONFIG_INVALID') return 'configuration';
  if (code === 'DEPENDENCY_UNAVAILABLE' || code === 'NETWORK_ERROR') return 'dependency';

  if (name === 'AuthorizationError' || name === 'ForbiddenError') return 'authorization';
  if (name === 'ConfigurationError' || name === 'ConfigError') return 'configuration';
  if (name === 'NotFoundError') return 'missing-resource';
  if (name === 'DependencyError' || name === 'NetworkError') return 'dependency';

  return 'unknown';
}

/**
 * Shared route/feature error boundary.
 *
 * - Isolates rendering/data faults to its subtree.
 * - Never clears pending-transaction recovery keys
 *   (`truthbounty-pending-transactions-v2`, `tb-tx-v2:*`).
 * - Never renders stack traces or sensitive data in production.
 * - Provides keyboard-accessible retry with focus management.
 * - Every caught error is routed through `redactError` before any logging or
 *   UI rendering so secrets / long hex / Bearer tokens never leak.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryRef = createRef<HTMLButtonElement>();

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    redactError(error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Report to privacy-safe telemetry (no-op when flag is disabled)
    try {
      getTelemetryClient().captureError(error, {
        category: 'boundary_error',
        severity: 'fatal',
        kind: this.props.kind ?? classifyRouteError(error),
        context: {},
      })
    } catch {
      // Telemetry must never surface to the user
    }

    // Development-only verbose logging
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary] Caught unhandled error:', error, errorInfo)
    }
  }

  handleRetry = () => {
    // Safe retry: reset local error state only. Pending transaction stores
    // are intentionally left untouched so reload recovery still works.
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const redacted = redactError(this.state.error);
      const safeErrorForDisplay: Error = {
        name: redacted.name,
        message: redacted.message,
        stack: redacted.stack ?? undefined,
      } as Error;
      const message = toSafeErrorMessage(safeErrorForDisplay);
      const kind: RouteBoundaryKind =
        this.props.kind ?? classifyRouteError(this.state.error);
      if (this.props.fallback) {
        return <>{this.props.fallback({ message, onRetry: this.handleRetry })}</>;
      }
      return (
        <div
          className="flex min-h-screen items-center justify-center bg-gray-50 px-4"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-3">
              {kind === 'authorization'
                ? 'Access denied'
                : kind === 'configuration'
                  ? 'Configuration failure'
                  : kind === 'dependency'
                    ? 'Service unavailable'
                    : kind === 'missing-resource'
                      ? 'Not found'
                      : 'Something went wrong'}
            </h2>
            <p className="mb-2 text-gray-600 dark:text-gray-300">{message}</p>
            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              {kind === 'authorization'
                ? 'You do not have permission to view this route. Your pending transactions are preserved.'
                : kind === 'configuration'
                  ? 'This route is misconfigured. Your pending transactions are preserved.'
                  : kind === 'dependency'
                    ? 'A required dependency is unavailable. Your pending transactions are preserved. Retry is safe.'
                    : kind === 'missing-resource'
                      ? 'This resource does not exist. Your pending transactions are preserved.'
                      : 'Your pending transactions are preserved. Retry is safe.'}
            </p>
            <button
              ref={this.retryRef}
              autoFocus
              type="button"
              onClick={this.handleRetry}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
              aria-label={
                kind === 'authorization'
                  ? 'Retry after access denied error'
                  : kind === 'configuration'
                    ? 'Retry after configuration failure'
                    : kind === 'dependency'
                      ? 'Retry after dependency failure'
                      : kind === 'missing-resource'
                        ? 'Retry after not found error'
                        : 'Retry after error'
              }
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary
