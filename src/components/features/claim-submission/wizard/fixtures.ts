/**
 * UI-FE-012 — Isolated test/story fixtures for evidence/funding compositions.
 *
 * These fixtures are test-only. They never import production adapters,
 * live RPC clients, wallet connectors, or API clients. Stories and tests
 * use these to drive every scoped state deterministically.
 *
 * Deterministic values: no RNG, no timestamps depending on execution time,
 * no real contract addresses that could be confused with production.
 */

import type { Address } from 'viem';
import type {
  AdapterAvailability,
  AllowanceReadState,
  ApprovalActionState,
  EvidenceIntegrity,
  EvidenceSourceMetadata,
  EvidenceUploadStepState,
  FundingRequirement,
  ProjectionFreshnessLabel,
} from './types';

// ---------------------------------------------------------------------------
// Pinned test addresses (RFC 2606 / EVM test range — never production)
// ---------------------------------------------------------------------------

/** Test-only token address (outside real deployment ranges). */
export const FIXTURE_TOKEN_ADDRESS =
  '0x1234567890123456789012345678901234567890' as Address;

/** Test-only spender/protocol contract address. */
export const FIXTURE_SPENDER_ADDRESS =
  '0xAbCDef7890123456789012345678901234567890' as Address;

// ---------------------------------------------------------------------------
// Adapter availability fixtures
// ---------------------------------------------------------------------------

export const UPLOAD_AVAILABLE: AdapterAvailability = {
  available: true,
  pinnedReference: 'NEXT_PUBLIC_EVIDENCE_UPLOAD_URL=v2-pinned',
};

export const UPLOAD_UNAVAILABLE: AdapterAvailability = {
  available: false,
  reason: 'Evidence upload is not configured for this deployment.',
  adapterIssue: '#554',
};

export const APPROVAL_AVAILABLE: AdapterAvailability = {
  available: true,
  pinnedReference: 'useERC20Approval=v2-pinned',
};

export const APPROVAL_UNAVAILABLE: AdapterAvailability = {
  available: false,
  reason: 'Token approval adapter is not pinned for this deployment.',
  adapterIssue: '#566',
};

export const ALLOWANCE_READ_AVAILABLE: AdapterAvailability = {
  available: true,
  pinnedReference: 'useERC20Allowance=v2-pinned',
};

export const ALLOWANCE_READ_UNAVAILABLE: AdapterAvailability = {
  available: false,
  reason: 'Allowance read adapter is not pinned for this deployment.',
  adapterIssue: '#245',
};

// ---------------------------------------------------------------------------
// Evidence integrity fixtures
// ---------------------------------------------------------------------------

export const VERIFIED_FILE_INTEGRITY: EvidenceIntegrity = {
  contentIdentifier: 'sha256:a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
  integrityVerified: true,
  sanitizedFileName: 'evidence.pdf',
  fileSizeBytes: 1_048_576, // exact 1 MB integer
  mimeType: 'application/pdf',
};

export const VERIFIED_PNG_INTEGRITY: EvidenceIntegrity = {
  contentIdentifier: 'sha256:b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1',
  integrityVerified: true,
  sanitizedFileName: 'evidence.png',
  fileSizeBytes: 524_288, // exact 512 KB integer
  mimeType: 'image/png',
};

// ---------------------------------------------------------------------------
// Evidence source (URL) fixtures
// ---------------------------------------------------------------------------

export const VERIFIED_URL_SOURCE: EvidenceSourceMetadata = {
  sanitizedLabel: 'evidence from example.com',
  fullUrl: 'https://example.com/evidence/report',
  isValid: true,
};

// ---------------------------------------------------------------------------
// Evidence upload state fixtures (one per scoped state)
// ---------------------------------------------------------------------------

export const STATE_IDLE: EvidenceUploadStepState = { status: 'idle' };

export const STATE_VALIDATING: EvidenceUploadStepState = { status: 'validating' };

export const STATE_HASHING: EvidenceUploadStepState = {
  status: 'hashing',
  progress: 25,
};

export const STATE_UPLOADING: EvidenceUploadStepState = {
  status: 'uploading',
  progress: 45,
};

export const STATE_VERIFYING: EvidenceUploadStepState = { status: 'verifying' };

export const STATE_VERIFIED_FILE: EvidenceUploadStepState = {
  status: 'verified',
  integrity: VERIFIED_FILE_INTEGRITY,
};

export const STATE_VERIFIED_PNG: EvidenceUploadStepState = {
  status: 'verified',
  integrity: VERIFIED_PNG_INTEGRITY,
};

export const STATE_URL_VERIFIED: EvidenceUploadStepState = {
  status: 'url-verified',
  source: VERIFIED_URL_SOURCE,
};

export const STATE_FAILED_RETRYABLE: EvidenceUploadStepState = {
  status: 'failed',
  error: 'The connection failed. You can retry without choosing the file again.',
  retryable: true,
};

export const STATE_FAILED_INTEGRITY: EvidenceUploadStepState = {
  status: 'failed',
  error: 'Integrity check failed: the uploaded data did not match your file. Nothing was accepted.',
  retryable: false,
};

export const STATE_CANCELLED: EvidenceUploadStepState = { status: 'cancelled' };

export const STATE_INVALIDATED: EvidenceUploadStepState = {
  status: 'invalidated',
  reason: 'Wallet account or network changed. The upload was cancelled; choose the file again.',
};

// ---------------------------------------------------------------------------
// Funding requirement fixtures
// ---------------------------------------------------------------------------

export const FUNDING_USDC_100: FundingRequirement = {
  tokenAddress: FIXTURE_TOKEN_ADDRESS,
  tokenSymbol: 'USDC',
  tokenDecimals: 6,
  requiredAmount: 100_000_000n, // 100 USDC with 6 decimals (exact integer)
  spenderAddress: FIXTURE_SPENDER_ADDRESS,
  spenderLabel: 'TruthBountyWeighted',
};

export const FUNDING_OP_1: FundingRequirement = {
  tokenAddress: FIXTURE_TOKEN_ADDRESS,
  tokenSymbol: 'OP',
  tokenDecimals: 18,
  requiredAmount: 1_000_000_000_000_000_000n, // 1 OP with 18 decimals (exact integer)
  spenderAddress: FIXTURE_SPENDER_ADDRESS,
  spenderLabel: 'TruthBountyWeighted',
};

// ---------------------------------------------------------------------------
// Allowance read state fixtures
// ---------------------------------------------------------------------------

export const ALLOWANCE_IDLE: AllowanceReadState = { status: 'idle' };

export const ALLOWANCE_LOADING: AllowanceReadState = { status: 'loading' };

export const ALLOWANCE_SUFFICIENT: AllowanceReadState = {
  status: 'success',
  currentAllowance: 500_000_000n, // 500 USDC > 100 required
};

export const ALLOWANCE_INSUFFICIENT: AllowanceReadState = {
  status: 'success',
  currentAllowance: 50_000_000n, // 50 USDC < 100 required
};

export const ALLOWANCE_ZERO: AllowanceReadState = {
  status: 'success',
  currentAllowance: 0n,
};

export const ALLOWANCE_ERROR: AllowanceReadState = {
  status: 'error',
  error: 'Could not read token allowance from the chain. Please try again.',
};

export const ALLOWANCE_UNSUPPORTED_CHAIN: AllowanceReadState = {
  status: 'unsupported-chain',
  message: 'Unsupported network. Switch to Optimism to check allowance.',
};

// ---------------------------------------------------------------------------
// Approval action state fixtures
// ---------------------------------------------------------------------------

export const APPROVAL_IDLE: ApprovalActionState = { status: 'idle' };

export const APPROVAL_CHECKING: ApprovalActionState = { status: 'checking' };

export const APPROVAL_APPROVED: ApprovalActionState = {
  status: 'approved',
  allowance: 500_000_000n,
};

export const APPROVAL_NEEDS_APPROVAL: ApprovalActionState = {
  status: 'needs-approval',
};

export const APPROVAL_AWAITING_SIGNATURE: ApprovalActionState = {
  status: 'awaiting-signature',
};

export const APPROVAL_PENDING: ApprovalActionState = {
  status: 'pending-approval',
};

export const APPROVAL_CONFIRMING: ApprovalActionState = { status: 'confirming' };

export const APPROVAL_SUCCESS: ApprovalActionState = { status: 'success' };

export const APPROVAL_REJECTED: ApprovalActionState = { status: 'rejected' };

export const APPROVAL_ERROR: ApprovalActionState = {
  status: 'error',
  error: 'Approval transaction reverted. Check your wallet activity before retrying.',
};

// ---------------------------------------------------------------------------
// Projection freshness label fixtures
// ---------------------------------------------------------------------------

export const PROJECTION_FRESH: ProjectionFreshnessLabel = {
  freshness: 'fresh',
  generatedAt: '2026-10-18T12:00:00.000Z',
  disclaimer:
    'API projection data is freshness-labelled. Contract state is canonical for every action.',
};

export const PROJECTION_STALE: ProjectionFreshnessLabel = {
  freshness: 'stale',
  generatedAt: '2026-10-17T08:00:00.000Z',
  disclaimer:
    'This API projection is stale. The on-chain allowance and spender address remain canonical.',
};

export const PROJECTION_UNKNOWN: ProjectionFreshnessLabel = {
  freshness: 'unknown',
  generatedAt: null,
  disclaimer:
    'API projection freshness could not be determined. Contract state remains canonical.',
};
