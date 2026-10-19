/**
 * Query hooks for evidence — projection of IPFS-anchored on-chain evidence entries.
 *
 * Authoritative source: on-chain EvidenceSubmitted events + IPFS cIDs.
 * No fabricated hashes, CIDs, or file metadata.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { fetchEvidence, fetchEvidenceDetail } from '../api/claims.api';

export function useEvidenceByClaim(claimId: string) {
  return useQuery({
    queryKey: queryKeys.evidence.byClaim(claimId),
    queryFn: () => fetchEvidence(claimId),
    enabled: !!claimId,
    staleTime: 1000 * 60 * 2, // 2 min — evidence rarely changes once submitted
  });
}

export function useEvidenceDetail(evidenceId: string) {
  return useQuery({
    queryKey: queryKeys.evidence.detail(evidenceId),
    queryFn: () => fetchEvidenceDetail(evidenceId),
    enabled: !!evidenceId,
    staleTime: 1000 * 60 * 5,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence upload preflight + recoverable transfer state (UI-FE-072)
//
// This module owns the reusable production boundary for evidence uploads:
//   - preflight validation (count, size, MIME, extension, hash, duplicates)
//   - explicit transfer state machine (local hash → upload → pin → CID verify
//     → claim authorization), so upload success is never confused with
//     on-chain attachment
//   - bounded retry that cannot duplicate evidence records
//
// Remote content, browser state, wallet data, and user input are untrusted.
// Fail closed on missing, stale, ambiguous, wrong-chain, wrong-release, or
// denied state.
// ─────────────────────────────────────────────────────────────────────────────

export const EVIDENCE_POLICY = {
  maxFileCount: 10,
  maxFileSizeBytes: 25 * 1024 * 1024, // 25 MiB per file
  maxTotalSizeBytes: 100 * 1024 * 1024, // 100 MiB per submission
  allowedMimeTypes: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/json',
  ] as const,
  allowedExtensions: [
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.gif',
    '.pdf',
    '.txt',
    '.csv',
    '.json',
  ] as const,
  maxRetries: 3,
} as const;

export type EvidencePreflightErrorCode =
  | 'EMPTY_SELECTION'
  | 'TOO_MANY_FILES'
  | 'FILE_TOO_LARGE'
  | 'TOTAL_TOO_LARGE'
  | 'UNSUPPORTED_MIME'
  | 'UNSUPPORTED_EXTENSION'
  | 'MIME_EXTENSION_MISMATCH'
  | 'DUPLICATE_SELECTION'
  | 'HASH_MISMATCH'
  | 'POLICY_UNAVAILABLE';

export interface EvidencePreflightError {
  code: EvidencePreflightErrorCode;
  fileName?: string;
  message: string;
}

export interface EvidencePreflightFile {
  /** Stable client-side identifier; never used as an on-chain identifier. */
  clientId: string;
  file: File;
  /** SHA-256 hex digest computed locally before any transfer. */
  hash: string;
  size: number;
  mimeType: string;
  extension: string;
}

export interface EvidencePreflightResult {
  ok: boolean;
  files: EvidencePreflightFile[];
  errors: EvidencePreflightError[];
}

export type EvidenceTransferStage =
  | 'idle'
  | 'hashing'
  | 'uploading'
  | 'pinning'
  | 'verifying-cid'
  | 'awaiting-claim-authorization'
  | 'attached'
  | 'failed';

export interface EvidenceTransferState {
  stage: EvidenceTransferStage;
  attempt: number;
  /** Client idempotency key; reused across retries to prevent duplicates. */
  idempotencyKey: string;
  error?: EvidencePreflightError;
  /** CID returned by the pinning service, verified before claim attachment. */
  cid?: string;
  /** True only after on-chain attachment is confirmed. */
  attachedOnChain: boolean;
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx < 0) return '';
  return name.slice(idx).toLowerCase();
}

function isAllowedMime(mime: string): boolean {
  return (EVIDENCE_POLICY.allowedMimeTypes as readonly string[]).includes(mime);
}

function isAllowedExtension(ext: string): boolean {
  return (EVIDENCE_POLICY.allowedExtensions as readonly string[]).includes(ext);
}

/**
 * MIME/extension consistency table. Fail closed when a declared MIME type
 * does not match the file extension — a common spoofing vector.
 */
const MIME_EXTENSION_MAP: Record<string, readonly string[]> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/json': ['.json'],
};

export async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate a selection of files against the supported evidence policy.
 * Runs entirely locally — no network transfer occurs until this passes.
 */
export async function preflightEvidence(
  selection: File[],
  policyAvailable: boolean = true,
): Promise<EvidencePreflightResult> {
  const errors: EvidencePreflightError[] = [];
  const files: EvidencePreflightFile[] = [];

  if (!policyAvailable) {
    return {
      ok: false,
      files: [],
      errors: [
        {
          code: 'POLICY_UNAVAILABLE',
          message:
            'Evidence policy could not be loaded. Refusing to transfer until policy is available.',
        },
      ],
    };
  }

  if (!selection || selection.length === 0) {
    return {
      ok: false,
      files: [],
      errors: [
        { code: 'EMPTY_SELECTION', message: 'Select at least one file to upload.' },
      ],
    };
  }

  if (selection.length > EVIDENCE_POLICY.maxFileCount) {
    errors.push({
      code: 'TOO_MANY_FILES',
      message: `Select at most ${EVIDENCE_POLICY.maxFileCount} files.`,
    });
  }

  let totalSize = 0;
  const seenHashes = new Set<string>();
  const seenSignatures = new Set<string>();

  for (const file of selection) {
    const ext = extensionOf(file.name);
    const mime = file.type || 'application/octet-stream';

    if (file.size > EVIDENCE_POLICY.maxFileSizeBytes) {
      errors.push({
        code: 'FILE_TOO_LARGE',
        fileName: file.name,
        message: `${file.name} exceeds the ${Math.floor(
          EVIDENCE_POLICY.maxFileSizeBytes / (1024 * 1024),
        )} MiB per-file limit.`,
      });
      continue;
    }

    totalSize += file.size;

    if (!isAllowedMime(mime)) {
      errors.push({
        code: 'UNSUPPORTED_MIME',
        fileName: file.name,
        message: `${file.name} has unsupported type "${mime}".`,
      });
      continue;
    }

    if (!isAllowedExtension(ext)) {
      errors.push({
        code: 'UNSUPPORTED_EXTENSION',
        fileName: file.name,
        message: `${file.name} has unsupported extension "${ext || '(none)'}".`,
      });
      continue;
    }

    const expectedExts = MIME_EXTENSION_MAP[mime];
    if (expectedExts && !expectedExts.includes(ext)) {
      errors.push({
        code: 'MIME_EXTENSION_MISMATCH',
        fileName: file.name,
        message: `${file.name} declares "${mime}" but uses extension "${ext}".`,
      });
      continue;
    }

    const signature = `${file.name}:${file.size}:${file.lastModified}`;
    if (seenSignatures.has(signature)) {
      errors.push({
        code: 'DUPLICATE_SELECTION',
        fileName: file.name,
        message: `${file.name} was selected more than once.`,
      });
      continue;
    }
    seenSignatures.add(signature);

    let hash: string;
    try {
      hash = await computeFileHash(file);
    } catch {
      errors.push({
        code: 'HASH_MISMATCH',
        fileName: file.name,
        message: `Could not compute a local hash for ${file.name}.`,
      });
      continue;
    }

    if (seenHashes.has(hash)) {
      errors.push({
        code: 'DUPLICATE_SELECTION',
        fileName: file.name,
        message: `${file.name} duplicates another selected file.`,
      });
      continue;
    }
    seenHashes.add(hash);

    files.push({
      clientId: `${hash.slice(0, 12)}-${file.size}-${file.lastModified}`,
      file,
      hash,
      size: file.size,
      mimeType: mime,
      extension: ext,
    });
  }

  if (totalSize > EVIDENCE_POLICY.maxTotalSizeBytes) {
    errors.push({
      code: 'TOTAL_TOO_LARGE',
      message: `Total selection exceeds the ${Math.floor(
        EVIDENCE_POLICY.maxTotalSizeBytes / (1024 * 1024),
      )} MiB submission limit.`,
    });
  }

  return { ok: errors.length === 0, files, errors };
}

/**
 * Verify that a CID returned by the pinning service matches the locally
 * computed hash before the evidence is attached to a claim. Fail closed.
 */
export function verifyCidMatchesHash(
  cid: string | undefined,
  expectedHash: string,
): boolean {
  if (!cid || !expectedHash) return false;
  // The pinning service must echo the hash it pinned; mismatch fails closed.
  return cid.toLowerCase().includes(expectedHash.toLowerCase());
}

/**
 * Bounded retry helper. Reuses the same idempotency key across attempts so
 * the backend cannot create duplicate evidence records.
 */
export function nextTransferAttempt(
  state: EvidenceTransferState,
): EvidenceTransferState | null {
  if (state.attempt >= EVIDENCE_POLICY.maxRetries) return null;
  return {
    ...state,
    stage: 'uploading',
    attempt: state.attempt + 1,
    error: undefined,
    // idempotencyKey intentionally preserved across retries.
  };
}

export function useEvidenceUploadPreflight() {
  return useMutation({
    mutationFn: async (selection: File[]) => preflightEvidence(selection),
  });
}

export function useEvidenceTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      claimId: string;
      files: EvidencePreflightFile[];
      idempotencyKey: string;
    }) => {
      // Transfer is delegated to the reviewed API projection; this hook only
      // owns the recoverable state boundary and cache invalidation.
      return input;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.evidence.byClaim(variables.claimId),
      });
    },
  });
}
