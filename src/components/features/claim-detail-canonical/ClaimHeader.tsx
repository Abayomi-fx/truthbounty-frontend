'use client';

/**
 * ClaimHeader — Claim title, status badge, and metadata
 *
 * Displays claim title with status badge. All content is sanitized.
 */

import { sanitizeText } from '@/lib/security/evidence-sanitizer';
import type { ClaimDetailProjection } from '@/app/types/claim-detail-projection';
import type { ClaimStatus } from '@/app/types/claim';

interface StatusBadgeConfig {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

const STATUS_CONFIGS: Record<ClaimStatus, StatusBadgeConfig> = {
  OPEN: {
    label: 'Open',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-500',
    borderColor: 'border-blue-500/20',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    bgColor: 'bg-yellow-500/10',
    textColor: 'text-yellow-500',
    borderColor: 'border-yellow-500/20',
  },
  VERIFIED: {
    label: 'Verified',
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-500',
    borderColor: 'border-green-500/20',
  },
  REJECTED: {
    label: 'Rejected',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-500',
    borderColor: 'border-red-500/20',
  },
  DISPUTED: {
    label: 'Disputed',
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-500',
    borderColor: 'border-purple-500/20',
  },
};

export interface ClaimHeaderProps {
  claim: ClaimDetailProjection;
}

export function ClaimHeader({ claim }: ClaimHeaderProps) {
  // V2-FE-075 — claim title is untrusted content; sanitize before rendering
  const safeTitle = sanitizeText(claim.title, 300);
  const statusConfig = STATUS_CONFIGS[claim.status];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232329] pb-4">
      <h1 className="min-w-0 flex-1 text-lg font-bold break-words text-white sm:text-xl">
        {safeTitle}
      </h1>

      <span
        className={`shrink-0 px-3 py-1 ${statusConfig.bgColor} ${statusConfig.textColor} border ${statusConfig.borderColor} rounded-full text-xs font-semibold uppercase tracking-wider`}
        aria-label={`Status: ${statusConfig.label}`}
      >
        {statusConfig.label}
      </span>
    </div>
  );
}
