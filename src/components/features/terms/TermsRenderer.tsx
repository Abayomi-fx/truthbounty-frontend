'use client';

import React, { useState, useMemo } from 'react';
import { sanitizeText } from '@/lib/security/evidence-sanitizer';
import { TermsSection } from './TermsSection';
import { TermsVersionSelector } from './TermsVersionSelector';
import { TermsReviewState, TermsReviewSummary } from './TermsReviewState';
import type { TermsVersion, TermsClause, TermsSectionId, NetworkType, ClauseStatus } from '@/app/types/terms';
import { TERMS_SECTIONS, SECTION_TITLES } from '@/app/types/terms';

interface TermsRendererProps {
  version: TermsVersion;
  allVersions: TermsVersion[];
  network: NetworkType;
  onVersionChange: (version: string) => void;
}

export function TermsRenderer({ version, allVersions, network, onVersionChange }: TermsRendererProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(TERMS_SECTIONS));

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const clauseMap = useMemo(() => {
    const map = new Map<string, TermsClause>();
    version.clauses.forEach((clause) => map.set(clause.id, clause));
    return map;
  }, [version.clauses]);

  const sortedClauses = useMemo(() => {
    return TERMS_SECTIONS.map((sectionId) => {
      const clause = clauseMap.get(sectionId);
      if (clause) return clause;
      // Synthetic unavailable clause for missing sections
      return {
        id: sectionId,
        title: SECTION_TITLES[sectionId as TermsSectionId],
        content: 'This clause is currently unavailable. It may be pending legal review, regulatory approval, or governance voting.',
        status: 'unavailable' as ClauseStatus,
        reviewerNotes: undefined,
      };
    });
  }, [clauseMap]);

  const safeVersionTitle = sanitizeText(version.version, 50);
  const safeEffectiveDate = sanitizeText(version.effectiveDate, 50);
  const safeMaterialChanges = sanitizeText(version.materialChanges, 5000);
  const safeSource = sanitizeText(version.source, 50);

  // Validate dates to prevent "Invalid Date" display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Fallback to raw string if invalid
    }
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const effectiveDateFormatted = formatDate(version.effectiveDate);
  const publishedAtFormatted = version.publishedAt ? formatDate(version.publishedAt) : null;

  return (
    <div className="tb-content space-y-8">
      {/* Header */}
      <header className="space-y-4 pb-6 border-b border-divider" role="banner">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="tb-display font-bold text-ink">Terms of Use</h1>
            <p className="tb-body text-ink-muted mt-1">
              Version {safeVersionTitle} • Effective {safeEffectiveDate}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900/30 text-green-400 border border-green-700"
              aria-label="This version is published"
            >
              Published
            </span>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                network === 'testnet'
                  ? 'bg-blue-900/30 text-blue-400 border-blue-700'
                  : 'bg-purple-900/30 text-purple-400 border-purple-700'
              }`}
              aria-label={network === 'testnet' ? 'Testnet terms' : 'Mainnet terms'}
            >
              {network === 'testnet' ? 'Testnet' : 'Mainnet'}
            </span>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                safeSource === 'governance'
                  ? 'bg-purple-900/30 text-purple-400 border-purple-700'
                  : safeSource === 'board'
                  ? 'bg-blue-900/30 text-blue-400 border-blue-700'
                  : 'bg-green-900/30 text-green-400 border-green-700'
              }`}
              aria-label={`Source: ${safeSource}`}
            >
              {safeSource === 'governance' ? 'Governance' : safeSource === 'board' ? 'Board' : 'Legal'}
            </span>
          </div>
        </div>

        {/* Material Changes */}
        <details className="group">
          <summary className="tb-label text-ink-muted cursor-pointer flex items-center gap-2 list-none group-hover:text-ink transition-colors">
            <svg className="w-5 h-5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Material Changes in This Version</span>
          </summary>
          <div className="mt-3 p-4 bg-elevated rounded-lg border border-divider">
            <p className="tb-body text-ink-secondary whitespace-pre-wrap">{safeMaterialChanges}</p>
          </div>
        </details>

        {/* Version Metadata */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-ink-muted">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Effective: {effectiveDateFormatted}</span>
          </div>
          {publishedAtFormatted && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Published: {publishedAtFormatted}</span>
            </div>
          )}
          {version.previousVersion && (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Previous: v{version.previousVersion}</span>
            </div>
          )}
        </div>
      </header>

      {/* Review Summary */}
      <TermsReviewSummary
        clauses={sortedClauses.map((c) => ({ id: c.id, title: c.title, status: c.status }))}
        network={network}
      />

      {/* Clauses */}
      <div className="space-y-0">
        {sortedClauses.map((clause) => {
          const isExpanded = expandedSections.has(clause.id);
          const sectionId = clause.id as TermsSectionId;

          return (
            <article key={clause.id} className="pb-8 border-b border-divider last:border-0">
              {/* Review State Banner */}
              {clause.status !== 'approved' && (
                <TermsReviewState
                  status={clause.status}
                  reviewerNotes={clause.reviewerNotes}
                  clauseTitle={clause.title}
                  network={network}
                />
              )}

              {/* Section Header */}
              <div className="mb-4">
                <button
                  onClick={() => toggleSection(clause.id)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg bg-surface/50 border border-divider hover:bg-surface transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
                  aria-expanded={isExpanded}
                  aria-controls={`${clause.id}-content`}
                >
                  <div className="flex-1 text-left">
                    <h2 id={`${clause.id}-heading`} className="tb-section text-ink font-semibold flex items-center gap-2">
                      {SECTION_TITLES[sectionId]}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                          clause.status === 'approved'
                            ? 'bg-green-900/30 text-green-400 border-green-700'
                            : clause.status === 'review'
                            ? 'bg-yellow-900/30 text-yellow-400 border-yellow-700'
                            : 'bg-red-900/30 text-red-400 border-red-700'
                        }`}
                        aria-label={`Status: ${clause.status}`}
                      >
                        {clause.status === 'approved' ? 'Approved' : clause.status === 'review' ? 'Review' : 'Unavailable'}
                      </span>
                    </h2>
                    <p className="tb-small text-ink-muted mt-1">{TERMS_SECTIONS.includes(sectionId) ? SECTION_TITLES[sectionId] : ''}</p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-ink-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Section Content */}
              <div
                id={`${clause.id}-content`}
                data-testid={clause.id}
                role="region"
                aria-labelledby={`${clause.id}-heading`}
                hidden={!isExpanded}
                className="animate-in fade-in-0 duration-200"
              >
                <TermsSection clause={clause} sectionId={sectionId} network={network} />
              </div>
            </article>
          );
        })}
      </div>

      {/* Expand/Collapse All */}
      <div className="flex justify-center gap-4 pt-6 border-t border-divider">
        <button
          onClick={() => setExpandedSections(new Set(TERMS_SECTIONS))}
          className="tb-touch px-6 py-2 text-sm font-medium text-ink bg-surface border border-divider rounded-lg hover:bg-elevated transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
        >
          Expand All
        </button>
        <button
          onClick={() => setExpandedSections(new Set())}
          className="tb-touch px-6 py-2 text-sm font-medium text-ink bg-surface border border-divider rounded-lg hover:bg-elevated transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
        >
          Collapse All
        </button>
      </div>

      {/* Version History */}
      <section aria-labelledby="version-history-heading" className="pt-8 border-t border-divider" aria-label="Version history for Terms of Use">
        <h2 id="version-history-heading" className="tb-title font-bold text-ink mb-6">Version History</h2>
        <TermsVersionSelector
          versions={allVersions}
          currentVersion={version.version}
          network={network}
          onVersionChange={onVersionChange}
        />
      </section>

      {/* Footer Disclaimer */}
      <footer className="pt-8 border-t border-divider text-center" role="contentinfo">
        <p className="tb-small text-ink-muted max-w-2xl mx-auto">
          {network === 'mainnet' ? (
            <>
              These Mainnet Terms govern your use of the TruthBounty protocol on Optimism Mainnet.
              Only approved clauses are considered effective. Draft content is not effective.
              <br />
              For questions, contact the protocol team via official channels.
            </>
          ) : (
            <>
              These Testnet Terms govern your use of the TruthBounty testnet on Optimism Sepolia.
              Testnet tokens have no monetary value. Only approved clauses are effective.
              <br />
              For questions, contact the protocol team via official channels.
            </>
          )}
        </p>
      </footer>
    </div>
  );
}