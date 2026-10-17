/**
 * Reduced-Data & Constrained-Network Configuration (UI-FE-082)
 *
 * Canonical, typed configuration for the global reduced-data layer. This module
 * contains only pure data: no React, no browser access, no side effects, so it
 * can be imported from client and server code and unit tested in isolation.
 *
 * Security invariants (must never be relaxed by this layer):
 *  - Cryptographic verification, receipt validation, contract integrity checks,
 *    authorization/session checks, and allowlist/chain guards are CRITICAL and
 *    are never throttled, deferred, truncated, or skipped to save bandwidth.
 *  - Unknown / malformed stored values fail closed to `auto`, never to a mode
 *    that would silently disable user-requested data saving.
 */

/** User-controllable data-saving preference. */
export type ReducedDataMode = 'auto' | 'on' | 'off';

export const REDUCED_DATA_MODES: readonly ReducedDataMode[] = ['auto', 'on', 'off'] as const;

/** localStorage key holding the persisted user preference. */
export const REDUCED_DATA_STORAGE_KEY = 'truthbounty.reduced-data-mode';

/**
 * Effective connection types the browser may report via the Network
 * Information API. `slow-2g`, `2g` and `3g` are treated as constrained.
 * `4g` (and the newer `5g`) are treated as unconstrained.
 */
export const CONSTRAINED_EFFECTIVE_TYPES: readonly string[] = ['slow-2g', '2g', '3g'] as const;

/**
 * Query classes that carry protocol/security meaning. Polling for these is
 * NEVER stretched by the reduced-data layer.
 */
export type PollingCriticality = 'critical' | 'non-critical';

/**
 * Stretch applied to non-critical polling intervals while reduced-data mode is
 * active, plus the safety floor/ceiling used to keep intervals sane.
 */
export interface ReducedDataPolicy {
  /** Multiplier applied to a non-critical base poll interval. */
  readonly pollMultiplier: number;
  /** Non-critical intervals are never stretched beyond this ceiling. */
  readonly maxPollIntervalMs: number;
  /** Intervals at or below this floor are left untouched (already cheap). */
  readonly minPollIntervalMs: number;
}

export const REDUCED_DATA_POLICY: ReducedDataPolicy = {
  pollMultiplier: 4,
  maxPollIntervalMs: 15 * 60 * 1000,
  minPollIntervalMs: 5 * 1000,
} as const;

/**
 * Human explanation of each mode, reused by the toggle's accessible label.
 */
export const REDUCED_DATA_MODE_LABELS: Record<ReducedDataMode, string> = {
  auto: 'Automatic (follow browser and connection)',
  on: 'Always on',
  off: 'Always off',
} as const;
