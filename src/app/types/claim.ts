// UI-FE-072: Evidence upload preflight and recoverable transfer state
export type ClaimStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'DISPUTED';

export type EvidenceType = 'link' | 'text' | 'image' | 'video' | 'document';

export interface Evidence {
  id: string;
  type: EvidenceType;
  value: string;
  createdAt: string;
}

export interface Claim {
  id: string;
  title: string;
  description: string;
  category?: string;
  claimantAddress: string;
  proposer?: string;
  status: ClaimStatus;
  bountyAmount: number;
  totalStaked: number;
  evidence: Evidence[];
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export type ContentDigest = `0x${string}`;

export interface BountyAsset {
  token: `0x${string}`;
  amount: bigint;
}

export interface ClaimCreationConfig {
  artifactVersion: string;
  frozen?: boolean;
}

export interface ClaimCreationInput {
  contentDigest: ContentDigest;
  bountyAsset: BountyAsset;
  config: ClaimCreationConfig;
}

export type ClaimCreationErrorCode =
  | 'UNSUPPORTED_CHAIN'
  | 'INVALID_ADDRESS'
  | 'INVALID_ARTIFACT_VERSION'
  | 'INVALID_WALLET_ACCOUNT'
  | 'INVALID_AMOUNT'
  | 'INVALID_CONTENT'
  | 'ALLOWANCE_NOT_APPROVED'
  | 'SIMULATION_REVERTED'
  | 'USER_REJECTED'
  | 'STALE_RECONMILIATION'
  | 'STALE_RECONCILIATION'
  | 'UNKNOWN';

export interface ClaimCreationProtocolError {
  code: ClaimCreationErrorCode;
  message: string;
  cause?: unknown;
}

export type ClaimCreationStep =
  | 'idle'
  | 'allowance'
  | 'simulation'
  | 'submission'
  | 'confirmation'
  | 'reconciliation'
  | 'success'
  | 'error';

export interface ClaimCreationState {
  step: ClaimCreationStep;
  txHash?: `0x${string}`;
  claimId?: string;
  error?: ClaimCreationProtocolError;
}


/* -----------------------------------------------------------------------------
 * Evidence upload preflight and recoverable transfer state
 * (UI-FE-072)
 *
 * This block defines the reusable production boundary for validating evidence
 * before any network transfer and for tracking the distinct local hashing,
 * upload, pinning, CID verification, and claim authorization states.
 *
 * The contracts and reviewed API projections remain authoritative; this file
 * only describes the client-side contract for the upload preflight and the
 * recoverable transfer state machine.
 */


export type EvidenceUploadStatus =
  | 'idle'
  | 'preflight'
  | 'hashing'
  | 'uploading'
  | 'pinning'
  | 'verifying'
  | 'authorizing'
  | 'complete'
  | 'error';

export type EvidencePreflightErrorCode =
  | 'EMPTY_SELECTION'
  | 'TOO_MANY_FILES'
  | 'FILE_TOO_LARGE'
  | 'TOTAL_SIZE_TOO_LARGE'
  | 'UNSUPPORTED_MIME_TYPE'
  | 'UNSUPPORTED_EXTENSION'
  | 'MIME_EXTENSION_MISMATCH'
  | 'DUPLICATE_SELECTION'
  | 'UNSUPPORTED_EVIDENCE_POLICY'
  | 'HASH_MISMATCH'
  | 'UNKNOWN';

export type EvidenceTransferErrorCode =
  | 'INTERRUPTED_UPLOAD'
  | 'GATEWAY_TIMEOUT'
  | 'UPLOAD_REJECTED'
  | 'PIN_FAILED'
  | 'CID_MISMATCH'
  | 'AUTHORIZATION_DENIED'
  | 'RETRIES_EXHAUSTED'
  | 'UNKNOWN';

export type EvidenceUploadErrorCode =
  | EvidencePreflightErrorCode
  | EvidenceTransferErrorCode;

export interface EvidenceUploadError {
  code: EvidenceUploadErrorCode;
  message: string;
  /** Whether the operation may be safely retried without duplicating records. */
  recoverable: boolean;
  /** Optional suggested backoff in milliseconds before the next retry. */
  retryAfterMs?: number;
  cause?: unknown;
}

export interface EvidencePolicy {
  /** Maximum number of files allowed in a single selection. */
  maxFileCount: number;
  /** Maximum size of a single file in bytes. */
  maxFileBytes: number;
  /** Maximum combined size of all selected files in bytes. */
  maxTotalBytes: number;
  /** Allowed MIME types, lowercased. */
  allowedMimeTypes: readonly string[];
  /** Allowed file extensions, lowercased, including leading dot. */
  allowedExtensions: readonly string[];
  /** Mapping from extension to the expected MIME type(s) for that extension. */
  extensionTypeMap: Readonly<Record<string, readonly string[]>>;
  /** Evidence types that may be attached under this policy. */
  allowedEvidenceTypes: readonly EvidenceType[];
}

export interface EvidenceSelectionItem {
  /** Stable identifier for the selection entry (e.g. derived from name, size, and lastModified). */
  id: string;
  name: string;
  size: number;
  mimeType: string;
  extension: string;
  /** Locally computed content hash (e.g. SHA-256), if available. */
  hash?: string;
  /** Evidence type the file will be attached as. */
  evidenceType: EvidenceType;
  /** Optional last-modified timestamp from the browser for duplicate detection. */
  lastModified?: number;
}

export interface EvidencePreflightResult {
  ok: boolean;
  errors: readonly EvidenceUploadError[];
  /** Selections that passed preflight and may proceed to transfer. */
  accepted: readonly EvidenceSelectionItem[];
  /** Selections rejected before any network transfer. */
  rejected: readonly EvidenceSelectionItem[];
}

export interface EvidenceTransferRecord {
  /** Stable identifier shared with the selection item. */
  selectionId: string;
  /** Idempotency key used to guarantee a retry cannot duplicate a record. */
  idempotencyKey: string;
  /** Locally computed content hash. */
  hash?: string;
  /** Remote upload identifier once the transfer has been acknowledged. */
  uploadId?: string;
  /** Content identifier assigned by the pinning layer. */
  cid?: string;
  /** Claim authorization reference once the attachment is authorized. */
  authorizationId?: string;
  /** Number of attempts made for this record. */
  attempts: number;
  /** Timestamp of the last update to this record. */
  updatedAt: string;
  error?: EvidenceUploadError;
}

export interface EvidenceUploadState {
  status: EvidenceUploadStatus;
  /** Current selection being processed, if any. */
  currentSelectionId?: string;
  /** Progress fraction in the range [0, 1] for the current transfer. */
  progress: number;
  /** Records keyed by selection id for recoverable retry. */
  records: Readonly<Record<string, EvidenceTransferRecord>>;
  /** Aggregated errors from the last operation. */
  errors: readonly EvidenceUploadError[];
}

export interface EvidenceUploadRetryOptions {
  /** Maximum number of attempts for a single record. */
  maxAttempts: number;
  /** Base backoff in milliseconds. */
  baseBackoffMs: number;
  /** Maximum backoff in milliseconds. */
  maxBackoffMs: number;
  /** Maximum total time in milliseconds before giving up. */
  maxTotalMs: number;
}

export const DEFAULT_EVIDENCE_UPLOAD_RETRY_OPTIONS: EvidenceUploadRetryOptions = {
  maxAttempts: 3,
  baseBackoffMs: 500,
  maxBackoffMs: 8_000,
  maxTotalMs: 30_000,
};

export interface EvidenceUploadContext {
  policy: EvidencePolicy;
  retry?: EvidenceUploadRetryOptions;
  /** Existing records for idempotent retry. */
  existingRecords?: Readonly<Record<string, EvidenceTransferRecord>>;
}
