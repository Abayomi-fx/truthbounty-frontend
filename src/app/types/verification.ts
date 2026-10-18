
export type VerificationDecision = 'VERIFY' | 'REJECT';

export type VerificationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED';

export interface Verification {
  id: string;

  claimId: string;
  verifierAddress: string;

  decision: VerificationDecision;

  stakeAmount: number;

  status: VerificationStatus;

  transactionHash?: string;

  createdAt: string;
  confirmedAt?: string;
}

// ---------------------------------------------------------------------------
// V2-FE-013 — EVM verification & stake submission types
// ---------------------------------------------------------------------------

/**
 * Canonical True/False verification position encoded on-chain as
 * `VerificationVerdict` (TRUE = 0, FALSE = 1).
 */
export type VerificationPosition = 'TRUE' | 'FALSE';

/**
 * Active verification round parameters for a claim.
 *
 * `minStake` and `deadline` are enforced on-chain by the canonical
 * `VerificationSubmission` contract (V2-SC-010). `maxStake` and
 * `perWalletWeightCap` are protocol parameters published in the versioned
 * deployment release; they are `null` until such a release is pinned so the
 * hook never guesses protocol caps.
 */
export interface VerificationRoundParams {
  /** Active round identifier for the claim (0 when no round is open). */
  roundId: bigint;
  /** Round start time (unix seconds). */
  startTime: bigint;
  /** Verification deadline (unix seconds) — enforced on-chain. */
  deadline: bigint;
  /** Contract-enforced minimum stake (wei). */
  minStake: bigint;
  /** Protocol cap for a single verifier stake (wei); `null` when unpublished. */
  maxStake: bigint | null;
  /** Protocol per-wallet weight cap (wei); `null` when unpublished. */
  perWalletWeightCap: bigint | null;
  /** Protocol parameter version; `null` when unpublished. */
  parameterVersion: bigint | null;
  /** Whether the claim is in an open verification window right now. */
  isOpen: boolean;
}

/**
 * Raw on-chain verification record (`IVerificationSubmission.Verification`).
 * `verdict` is the enum-encoded uint8: 0 = TRUE, 1 = FALSE.
 */
export interface OnChainVerification {
  id: bigint;
  claimId: bigint;
  verifier: `0x${string}`;
  verdict: number;
  stake: bigint;
  submittedAt: bigint;
}

/**
 * Effective on-chain position of a verifier for a claim, derived from the
 * canonical registry without fabricating anything.
 */
export interface EffectiveOnChainPosition {
  claimId: string;
  verifier: `0x${string}` | null;
  exists: boolean;
  position: VerificationPosition | null;
  stake: bigint;
}

/**
 * API projection entity returned by the V2-BE-026 verifications endpoint.
 */
export interface VerificationProjection {
  id: string;
  claimId: string;
  verifierAddress: string;
  decision: VerificationDecision;
  stakeAmount: number;
  status: VerificationStatus;
  transactionHash?: string;
  chainId?: number;
  artifactVersion?: string;
  createdAt: string;
  confirmedAt?: string;
}

// ---------------------------------------------------------------------------
// UI-FE-018 — Stake and effective-weight review types
// ---------------------------------------------------------------------------

/**
 * Freshness label for contract-sourced review data. Only `'fresh'` data may
 * authorize a review; every other state renders the review as unavailable.
 */
export type EconomicReviewFreshness =
  | 'fresh'
  | 'stale'
  | 'unavailable'
  | 'inconsistent';

/**
 * Source of a review value. Contract values are canonical; API values are
 * freshness-labelled projection data and never authorize a vote.
 */
export type EconomicReviewSource = 'contract' | 'api' | 'unavailable';

/**
 * Lossless value with exact units and provenance. `raw` preserves the exact
 * integer string (wei) so no precision is lost; `display` is a formatted
 * string for presentation only and must never be parsed back.
 */
export interface EconomicReviewValue {
  /** Exact integer value as a decimal string (wei for token amounts). */
  raw: string | null;
  /** Human-readable formatted value; presentation only. */
  display: string | null;
  /** Unit label, e.g. `'wei'`, `'TBY'`, or `'weight'`. */
  unit: string;
  /** Provenance of the value. */
  source: EconomicReviewSource;
}

/**
 * Adjustment inputs applied to raw stake to derive effective weight. Inputs
 * are contract-sourced; `null` means the input is unpublished and the review
 * must render as unavailable.
 */
export interface EconomicReviewAdjustment {
  /** Adjustment identifier, e.g. `'reputationMultiplier'. */
  id: string;
  /** Human-readable label for the adjustment. */
  label: string;
  /** Exact adjustment value as a decimal string; `null` when unpublished. */
  raw: string | null;
  /** Unit label for the adjustment, e.g. `'bps'` or `'x'`. */
  unit: string;
  /** Provenance of the adjustment input. */
  source: EconomicReviewSource;
}

/**
 * Reward range projection for a verification position. Bounds are exact
 * integer strings; `null` bounds indicate an unpublished range.
 */
export interface EconomicReviewRewardRange {
  min: EconomicReviewValue;
  max: EconomicReviewValue;
}

/**
 * Slashing exposure for a verification position. `maxLoss` is the maximum
 * amount at risk; `null` when unpublished.
 */
export interface EconomicReviewSlashingExposure {
  maxLoss: EconomicReviewValue;
  /** Whether the position is currently slashable. */
  isSlashable: boolean;
}

/**
 * Contract-sourced economic review for a verification position. This is the
 * only shape that may authorize a vote; API estimates never do.
 */
export interface EconomicReview {
  claimId: string;
  verifier: `0x${string}` | null;
  /** Raw stake submitted by the verifier. */
  rawStake: EconomicReviewValue;
  /** Adjustment inputs applied to raw stake. */
  adjustments: EconomicReviewAdjustment[];
  /** Effective weight derived from raw stake and adjustments. */
  effectiveWeight: EconomicReviewValue;
  /** Reward range for the position. */
  rewardRange: EconomicReviewRewardRange;
  /** Slashing exposure for the position. */
  slashingExposure: EconomicReviewSlashingExposure;
  /** Freshness of the review data. */
  freshness: EconomicReviewFreshness;
  /** Contract parameter version the review was derived from; `null` when unpublished. */
  parameterVersion: bigint | null;
  /** Block number the review was derived at; `null` when unpublished. */
  blockNumber: bigint | null;
  /** Human-readable diagnostics for stale/unavailable/inconsistent states. */
  diagnostics: string[];
}

/**
 * A contract input that changed between review derivation and authorization.
 * When any input is present, the review must be re-derived and cannot
 * authorize a vote.
 */
export interface EconomicReviewChangedInput {
  /** Identifier of the changed input, e.g. `'minStake'` or `'parameterVersion'`. */
  id: string;
  /** Human-readable label for the changed input. */
  label: string;
  /** Previous exact value as a decimal string; `null` when previously unpublished. */
  previousRaw: string | null;
  /** Current exact value as a decimal string; `null` when now unpublished. */
  currentRaw: string | null;
  /** Unit label for the input. */
  unit: string;
}

/**
 * Authorization state for an economic review. Only `'authorizedg` permits a
 * vote; every other state renders the review as unavailable.
 */
export type EconomicReviewAuthorization =
  | 'authorized'
  | 'unavailable'
  | 'stale'
  | 'inconsistent'
  | 'changed';

/**
 * Result of evaluating an economic review for authorization. `changed`
 * indicates contract inputs changed before authorization and the review must
 * be re-derived.
 */
export interface EconomicReviewEvaluation {
  authorization: EconomicReviewAuthorization;
  /** Whether the review may authorize a vote. */
  canAuthorize: boolean;
  /** Reasons the review is not authorized; empty when authorized. */
  reasons: string[];
}

/**
 * Phases of the verification submission state machine.
 */
export type VerificationSubmissionPhase =
  | 'idle'
  | 'validating'
  | 'allowance'
  | 'approving'
  | 'simulating'
  | 'confirming'
  | 'reconciling'
  | 'confirmed'
  | 'rejected'
  | 'stale'
  | 'degraded'
  | 'mismatch'
  | 'error';

export interface VerificationReconciliation {
  status: 'confirmed' | 'rejected' | 'stale' | 'degraded' | 'mismatch' | 'idle';
  isMismatch: boolean;
  isWrongNetwork: boolean;
  isProtocolDisabled: boolean;
  details: string[];
}

export type VerificationSubmissionErrorCode =
  | 'UNCONNECTED'
  | 'WRONG_NETWORK'
  | 'PROTOCOL_DISABLED'
  | 'INVALID_CLAIM'
  | 'INVALID_POSITION'
  | 'ALREADY_VERIFIED'
  | 'VERIFICATION_CLOSED'
  | 'STAKE_BELOW_MIN'
  | 'STAKE_ABOVE_MAX'
  | 'DEADLINE_PASSED'
  | 'APPROVAL_REJECTED'
  | 'SIMULATION_REVERTED'
  | 'SUBMISSION_REJECTED'
  | 'RECONCILE_FAILED';

export interface VerificationSubmissionError {
  code: VerificationSubmissionErrorCode;
  message: string;
}

/**
 * Payload posted to the API projection endpoint after on-chain confirmation.
 * Amounts are expressed in whole token units for the API projection and are
 * converted from exact integer (wei) amounts before serialization.
 */
export interface VerificationSubmissionRequest {
  claimId: string;
  verifierAddress: string;
  decision: VerificationDecision;
  stakeAmount: number;
  transactionHash: string;
  chainId: number;
  artifactVersion: string;
  submittedAt: string;
}

export const VERIFICATION_VERDICT = {
  TRUE: 0,
  FALSE: 1,
} as const;

export type VerificationVerdictValue =
  (typeof VERIFICATION_VERDICT)[keyof typeof VERIFICATION_VERDICT];
