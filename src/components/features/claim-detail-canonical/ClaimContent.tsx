'use client';

/**
 * ClaimContent — Description, evidence, and metadata display
 *
 * Renders sanitized claim content with evidence links. All user-generated
 * content is sanitized; unsafe URLs fail closed to plain text.
 *
 * V2-FE Evidence Privacy Protection — Evidence URLs and timestamps are
 * displayed in privacy-preserving format. Full URLs available via clipboard.
 */

import { sanitizeText, sanitizeEvidenceList } from '@/lib/security/evidence-sanitizer';
import { PrivateEvidenceLink } from '@/components/security/PrivateEvidenceLink';
import { PrivateTimestamp } from '@/components/security/PrivateTimestamp';
import { sanitizeText, sanitizeEvidenceList } from '@/lib/security/evidence-sanitizer';
import { SafeExternalLink } from '@/components/security/SafeExternalLink';
import type { ClaimDetailProjection } from '@/app/types/claim-detail-projection';

export interface ClaimContentProps {
  claim: ClaimDetailProjection;
}

export function ClaimContent({ claim }: ClaimContentProps) {
  // V2-FE-075 — all claim content is untrusted; sanitize before rendering
  const safeDescription = sanitizeText(claim.description, 5000);
  const safeCategory = claim.category ? sanitizeText(claim.category, 100) : null;
  const evidence = sanitizeEvidenceList(claim.evidence);

  return (
    <div className="space-y-4">
      {/* Description */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Description
        </h2>
        <p className="text-gray-200 text-sm leading-relaxed break-words whitespace-pre-wrap">
          {safeDescription}
        </p>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-[#232329] text-xs">
        <div className="text-gray-400">
          {claim.category ? (
            <>
              <span>Category: </span>
              <span className="text-gray-200 font-medium">
                {safeCategory ?? 'Uncategorized'}
              </span>
            </>
          ) : (
            <span>Category: Uncategorized</span>
          )}
        </div>

        <div className="text-gray-400">
          <span>Bounty: </span>
          <span className="text-gray-200 font-medium">
            {claim.bountyAmount.toLocaleString()} ETH
          </span>
        </div>

        <div className="text-gray-400">
          <span>Total Staked: </span>
          <span className="text-gray-200 font-medium">
            {claim.totalStaked.toLocaleString()} ETH
          </span>
        </div>
      </div>

      {/* Evidence */}
      {evidence.length > 0 && (
        <div className="pt-4 border-t border-[#232329] space-y-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Evidence
          </h2>
          <ul className="space-y-2" role="list">
            {evidence.map((ev, idx) => (
              <li key={idx} className="text-xs">
                {ev.kind === 'link' && (
                  <PrivateEvidenceLink
                    href={ev.href}
                    className="text-blue-400 hover:text-blue-300 underline break-all transition-colors"
                    ariaLabel={`Evidence link ${idx + 1} (truncated for privacy, click to copy full URL)`}
                    showIcon={true}
                    showCopyButton={true}
                  />
                  <SafeExternalLink
                    href={ev.href}
                    className="text-blue-400 hover:text-blue-300 underline break-all transition-colors"
                    aria-label={`Evidence link ${idx + 1}: ${ev.text} (opens in new tab)`}
                  >
                    {ev.text}
                  </SafeExternalLink>
                )}
                {ev.kind === 'image' && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={ev.src}
                    alt={`Evidence image ${idx + 1}`}
                    className="rounded max-h-60 w-auto border border-[#232329]"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                )}
                {ev.kind === 'text' && (
                  <span className="text-gray-300">{ev.text}</span>
                )}
                {ev.kind === 'blocked' && (
                  <span className="text-gray-500 italic" role="note">
                    {ev.reason}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Claimant info */}
      <div className="pt-4 border-t border-[#232329] text-xs text-gray-400">
        <div className="flex flex-wrap gap-4">
          <div>
            <span>Claimant: </span>
            <span className="text-gray-200 font-mono text-xs">
              {claim.claimantAddress.slice(0, 6)}...{claim.claimantAddress.slice(-4)}
            </span>
          </div>

          {claim.claimantReputation !== null && (
            <div>
              <span>Reputation: </span>
              <span className="text-yellow-500 font-bold">{claim.claimantReputation}</span>
            </div>
          )}

          <div>
            <PrivateTimestamp
              timestamp={claim.createdAt}
              prefix="Created"
              showTooltip={false}
            />
            <span>Created: </span>
            <span className="text-gray-200">
              {new Date(claim.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
