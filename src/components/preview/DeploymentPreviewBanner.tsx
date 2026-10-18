'use client';

/**
 * V2-FE-064 — Deployment Preview Banner
 *
 * Displays commit, release ID, artifact checksum, API version, and environment
 * classification for preview deployments. Visible only on non-production
 * deployments where a valid preview manifest has been verified.
 *
 * Accessibility: uses role="status" (polite) for informational states and
 * role="alert" (assertive) for blocked/failed states. Keyboard-reachable,
 * WCAG AA contrast compliant.
 *
 * Security invariants:
 *  - Never displays production secrets.
 *  - Never fabricates wallet, transaction, finality, permission, health, or
 *    legal state.
 *  - Blocked state disables all action children and surfaces failure reason.
 *  - Data rendered is only from ValidatedPreviewManifest — no raw env vars.
 */

import React, { useState } from 'react';
import type { PreviewVerificationResult, PreviewDisplayInfo } from '@/lib/deployment';

export interface DeploymentPreviewBannerProps {
  /** Verification result from `verifyPreviewDeployment()`. */
  verificationResult: PreviewVerificationResult;
  /** Allow dismissing the banner (default true). */
  dismissible?: boolean;
  /** Additional class names for the outer container. */
  className?: string;
}

const CHAIN_ENVIRONMENT_COLORS: Record<string, string> = {
  preview: 'bg-sky-950 border-sky-700 text-sky-100',
  staging: 'bg-amber-950 border-amber-700 text-amber-100',
  development: 'bg-violet-950 border-violet-700 text-violet-100',
};

const BLOCKED_COLORS = 'bg-red-950 border-red-700 text-red-100';

function MetadataRow({
  label,
  value,
  mono = false,
  title,
}: {
  label: string;
  value: string;
  mono?: boolean;
  title?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
      <span className="font-semibold opacity-70 shrink-0">{label}:</span>
      <span
        className={mono ? 'font-mono break-all' : 'break-all'}
        title={title}
        aria-label={`${label}: ${value}`}
      >
        {value}
      </span>
    </div>
  );
}

function ChecksumIndicator({ info }: { info: PreviewDisplayInfo }) {
  if (info.checksumMatchesRegistry) {
    return (
      <div className="flex items-baseline gap-x-2 text-xs">
        <span className="font-semibold opacity-70 shrink-0">Artifact:</span>
        <span
          className="font-mono text-emerald-400"
          title={`Full checksum: ${info.artifactChecksumFull}`}
          aria-label={`Artifact checksum: ${info.artifactChecksumShort} — matches registry`}
        >
          {info.artifactChecksumShort}…
          <span className="ml-1 text-emerald-400" aria-hidden="true">✓</span>
          <span className="sr-only"> matches registry</span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-x-2 text-xs">
      <span className="font-semibold opacity-70 shrink-0">Artifact:</span>
      <span
        className="font-mono text-amber-400"
        title={`Full checksum: ${info.artifactChecksumFull}`}
        aria-label={`Artifact checksum: ${info.artifactChecksumShort} — registry unavailable for comparison`}
      >
        {info.artifactChecksumShort}…
        <span className="ml-1 text-amber-400" aria-hidden="true">~</span>
        <span className="sr-only"> registry comparison unavailable</span>
      </span>
    </div>
  );
}

/**
 * Verified preview banner — displays full provenance metadata to reviewers.
 */
function VerifiedBanner({
  info,
  dismissible,
  onDismiss,
}: {
  info: PreviewDisplayInfo;
  dismissible: boolean;
  onDismiss: () => void;
}) {
  const colorClasses =
    CHAIN_ENVIRONMENT_COLORS[info.environment] ??
    CHAIN_ENVIRONMENT_COLORS['preview'];

  const builtAtDate = new Date(info.builtAt);
  const builtAtDisplay = Number.isNaN(builtAtDate.getTime())
    ? info.builtAt
    : builtAtDate.toISOString().slice(0, 19).replace('T', ' ') + ' UTC';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Deployment preview verification status"
      data-testid="deployment-preview-banner"
      data-preview-status="verified"
      data-preview-environment={info.environment}
      data-preview-chain-id={String(info.chainId)}
      className={`w-full border rounded-md px-4 py-3 ${colorClasses}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-current opacity-80"
              aria-hidden="true"
            >
              {info.environment}
            </span>
            <span className="font-semibold text-sm">
              Preview Deployment
            </span>
            {info.prNumber !== null && (
              <span className="text-xs opacity-70" aria-label={`Pull request ${info.prNumber}`}>
                PR #{info.prNumber}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            <MetadataRow
              label="Commit"
              value={info.commitShort}
              mono
              title={`Full commit: ${info.commitFull}`}
            />
            <MetadataRow
              label="Release"
              value={info.releaseId}
              mono
            />
            <MetadataRow
              label="Protocol"
              value={info.protocolVersion}
            />
            <MetadataRow
              label="Chain"
              value={`${info.chainName} (${info.chainId})`}
            />
            <ChecksumIndicator info={info} />
            <MetadataRow
              label="API"
              value={info.apiVersion}
            />
            <MetadataRow
              label="Built"
              value={builtAtDisplay}
            />
            {info.buildId && (
              <MetadataRow
                label="Build ID"
                value={info.buildId}
                mono
              />
            )}
          </div>
        </div>

        {dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-current opacity-60 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-current rounded p-1"
            aria-label="Dismiss deployment preview banner"
          >
            <span aria-hidden="true">✕</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Blocked banner — surfaces all failure reasons clearly to the reviewer.
 */
function BlockedBanner({
  result,
  dismissible,
  onDismiss,
}: {
  result: PreviewVerificationResult;
  dismissible: boolean;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-label="Deployment preview verification failed"
      data-testid="deployment-preview-banner"
      data-preview-status="blocked"
      className={`w-full border rounded-md px-4 py-3 ${BLOCKED_COLORS}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm mb-2">
            <span aria-hidden="true">⛔ </span>
            Preview Blocked — Configuration Incomplete or Invalid
          </p>

          {result.failureDetails.length > 0 && (
            <ul
              className="list-disc pl-5 text-xs space-y-1 opacity-90"
              aria-label="Failure reasons"
            >
              {result.failureDetails.map((detail, i) => (
                <li key={i}>{detail}</li>
              ))}
            </ul>
          )}

          <p className="text-xs mt-2 opacity-70">
            Protocol mutations are blocked until all preview configuration issues are resolved.
          </p>
        </div>

        {dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-current opacity-60 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-current rounded p-1"
            aria-label="Dismiss deployment preview banner"
          >
            <span aria-hidden="true">✕</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Deployment preview banner — renders provenance for verified previews and a
 * blocking error for invalid/incomplete configurations.
 *
 * Returns null when the deployment is NOT a preview (`status === 'not_preview'`),
 * keeping the production build clean with no preview-related DOM.
 */
export function DeploymentPreviewBanner({
  verificationResult,
  dismissible = true,
  className,
}: DeploymentPreviewBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (verificationResult.status === 'not_preview') {
    return null;
  }

  if (dismissed && verificationResult.status !== 'blocked') {
    // Blocked banners cannot be dismissed — they must remain visible
    return null;
  }

  const content =
    verificationResult.status === 'verified' && verificationResult.displayInfo ? (
      <VerifiedBanner
        info={verificationResult.displayInfo}
        dismissible={dismissible}
        onDismiss={() => setDismissed(true)}
      />
    ) : (
      <BlockedBanner
        result={verificationResult}
        dismissible={false}
        onDismiss={() => setDismissed(true)}
      />
    );

  return (
    <div
      className={className}
      data-testid="deployment-preview-banner-wrapper"
    >
      {content}
    </div>
  );
}

export default DeploymentPreviewBanner;
