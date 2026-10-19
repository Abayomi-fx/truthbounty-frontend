'use client';

/**
 * SourceBadge (UI-FE-010)
 *
 * Atomic badge that communicates data provenance — `contract`, `projected`,
 * or `stale projection` — using text, a distinct icon glyph, and a colour
 * tone together so that colour is *never* the sole distinguishing signal
 * (WCAG 1.4.1).
 *
 * Accessibility contract:
 * - `aria-label` encodes both the source type and the timestamp so the
 *   full meaning is available to assistive technology without relying on
 *   the visible text or colour alone.
 * - Icon glyphs are rendered with `aria-hidden="true"` because the
 *   `aria-label` on the outer element already provides the description.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

/** The three data-provenance values the badge communicates. */
export type BadgeSource = 'contract' | 'projected' | 'stale projection';

export interface SourceBadgeProps {
  /**
   * Provenance of the adjacent data field.
   * - `contract`          — value read directly from an on-chain contract
   * - `projected`         — value from the API indexer projection
   * - `stale projection`  — projection whose freshness window has lapsed
   */
  source: BadgeSource;
  /**
   * ISO 8601 timestamp or block number string indicating when the data
   * was last read.  Included verbatim in the accessible `aria-label`.
   */
  asOf: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Icon components — SVGs with aria-hidden, no external dependencies
// ---------------------------------------------------------------------------

/** Chain-link icon: two overlapping oval links. */
function ChainIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.354 5.5H4a3 3 0 0 0 0 6h3a3 3 0 0 0 2.83-4H9v.02c-.065.52-.24 1-.568 1.382A2 2 0 0 1 7 9.5H4a2 2 0 1 1 0-4h1.535c.218-.376.495-.714.82-1z" />
      <path d="M9 5.5a3 3 0 0 0-2.83 4h.002c.064-.52.24-1 .568-1.382A2 2 0 0 1 8 7.5h3a2 2 0 1 1 0 4h-1.535a4 4 0 0 1-.82 1H11a3 3 0 1 0 0-6H9z" />
    </svg>
  );
}

/** Broadcast / signal icon: radiating arcs. */
function BroadcastIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.05 3.05a7 7 0 0 0 0 9.9.5.5 0 0 1-.707.707 8 8 0 0 1 0-11.314.5.5 0 0 1 .707.707zm2.122 2.122a4 4 0 0 0 0 5.656.5.5 0 1 1-.708.708 5 5 0 0 1 0-7.072.5.5 0 0 1 .708.708zm5.656-.708a.5.5 0 0 1 .708 0 5 5 0 0 1 0 7.072.5.5 0 1 1-.708-.708 4 4 0 0 0 0-5.656.5.5 0 0 1 0-.708zm2.122-2.12a.5.5 0 0 1 .707 0 8 8 0 0 1 0 11.313.5.5 0 0 1-.707-.707 7 7 0 0 0 0-9.899.5.5 0 0 1 0-.707zM8 8.5a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0z" />
    </svg>
  );
}

/** Warning-triangle icon: exclamation mark inside a triangle outline. */
function WarningTriangleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.15.15 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.2.2 0 0 1-.054.06.1.1 0 0 1-.066.017H1.146a.1.1 0 0 1-.066-.017.2.2 0 0 1-.054-.06.18.18 0 0 1 .002-.183L7.884 2.073a.15.15 0 0 1 .054-.057zm1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566z" />
      <path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Badge configuration map — single source of truth for text + tone + icon
// ---------------------------------------------------------------------------

/**
 * `BADGE_CONFIG` maps each `BadgeSource` value to:
 * - `text`  — the visible label text
 * - `tone`  — Tailwind colour classes (background tint + foreground)
 * - `Icon`  — the icon component rendered with `aria-hidden`
 *
 * Colour is always paired with both a text label and an icon glyph so that
 * it is never the sole distinguishing signal (WCAG SC 1.4.1).
 */
export const BADGE_CONFIG = {
  contract: {
    text: 'contract',
    tone: 'bg-muted/60 text-ink-secondary border-divider',
    Icon: ChainIcon,
  },
  projected: {
    text: 'projected',
    tone: 'bg-info/10 text-info border-info/30',
    Icon: BroadcastIcon,
  },
  'stale projection': {
    text: 'stale projection',
    /**
     * Uses `text-warning` — the canonical stale/outdated colour role in this
     * project's design-token contract (src/lib/design-tokens.ts).  The spec
     * draft references `text-semantic-stale` but that token is not defined;
     * `warning` is the correct semantic equivalent.
     */
    tone: 'bg-warning/10 text-warning border-warning/30',
    Icon: WarningTriangleIcon,
  },
} as const satisfies Record<BadgeSource, { text: string; tone: string; Icon: () => React.ReactElement }>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `SourceBadge` — provenance label for a single data field.
 *
 * @example
 * <SourceBadge source="contract" asOf="block 12345678" />
 * <SourceBadge source="projected" asOf="2024-05-01T12:00:00Z" />
 * <SourceBadge source="stale projection" asOf="2024-05-01T08:00:00Z" />
 */
export function SourceBadge({ source, asOf, className }: SourceBadgeProps) {
  const { text, tone, Icon } = BADGE_CONFIG[source];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
        'tb-label font-medium',
        tone,
        className,
      )}
      aria-label={`${source} — as of ${asOf}`}
    >
      <Icon />
      {text}
    </span>
  );
}

export default SourceBadge;
