/**
 * V2-FE-064 — Deployment Preview Verification Engine
 *
 * Cross-cutting verification that validates a preview deployment against the
 * complete signed release package (bundled registry) and the canonical
 * supported chain.
 *
 * Registry binding (fixes the "missing registry fails open" finding):
 *   ALL of the following are required from the registry:
 *     - protocolVersion
 *     - releaseId
 *     - gitCommit  (source commit — must match manifest exactly)
 *     - chainId
 *     - abiChecksum (abi/TruthBountyWeighted.json SHA-256)
 *   If ANY lookup throws or returns null/undefined, the result is BLOCKED
 *   with `registry_unavailable`.  The comparison is never skipped.
 *
 * Preview-build classification (fixes the "missing manifest fails open" finding):
 *   A build classified as a preview (via NEXT_PUBLIC_PREVIEW_* or APP_ENV)
 *   with an absent manifest returns BLOCKED (`missing_manifest`), NOT
 *   `not_preview`.  Only truly non-preview builds return `not_preview`.
 *
 * Exact-source verification (new):
 *   - gitCommit in manifest must equal registry.manifest.gitCommit exactly.
 *   - releaseId in manifest must equal registry.manifest.releaseId exactly.
 *   - chainId in manifest must equal registry.manifest.chainId exactly.
 *   - artifactChecksum must equal all tracked checksums' ABI entry exactly.
 *
 * Fail-closed invariants:
 *   - No wallet, transaction, finality, permission, health, or legal state
 *     is fabricated.
 *   - Remote content and browser state treated as untrusted.
 *   - `allowsMutation` is `true` only for `status === 'verified'`.
 *   - `not_preview` leaves `allowsMutation: true` because the build is not a
 *     preview context at all; other guards (IntegrityBoundary, ChainGuard)
 *     remain in effect.
 */

import {
  validatePreviewManifest,
  loadPreviewManifestFromEnv,
  classifyPreviewBuild,
  type ValidatedPreviewManifest,
  type PreviewManifestFailureReason,
  type RawPreviewManifest,
} from './preview-manifest';

export type PreviewVerificationStatus =
  | 'verified'
  | 'blocked'
  | 'not_preview';

export interface PreviewVerificationResult {
  readonly status: PreviewVerificationStatus;
  readonly allowsMutation: boolean;
  readonly manifest: ValidatedPreviewManifest | null;
  readonly displayInfo: PreviewDisplayInfo | null;
  readonly failures: readonly PreviewManifestFailureReason[];
  readonly failureDetails: readonly string[];
}

export interface PreviewDisplayInfo {
  readonly commitShort: string;
  readonly commitFull: string;
  readonly releaseId: string;
  readonly protocolVersion: string;
  readonly chainId: number;
  readonly chainName: string;
  readonly artifactChecksumShort: string;
  readonly artifactChecksumFull: string;
  readonly apiVersion: string;
  readonly environment: string;
  readonly builtAt: string;
  readonly prNumber: number | null;
  readonly buildId: string | null;
  readonly checksumMatchesRegistry: boolean;
}

const CHAIN_NAMES: Record<number, string> = {
  11155420: 'Optimism Sepolia',
};

// ── Registry accessor — FAILS CLOSED on any shape error ──────────────────

interface RegistryAuthority {
  protocolVersion: string;
  releaseId: string;
  gitCommit: string;
  chainId: number;
  abiChecksum: string;
}

/**
 * Load the complete signed release package from the bundled registry.
 *
 * Returns null ONLY when the registry module cannot be imported at all
 * (e.g., in a stripped test environment).  Any partial/missing field also
 * returns null so callers treat it as `registry_unavailable` and BLOCK.
 */
function loadRegistryAuthority(): RegistryAuthority | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const reg = require('@/lib/contracts/registry') as {
      protocolRegistry?: {
        manifest?: {
          protocolVersion?: unknown;
          releaseId?: unknown;
          gitCommit?: unknown;
          chainId?: unknown;
        };
        checksums?: { files?: Record<string, string> };
      };
      getProtocolVersion?: () => string;
    };

    const manifest = reg.protocolRegistry?.manifest;
    const checksums = reg.protocolRegistry?.checksums;

    if (!manifest || !checksums) return null;

    const protocolVersion =
      typeof manifest.protocolVersion === 'string' && manifest.protocolVersion.trim()
        ? manifest.protocolVersion.trim()
        : null;
    const releaseId =
      typeof manifest.releaseId === 'string' && manifest.releaseId.trim()
        ? manifest.releaseId.trim()
        : null;
    const gitCommit =
      typeof manifest.gitCommit === 'string' && manifest.gitCommit.trim()
        ? manifest.gitCommit.trim()
        : null;
    const chainId =
      typeof manifest.chainId === 'number' && Number.isFinite(manifest.chainId)
        ? manifest.chainId
        : null;
    const abiChecksum =
      typeof checksums.files?.['abi/TruthBountyWeighted.json'] === 'string' &&
      checksums.files['abi/TruthBountyWeighted.json'].trim()
        ? checksums.files['abi/TruthBountyWeighted.json'].trim()
        : null;

    // All five fields are required — any missing field means no authority
    if (!protocolVersion || !releaseId || !gitCommit || !chainId || !abiChecksum) {
      return null;
    }

    return { protocolVersion, releaseId, gitCommit, chainId, abiChecksum };
  } catch {
    return null;
  }
}

// ── Display info builder ──────────────────────────────────────────────────

function buildDisplayInfo(
  manifest: ValidatedPreviewManifest,
  checksumMatchesRegistry: boolean,
): PreviewDisplayInfo {
  return {
    commitShort: manifest.gitCommit.slice(0, 7),
    commitFull: manifest.gitCommit,
    releaseId: manifest.releaseId,
    protocolVersion: manifest.protocolVersion,
    chainId: manifest.chainId,
    chainName: CHAIN_NAMES[manifest.chainId] ?? `Chain ${manifest.chainId}`,
    artifactChecksumShort: manifest.artifactChecksum.slice(0, 12),
    artifactChecksumFull: manifest.artifactChecksum,
    apiVersion: manifest.apiVersion,
    environment: manifest.environment,
    builtAt: manifest.builtAt,
    prNumber: manifest.prNumber,
    buildId: manifest.buildId,
    checksumMatchesRegistry,
  };
}

// ── Main verifier ─────────────────────────────────────────────────────────

/**
 * Verify a deployment preview against the complete signed release package.
 *
 * Pass `rawManifest` explicitly for tests/harness, or leave undefined to load
 * from environment variables.
 *
 * `nowMs` is injectable for deterministic freshness tests.
 */
export function verifyPreviewDeployment(
  rawManifest?: RawPreviewManifest | null,
  nowMs: number = Date.now(),
): PreviewVerificationResult {
  // ── Step 1: classify whether this is even a preview build ────────────
  const classification =
    rawManifest !== undefined
      ? rawManifest === null
        ? 'not_preview'          // Explicit null means caller says "not preview"
        : 'preview_has_manifest' // Any non-null object → treat as preview
      : classifyPreviewBuild();  // No argument → read env vars

  if (classification === 'not_preview') {
    return {
      status: 'not_preview',
      allowsMutation: true,
      manifest: null,
      displayInfo: null,
      failures: [],
      failureDetails: [],
    };
  }

  // ── Step 2: if classified as preview but manifest absent → BLOCKED ───
  const raw =
    rawManifest !== undefined
      ? rawManifest
      : loadPreviewManifestFromEnv();

  if (!raw || (typeof raw === 'object' && Object.keys(raw).length === 0)) {
    // Empty object supplied by harness "no params" case → treat as absent
    const isEmpty = raw !== null && typeof raw === 'object' && Object.keys(raw).length === 0;
    return {
      status: 'blocked',
      allowsMutation: false,
      manifest: null,
      displayInfo: null,
      failures: ['missing_manifest'],
      failureDetails: [
        isEmpty
          ? 'Preview manifest fields are all absent. All fields are required for preview verification.'
          : 'This build is classified as a preview deployment but no manifest was provided. Deploy with a complete NEXT_PUBLIC_PREVIEW_* configuration.',
      ],
    };
  }

  // ── Step 3: validate manifest fields ────────────────────────────────
  const validation = validatePreviewManifest(raw, nowMs);
  if (!validation.isValid || !validation.manifest) {
    return {
      status: 'blocked',
      allowsMutation: false,
      manifest: null,
      displayInfo: null,
      failures: validation.failures,
      failureDetails: validation.failureDetails,
    };
  }

  const manifest = validation.manifest;

  // ── Step 4: load registry authority — REQUIRED, never skipped ───────
  const registry = loadRegistryAuthority();
  if (!registry) {
    return {
      status: 'blocked',
      allowsMutation: false,
      manifest,
      displayInfo: buildDisplayInfo(manifest, false),
      failures: ['registry_unavailable'],
      failureDetails: [
        'Bundled release registry is unavailable or incomplete. All five authority fields ' +
          '(protocolVersion, releaseId, gitCommit, chainId, abiChecksum) are required. ' +
          'Cannot verify preview provenance without them.',
      ],
    };
  }

  // ── Step 5: exact-source checks against complete signed package ──────
  const exactFailures: PreviewManifestFailureReason[] = [];
  const exactDetails: string[] = [];

  // gitCommit — must match registry exactly (source-of-truth is the deployed build SHA)
  if (manifest.gitCommit.toLowerCase() !== registry.gitCommit.toLowerCase()) {
    exactFailures.push('commit_mismatch');
    exactDetails.push(
      `gitCommit mismatch: manifest declares "${manifest.gitCommit.slice(0, 7)}" ` +
        `but the bundled registry records "${registry.gitCommit.slice(0, 7)}". ` +
        `The preview must be built from the same commit as the release artifacts.`,
    );
  }

  // releaseId — must match registry exactly
  if (manifest.releaseId !== registry.releaseId) {
    exactFailures.push('release_id_mismatch');
    exactDetails.push(
      `releaseId mismatch: manifest declares "${manifest.releaseId}" ` +
        `but the bundled registry records "${registry.releaseId}".`,
    );
  }

  // protocolVersion — must match registry exactly
  if (manifest.protocolVersion !== registry.protocolVersion) {
    exactFailures.push('mixed_release');
    exactDetails.push(
      `protocolVersion mismatch: manifest "${manifest.protocolVersion}" ≠ ` +
        `registry "${registry.protocolVersion}". Deploy with matching artifacts.`,
    );
  }

  // chainId — must match registry exactly
  if (manifest.chainId !== registry.chainId) {
    exactFailures.push('wrong_chain');
    exactDetails.push(
      `chainId mismatch: manifest declares ${manifest.chainId} ` +
        `but the bundled registry records ${registry.chainId}.`,
    );
  }

  // artifactChecksum — must match registry ABI checksum exactly
  const checksumMatch =
    manifest.artifactChecksum.toLowerCase() === registry.abiChecksum.toLowerCase();
  if (!checksumMatch) {
    exactFailures.push('checksum_mismatch');
    exactDetails.push(
      `Artifact checksum mismatch: manifest "${manifest.artifactChecksum.slice(0, 12)}…" ≠ ` +
        `registry "${registry.abiChecksum.slice(0, 12)}…". ` +
        `The ABI this preview uses may be stale or built from different artifacts.`,
    );
  }

  if (exactFailures.length > 0) {
    return {
      status: 'blocked',
      allowsMutation: false,
      manifest,
      displayInfo: buildDisplayInfo(manifest, checksumMatch),
      failures: exactFailures,
      failureDetails: exactDetails,
    };
  }

  // ── All checks passed ─────────────────────────────────────────────────
  return {
    status: 'verified',
    allowsMutation: true,
    manifest,
    displayInfo: buildDisplayInfo(manifest, true),
    failures: [],
    failureDetails: [],
  };
}

export function isPreviewVerified(rawManifest?: RawPreviewManifest | null): boolean {
  return verifyPreviewDeployment(rawManifest).status === 'verified';
}

export function buildVerificationSummary(result: PreviewVerificationResult): string {
  if (result.status === 'not_preview') return 'Not a preview deployment.';
  if (result.status === 'verified' && result.displayInfo) {
    const d = result.displayInfo;
    return (
      `Preview verified — commit ${d.commitShort}, release ${d.releaseId}, ` +
      `chain ${d.chainName} (${d.chainId}), artifact ${d.artifactChecksumShort}…, ` +
      `API ${d.apiVersion}, env ${d.environment}`
    );
  }
  return `Preview blocked — ${result.failureDetails.join(' | ') || 'configuration incomplete or invalid.'}`;
}
