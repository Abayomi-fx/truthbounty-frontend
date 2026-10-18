/**
 * UI-FE-022 — Dispute eligibility & evidence-entry types.
 *
 * Authority model (non-negotiable):
 *   - Contracts are canonical for every mutation gate. `DisputeEligibility`
 *     is derived exclusively from contract reads (`DisputeContractSnapshot`).
 *   - API data is a freshness-labelled projection overlay
 *     (`DisputeProjectionOverlay`) and NEVER grants eligibility or authority.
 *   - Wallet connection, UI context, or fixtures never grant authority either;
 *     they only feed the derivation inputs that the contract data gates.
 */

import type { DisputeArtifact } from '@/config/protocol/dispute-artifact';

// ---------------------------------------------------------------------------
// On-chain mirrors
// ---------------------------------------------------------------------------

/**
 * Mirror of `IDisputeRegistry.ClaimPhase` (enum-encoded uint8 on-chain):
 * NONE = 0, VERIFICATION = 1, DISPUTE_WINDOW = 2, DISPUTE_ACTIVE = 3,
 * FINALIZED = 4.
 */
export const DISPUTE_CLAIM_PHASE = {
  NONE: 0,
  VERIFICATION: 1,
  DISPUTE_WINDOW: 2,
  DISPUTE_ACTIVE: 3,
  FINALIZED: 4,
} as const;

export type DisputeClaimPhaseName =
  keyof typeof DISPUTE_CLAIM_PHASE;

/** Raw on-chain dispute record (`IDisputeRegistry.getDispute`). */
export interface OnChainDisputeRecord {
  /** 0 when no dispute exists for the claim. */
  disputeId: bigint;
  challenger: `0x${string}`;
  openedAt: bigint;
}

/** On-chain dispute window (`IDisputeRegistry.disputeWindow`), unix seconds. */
export interface OnChainDisputeWindow {
  opensAt: bigint;
  closesAt: bigint;
}

/**
 * Contract-derived snapshot for a claim. This is the ONLY input that may
 * gate a dispute mutation. Every field is read from the pinned contracts;
 * nothing here is selected, estimated, or projected.
 */
export interface DisputeContractSnapshot {
  claimId: string;
  chainId: number;
  /** Block number the reads were observed at (chain authority timestamp). */
  observedAtBlock: bigint;
  phase: DisputeClaimPhaseName;
  dispute: OnChainDisputeRecord;
  window: OnChainDisputeWindow;
  /** Required bond in wei, from `requiredDisputeBond(claimId)`. */
  requiredBond: bigint;
  /** Bond-token balance of the connected account (ERC-20 `balanceOf`). */
  accountBalance: bigint | null;
}

// ---------------------------------------------------------------------------
// Freshness-labelled projection overlay (non-authoritative)
// ---------------------------------------------------------------------------

/**
 * API projection data shown alongside contract state. It is labelled with
 * its source and fetch time so the UI can present freshness honestly, and it
 * never participates in eligibility derivation.
 */
export interface DisputeProjectionOverlay {
  source: 'api-projection';
  /** ISO 8601 timestamp of when the projection was fetched. */
  asOf: string;
  claimId: string;
  status?: string;
  disputeCount?: number;
}

// ---------------------------------------------------------------------------
// Eligibility derivation (contract-derived, never selected)
// ---------------------------------------------------------------------------

export type DisputeEligibility =
  /** Contract authority is not pinned; mutation is unavailable. */
  | { status: 'protocol-unpinned'; reasons: string[] }
  /** Wallet is on an unsupported chain. */
  | { status: 'unsupported-chain'; chainId: number; supportedChains: number[] }
  /** No wallet connected — reads that need an account are unavailable. */
  | { status: 'wallet-not-connected' }
  /** Contract reads have not resolved yet; no guess is rendered. */
  | { status: 'loading' }
  /** Claim is not in the dispute window phase. */
  | {
      status: 'unsupported-phase';
      phase: DisputeClaimPhaseName;
      phaseLabel: string;
    }
  /** A dispute already exists on-chain for this claim. */
  | {
      status: 'existing-dispute';
      disputeId: string;
      challenger: string;
      openedAt: string;
    }
  /** The dispute window has closed on-chain. */
  | { status: 'expired-window'; windowEnd: string }
  /** The dispute window has not opened yet on-chain. */
  | { status: 'window-not-open'; windowStart: string }
  /**
   * The required bond changed since the draft was created (or was never
   * pinned in the draft). The mutation stays unavailable until the current
   * contract bond is explicitly acknowledged.
   */
  | {
      status: 'bond-changed';
      requiredBond: string;
      bondAtDraft: string | null;
    }
  /** Connected account cannot cover the contract-required bond. */
  | { status: 'insufficient-balance'; requiredBond: string; balance: string }
  /** Every contract-derived gate passed; mutation may be attempted. */
  | {
      status: 'eligible';
      requiredBond: string;
      windowEnd: string;
      observedAtBlock: string;
    };

export type DisputeEligibilityStatus = DisputeEligibility['status'];

// ---------------------------------------------------------------------------
// Evidence entry (SEC-FE-007 security & privacy semantics)
// ---------------------------------------------------------------------------

export interface DisputeEvidenceEntry {
  uri: string;
  /** Optional SHA-256 digest of the linked content (hex, 0x-optional). */
  digest?: string;
}

export type EvidenceProblemCode =
  | 'empty'
  | 'invalid-url'
  | 'unsupported-scheme'
  | 'oversized'
  | 'secret-material'
  | 'invalid-digest'
  | 'too-many-entries';

export interface EvidenceProblem {
  code: EvidenceProblemCode;
  message: string;
  /** The entry index the problem refers to, or null for set-level problems. */
  entryIndex: number | null;
}

export interface EvidenceSetValidation {
  isValid: boolean;
  problems: EvidenceProblem[];
  /** Entries that passed every integrity check. */
  usable: DisputeEvidenceEntry[];
  rejected: DisputeEvidenceEntry[];
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

/** Current dispute draft schema version. */
export const DISPUTE_DRAFT_VERSION = 1 as const;

/**
 * A locally persisted dispute draft. Drafts are user convenience only: they
 * never grant authority, and they must never contain prohibited secrets
 * (private keys, mnemonics, session/API tokens, credentials).
 */
export interface DisputeDraftV1 {
  version: typeof DISPUTE_DRAFT_VERSION;
  claimId: string;
  reason: string;
  evidence: DisputeEvidenceEntry[];
  /** Bond (wei) observed from the contract when the draft was last saved. */
  bondAtDraft: string | null;
  /** ISO 8601 timestamp of the last save. */
  updatedAt: string;
}

export interface DisputeDraftInput {
  claimId: string;
  reason: string;
  evidence: DisputeEvidenceEntry[];
  bondAtDraft: bigint | string | null;
  updatedAt: string;
}

export interface SanitizedDisputeDraft {
  draft: DisputeDraftV1;
  /** Number of secret occurrences redacted from the reason text. */
  redactions: number;
  /** Evidence entries dropped by the integrity checks on save. */
  droppedEvidence: DisputeEvidenceEntry[];
}

// ---------------------------------------------------------------------------
// Composition inputs / outputs
// ---------------------------------------------------------------------------

/** Payload handed to the mutation layer when — and only when — eligible. */
export interface DisputeEntrySubmission {
  claimId: string;
  reason: string;
  evidence: DisputeEvidenceEntry[];
  /** Exact contract-required bond in wei (bigint string). */
  bondAmount: string;
  /** Pinned contract authority used for the mutation. */
  artifact: DisputeArtifact;
}
