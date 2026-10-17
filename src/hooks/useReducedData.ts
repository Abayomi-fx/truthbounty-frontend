'use client';

/**
 * useReducedData — consumer hook for the global reduced-data layer (UI-FE-082).
 *
 * Returns the provider value when mounted under `ReducedDataProvider`, and a
 * conservative "standard" fallback otherwise (so components remain usable in
 * isolation, tests, and storybook without silently enabling data saving).
 */

import { useContext, useMemo } from 'react';
import {
  ReducedDataContext,
  type ReducedDataContextValue,
} from '@/components/providers/ReducedDataProvider';
import type { AdaptivePollIntervalOptions } from '@/lib/reduced-data';
import type { PollingCriticality } from '@/config/reduced-data';

const NOOP = () => {};

const STANDARD_FALLBACK: ReducedDataContextValue = {
  mode: 'auto',
  source: 'standard',
  isReducedData: false,
  isConstrainedNetwork: false,
  browserSaveData: false,
  effectiveType: null,
  isOnline: true,
  osPrefersReducedMotion: false,
  reduceMotion: false,
  shouldDeferRichMedia: false,
  setMode: NOOP,
  toggle: NOOP,
  getPollInterval: (baseIntervalMs: number | false) => baseIntervalMs,
};

/** Access the global reduced-data state and helpers. */
export function useReducedData(): ReducedDataContextValue {
  return useContext(ReducedDataContext) ?? STANDARD_FALLBACK;
}

export interface UseAdaptivePollingOptions {
  /** Base interval the query would use under a normal connection. */
  baseIntervalMs: number | false;
  /**
   * Mark protocol/security-critical polling. Critical intervals are returned
   * unchanged and are NEVER deferred (authorization, verification, receipts,
   * finality, contract integrity).
   */
  critical?: boolean;
  /** When reduced, non-critical polling falls back to manual refresh only. */
  manualOnlyWhenReduced?: boolean;
  /** Disable polling entirely (e.g. query disabled). */
  enabled?: boolean;
}

export interface UseAdaptivePollingResult {
  /** Interval to pass to TanStack Query (`false` disables polling). */
  readonly pollInterval: number | false;
  /** True when polling was stretched or disabled by reduced-data mode. */
  readonly isDeferred: boolean;
  /** Classification the interval was resolved under. */
  readonly criticality: PollingCriticality;
}

/**
 * Resolve an adaptive polling interval for a query given the current
 * reduced-data state. Critical reads pass through untouched.
 */
export function useAdaptivePolling({
  baseIntervalMs,
  critical = false,
  manualOnlyWhenReduced = false,
  enabled = true,
}: UseAdaptivePollingOptions): UseAdaptivePollingResult {
  const { getPollInterval } = useReducedData();

  return useMemo(() => {
    if (!enabled) {
      return { pollInterval: false, isDeferred: false, criticality: critical ? 'critical' : 'non-critical' };
    }

    const options: Omit<AdaptivePollIntervalOptions, 'isReducedData'> = {
      critical,
      manualOnlyWhenReduced,
    };
    const pollInterval = getPollInterval(baseIntervalMs, options);

    return {
      pollInterval,
      // Deferred when the caller asked for a poll but the resolved interval
      // differs (stretched/disabled) because of reduced-data mode.
      isDeferred: baseIntervalMs !== false && !critical && pollInterval !== baseIntervalMs,
      criticality: critical ? 'critical' : 'non-critical',
    };
  }, [baseIntervalMs, critical, manualOnlyWhenReduced, enabled, getPollInterval]);
}

export type { ReducedDataContextValue };
