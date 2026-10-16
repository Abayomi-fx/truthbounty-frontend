'use client';

import React from 'react';
import type { TermsVersion, NetworkType } from '@/app/types/terms';

interface TermsVersionSelectorProps {
  versions: TermsVersion[];
  currentVersion: string;
  network: NetworkType;
  onVersionChange: (version: string) => void;
  className?: string;
}

export function TermsVersionSelector({
  versions,
  currentVersion,
  network,
  onVersionChange,
  className = '',
}: TermsVersionSelectorProps) {
  const publishedVersions = versions.filter((v) => v.status === 'published');
  const draftVersions = versions.filter((v) => v.status === 'draft');

  return (
    <div className={`tb-content ${className}`} role="region" aria-label="Version selector">
      <div className="space-y-6">
        {/* Current Version Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg bg-surface border border-divider">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-action/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-action" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="tb-label text-ink-muted">Current Version</p>
              <p className="tb-title font-mono text-ink">{currentVersion}</p>
            </div>
          </div>
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900/30 text-green-400 border border-green-700"
            aria-label="Currently active version"
          >
            Active
          </span>
        </div>

        {/* Published Versions */}
        {publishedVersions.length > 0 && (
          <div>
            <h3 className="tb-section text-ink mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-action" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Published Versions
            </h3>
            <div className="space-y-3" aria-label="Published versions">
              {publishedVersions.map((version) => (
                <VersionListItem
                  key={version.version}
                  version={version}
                  isCurrent={version.version === currentVersion}
                  onSelect={onVersionChange}
                  network={network}
                />
              ))}
            </div>
          </div>
        )}

        {/* Draft Versions */}
        {draftVersions.length > 0 && (
          <div>
            <h3 className="tb-section text-ink mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Draft Versions (Not Published)
            </h3>
            <div className="space-y-3" aria-label="Draft versions">
              {draftVersions.map((version) => (
                <DraftVersionListItem key={version.version} version={version} network={network} />
              ))}
            </div>
            <p className="tb-small text-ink-muted mt-3 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg" role="note">
              <strong>Draft content cannot be published as approved.</strong> Draft versions are visible for transparency but are not legally effective.
              Only versions marked "Published" and sourced from "governance" (mainnet) or "board" (testnet) are legally binding.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface VersionListItemProps {
  version: TermsVersion;
  isCurrent: boolean;
  onSelect: (version: string) => void;
  network: NetworkType;
}

function VersionListItem({ version, isCurrent, onSelect, network }: VersionListItemProps) {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const effectiveDate = formatDate(version.effectiveDate);

  const publishedAt = version.publishedAt
    ? formatDate(version.publishedAt)
    : null;

  const sourceLabels: Record<string, { label: string; className: string }> = {
    board: { label: 'Board', className: 'bg-blue-900/30 text-blue-400 border-blue-700' },
    governance: { label: 'Governance', className: 'bg-purple-900/30 text-purple-400 border-purple-700' },
    legal: { label: 'Legal', className: 'bg-green-900/30 text-green-400 border-green-700' },
  };

  const sourceInfo = sourceLabels[version.source] || { label: version.source, className: 'bg-gray-700 text-gray-300 border-gray-600' };

  return (
    <article
      className={`p-4 rounded-lg border transition-colors ${
        isCurrent
          ? 'bg-action/5 border-action/30 ring-1 ring-action/20'
          : 'bg-surface border-divider hover:bg-elevated'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="tb-title font-mono text-ink">{version.version}</span>
            {isCurrent && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-action/20 text-action border border-action/30"
                aria-label="Currently selected version"
              >
                Current
              </span>
            )}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${sourceInfo.className}`}
              aria-label={`Source: ${sourceInfo.label}`}
            >
              {sourceInfo.label}
            </span>
            {network === 'testnet' && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-blue-900/30 text-blue-400 border-blue-700"
                aria-label="Testnet version"
              >
                Testnet
              </span>
            )}
            {network === 'mainnet' && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-purple-900/30 text-purple-400 border-purple-700"
                aria-label="Mainnet version"
              >
                Mainnet
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-ink-muted">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Effective: {effectiveDate}</span>
            </div>
            {publishedAt && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Published: {publishedAt}</span>
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
        </div>

        {!isCurrent && (
          <button
            onClick={() => onSelect(version.version)}
            className="tb-touch px-4 py-2 text-sm font-medium text-action-ink bg-action rounded-lg hover:bg-action-hover transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
            aria-label={`View version ${version.version} (effective ${effectiveDate})`}
          >
            View Version
          </button>
        )}
      </div>

      <details className="mt-4">
        <summary className="tb-small text-ink-muted cursor-pointer flex items-center gap-2 list-none">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Material Changes</span>
        </summary>
        <div className="mt-3 p-3 bg-elevated rounded-lg border border-divider">
          <p className="tb-body text-ink-secondary whitespace-pre-wrap">{version.materialChanges}</p>
        </div>
      </details>
    </article>
  );
}

interface DraftVersionListItemProps {
  version: TermsVersion;
  network: NetworkType;
}

function DraftVersionListItem({ version, network }: DraftVersionListItemProps) {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const effectiveDate = formatDate(version.effectiveDate);

  return (
    <article className="p-4 rounded-lg border bg-surface/50 border-yellow-700/30">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="tb-title font-mono text-ink">{version.version}</span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-yellow-900/30 text-yellow-400 border-yellow-700"
              aria-label="Draft version — not legally effective"
            >
              Draft
            </span>
            {network === 'testnet' && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-blue-900/30 text-blue-400 border-blue-700"
                aria-label="Testnet version"
              >
                Testnet
              </span>
            )}
            {network === 'mainnet' && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-purple-900/30 text-purple-400 border-purple-700"
                aria-label="Mainnet version"
              >
                Mainnet
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-ink-muted">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Proposed Effective: {effectiveDate}</span>
            </div>
            {version.previousVersion && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Previous: v{version.previousVersion}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <details className="mt-4">
        <summary className="tb-small text-ink-muted cursor-pointer flex items-center gap-2 list-none">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Proposed Changes</span>
        </summary>
        <div className="mt-3 p-3 bg-elevated rounded-lg border border-divider">
          <p className="tb-body text-ink-secondary whitespace-pre-wrap">{version.materialChanges}</p>
        </div>
      </details>
    </article>
  );
}