/**
 * V2 Claim Detail Projection Types — Canonical Optimism/EVM read path
 *
 * The claim detail is an API projection of on-chain claim state enriched with
 * indexer-derived verification, evidence, and settlement metadata. The API is a
 * read layer only: it never fabricates protocol state, and the contracts remain
 * authoritative for protocol mutation.
 *
 * Every envelope carries explicit projection metadata so the UI can show
 * `fresh` vs `stale` honestly instead of inventing success. Invalid projections
 * fail closed (see claim detail API implementation).
 */

import type { Claim, ClaimStatus, Evidence } from './claim';

/**
 * Projection freshness as reported by the API envelope.
 * - `fresh`: projection is current with the indexer cursor
 * - `stale`: the indexer fell behind; data shown must be marked stale
 * - `degraded`: partial data (some fields unavailable); must be visible
 */
export type ClaimDetailFreshness = 'fresh' | 'stale' | 'degraded';

/**
 * Verification record from the projection (derived from chain events + indexer state).
 */
export interface ClaimVerification {
  id: string;
  verifierAddress: string;
  decision: 'SUPPORT' | 'REJECT';
  stakeAmount: number;
  timestamp: string;
  transactionHash?: string;
  /** null when not yet finalized on-chain */
  finalizedAt?: string | null;
}

/**
 * Settlement state projection (never fabricated).
 */
export interface ClaimSettlementProjection {
  /** Null when the claim is not yet settled. */
  settledAt: string | null;
  /** Settlement transaction hash, null when not settled. */
  settlementTxHash: string | null;
  /** True when finalized per chain finality rules. */
  isFinalized: boolean;
  /** Finalization block number, null when not finalized. */
  finalizedBlock: number | null;
}

/**
 * Enriched claim detail from the canonical projection.
 */
export interface ClaimDetailProjection extends Claim {
  /** Verifications attached to this claim (may be empty for new claims). */
  verifications: ClaimVerification[];
  /** Settlement state; all fields null when not settled. */
  settlement: ClaimSettlementProjection;
  /** Reputation score of claimant (0-100), null when not yet computed. */
  claimantReputation: number | null;
  /** Vote counts derived from verifications (not fabricated). */
  voteCounts: {
    support: number;
    reject: number;
  };
  /** Confidence score (0-100), null when claim has not been scored. */
  confidenceScore: number | null;
}

/**
 * API envelope for the claim detail read path.
 */
export interface ClaimDetailEnvelope {
  claim: ClaimDetailProjection;
  projection: {
    freshness: ClaimDetailFreshness;
    /** ISO timestamp of when the projection was generated. */
    generatedAt: string;
    /** Indexer block height at projection generation. */
    indexedAtBlock: number;
    /** Chain finalized block height at projection time. */
    finalizedBlock: number;
    /** Server-reported reason when freshness is `stale` or `degraded`. */
    reason?: string;
  };
}

/**
 * Canonical, user-visible failure codes for the detail read path.
 * These map 1:1 to testable failure states in the UI.
 */
export type ClaimDetailErrorCode =
  | 'CLAIM_NOT_FOUND'
  | 'PROJECTION_UNAVAILABLE'
  | 'PROJECTION_MALFORMED'
  | 'PROJECTION_STALE'
  | 'UNSUPPORTED_CHAIN'
  | 'UNKNOWN';

export interface ClaimDetailError extends Error {
  code: ClaimDetailErrorCode;
}

export function createClaimDetailError(
  code: ClaimDetailErrorCode,
  message: string,
  cause?: unknown
): ClaimDetailError {
  const error = new Error(message) as ClaimDetailError;
  error.code = code;
  error.name = 'ClaimDetailError';
  error.cause = cause;
  return error;
}

/**
 * UI-facing view state derived from the query. The hook maps React Query
 * internals onto these explicit states so components never branch on
 * isLoading/isFetching internals themselves.
 */
export type ClaimDetailViewState =
  | 'loading'      // Initial fetch in progress
  | 'ready'        // Fresh data available
  | 'ready-stale'  // Data available but stale (must show staleness indicator)
  | 'not-found'    // Claim does not exist
  | 'error';       // Failed to fetch (network, server, or malformed projection)

/**
 * Freshness threshold configuration.
 */
export interface ClaimDetailFreshnessConfig {
  /** Projection age (ms) beyond which the view is shown as stale. */
  staleAfterMs: number;
  /** Interval (ms) for polling when claim is in mutable state. */
  pollIntervalMs: number;
}

export const CLAIM_DETAIL_FRESHNESS_DEFAULTS: ClaimDetailFreshnessConfig = {
  /** 30s: past this age the projection is treated as stale critical data. */
  staleAfterMs: 30_000,
  /** Poll every 10s when claim is in OPEN or UNDER_REVIEW state. */
  pollIntervalMs: 10_000,
};

/**
 * Type guard narrowing an unknown payload to a ClaimDetailProjection.
 */
export function isClaimDetailProjection(value: unknown): value is ClaimDetailProjection {
  if (typeof value !== 'object' || value === null) return false;
  const claim = value as Record<string, unknown>;

  // Base claim fields
  if (
    typeof claim.id !== 'string' ||
    typeof claim.title !== 'string' ||
    typeof claim.description !== 'string' ||
    typeof claim.claimantAddress !== 'string' ||
    typeof claim.status !== 'string' ||
    typeof claim.bountyAmount !== 'number' ||
    typeof claim.totalStaked !== 'number' ||
    typeof claim.createdAt !== 'string' ||
    typeof claim.updatedAt !== 'string'
  ) {
    return false;
  }

  // Verifications array
  if (!Array.isArray(claim.verifications)) return false;

  // Settlement projection
  if (
    typeof claim.settlement !== 'object' ||
    claim.settlement === null ||
    typeof (claim.settlement as Record<string, unknown>).isFinalized !== 'boolean'
  ) {
    return false;
  }

  // Vote counts
  if (
    typeof claim.voteCounts !== 'object' ||
    claim.voteCounts === null ||
    typeof (claim.voteCounts as Record<string, unknown>).support !== 'number' ||
    typeof (claim.voteCounts as Record<string, unknown>).reject !== 'number'
  ) {
    return false;
  }

  // Nullable fields
  if (
    claim.claimantReputation !== null &&
    typeof claim.claimantReputation !== 'number'
  ) {
    return false;
  }

  if (
    claim.confidenceScore !== null &&
    typeof claim.confidenceScore !== 'number'
  ) {
    return false;
  }

  return true;
}

/**
 * Type guard for ClaimDetailEnvelope.
 */
export function isClaimDetailEnvelope(value: unknown): value is ClaimDetailEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const envelope = value as Record<string, unknown>;

  if (!isClaimDetailProjection(envelope.claim)) return false;

  const projection = envelope.projection as Record<string, unknown> | undefined;
  if (
    !projection ||
    typeof projection !== 'object' ||
    (projection.freshness !== 'fresh' &&
      projection.freshness !== 'stale' &&
      projection.freshness !== 'degraded') ||
    typeof projection.generatedAt !== 'string' ||
    typeof projection.indexedAtBlock !== 'number' ||
    typeof projection.finalizedBlock !== 'number'
  ) {
    return false;
  }

  return true;
}

/**
 * Determine if a projection is considered stale based on generation time.
 */
export function isProjectionStale(
  generatedAt: string,
  staleAfterMs: number = CLAIM_DETAIL_FRESHNESS_DEFAULTS.staleAfterMs
): boolean {
  const generatedTime = new Date(generatedAt).getTime();
  const now = Date.now();
  return now - generatedTime > staleAfterMs;
}

/**
 * Derive the view state from projection freshness and data availability.
 */
export function deriveClaimDetailViewState(
  isLoading: boolean,
  isError: boolean,
  errorCode: ClaimDetailErrorCode | null,
  data: ClaimDetailEnvelope | null
): ClaimDetailViewState {
  if (isLoading && !data) return 'loading';
  if (isError && errorCode === 'CLAIM_NOT_FOUND') return 'not-found';
  if (isError || !data) return 'error';

  const isStale =
    data.projection.freshness === 'stale' ||
    data.projection.freshness === 'degraded' ||
    isProjectionStale(data.projection.generatedAt);

  return isStale ? 'ready-stale' : 'ready';
}
