/**
 * V2-FE-064 — Deployment Preview Manifest Types & Validation
 *
 * Defines the authoritative shape of a deployment preview manifest and the
 * fail-closed validation rules applied before any preview surface renders.
 *
 * Dependency note: this module is keyed UI-FE-064 and is gated behind the
 * open dependencies #559 (canonical environment contract) and #560
 * (verifiable contract provenance). Until those land, the preview
 * classification falls back to `pending_dependencies` (blocked). This module
 * NEVER defines its own interim authority — all provenance anchors come from
 * the bundled release registry (`src/lib/contracts/registry`).
 *
 * Fail-closed invariants:
 *  - A classified preview build with an absent manifest is BLOCKED
 *    (not transparent). Use `classifyPreviewBuild()` to distinguish
 *    "not a preview" from "preview with missing manifest".
 *  - Missing registry authority (checksums / version / releaseId / chain /
 *    gitCommit) BLOCKS — never silently skips the comparison.
 *  - Production chains (10), production API origins, production environment
 *    flags, all-zero commit SHAs, and stale builtAt timestamps all BLOCK.
 *  - No wallet, transaction, finality, permission, health, or legal state is
 *    fabricated.
 */

/** Supported non-production chain IDs for preview deployments. */
export const PREVIEW_SUPPORTED_CHAIN_IDS = [11155420] as const;
export type PreviewSupportedChainId = (typeof PREVIEW_SUPPORTED_CHAIN_IDS)[number];

/** Classification of the deployment environment. */
export type DeploymentEnvironment = 'preview' | 'staging' | 'development' | 'production';

/**
 * Independent preview-build classification.
 *
 * `not_preview`           — no preview indicator present; treat as regular build.
 * `preview_no_manifest`   — classified as a preview build but manifest is absent → BLOCKED.
 * `preview_has_manifest`  — classified as a preview build and a manifest object is present.
 *
 * The distinction between `not_preview` and `preview_no_manifest` is what
 * the first review identified as a fail-open gap: previously both cases
 * produced `not_preview` which allowed mutations.
 */
export type PreviewBuildClassification =
  | 'not_preview'
  | 'preview_no_manifest'
  | 'preview_has_manifest';

/** Failure category when manifest validation or registry binding fails. */
export type PreviewManifestFailureReason =
  | 'missing_manifest'
  | 'incomplete_manifest'
  | 'wrong_chain'
  | 'production_endpoint'
  | 'stale_release'
  | 'stale_abi'
  | 'production_targeting'
  | 'mixed_release'
  | 'checksum_mismatch'
  | 'invalid_commit'
  | 'commit_mismatch'
  | 'release_id_mismatch'
  | 'stale_built_at'
  | 'registry_unavailable'
  | 'pending_dependencies';

/**
 * Raw deployment preview manifest.  All fields are `unknown` at the trust
 * boundary — validate before trusting any value.
 */
export interface RawPreviewManifest {
  gitCommit?: unknown;
  releaseId?: unknown;
  protocolVersion?: unknown;
  chainId?: unknown;
  artifactChecksum?: unknown;
  apiUrl?: unknown;
  apiVersion?: unknown;
  environment?: unknown;
  builtAt?: unknown;
  prNumber?: unknown;
  buildId?: unknown;
}

/**
 * Validated manifest with strong types.
 * Only produced by `validatePreviewManifest` — never constructed directly.
 */
export interface ValidatedPreviewManifest {
  readonly gitCommit: string;
  readonly releaseId: string;
  readonly protocolVersion: string;
  readonly chainId: PreviewSupportedChainId;
  readonly artifactChecksum: string;
  readonly apiUrl: string;
  readonly apiVersion: string;
  readonly environment: Exclude<DeploymentEnvironment, 'production'>;
  readonly builtAt: string;
  readonly prNumber: number | null;
  readonly buildId: string | null;
}

export interface PreviewManifestValidationResult {
  readonly isValid: boolean;
  readonly manifest: ValidatedPreviewManifest | null;
  readonly failures: readonly PreviewManifestFailureReason[];
  readonly failureDetails: readonly string[];
}

// ── Approved non-production endpoint allowlist ────────────────────────────
// This is an approved-endpoint contract, not a blocklist.
// A preview apiUrl is valid ONLY when its origin matches one of these
// approved non-production patterns.  Everything else is rejected.
// When #559 (canonical environment contract) lands, this list should be
// replaced by consumption of that contract's exported allowlist.
const APPROVED_PREVIEW_API_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?(\/|$)/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?(\/|$)/,
  /\.(staging|preview|dev|test|internal)\./,
  /-(staging|preview|dev|test|pr-\d+)\./,
  /vercel\.app(\/|$)/,
  /netlify\.app(\/|$)/,
  /render\.com(\/|$)/,
  /fly\.dev(\/|$)/,
  /railway\.app(\/|$)/,
] as const;

/** Production origins that must never be targeted by a preview build. */
const PRODUCTION_API_PATTERNS = [
  /^https?:\/\/([a-z0-9-]+\.)*truthbounty\.io(\/|$)/i,
  /^https?:\/\/api\.truthbounty/i,
] as const;

const PLACEHOLDER_COMMIT_RE = /^0+$/;
const VALID_COMMIT_RE = /^[0-9a-f]{7,40}$/i;
const VALID_CHECKSUM_RE = /^[0-9a-f]{64}$/i;

/** Maximum age (ms) a preview build timestamp may be before it is stale. */
const MAX_PREVIEW_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isApprovedPreviewOrigin(url: string): boolean {
  try {
    const parsed = new URL(url);
    const full = parsed.href;
    if (PRODUCTION_API_PATTERNS.some((re) => re.test(full))) return false;
    return APPROVED_PREVIEW_API_PATTERNS.some((re) => re.test(full));
  } catch {
    return false;
  }
}

function isProductionOrigin(url: string): boolean {
  try {
    return PRODUCTION_API_PATTERNS.some((re) => re.test(url));
  } catch {
    return false;
  }
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPreviewSupportedChain(chainId: number): chainId is PreviewSupportedChainId {
  return (PREVIEW_SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
}

function isValidIso8601(value: string): boolean {
  const ts = Date.parse(value);
  return Number.isFinite(ts) && !Number.isNaN(ts);
}

function isBuiltAtFresh(builtAt: string, nowMs: number): boolean {
  const ts = Date.parse(builtAt);
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts <= MAX_PREVIEW_AGE_MS;
}

/**
 * Validate a raw preview manifest.  Fail closed on every anomaly.
 * `nowMs` is injectable for deterministic tests (defaults to `Date.now()`).
 */
export function validatePreviewManifest(
  raw: RawPreviewManifest | null | undefined,
  nowMs: number = Date.now(),
): PreviewManifestValidationResult {
  const failures: PreviewManifestFailureReason[] = [];
  const failureDetails: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      manifest: null,
      failures: ['missing_manifest'],
      failureDetails: ['Preview manifest is absent or not an object.'],
    };
  }

  // gitCommit
  const gitCommit =
    typeof raw.gitCommit === 'string' ? raw.gitCommit.trim() : '';
  if (!gitCommit || !VALID_COMMIT_RE.test(gitCommit) || PLACEHOLDER_COMMIT_RE.test(gitCommit)) {
    failures.push('invalid_commit');
    failureDetails.push(
      `gitCommit is missing, zero-padded, or not a valid 7–40 hex SHA: "${raw.gitCommit ?? ''}".`,
    );
  }

  // releaseId
  const releaseId =
    typeof raw.releaseId === 'string' ? raw.releaseId.trim() : '';
  if (!releaseId) {
    failures.push('incomplete_manifest');
    failureDetails.push('releaseId is missing or empty.');
  }

  // protocolVersion
  const protocolVersion =
    typeof raw.protocolVersion === 'string' ? raw.protocolVersion.trim() : '';
  if (!protocolVersion) {
    failures.push('incomplete_manifest');
    failureDetails.push('protocolVersion is missing or empty.');
  }

  // chainId
  const rawChainId =
    typeof raw.chainId === 'number'
      ? raw.chainId
      : typeof raw.chainId === 'string'
        ? parseInt(raw.chainId, 10)
        : NaN;
  const chainIdValid = Number.isFinite(rawChainId) && !Number.isNaN(rawChainId);
  if (!chainIdValid) {
    failures.push('wrong_chain');
    failureDetails.push(`chainId is missing or not a number: "${raw.chainId ?? ''}".`);
  } else if (rawChainId === 10) {
    failures.push('production_targeting');
    failureDetails.push(
      `chainId 10 (Optimism Mainnet) is a production chain. Preview deployments must target Optimism Sepolia (11155420).`,
    );
  } else if (!isPreviewSupportedChain(rawChainId)) {
    failures.push('wrong_chain');
    failureDetails.push(
      `chainId ${rawChainId} is not a supported preview chain. Only Optimism Sepolia (11155420) is allowed.`,
    );
  }

  // artifactChecksum
  const artifactChecksum =
    typeof raw.artifactChecksum === 'string' ? raw.artifactChecksum.trim() : '';
  if (!artifactChecksum || !VALID_CHECKSUM_RE.test(artifactChecksum)) {
    failures.push('stale_abi');
    failureDetails.push(
      `artifactChecksum is missing or not a valid 64-char hex SHA-256: "${raw.artifactChecksum ?? ''}".`,
    );
  }

  // apiUrl — approved-endpoint contract (not a blocklist)
  const apiUrl =
    typeof raw.apiUrl === 'string' ? raw.apiUrl.trim() : '';
  if (!apiUrl || !isValidUrl(apiUrl)) {
    failures.push('incomplete_manifest');
    failureDetails.push(`apiUrl is missing or not a valid HTTP/HTTPS URL: "${raw.apiUrl ?? ''}".`);
  } else if (isProductionOrigin(apiUrl)) {
    failures.push('production_endpoint');
    failureDetails.push(
      `apiUrl "${apiUrl}" matches a known production origin. Preview builds must not target production API endpoints.`,
    );
  } else if (!isApprovedPreviewOrigin(apiUrl)) {
    failures.push('production_endpoint');
    failureDetails.push(
      `apiUrl "${apiUrl}" does not match any approved non-production origin pattern. ` +
        `Preview builds must use a staging, preview, dev, localhost, or known-PaaS endpoint.`,
    );
  }

  // apiVersion
  const apiVersion =
    typeof raw.apiVersion === 'string' ? raw.apiVersion.trim() : '';
  if (!apiVersion) {
    failures.push('incomplete_manifest');
    failureDetails.push('apiVersion is missing or empty.');
  }

  // environment
  const environment =
    typeof raw.environment === 'string' ? raw.environment.trim() : '';
  if (!environment) {
    failures.push('incomplete_manifest');
    failureDetails.push('environment is missing or empty.');
  } else if (environment === 'production') {
    failures.push('production_targeting');
    failureDetails.push(
      'environment is set to "production". Preview builds must not declare a production environment.',
    );
  } else if (!['preview', 'staging', 'development'].includes(environment)) {
    failures.push('incomplete_manifest');
    failureDetails.push(
      `environment "${environment}" is not a valid non-production value (expected: preview, staging, development).`,
    );
  }

  // builtAt — parseable AND fresh
  const builtAt =
    typeof raw.builtAt === 'string' ? raw.builtAt.trim() : '';
  if (!builtAt || !isValidIso8601(builtAt)) {
    failures.push('incomplete_manifest');
    failureDetails.push(`builtAt is missing or not a valid ISO-8601 timestamp: "${raw.builtAt ?? ''}".`);
  } else if (!isBuiltAtFresh(builtAt, nowMs)) {
    failures.push('stale_built_at');
    failureDetails.push(
      `builtAt "${builtAt}" is older than ${MAX_PREVIEW_AGE_MS / 86400000} days. ` +
        `Redeploy with a fresh build to continue.`,
    );
  }

  const uniqueFailures = [...new Set(failures)] as PreviewManifestFailureReason[];

  if (uniqueFailures.length > 0) {
    return { isValid: false, manifest: null, failures: uniqueFailures, failureDetails };
  }

  return {
    isValid: true,
    manifest: {
      gitCommit,
      releaseId,
      protocolVersion,
      chainId: rawChainId as PreviewSupportedChainId,
      artifactChecksum,
      apiUrl,
      apiVersion,
      environment: environment as Exclude<DeploymentEnvironment, 'production'>,
      builtAt,
      prNumber:
        typeof raw.prNumber === 'number' && Number.isFinite(raw.prNumber)
          ? raw.prNumber
          : typeof raw.prNumber === 'string' && !isNaN(parseInt(raw.prNumber, 10))
            ? parseInt(raw.prNumber, 10)
            : null,
      buildId:
        typeof raw.buildId === 'string' && raw.buildId.trim()
          ? raw.buildId.trim()
          : null,
    },
    failures: [],
    failureDetails: [],
  };
}

// ── Preview-build classification ──────────────────────────────────────────

/**
 * Determine whether the current build is a preview deployment, independent
 * of whether a manifest is present.
 *
 * A build is classified as a preview when ANY of the following are set:
 *   NEXT_PUBLIC_PREVIEW_ENVIRONMENT
 *   NEXT_PUBLIC_PREVIEW_GIT_COMMIT
 *   NEXT_PUBLIC_PREVIEW_RELEASE_ID
 *   NEXT_PUBLIC_APP_ENV=preview|staging  (used by existing feature-flag system)
 *
 * This is separate from `loadPreviewManifestFromEnv` so that a preview build
 * with an absent or incomplete manifest returns `preview_no_manifest`
 * (blocked) rather than `not_preview` (transparent pass-through).
 */
export function classifyPreviewBuild(): PreviewBuildClassification {
  const explicitEnv = process.env.NEXT_PUBLIC_PREVIEW_ENVIRONMENT;
  const explicitCommit = process.env.NEXT_PUBLIC_PREVIEW_GIT_COMMIT;
  const explicitRelease = process.env.NEXT_PUBLIC_PREVIEW_RELEASE_ID;
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV;

  const isPreviewBuild = Boolean(
    explicitEnv || explicitCommit || explicitRelease ||
    appEnv === 'preview' || appEnv === 'staging',
  );

  if (!isPreviewBuild) return 'not_preview';

  // It is a preview build — check whether a manifest is loadable
  const raw = loadPreviewManifestFromEnv();
  if (!raw) return 'preview_no_manifest';
  return 'preview_has_manifest';
}

/**
 * Load raw manifest from `NEXT_PUBLIC_PREVIEW_*` env vars.
 * Returns null only when genuinely no preview vars are set.
 */
export function loadPreviewManifestFromEnv(): RawPreviewManifest | null {
  const gitCommit = process.env.NEXT_PUBLIC_PREVIEW_GIT_COMMIT;
  const releaseId = process.env.NEXT_PUBLIC_PREVIEW_RELEASE_ID;
  const protocolVersion = process.env.NEXT_PUBLIC_PREVIEW_PROTOCOL_VERSION;
  const chainId = process.env.NEXT_PUBLIC_PREVIEW_CHAIN_ID;
  const artifactChecksum = process.env.NEXT_PUBLIC_PREVIEW_ARTIFACT_CHECKSUM;
  const apiUrl = process.env.NEXT_PUBLIC_PREVIEW_API_URL;
  const apiVersion = process.env.NEXT_PUBLIC_PREVIEW_API_VERSION;
  const environment = process.env.NEXT_PUBLIC_PREVIEW_ENVIRONMENT;
  const builtAt = process.env.NEXT_PUBLIC_PREVIEW_BUILT_AT;
  const prNumber = process.env.NEXT_PUBLIC_PREVIEW_PR_NUMBER;
  const buildId = process.env.NEXT_PUBLIC_PREVIEW_BUILD_ID;

  if (!gitCommit && !releaseId && !environment) return null;

  return {
    gitCommit,
    releaseId,
    protocolVersion,
    chainId: chainId ? parseInt(chainId, 10) : undefined,
    artifactChecksum,
    apiUrl,
    apiVersion,
    environment,
    builtAt,
    prNumber: prNumber ? parseInt(prNumber, 10) : undefined,
    buildId,
  };
}
