// src/app/api/claims.api.ts

import { Claim } from '@/app/types/claim';
import { createBoundedRequest } from '@/app/api/bounded-request';
import {
  CLAIMS_LIST_MAX_PAGE_SIZE,
  CLAIMS_LIST_MIN_PAGE_SIZE,
  createClaimsListError,
  isClaimListItem,
  type ClaimListItem,
  type ClaimsListEnvelope,
  type ClaimsListParams,
} from '@/app/types/claim-list';

const claimsRequest = createBoundedRequest({ namespace: 'claims' });

// ---------------------------------------------------------------------------
// Evidence upload preflight + recoverable transfer state (UI-FE-072)
// ---------------------------------------------------------------------------

export const EVIDENCE_MAX_FILE_COUNT = 10;
export const EVIDENCE_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const EVIDENCE_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
] as const;
export const EVIDENCE_ALLOWED_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.pdf',
  '.txt',
] as const;

export type EvidencePreflightCode =
  | 'EMPTY_SELECTION'
  | 'TOO_MANY_FILES'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_MIME'
  | 'UNSUPPORTED_EXTENSION'
  | 'MIME_EXTENSION_MISMATCH'
  | 'DUPLICATE_SELECTION'
  | 'HASH_MISMATCH'
  | 'POLICY_UNSUPPORTED';

export interface EvidencePreflightIssue {
  code: EvidencePreflightCode;
  fileName: string;
  message: string;
}

export interface EvidencePreflightFile {
  file: File;
  name: string;
  size: number;
  mimeType: string;
  extension: string;
  hash: string;
}

export interface EvidencePreflightResult {
  ok: boolean;
  accepted: EvidencePreflightFile[];
  issues: EvidencePreflightIssue[];
}

export type EvidenceTransferStage =
  | 'idle'
  | 'hashing'
  | 'uploading'
  | 'pinning'
  | 'verifying-cid'
  | 'authorizing-claim'
  | 'attached'
  | 'failed';

export interface EvidenceTransferState {
  stage: EvidenceTransferStage;
  attempt: number;
  maxAttempts: number;
  progress: number;
  error: string | null;
  recoverable: boolean;
  evidenceId: string | null;
  cid: string | null;
  claimAttached: boolean;
}

export const EVIDENCE_TRANSFER_INITIAL_STATE: EvidenceTransferState = {
  stage: 'idle',
  attempt: 0,
  maxAttempts: 3,
  progress: 0,
  error: null,
  recoverable: false,
  evidenceId: null,
  cid: null,
  claimAttached: false,
};

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx < 0) return '';
  return name.slice(idx).toLowerCase();
}

function expectedMimeForExtension(ext: string): string[] {
  switch (ext) {
    case '.png':
      return ['image/png'];
    case '.jpg':
    case '.jpeg':
      return ['image/jpeg'];
    case '.webp':
      return ['image/webp'];
    case '.pdf':
      return ['application/pdf'];
    case '.txt':
      return ['text/plain'];
    default:
      return [];
  }
}

/**
 * Compute a SHA-256 hex digest for a browser File using WebCrypto.
 * Fails closed if the runtime lacks SubtleCrypto.
 */
export async function hashEvidenceFile(file: File): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Hashing unavailable: SubtleCrypto is not supported');
  }
  const buffer = await file.arrayBuffer();
  const digest = await subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Validate a batch of selected evidence files before any network transfer.
 * Rejects empty selections, oversize files, unsupported MIME/extension,
 * MIME/extension mismatches, and duplicate selections (by name+size+hash).
 */
export async function preflightEvidenceSelection(
  files: File[],
  policy: { maxFiles?: number; maxBytes?: number } = {}
): Promise<EvidencePreflightResult> {
  const maxFiles = policy.maxFiles ?? EVIDENCE_MAX_FILE_COUNT;
  const maxBytes = policy.maxBytes ?? EVIDENCE_MAX_FILE_BYTES;
  const issues: EvidencePreflightIssue[] = [];
  const accepted: EvidencePreflightFile[] = [];
  const seen = new Set<string>();

  if (!files || files.length === 0) {
    issues.push({
      code: 'EMPTY_SELECTION',
      fileName: '',
      message: 'Select at least one evidence file.',
    });
    return { ok: false, accepted, issues };
  }

  if (files.length > maxFiles) {
    issues.push({
      code: 'TOO_MANY_FILES',
      fileName: '',
      message: `Select no more than ${maxFiles} evidence files.`,
    });
  }

  for (const file of files) {
    const name = file.name;
    const ext = extensionOf(name);
    const mime = (file.type || '').toLowerCase();

    if (file.size > maxBytes) {
      issues.push({
        code: 'FILE_TOO_LARGE',
        fileName: name,
        message: `${name} exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MB limit.`,
      });
      continue;
    }

    if (!EVIDENCE_ALLOWED_MIME_TYPES.includes(mime as (typeof EVIDENCE_ALLOWED_MIME_TYPES)[number])) {
      issues.push({
        code: 'UNSUPPORTED_MIME',
        fileName: name,
        message: `${name} uses an unsupported MIME type.`,
      });
      continue;
    }

    if (!EVIDENCE_ALLOWED_EXTENSIONS.includes(ext as (typeof EVIDENCE_ALLOWED_EXTENSIONS)[number])) {
      issues.push({
        code: 'UNSUPPORTED_EXTENSION',
        fileName: name,
        message: `${name} uses an unsupported file extension.`,
      });
      continue;
    }

    const expected = expectedMimeForExtension(ext);
    if (expected.length > 0 && !expected.includes(mime)) {
      issues.push({
        code: 'MIME_EXTENSION_MISMATCH',
        fileName: name,
        message: `${name} extension does not match its declared MIME type.`,
      });
      continue;
    }

    let hash: string;
    try {
      hash = await hashEvidenceFile(file);
    } catch {
      issues.push({
        code: 'POLICY_UNSUPPORTED',
        fileName: name,
        message: `Unable to hash ${name} in this environment.`,
      });
      continue;
    }

    const dedupeKey = `${name}::${file.size}::${hash}`;
    if (seen.has(dedupeKey)) {
      issues.push({
        code: 'DUPLICATE_SELECTION',
        fileName: name,
        message: `${name} is a duplicate selection.`,
      });
      continue;
    }
    seen.add(dedupeKey);

    accepted.push({ file, name, size: file.size, mimeType: mime, extension: ext, hash });
  }

  return { ok: issues.length === 0, accepted, issues };
}

/**
 * Verify a locally computed hash against the server-reported hash.
 * Fails closed on mismatch.
 */
export function verifyEvidenceHash(localHash: string, remoteHash: string): boolean {
  if (!localHash || !remoteHash) return false;
  return localHash.toLowerCase() === remoteHash.toLowerCase();
}

export interface EvidenceUploadResponse {
  evidenceId: string;
  cid: string;
  hash: string;
  pinned: boolean;
}

export interface EvidenceTransferDeps {
  upload: (file: File, signal?: AbortSignal) => Promise<EvidenceUploadResponse>;
  pin: (evidenceId: string, signal?: AbortSignal) => Promise<{ cid: string; pinned: boolean }>;
  verifyCid: (evidenceId: string, cid: string, signal?: AbortSignal) => Promise<boolean>;
  authorizeClaim: (evidenceId: string, claimId: string, signal?: AbortSignal) => Promise<boolean>;
  onState?: (state: EvidenceTransferState) => void;
}

/**
 * Run the evidence transfer pipeline with bounded retry.
 *
 * Stages are separated so callers never confuse upload success with on-chain
 * attachment. Retries reuse the same evidenceId to prevent duplicate records.
 */
export async function runEvidenceTransfer(
  file: File,
  claimId: string,
  deps: EvidenceTransferDeps,
  signal?: AbortSignal
): Promise<EvidenceTransferState> {
  let state: EvidenceTransferState = { ...EVIDENCE_TRANSFER_INITIAL_STATE };
  const emit = () => deps.onState?.({ ...state });

  state = { ...state, stage: 'hashing', progress: 0.05 };
  emit();
  const localHash = await hashEvidenceFile(file);

  let evidenceId: string | null = null;
  let cid: string | null = null;

  while (state.attempt < state.maxAttempts) {
    state = { ...state, attempt: state.attempt + 1, error: null, recoverable: false };
    try {
      if (!evidenceId) {
        state = { ...state, stage: 'uploading', progress: 0.25 };
        emit();
        const uploaded = await deps.upload(file, signal);
        if (!verifyEvidenceHash(localHash, uploaded.hash)) {
          state = {
            ...state,
            stage: 'failed',
            error: 'Hash mismatch after upload',
            recoverable: false,
          };
          emit();
          return state;
        }
        evidenceId = uploaded.evidenceId;
        state = { ...state, evidenceId };
      }

      state = { ...state, stage: 'pinning', progress: 0.5 };
      emit();
      const pinned = await deps.pin(evidenceId, signal);
      cid = pinned.cid;
      state = { ...state, cid };

      state = { ...state, stage: 'verifying-cid', progress: 0.7 };
      emit();
      const cidOk = await deps.verifyCid(evidenceId, cid, signal);
      if (!cidOk) {
        throw new Error('CID verification failed');
      }

      state = { ...state, stage: 'authorizing-claim', progress: 0.9 };
      emit();
      const authorized = await deps.authorizeClaim(evidenceId, claimId, signal);
      if (!authorized) {
        throw new Error('Claim authorization denied');
      }

      state = {
        ...state,
        stage: 'attached',
        progress: 1,
        claimAttached: true,
        recoverable: false,
      };
      emit();
      return state;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Evidence transfer failed';
      const canRetry = state.attempt < state.maxAttempts;
      state = {
        ...state,
        stage: 'failed',
        error: message,
        recoverable: canRetry,
      };
      emit();
      if (!canRetry) {
        return state;
      }
    }
  }

  return state;
}

type EvidenceItem = Record<string, unknown>;
type RoundItem = Record<string, unknown>;

export interface ClaimSubmissionData {
  title: string;
  description: string;
  category?: string;
  impact?: string;
  source?: string;
  evidence?: Array<{ type: string; value: string }>;
}

export async function fetchClaims(): Promise<Claim[]> {
  const res = await claimsRequest('/api/claims', {
    method: 'GET',
    idempotent: true,
  });
  if (!res.ok) throw new Error('Failed to fetch claims');
  return res.json();
}

export async function fetchClaimDetail(claimId: string): Promise<Claim> {
  const res = await claimsRequest(`/api/claims/${claimId}`, {
    method: 'GET',
    idempotent: true,
  });
  if (!res.ok) throw new Error('Failed to fetch claim detail');
  return res.json();
}

export async function submitClaim(payload: ClaimSubmissionData): Promise<Claim> {
  const res = await claimsRequest('/api/claims', {
    method: 'POST',
    idempotent: false,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to submit claim');
  return res.json();
}

export async function fetchClaimsByStatus(status: string): Promise<Claim[]> {
  const res = await claimsRequest(`/api/claims?status=${encodeURIComponent(status)}`, {
    method: 'GET',
    idempotent: true,
  });
  if (!res.ok) throw new Error('Failed to fetch claims by status');
  return res.json();
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export async function fetchEvidence(claimId: string): Promise<EvidenceItem[]> {
  const res = await claimsRequest(
    `/api/claims/${encodeURIComponent(claimId)}/evidence`,
    { method: 'GET', idempotent: true }
  );
  if (!res.ok) throw new Error('Failed to fetch evidence');
  return res.json();
}

export async function fetchEvidenceDetail(evidenceId: string): Promise<EvidenceItem> {
  const res = await claimsRequest(`/api/evidence/${encodeURIComponent(evidenceId)}`, {
    method: 'GET',
    idempotent: true,
  });
  if (!res.ok) throw new Error('Failed to fetch evidence detail');
  return res.json();
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

export async function fetchRoundsByClaim(claimId: string): Promise<RoundItem[]> {
  const res = await claimsRequest(
    `/api/claims/${encodeURIComponent(claimId)}/rounds`,
    { method: 'GET', idempotent: true }
  );
  if (!res.ok) throw new Error('Failed to fetch rounds');
  return res.json();
}

export async function fetchRoundDetail(roundId: string): Promise<RoundItem> {
  const res = await claimsRequest(`/api/rounds/${encodeURIComponent(roundId)}`, {
    method: 'GET',
    idempotent: true,
  });
  if (!res.ok) throw new Error('Failed to fetch round detail');
  return res.json();
}

/* ------------------------------------------------------------------ */
/* Canonical claim-list projection (V2-FE-109)                        */
/* ------------------------------------------------------------------ */

/**
 * Build the canonical querystring for the claims list projection endpoint.
 * Exported for deterministic testing of the wire format.
 */
export function buildClaimsListQuery(params: ClaimsListParams): string {
  const search = new URLSearchParams();
  const trimmedSearch = params.search.trim();
  if (trimmedSearch.length > 0) {
    search.set('search', trimmedSearch);
  }
  if (params.filters.status) {
    search.set('status', params.filters.status);
  }
  if (params.filters.highImpact) {
    search.set('highImpact', 'true');
  }
  search.set('page', String(params.pagination.page));
  search.set('pageSize', String(params.pagination.pageSize));
  search.set('sort', `${params.sort.field}.${params.sort.direction}`);
  return search.toString();
}

function assertClaimsListEnvelope(payload: unknown): ClaimsListEnvelope {
  if (typeof payload !== 'object' || payload === null) {
    throw createClaimsListError(
      'PROJECTION_MALFORMED',
      'Claims projection response is not an object'
    );
  }

  const envelope = payload as Record<string, unknown>;
  const items = envelope.items;
  const pagination = envelope.pagination as ClaimsListEnvelope['pagination'] | undefined;
  const projection = envelope.projection as ClaimsListEnvelope['projection'] | undefined;

  if (!Array.isArray(items)) {
    throw createClaimsListError(
      'PROJECTION_MALFORMED',
      'Claims projection response is missing a valid items array'
    );
  }

  for (const item of items) {
    if (!isClaimListItem(item)) {
      throw createClaimsListError(
        'PROJECTION_MALFORMED',
        'Claims projection contains a malformed claim row'
      );
    }
  }

  if (
    !pagination ||
    typeof pagination !== 'object' ||
    !Number.isInteger(pagination.page) ||
    pagination.page < 1 ||
    !Number.isInteger(pagination.pageSize) ||
    !Number.isInteger(pagination.total) ||
    pagination.total < 0 ||
    !Number.isInteger(pagination.totalPages)
  ) {
    throw createClaimsListError(
      'PROJECTION_MALFORMED',
      'Claims projection pagination block is malformed'
    );
  }

  if (
    !projection ||
    typeof projection !== 'object' ||
    (projection.freshness !== 'fresh' &&
      projection.freshness !== 'stale' &&
      projection.freshness !== 'degraded') ||
    typeof projection.generatedAt !== 'string'
  ) {
    throw createClaimsListError(
      'PROJECTION_MALFORMED',
      'Claims projection freshness metadata is malformed'
    );
  }

  return payload as ClaimsListEnvelope;
}

/**
 * Fetch the canonical claims list projection.
 *
 * Fails closed: any non-2xx, non-JSON, or schema-violating response throws a
 * ClaimsListError with a canonical code. The UI must never render an
 * unvalidated response as protocol state.
 */
export async function fetchClaimsList(
  params: ClaimsListParams,
  signal?: AbortSignal
): Promise<ClaimsListEnvelope> {
  const clamped: ClaimsListParams = {
    ...params,
    pagination: {
      page: Math.max(1, params.pagination.page),
      pageSize: Math.min(
        CLAIMS_LIST_MAX_PAGE_SIZE,
        Math.max(CLAIMS_LIST_MIN_PAGE_SIZE, params.pagination.pageSize)
      ),
    },
  };

  let res: Response;
  try {
    res = await claimsRequest(`/api/claims?${buildClaimsListQuery(clamped)}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    // Abort is a normal control flow path (React Query cancellation), not a failure.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw createClaimsListError(
      'PROJECTION_UNAVAILABLE',
      'Could not reach the claims projection service'
    );
  }

  if (res.status === 400 || res.status === 422) {
    throw createClaimsListError(
      'UNSUPPORTED_REQUEST',
      'The claims projection rejected this query as unsupported'
    );
  }

  if (res.status === 503) {
    throw createClaimsListError(
      'PROJECTION_STALE',
      'The claims projection is temporarily unavailable (stale or rebuilding)'
    );
  }

  if (!res.ok) {
    throw createClaimsListError(
      'PROJECTION_UNAVAILABLE',
      `Claims projection request failed with status ${res.status}`
    );
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw createClaimsListError(
      'PROJECTION_MALFORMED',
      'Claims projection returned a non-JSON response'
    );
  }

  return assertClaimsListEnvelope(payload);
}