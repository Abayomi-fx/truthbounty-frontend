/**
 * Phase Config — shared source of truth (UI-FE-010)
 *
 * Exported helpers that both `ClaimLifecycleTimeline` and `ClaimHeader` import
 * so the phase icon, colour class, and display label are derived from a single
 * location and can never drift out of sync between the two components.
 */

import type { TimelinePhase } from '@/app/types/lifecycle';

/**
 * Visual configuration for a single `TimelinePhase` value.
 */
export interface PhaseConfig {
  /** Unicode glyph rendered with `aria-hidden="true"` beside the phase label. */
  icon: string;
  /**
   * Tailwind class string applied to the phase badge element.
   * Always pairs a background tint with a foreground colour token so that
   * colour is never the sole distinguishing signal (WCAG 1.4.1).
   */
  className: string;
}

/**
 * Complete map of every `TimelinePhase` to its visual configuration.
 * Values are intentionally `const` — consumers should read them, not mutate them.
 */
const PHASE_CONFIGS = {
  CREATED: { icon: '✨', className: 'bg-info/10 text-info' },
  INDEXING: { icon: '⏳', className: 'bg-info/10 text-info' },
  VERIFICATION_OPEN: { icon: '🔓', className: 'bg-success/10 text-success' },
  VERIFICATION_CLOSED: { icon: '🔒', className: 'bg-muted text-muted-foreground' },
  DISPUTED: { icon: '⚠️', className: 'bg-warning/10 text-warning' },
  APPEAL_OPEN: { icon: '⚖️', className: 'bg-warning/10 text-warning' },
  PENDING_SETTLEMENT: { icon: '⏱️', className: 'bg-info/10 text-info' },
  SETTLED: { icon: '✅', className: 'bg-success/10 text-success' },
  PENDING_APPEAL_SETTLEMENT: { icon: '⏱️', className: 'bg-info/10 text-info' },
  APPEAL_SETTLED: { icon: '⚖️', className: 'bg-success/10 text-success' },
  PENDING_FINALIZATION: { icon: '⏱️', className: 'bg-info/10 text-info' },
  FINALIZED: { icon: '🎯', className: 'bg-success/20 text-success' },
  /**
   * STALE and ERROR use `text-warning` / `text-destructive` rather than a
   * hypothetical `text-semantic-stale` because the project's design-token
   * contract (src/lib/design-tokens.ts) does not define a `stale` colour role.
   * `warning` is the canonical stale signal throughout the codebase.
   */
  STALE: { icon: '⚠️', className: 'bg-warning/10 text-warning' },
  ERROR: { icon: '❌', className: 'bg-destructive/10 text-destructive' },
} as const satisfies Record<TimelinePhase, PhaseConfig>;

/**
 * Returns the visual configuration for the given `phase`.
 *
 * @example
 * const { icon, className } = getPhaseConfig('FINALIZED');
 * // icon      → '🎯'
 * // className → 'bg-success/20 text-success'
 */
export function getPhaseConfig(phase: TimelinePhase): PhaseConfig {
  return PHASE_CONFIGS[phase] ?? { icon: '•', className: 'bg-muted text-muted-foreground' };
}

/**
 * Converts a `TimelinePhase` enum value to a human-readable display string.
 *
 * @example
 * formatPhase('VERIFICATION_OPEN') // → 'Verification Open'
 * formatPhase('APPEAL_SETTLED')    // → 'Appeal Settled'
 */
export function formatPhase(phase: TimelinePhase): string {
  return phase
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}
