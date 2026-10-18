'use client';

/**
 * ClaimHeader — Claim title, status badge, and metadata
 *
 * Displays claim title with status badge. All content is sanitized.
 *
 * UI-FE-074 — centralizes canonical deadline and finality presentation.
 * Action availability is derived from canonical contract state (not the
 * displayed countdown). Absolute time + timezone are always shown. Stale /
 * unavailable clock is explicit. Finalized and merely confirmed states remain
 * distinct.
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

/** Canonical clock state as provided by the reviewed API projection. */
export type CanonicalClockStatus = 'synced' | 'skewed' | 'unavailable';

/** Finality depth distinct from mere confirmation. */
export type FinalityStatus = 'finalized' | 'confirmed' | 'pending' | 'reorged';

export interface CanonicalTimeProvenance {
  /** Absolute ISO 8601 timestamp from the contract/chain. */
  absoluteTimeIso: string;
  /** IANA timezone identifier (e.g. "UTC"). */
  timezone: string;
  /** Block height at which the time was observed. */
  blockHeight?: number;
  /** Chain identifier for wrong-chain detection. */
  chainId?: string;
  /** Clock status from canonical source. */
  clockStatus: CanonicalClockStatus;
  /** Observed skew in seconds when clockStatus === 'skewed'. */
  skewSeconds?: number;
  /** Whether the canonical time is currently usable for authorizing actions. */
  isAuthoritative: boolean;
}

export interface CanonicalDeadline {
  /** Absolute ISO 8601 deadline from contract. */
  deadlineIso: string;
  /** Timezone in which the deadline is presented. */
  timezone: string;
  /** Whether the deadline has passed according to canonical time. */
  hasPassed: boolean;
  /** Whether the deadline is exactly now (canonical). */
  isExactNow: boolean;
}

export interface CanonicalFinality {
  status: FinalityStatus;
  /** Confirmations observed so far. */
  confirmations: number;
  /** Required confirmations for finality. */
  requiredConfirmations: number;
}

export interface ClaimHeaderProps {
  claim: ClaimDetailProjection;
  /** Canonical time provenance from contract/API. */
  timeProvenance?: CanonicalTimeProvenance;
  /** Canonical deadline from contract/API. */
  deadline?: CanonicalDeadline;
  /** Canonical finality state from contract/API. */
  finality?: CanonicalFinality;
}

function formatAbsoluteTime(iso: string, timezone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unavailable';
  }
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: timezone,
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function clockStatusLabel(status: CanonicalClockStatus, skewSeconds?: number): string {
  switch (status) {
    case 'synced':
      return 'Clock synced';
    case 'skewed':
      return typeof skewSeconds === 'number'
        ? `Clock skewed by ${Math.abs(skewSeconds)}s`
        : 'Clock skewed';
    case 'unavailable':
      return 'Clock unavailable';
    default:
      return 'Clock unavailable';
  }
}

function finalityLabel(finality: CanonicalFinality): { label: string; className: string } {
  switch (finality.status) {
    case 'finalized':
      return {
        label: 'Finalized',
        className: 'text-green-400 border-green-500/30 bg-green-500/10',
      };
    case 'confirmed':
      return {
        label: `Confirmed (${finality.confirmations}/${finality.requiredConfirmations})`,
        className: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
      };
    case 'pending':
      return {
        label: `Pending (${finality.confirmations}/${finality.requiredConfirmations})`,
        className: 'text-slate-400 border-slate-500/30 bg-slate-500/10',
      };
    case 'reorged':
      return {
        label: 'Reorged',
        className: 'text-red-400 border-red-500/30 bg-red-500/10',
      };
    default:
      return {
        label: 'Finality unavailable',
        className: 'text-slate-400 border-slate-500/30 bg-slate-500/10',
      };
  }
}

export function ClaimHeader({ claim, timeProvenance, deadline, finality }: ClaimHeaderProps) {
  // V2-FE-075 — claim title is untrusted content; sanitize before rendering
  const safeTitle = sanitizeText(claim.title, 300);
  const statusConfig = STATUS_CONFIGS[claim.status];

  // Canonical time is authoritative only when explicitly flagged and synced.
  const hasCanonicalTime =
    !!timeProvenance && timeProvenance.clockStatus === 'synced' && timeProvenance.isAuthoritative;
  const isTimeStale = !timeProvenance || !hasCanonicalTime;

  const clockLabel = timeProvenance
    ? clockStatusLabel(timeProvenance.clockStatus, timeProvenance.skewSeconds)
    : 'Clock unavailable';

  const deadlineLabel = deadline
    ? deadline.hasPassed
      ? 'Deadline passed'
      : deadline.isExactNow
        ? 'Deadline now'
        : 'Deadline pending'
    : null;

  const finalityInfo = finality ? finalityLabel(finality) : null;

  return (
    <div className="border-bottom border-[#232329] pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-400 sm:grid-cols-2">
        {timeProvenance && (
          <div className="flex flex-col">
            <dt className="font-medium text-slate-500">Canonical time</dt>
            <dd className="text-slate-200">
              {formatAbsoluteTime(timeProvenance.absoluteTimeIso, timeProvenance.timezone)}
            </dd>
            <dd className="text-slate-500">
              {clockLabel}
              {timeProvenance.blockHeight !== undefined && (
                <>
                  {' · block '}
                  {timeProvenance.blockHeight}
                </>
              )}
            </dd>
          </div>
        )}

        {deadline && (
          <div className="flex flex-col">
            <dt className="font-medium text-slate-500">Deadline</dt>
            <dd className="text-slate-200">
              {formatAbsoluteTime(deadline.deadlineIso, deadline.timezone)}
            </dd>
            <dd
              className={deadline.hasPassed ? 'text-red-400' : 'text-slate-500'}
              aria-live="polite"
            >
              {deadlineLabel}
              {hasCanonicalTime ? '' : ' — time unavailable'}
            </dd>
          </div>
        )}

        {finalityInfo && (
          <div className="flex flex-col">
            <dt className="font-medium text-slate-500">Finality</dt>
            <dd>
              <span
                className={` inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${finalityInfo.className}`}
                aria-label={`Finality: ${finalityInfo.label}`}
              >
                {finalityInfo.label}
              </span>
            </dd>
          </div>
        )}
      </dl>

      {isTimeStale && (
        <p className="mt-2 texe-xs text-amber-400" role="status">
          Canonical time is stale or unavailable. Action availability is determined by
          contract state, not this clock.
        </p>
      )}
    </div>
  );
}
