'use client';

/**
 * V2-FE-064 — Deployment Preview Verification E2E Harness
 *
 * Production-excluded harness page. Only accessible when E2E_HARNESS=1.
 * Accepts manifest fields via query-string so every failure scenario
 * (wrong chain, missing manifest, stale ABI, production endpoint, mixed
 * release) can be driven deterministically by Playwright without touching
 * production code.
 *
 * The page renders:
 *   - <DeploymentPreviewBanner>  — provenance metadata or blocked alert
 *   - <DeploymentPreviewGuard>   — fail-closed mutation gate
 *   - A sentinel element inside the guard so tests can assert whether
 *     mutations are allowed or blocked
 *
 * Security: this route 404s in production (isE2EHarnessEnabled guard in
 * page.tsx). Fixture values here are not real chain state — no wallet,
 * transaction, finality, permission, or legal state is fabricated for users.
 */

import React from 'react';
import { DeploymentPreviewBanner } from '@/components/preview/DeploymentPreviewBanner';
import { DeploymentPreviewGuard } from '@/components/preview/DeploymentPreviewGuard';
import {
  verifyPreviewDeployment,
  type PreviewVerificationResult,
} from '@/lib/deployment/preview-verification';
import type { RawPreviewManifest } from '@/lib/deployment/preview-manifest';

interface Props {
  searchParams: Record<string, string | undefined>;
}

/**
 * Build a RawPreviewManifest from query-string params.
 * When no params are supplied at all, returns an empty object so the
 * validation engine triggers 'incomplete_manifest' (fail-closed).
 * The harness intentionally passes the empty-object case through to the
 * validator rather than returning null (null would yield 'not_preview').
 */
function buildRawManifestFromParams(
  params: Record<string, string | undefined>,
): RawPreviewManifest | null {
  const hasAnyPreviewParam = Boolean(
    params.gitCommit ||
      params.releaseId ||
      params.environment ||
      params.chainId,
  );

  // No params at all → treat as misconfigured preview (empty manifest → blocked)
  if (!hasAnyPreviewParam) {
    return {};
  }

  const chainId = params.chainId ? parseInt(params.chainId, 10) : undefined;
  const prNumber = params.prNumber ? parseInt(params.prNumber, 10) : undefined;

  return {
    gitCommit: params.gitCommit,
    releaseId: params.releaseId,
    protocolVersion: params.protocolVersion,
    chainId,
    artifactChecksum: params.artifactChecksum,
    apiUrl: params.apiUrl,
    apiVersion: params.apiVersion,
    environment: params.environment,
    builtAt: params.builtAt,
    prNumber,
    buildId: params.buildId,
  };
}

export function DeploymentPreviewHarness({ searchParams }: Props) {
  const rawManifest = buildRawManifestFromParams(searchParams);
  const result: PreviewVerificationResult = verifyPreviewDeployment(rawManifest);

  return (
    <main
      id="e2e-deployment-preview"
      className="mx-auto max-w-3xl p-6"
      aria-label="Deployment preview verification harness"
    >
      <h1 className="mb-6 text-2xl font-bold text-white">
        Deployment Preview Verification (E2E Harness)
      </h1>

      {/* Banner: provenance display or blocked alert */}
      <section aria-label="Preview banner" className="mb-6">
        <DeploymentPreviewBanner
          verificationResult={result}
          dismissible={result.status === 'verified'}
        />
        {/* Render a placeholder when not_preview so tests can still locate the wrapper */}
        {result.status === 'not_preview' && (
          <div
            data-testid="deployment-preview-banner"
            data-preview-status="not_preview"
            role="status"
            aria-label="Not a preview deployment"
            className="rounded-md border border-slate-700 px-4 py-3 text-sm text-slate-400"
          >
            Not a preview deployment — no manifest configured.
          </div>
        )}
      </section>

      {/* Guard: wraps the mutation sentinel */}
      <section aria-label="Mutation gate">
        <DeploymentPreviewGuard
          verificationResult={result}
          renderChildrenWhenBlocked={false}
        >
          {/* Sentinel element — visible only when mutations are allowed */}
          <div
            data-testid="mutation-action-sentinel"
            className="rounded-md border border-emerald-700 bg-emerald-950 px-4 py-3 text-emerald-300 text-sm"
            role="status"
            aria-label="Mutation actions available"
          >
            ✓ Protocol mutations are permitted for this preview.
          </div>
        </DeploymentPreviewGuard>
      </section>

      {/* Debug: expose raw verification result for test assertions */}
      <section
        aria-hidden="true"
        data-testid="verification-result-debug"
        hidden
      >
        <pre>{JSON.stringify({ status: result.status, failures: result.failures }, null, 2)}</pre>
      </section>
    </main>
  );
}
