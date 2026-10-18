'use client';

/**
 * EvidenceRegion — ordered evidence list with unified security semantics (UI-FE-010 Task 5)
 *
 * Security invariants:
 * - Every URI passes through evidence-sanitizer before rendering.
 * - All external links wrapped in SafeExternalLink.
 * - dangerouslySetInnerHTML is strictly prohibited in this component.
 * - Partial resolution: only safe items rendered; blocked items silently dropped.
 * - Empty state shown only when ALL items are unresolvable.
 */

import * as React from 'react';
import { useClaimDetail } from '@/app/queries/claims.queries';
import { SafeExternalLink } from '@/components/security/SafeExternalLink';
import {
  sanitizeEvidenceItem,
  type RawEvidenceItem,
} from '@/lib/security/evidence-sanitizer';
import { FreshnessLabel } from './FreshnessLabel';
import { cn } from '@/lib/utils';
import type { Evidence } from '@/app/types/claim';

export interface EvidenceRegionProps {
  claimId: string;
  dataUpdatedAt: number;
  isStale: boolean;
}

export function EvidenceRegion({ claimId, dataUpdatedAt, isStale }: EvidenceRegionProps) {
  const { data: claim, isLoading } = useClaimDetail(claimId);

  // Live-region ref for WebSocket evidence announcements (Req 5.8)
  const liveRegionRef = React.useRef<HTMLDivElement | null>(null);

  // Announce new evidence without stealing focus
  const announceNewEvidence = React.useCallback((title: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = '';
      setTimeout(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = `New evidence added: ${title}`;
        }
      }, 50);
    }
  }, []);

  // Sanitize and filter evidence items (Reqs 5.2, 5.4)
  const safeItems = React.useMemo(() => {
    if (!claim?.evidence) return [];
    // Sort newest first (Req 5.1)
    const sorted = [...claim.evidence].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sorted
      .map((ev, idx) => ({
        original: ev,
        index: idx,
        sanitized: sanitizeEvidenceItem({ type: ev.type, value: ev.value } as RawEvidenceItem),
      }))
      .filter((item) => item.sanitized.kind !== 'blocked');
  }, [claim?.evidence]);

  if (isLoading) {
    return (
      <section
        aria-labelledby="evidence-heading"
        className="rounded-xl border border-border bg-surface p-5 sm:p-6"
        data-testid="evidence-region"
      >
        <h2 id="evidence-heading" className="tb-section text-ink mb-4 font-semibold">
          Evidence
        </h2>
        <div aria-busy="true" aria-label="Loading evidence" className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded bg-muted/40"
              aria-hidden="true"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="evidence-heading"
      className="rounded-xl border border-border bg-surface p-5 sm:p-6"
      data-testid="evidence-region"
    >
      {/* Polite live region for real-time evidence announcements (Req 5.8) */}
      <div
        ref={liveRegionRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="evidence-live-region"
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="evidence-heading" className="tb-section text-ink font-semibold">
          Evidence
        </h2>
        <FreshnessLabel dataUpdatedAt={dataUpdatedAt} isStale={isStale} />
      </div>

      {/* Empty state — Req 5.4: only when ALL items are unresolvable */}
      {safeItems.length === 0 ? (
        <p
          className="tb-body text-ink-muted"
          data-testid="evidence-empty-state"
        >
          No verifiable evidence is available for this claim.
        </p>
      ) : (
        <ol
          className="space-y-4"
          aria-label={`Evidence (${safeItems.length} item${safeItems.length === 1 ? '' : 's'})`}
        >
          {safeItems.map(({ original, index, sanitized }) => (
            <li
              key={original.id}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface p-3"
            >
              {/* Type icon */}
              <span
                className="mt-0.5 shrink-0 text-base"
                aria-hidden="true"
              >
                {original.type === 'image' ? '🖼' :
                 original.type === 'video' ? '🎬' :
                 original.type === 'document' ? '📄' :
                 original.type === 'text' ? '📝' : '🔗'}
              </span>

              <div className="min-w-0 flex-1">
                {sanitized.kind === 'link' && (
                  <SafeExternalLink
                    href={sanitized.href}
                    aria-label={`Evidence item ${index + 1}: ${sanitized.text} (opens in new tab)`}
                    className={cn(
                      'break-all text-sm text-info underline',
                      'hover:no-underline focus-visible:outline-none',
                      'focus-visible:ring-2 focus-visible:ring-ring rounded',
                    )}
                  >
                    {sanitized.text}
                    {/* Visible annotation — Req 5.3 */}
                    <span className="sr-only">(opens in new tab)</span>
                  </SafeExternalLink>
                )}

                {sanitized.kind === 'image' && (
                  /* Image rendered through SafeExternalLink (no dangerouslySetInnerHTML) — Req 5.6 */
                  <SafeExternalLink
                    href={sanitized.src}
                    aria-label={`Evidence image ${index + 1}: ${sanitized.text} (opens in new tab)`}
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sanitized.src}
                      alt={sanitized.text || `Evidence item ${index + 1}`}
                      className="max-h-48 rounded object-contain"
                      loading="lazy"
                    />
                    <span className="sr-only">(opens in new tab)</span>
                  </SafeExternalLink>
                )}

                {sanitized.kind === 'text' && (
                  <p className="break-words text-sm text-ink">
                    {sanitized.text}
                  </p>
                )}

                <time
                  dateTime={original.createdAt}
                  className="mt-1 block text-xs text-ink-muted"
                >
                  Added {new Date(original.createdAt).toLocaleDateString()}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default EvidenceRegion;
