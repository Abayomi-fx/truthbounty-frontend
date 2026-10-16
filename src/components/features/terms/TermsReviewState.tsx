'use client';

import React from 'react';
import type { ClauseStatus } from '@/app/types/terms';

interface TermsReviewStateProps {
  status: ClauseStatus;
  reviewerNotes?: string;
  clauseTitle: string;
  network: 'testnet' | 'mainnet';
  className?: string;
}

const STATUS_CONFIG: Record<ClauseStatus, {
  icon: React.ReactNode;
  title: string;
  description: string;
  className: string;
  borderClassName: string;
  iconClassName: string;
}> = {
  approved: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Approved',
    description: 'This clause has been reviewed and approved. It is legally effective as of the version effective date.',
    className: 'bg-green-900/20',
    borderClassName: 'border-green-700',
    iconClassName: 'text-green-400',
  },
  review: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Under Review',
    description: 'This clause is currently under legal/governance review and is NOT yet legally effective. Content may change before publication.',
    className: 'bg-yellow-900/20',
    borderClassName: 'border-yellow-700',
    iconClassName: 'text-yellow-400',
  },
  unavailable: {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    title: 'Unavailable',
    description: 'This clause is currently unavailable. It may be pending legal review, regulatory approval, or governance voting.',
    className: 'bg-red-900/20',
    borderClassName: 'border-red-700',
    iconClassName: 'text-red-400',
  },
};

export function TermsReviewState({ status, reviewerNotes, clauseTitle, network, className = '' }: TermsReviewStateProps) {
  const config = STATUS_CONFIG[status];

  if (status === 'approved') {
    return null; // Approved clauses don't need a review state banner
  }

  return (
    <div
      className={`p-4 rounded-lg border ${config.className} ${config.borderClassName} ${className}`}
      role={status === 'unavailable' ? 'alert' : 'note'}
      aria-label={`${config.title}: ${clauseTitle}`}
    >
      <div className="flex flex-col sm:flex-row gap-4">
        <div className={`flex-shrink-0 ${config.iconClassName}`} aria-hidden="true">
          {config.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="tb-label font-semibold" style={{ color: config.iconClassName.replace('text-', '') }}>
              {config.title}
            </h3>
            {network === 'testnet' && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-blue-900/30 text-blue-400 border-blue-700"
                aria-label="Testnet clause"
              >
                Testnet
              </span>
            )}
            {network === 'mainnet' && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-purple-900/30 text-purple-400 border-purple-700"
                aria-label="Mainnet clause"
              >
                Mainnet
              </span>
            )}
          </div>
          <p className="tb-small text-ink-secondary">{config.description}</p>
          {reviewerNotes && (
            <details className="mt-3">
              <summary className="tb-small font-medium cursor-pointer list-none flex items-center gap-1 text-ink-muted">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Reviewer Notes
              </summary>
              <div className="mt-2 p-3 bg-surface rounded border border-divider">
                <p className="tb-small text-ink-secondary whitespace-pre-wrap">{reviewerNotes}</p>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

interface TermsReviewSummaryProps {
  clauses: Array<{ id: string; title: string; status: ClauseStatus }>;
  network: 'testnet' | 'mainnet';
  className?: string;
}

export function TermsReviewSummary({ clauses, network, className = '' }: TermsReviewSummaryProps) {
  const reviewCount = clauses.filter((c) => c.status === 'review').length;
  const unavailableCount = clauses.filter((c) => c.status === 'unavailable').length;
  const approvedCount = clauses.filter((c) => c.status === 'approved').length;

  if (reviewCount === 0 && unavailableCount === 0) {
    return null;
  }

  return (
    <div className={`p-4 rounded-lg border bg-yellow-900/20 border-yellow-700 ${className}`} role="region" aria-label="Terms review summary">
      <div className="flex items-start gap-3">
        <svg className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1">
          <h2 className="tb-section text-yellow-400 mb-2">Clause Status Summary</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center p-2 bg-surface/50 rounded">
              <p className="tb-title font-mono text-green-400">{approvedCount}</p>
              <p className="tb-label text-ink-muted">Approved</p>
            </div>
            {reviewCount > 0 && (
              <div className="text-center p-2 bg-surface/50 rounded">
                <p className="tb-title font-mono text-yellow-400">{reviewCount}</p>
                <p className="tb-label text-ink-muted">Under Review</p>
              </div>
            )}
            {unavailableCount > 0 && (
              <div className="text-center p-2 bg-surface/50 rounded">
                <p className="tb-title font-mono text-red-400">{unavailableCount}</p>
                <p className="tb-label text-ink-muted">Unavailable</p>
              </div>
            )}
          </div>
          <p className="tb-small text-ink-muted mt-3">
            {network === 'mainnet' && (
              <>
                <strong>Mainnet:</strong> Only approved clauses are considered effective. Clauses under review or unavailable
                do not create binding obligations. Governance process is required for mainnet clause changes.
              </>
            )}
            {network === 'testnet' && (
              <>
                <strong>Testnet:</strong> Only approved clauses are effective for testnet participation. Clauses under review
                are not binding. Board process is required for testnet clause changes.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}