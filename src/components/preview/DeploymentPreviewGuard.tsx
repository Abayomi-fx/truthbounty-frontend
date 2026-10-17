'use client';

/**
 * V2-FE-064 — Deployment Preview Guard
 *
 * Wraps mutation-producing UI in a fail-closed gate for preview deployments.
 * Blocks children when:
 *  - The preview manifest is incomplete (missing fields).
 *  - The manifest targets a production chain (chain ID 10) or endpoint.
 *  - The manifest environment is "production".
 *  - Artifact checksums are mismatched between manifest and bundled registry.
 *  - The manifest is absent but the current environment appears to be a preview.
 *
 * When the deployment is NOT a preview (status === 'not_preview'), this
 * guard is transparent and renders children without modification.
 *
 * Accessibility: blocked state renders role="alert" with a descriptive message.
 *   Children are not rendered when blocked (no hidden or invisible elements).
 *
 * Usage:
 *   <DeploymentPreviewGuard verificationResult={result}>
 *     <ClaimSubmissionForm />
 *   </DeploymentPreviewGuard>
 */

import React from 'react';
import type { PreviewVerificationResult } from '@/lib/deployment';

export interface DeploymentPreviewGuardProps {
  /** Verification result from `verifyPreviewDeployment()`. */
  verificationResult: PreviewVerificationResult;
  /** Content to render when the preview is verified or when not a preview. */
  children: React.ReactNode;
  /**
   * When true (default), render children even in blocked state but with a
   * visual overlay — useful for showing the form structure to reviewers.
   * When false, children are completely removed from the DOM when blocked.
   */
  renderChildrenWhenBlocked?: boolean;
  /** Additional class names. */
  className?: string;
}

/**
 * Fail-closed deployment preview gate.
 *
 * Children receive full access when:
 *   a) `status === 'not_preview'` (production/regular build), OR
 *   b) `status === 'verified'` (all preview checks pass).
 *
 * Children are blocked when `status === 'blocked'`.
 */
export function DeploymentPreviewGuard({
  verificationResult,
  children,
  renderChildrenWhenBlocked = false,
  className,
}: DeploymentPreviewGuardProps) {
  const { status, failureDetails } = verificationResult;

  // Not a preview deployment — transparent pass-through
  if (status === 'not_preview' || status === 'verified') {
    return (
      <div
        className={className}
        data-testid="deployment-preview-guard"
        data-preview-guard-status={status}
      >
        {children}
      </div>
    );
  }

  // Blocked — surface failure reasons and gate mutations
  return (
    <div
      className={className}
      data-testid="deployment-preview-guard"
      data-preview-guard-status="blocked"
    >
      <div
        role="alert"
        aria-live="assertive"
        aria-label="Deployment preview guard: mutations blocked"
        data-testid="deployment-preview-guard-blocked"
        className="rounded-lg border-2 border-red-600 bg-red-950 p-4 text-red-100 mb-4"
      >
        <p className="font-bold text-sm mb-1">
          <span aria-hidden="true">⛔ </span>
          Preview Not Verified — Protocol Mutations Blocked
        </p>
        <p className="text-xs mb-2 opacity-80">
          This preview deployment has not passed configuration verification.
          All write actions are disabled until the following issues are resolved:
        </p>
        {failureDetails.length > 0 && (
          <ul
            className="list-disc pl-5 text-xs space-y-1"
            aria-label="Preview configuration failures"
          >
            {failureDetails.map((detail, i) => (
              <li key={i}>{detail}</li>
            ))}
          </ul>
        )}
        {failureDetails.length === 0 && (
          <p className="text-xs opacity-70">
            Preview configuration is incomplete or points to a production target.
          </p>
        )}
      </div>

      {renderChildrenWhenBlocked && (
        <div
          aria-hidden="true"
          className="pointer-events-none select-none opacity-30"
          data-testid="deployment-preview-guard-children-hidden"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default DeploymentPreviewGuard;
