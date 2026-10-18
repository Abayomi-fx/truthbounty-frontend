/**
 * Reduced-Data & Constrained-Network — pure resolution logic (UI-FE-082)
 *
 * This module is deliberately free of React and of any direct browser access
 * (aside from an injectable `Storage`-like object). It turns raw inputs
 * (browser hints, user preference, criticality) into deterministic decisions so
 * the same behaviour can be exercised under simulated constrained networks.
 *
 * Integrity rule: callers MUST pass `critical: true` for authorization,
 * cryptographic verification, receipt validation, finality, or contract
 * integrity reads. Those intervals are returned unchanged — this module cannot
 * defer them.
 */

import {
  CONSTRAINED_EFFECTIVE_TYPES,
  REDUCED_DATA_MODES,
  REDUCED_DATA_POLICY,
  REDUCED_DATA_STORAGE_KEY,
  type PollingCriticality,
  type ReducedDataMode,
  type ReducedDataPolicy,
} from '@/config/reduced-data';

/** Why the reduced-data layer is (or is not) active. */
export type ReducedDataSource =
  | 'forced-on'
  | 'forced-off'
  | 'browser-save-data'
  | 'slow-connection'
  | 'standard';

export interface ReducedDataInputs {
  /** User preference. */
  mode: ReducedDataMode;
  /** `navigator.connection.saveData`, if available. */
  saveData?: boolean | null;
  /** `navigator.connection.effectiveType`, if available. */
  effectiveType?: string | null;
}

/** A `Storage`-like surface; keeps this module testable and SSR-safe. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export function isReducedDataMode(value: unknown): value is ReducedDataMode {
  return typeof value === 'string' && (REDUCED_DATA_MODES as readonly string[]).includes(value);
}

/** True when an `effectiveType` reports a constrained connection. */
export function isConstrainedEffectiveType(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    (CONSTRAINED_EFFECTIVE_TYPES as readonly string[]).includes(value.toLowerCase())
  );
}

/**
 * Resolve the effective source. `forced-on`/`forced-off` honour an explicit
 * user choice; `auto` follows the browser/connection hints.
 */
export function resolveReducedDataSource({
  mode,
  saveData,
  effectiveType,
}: ReducedDataInputs): ReducedDataSource {
  if (mode === 'on') return 'forced-on';
  if (mode === 'off') return 'forced-off';
  if (saveData) return 'browser-save-data';
  if (isConstrainedEffectiveType(effectiveType)) return 'slow-connection';
  return 'standard';
}

/** True when the resolved source means the reduced-data policy is active. */
export function isReducedDataActive(source: ReducedDataSource): boolean {
  return source === 'forced-on' || source === 'browser-save-data' || source === 'slow-connection';
}

/**
 * True when the physical connection is constrained (browser save-data or a
 * slow effective type), regardless of the user's override. Used purely for
 * informational messaging — never to bypass a user's "always off" choice.
 */
export function isConstrainedNetwork(saveData?: boolean | null, effectiveType?: string | null): boolean {
  return Boolean(saveData) || isConstrainedEffectiveType(effectiveType);
}

/** Rich media (heavy previews/images) is deferred only while reduced-data is active. */
export function shouldDeferRichMedia(reducedDataActive: boolean): boolean {
  return reducedDataActive;
}

/** Reduced motion is requested by the OS or while data saving to cut decode work. */
export function resolveReduceMotion(input: {
  osPrefersReducedMotion: boolean;
  reducedDataActive: boolean;
}): boolean {
  return input.osPrefersReducedMotion || input.reducedDataActive;
}

export interface AdaptivePollIntervalOptions {
  /** Protocol/security-critical reads are never stretched. */
  critical?: boolean;
  /** Whether the reduced-data policy is active. */
  isReducedData?: boolean;
  /** When reduced, non-critical polling falls back to manual refresh only. */
  manualOnlyWhenReduced?: boolean;
  /** Override the canonical policy (tests / future tuning). */
  policy?: ReducedDataPolicy;
}

/**
 * Resolve the effective polling interval.
 *
 * - `baseIntervalMs === false` → `false` (polling disabled by the caller).
 * - critical reads → the caller's interval, unchanged (integrity invariant).
 * - non-critical + reduced + `manualOnlyWhenReduced` → `false`.
 * - non-critical + reduced → `base * multiplier`, clamped to the policy range.
 * - otherwise → the caller's interval.
 */
export function resolveAdaptivePollIntervalMs(
  baseIntervalMs: number | false,
  {
    critical = false,
    isReducedData = false,
    manualOnlyWhenReduced = false,
    policy = REDUCED_DATA_POLICY,
  }: AdaptivePollIntervalOptions = {},
): number | false {
  if (baseIntervalMs === false) return false;
  if (critical) return baseIntervalMs;
  if (!isReducedData) return baseIntervalMs;
  if (manualOnlyWhenReduced) return false;
  if (baseIntervalMs <= policy.minPollIntervalMs) return baseIntervalMs;

  const stretched = Math.round(baseIntervalMs * policy.pollMultiplier);
  return Math.min(stretched, policy.maxPollIntervalMs);
}

/** Parse a persisted value, failing closed to `auto`. */
export function parseStoredReducedDataMode(raw: unknown): ReducedDataMode {
  return isReducedDataMode(raw) ? raw : 'auto';
}

/** Read the persisted preference; any failure yields `auto`. */
export function readStoredReducedDataMode(storage?: StorageLike | null): ReducedDataMode {
  if (!storage) return 'auto';
  try {
    return parseStoredReducedDataMode(storage.getItem(REDUCED_DATA_STORAGE_KEY));
  } catch {
    return 'auto';
  }
}

/** Persist the preference; `auto` clears the key; failures are swallowed. */
export function writeStoredReducedDataMode(
  mode: ReducedDataMode,
  storage?: StorageLike | null,
): void {
  if (!storage) return;
  try {
    if (mode === 'auto') {
      storage.removeItem?.(REDUCED_DATA_STORAGE_KEY);
      return;
    }
    storage.setItem(REDUCED_DATA_STORAGE_KEY, mode);
  } catch {
    // Storage may be unavailable (private mode, quota). Preference stays
    // in-memory for the session; never throw from a UI toggle.
  }
}

/**
 * Format a "last synced" timestamp for freshness indicators. Returns a
 * stable, human-readable string; never fabricates a time when none exists.
 */
export function formatLastSynced(
  lastSyncedAt: number | string | Date | null | undefined,
  now: number = Date.now(),
): string {
  if (lastSyncedAt === null || lastSyncedAt === undefined) return 'never';

  const timestamp =
    lastSyncedAt instanceof Date
      ? lastSyncedAt.getTime()
      : typeof lastSyncedAt === 'string'
        ? Date.parse(lastSyncedAt)
        : lastSyncedAt;

  if (!Number.isFinite(timestamp)) return 'unknown';

  const diffMs = now - timestamp;
  if (diffMs < 0) return 'just now';
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 5) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/** Normalise the free-form criticality input used by convenience helpers. */
export function isCriticalPolling(criticality: PollingCriticality): boolean {
  return criticality === 'critical';
}
