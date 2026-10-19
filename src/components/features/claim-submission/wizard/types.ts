/**
 * UI-FE-012 — Typed inputs for evidence/funding wizard compositions.
 *
 * These types define the presentation contract for the EvidenceUploadStep
 * and FundingReviewStep compositions. They are intentionally adapter-agnostic:
 * the compositions receive availability boundaries and canonical data via
 * props and never fabricate values when an adapter is missing.
 *
 * Authority model:
 *  - Contract state is canonical for mutations.
 *  - API data is a freshness-labelled projection.
 *  - Missing adapters render `unavailable`, never simulated success.
 *  - Exact integer amounts (bigint) are preserved — never rounded.
 */

import type { Hex, Address } from 'viem';

// ---------------------------------------------------------------------------
// Shared availability primitive
// ---------------------------------------------------------------------------

/**
 * Discriminated union for whether a backing adapter is present and pinned.
 * Compositions use this to decide between enabled controls and the explicit
 * unavailable rendering (disabled + aria-disabled + explanatory copy).
 */
export type AdapterAvailability =
  | { available: true; pinnedReference: string }
  | {
      available: false;
      /** Human-readable reason shown to the user. */
      reason: string;
      /** Optional issue/adapter identifier for traceability. */
      adapterIssue?: string;
    };

// ---------------------------------------------------------------------------
// Evidence upload step
// ---------------------------------------------------------------------------

/**
 * Integrity evidence for a verified file upload.
 * Exposes the content-addressed identifier (CID) and source integrity without
 * leaking the raw digest to logs (callers use redactDigest for telemetry).
 */
export interface EvidenceIntegrity {
  /** Content-addressed reference, e.g. `sha256:<digest>`. Never logged raw. */
  contentIdentifier: string;
  /** True when the local SHA-256 matches the server-reported digest. */
  integrityVerified: boolean;
  /** Sanitized file name (extension only, privacy-preserving). */
  sanitizedFileName: string;
  /** Exact file size in bytes (integer, never rounded). */
  fileSizeBytes: number;
  /** MIME type captured at selection time. */
  mimeType: string;
}

/**
 * Source metadata for a URL-based evidence reference.
 * The full URL is never rendered inline; only the privacy-preserving label
 * is displayed. Full URL available via clipboard.
 */
export interface EvidenceSourceMetadata {
  /** Privacy-preserving display label, e.g. "evidence from example.com". */
  sanitizedLabel: string;
  /** Full URL available for clipboard copy (never rendered inline). */
  fullUrl: string;
  /** True when the URL passed HTTPS validation. */
  isValid: boolean;
}

/**
 * Discriminated union for the evidence upload step state.
 * Each variant maps to a distinct, accessible UI rendering.
 */
export type EvidenceUploadStepState =
  | { status: 'idle' }
  | { status: 'validating' }
  | { status: 'hashing'; progress: number }
  | { status: 'uploading'; progress: number }
  | { status: 'verifying' }
  | {
      status: 'verified';
      integrity: EvidenceIntegrity;
    }
  | {
      status: 'url-verified';
      source: EvidenceSourceMetadata;
    }
  | { status: 'failed'; error: string; retryable: boolean }
  | { status: 'cancelled' }
  | { status: 'invalidated'; reason: string };

export interface EvidenceUploadStepProps {
  /** Current evidence upload state. */
  state: EvidenceUploadStepState;
  /** Upload adapter availability. Missing → unavailable rendering. */
  uploadAvailable: AdapterAvailability;
  /** Whether the user can proceed to the next step. */
  canProceed: boolean;
  /** Called when the user selects a file for upload. */
  onFileSelect: (file: File) => void;
  /** Called when the user enters an evidence URL. */
  onUrlEnter: (url: string) => void;
  /** Called when the user retries a failed upload. */
  onRetry: () => void;
  /** Called when the user cancels an in-flight upload. */
  onCancel: () => void;
  /** Called when the user clears the current evidence to start over. */
  onReset: () => void;
  /** Navigate to the next step. */
  onNext: () => void;
  /** Navigate to the previous step. */
  onBack: () => void;
  /** Cancel the entire wizard. */
  onCancelWizard: () => void;
}

// ---------------------------------------------------------------------------
// Funding review step
// ---------------------------------------------------------------------------

/**
 * Canonical funding requirement for claim submission.
 * All amounts are exact integers (bigint) — never rounded or fabricated.
 */
export interface FundingRequirement {
  /** ERC-20 token contract address. */
  tokenAddress: Address;
  /** Human-readable token symbol (e.g. "USDC"). */
  tokenSymbol: string;
  /** Token decimal places (e.g. 6 for USDC, 18 for ETH). */
  tokenDecimals: number;
  /** Exact required amount in base units (wei), never rounded. */
  requiredAmount: bigint;
  /** Spender contract address (the protocol contract that will transfer). */
  spenderAddress: Address;
  /** Human-readable spender label (e.g. "TruthBountyWeighted"). */
  spenderLabel: string;
}

/**
 * Discriminated union for the allowance read state.
 * Mirrors the useERC20Allowance hook status but is a pure prop so stories
 * and tests can drive it without live RPC.
 */
export type AllowanceReadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; currentAllowance: bigint }
  | { status: 'error'; error: string }
  | { status: 'unsupported-chain'; message: string };

/**
 * Discriminated union for the approval action state.
 * Mirrors the useERC20Approval hook status but is a pure prop.
 */
export type ApprovalActionState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'approved'; allowance: bigint }
  | { status: 'needs-approval' }
  | { status: 'awaiting-signature' }
  | { status: 'pending-approval' }
  | { status: 'confirming' }
  | { status: 'success' }
  | { status: 'rejected' }
  | { status: 'error'; error: string };

/**
 * Freshness label for API projection data shown alongside funding requirements.
 * The API is a projection; contract state is canonical.
 */
export interface ProjectionFreshnessLabel {
  /** Freshness state. */
  freshness: 'fresh' | 'stale' | 'unknown';
  /** ISO timestamp of the projection generation. */
  generatedAt: string | null;
  /** Human-readable disclaimer. */
  disclaimer: string;
}

export interface FundingReviewStepProps {
  /** Canonical funding requirement (token, amount, spender). */
  requirement: FundingRequirement;
  /** Allowance read state from the chain (via adapter). */
  allowanceRead: AllowanceReadState;
  /** Approval action state (button label and availability). */
  approvalAction: ApprovalActionState;
  /** Whether the approval adapter is available. Missing → unavailable. */
  approvalAvailable: AdapterAvailability;
  /** Whether the allowance read adapter is available. Missing → unavailable. */
  allowanceReadAvailable: AdapterAvailability;
  /** Optional freshness label for any API projection data shown. */
  projectionFreshness?: ProjectionFreshnessLabel;
  /** Whether the user can proceed to submit. */
  canSubmit: boolean;
  /** Called when the user clicks the approve button. */
  onApprove: () => void;
  /** Called when the user clicks retry after rejection/error. */
  onRetryApproval: () => void;
  /** Called when the user refreshes the allowance read. */
  onRefreshAllowance: () => void;
  /** Navigate back to edit evidence. */
  onBack: () => void;
  /** Submit the claim to the blockchain. */
  onSubmit: () => void;
  /** Cancel the entire wizard. */
  onCancelWizard: () => void;
}

// ---------------------------------------------------------------------------
// Privacy constants
// ---------------------------------------------------------------------------

/**
 * Privacy notice copy for evidence uploads.
 * Secrets/protected evidence warnings are explicit and always visible.
 */
export const EVIDENCE_PRIVACY_NOTICE = {
  title: 'Privacy & integrity',
  points: [
    'Your file is hashed locally (SHA-256) in your browser before any upload.',
    'The server-reported digest must match your local hash — if it does not, nothing is accepted.',
    'File contents are never logged or inspected beyond hashing.',
    'The raw digest is never persisted to session storage; you must re-verify after a page refresh.',
  ],
  secretWarning:
    'Do not upload files containing private keys, seed phrases, passwords, or personally identifiable information. Evidence uploaded to the decentralized store is publicly retrievable by its content hash.',
} as const;

/**
 * Funding authority disclaimer shown alongside the funding review.
 * Contract state is canonical; API data is a freshness-labelled projection.
 */
export const FUNDING_AUTHORITY_DISCLAIMER =
  'Contract state is canonical for this transaction. Token amount, allowance, and spender address are read from on-chain state or the pinned release manifest — never fabricated by the UI.';
