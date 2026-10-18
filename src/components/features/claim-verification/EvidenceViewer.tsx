'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useClaimDetailProjection } from '@/hooks/useClaimDetailProjection';
import {
  sanitizeEvidenceList,
  type SafeEvidenceItem,
} from '@/lib/security/evidence-sanitizer';
import { getSafeEvidenceHref } from '@/lib/validation/evidenceUri';
import { DeferredMedia } from '@/components/ui/DeferredMedia';

export interface EvidenceViewerProps {
  claimId: string;
  /**
   * Untrusted evidence items from the API. When provided, no canonical
   * projection is fetched; every item is sanitized before render.
   */
  evidence?: Array<{ type: string; value: string }>;
}

const DEFAULT_EVIDENCE: Array<{ type: string; value: string }> = [
  { type: 'link', value: 'https://example.com' },
  { type: 'text', value: 'Witness testimony text' },
  { type: 'image', value: 'https://example.com/evidence/img1.png' },
];

interface EvidenceShellProps {
  evidence: SafeEvidenceItem[];
  loading: boolean;
  error: boolean;
  stale: boolean;
  onRetry?: () => void;
}

function EvidenceShell({ evidence, loading, error, stale, onRetry }: EvidenceShellProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="card p-4 sm:p-6">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls="evidence-content"
        className="flex items-center justify-between w-full font-semibold mb-3 text-base sm:text-lg text-left focus-visible:outline-2 focus-visible:outline-[#5b5bf6] focus-visible:outline-offset-2 rounded"
      >
        <span>Evidence</span>
        <span aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div
          id="evidence-content"
          data-testid="evidence-scroll-container"
          className="space-y-3 sm:space-y-3 overflow-y-auto overscroll-contain"
          style={{ maxHeight: '60vh', overscrollBehavior: 'contain' }}
        >
          {loading && (
            <p className="text-sm text-gray-500" role="status" aria-busy="true">
              Loading canonical evidence...
            </p>
          )}
          {error && (
            <div className="space-y-2" role="alert">
              <p className="text-sm text-red-500">Evidence projection unavailable.</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-sm text-blue-600 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                >
                  Try again
                </button>
              )}
            </div>
          )}
          {stale && (
            <p className="text-sm text-amber-700" role="status">
              Evidence projection may be outdated. Review before relying on it.
            </p>
          )}
          {evidence.length === 0 && !loading && !error && (
            <p className="text-sm text-gray-500">No evidence available.</p>
          )}

          {evidence.map((e: SafeEvidenceItem, idx) => {
            if (e.kind === 'link') {
              // Resolve ipfs:// URIs to a public gateway so they are actually
              // navigable; https URIs pass through unchanged. Fail closed to
              // the original (already-validated) href if resolution fails.
              const href = getSafeEvidenceHref(e.href) ?? e.href;
              return (
                <a
                  key={idx}
                  href={href}
                  target="_blank"
                  rel={e.rel}
                  className="text-blue-600 underline text-sm sm:text-base break-all block py-1"
                  aria-label={`Evidence link: ${e.text} (opens in new tab)`}
                >
                  {e.text}
                </a>
              );
            }

            if (e.kind === 'image') {
              return (
                <DeferredMedia
                  key={idx}
                  src={e.src}
                  alt="Evidence image"
                  className="rounded-lg max-h-40 sm:max-h-60 w-full object-cover"
                  placeholderClassName="max-h-40 sm:max-h-60"
                />
              );
            }

            if (e.kind === 'blocked') {
              return (
                <div
                  key={idx}
                  className="flex items-start gap-2 text-sm text-gray-500 italic py-1"
                  role="note"
                  data-testid="evidence-blocked-item"
                >
                  <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{e.reason}</span>
                </div>
              );
            }

            return (
              <p key={idx} className="text-sm sm:text-base leading-relaxed">
                {e.text}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProjectedEvidenceViewer({ claimId }: { claimId: string }) {
  const projection = useClaimDetailProjection({ claimId });
  const evidence = sanitizeEvidenceList(projection.data?.claim.evidence ?? DEFAULT_EVIDENCE);

  return (
    <EvidenceShell
      evidence={evidence}
      loading={projection.viewState === 'loading'}
      error={projection.viewState === 'error'}
      stale={projection.viewState === 'ready-stale'}
      onRetry={projection.refetch}
    />
  );
}

/**
 * V2-FE-075 / UI-FE-082 — Evidence media/link/text rendering with fail-closed
 * sanitization. All content is treated as untrusted:
 *  - link values must pass the scheme allowlist (https/ipfs) or they render
 *    as an accessible "blocked" placeholder instead of an anchor
 *  - anchors always use target="_blank" + noopener noreferrer nofollow
 *  - images only render from https or valid ipfs URIs (data:/blob: rejected),
 *    and are click-to-load under reduced-data mode (UI-FE-082)
 *  - text renders as React text children only — no innerHTML, ever
 */
export function EvidenceViewer({ claimId, evidence: rawEvidence }: EvidenceViewerProps) {
  // Supplying explicit evidence avoids a canonical projection fetch entirely,
  // which also keeps prop-driven renderers usable without a QueryClient.
  if (rawEvidence) {
    return <EvidenceShell evidence={sanitizeEvidenceList(rawEvidence)} loading={false} error={false} stale={false} />;
  }
  return <ProjectedEvidenceViewer claimId={claimId} />;
}

export default EvidenceViewer;
