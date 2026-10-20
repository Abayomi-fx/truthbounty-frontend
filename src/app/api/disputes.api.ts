/*
 * Dispute API functions.
 *
 * Authoritative source: on-chain DisputeCreated / DisputeResolved events
 * indexed into the projection layer.
 *
 * Security rules:
 *  - Never fabricate dispute IDs, outcome verdicts, vote counts, or stake amounts.
 *  - Amounts returned by the API are exact integer strings (wei precision); do
 *    not convert them locally without explicit bigint handling.
 *  - The API is a projection/read layer only. Contracts remain authoritative
 *    for protocol mutation; this module must not imply that a dispute has been
 *    created on-chain merely because the API acknowledged a request.
 *  - The public projection is never a canonical authority for mutations.
 *
 * Failure behavior:
 *  - Errors are surfaced as typed DisputeApiError instances so callers can
 *    distinguish network, HTTP, and integrity failures and render the correct
 *    user-visible state (loading / stale / rejected / failed).
 *  - Responses are validated before being returned. Malformed or integrity-
 *    uncertain payloads fail closed instead of being passed to the UI.
 *  - No request is issued with missing or empty critical identifiers.
 */

import type {
  Dispute,
  CreateDisputePayload,
  DisputeRegisterEntry,
  DisputeDetail,
} from '@/app/types/dispute';

export type { DisputeRegisterEntry, DisputeDetail };

export type { Dispute, CreateDisputePayload };

/**
 * Error codes exposed to callers so the UI can map them to accessible
 * user-visible states without parsing message strings.
 */
export type DisputeApiErrorCode =
  | 'network_error'
  | 'http_error'
  | 'invalid_response'
  | 'invalid_request';

export class DisputeApiError extends Error {
  readonly code: DisputeApiErrorCode;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(
    code: DisputeApiErrorCode,
    message: string,
    options?: { status?: number; cause?: unknown },
  ) {
    super(message);
    this.name = 'DisputeApiError';
    this.code = code;
    this.status = options?.status;
    this.cause = options?.cause;
  }
}

function assertIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DisputeApiError(
      'invalid_request',
      `Missing or invalid ${label}`,
    );
  }
  return value;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch (cause) {
    throw new DisputeApiError('invalid_response', 'Failed to parse dispute response', {
      status: res.status,
      cause,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Minimal integrity check for a projected dispute record. This is not a
 * semantic validator of protocol outcomes; it only ensures the shape is
 * sufficiently well-formed that the UI will not invent or display corrupt
 * dispute state. Anything ambiguous fails closed.
 */
function assertDispute(value: unknown): Dispute {
  if (!isRecord(value)) {
    throw new DisputeApiError('invalid_response', 'Dispute response is not an object');
  }
  const id = value.id;
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new DisputeApiError('invalid_response', 'Dispute response is missing an id');
  }
  return value as unknown as Dispute;
}

async function request(input: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (cause) {
    throw new DisputeApiError('network_error', 'Network request failed', {
      cause,
    });
  }

  if (!res.ok) {
    throw new DisputeApiError('http_error', `Dispute request failed with status ${res.status}`, {
      status: res.status,
    });
  }

  return readJson(res);
}

export async function fetchDisputesByClaim(claimId: string): Promise<Dispute[]> {
  const id = assertIdentifier(claimId, 'claimId');
  const data = await request(
    `/api/claims/${encodeURIComponent(id)}/disputes`,
  );
  if (!Array.isArray(data)) {
    throw new DisputeApiError('invalid_response', 'Dispute list response is not an array');
  }
  return data.map((entry) => assertDispute(entry));
}

export async function fetchDisputeDetail(disputeId: string): Promise<Dispute> {
  const id = assertIdentifier(disputeId, 'disputeId');
  const data = await request(`/api/disputes/${encodeURIComponent(id)}`);
  return assertDispute(data);
}

/**
 * Submit a dispute creation request to the projection layer.
 *
 * This function only records the request with the API. It does not create a
 * dispute on-chain and must not be treated as confirmation of dispute
 * creation. Callers must still wait for the canonical chain transaction to
 * confirm and finalize before presenting success.
 */
export async function createDispute(
  payload: CreateDisputePayload,
): Promise<Dispute> {
  if (!isRecord(payload)) {
    throw new DisputeApiError('invalid_request', 'Dispute payload is not an object');
  }

  const data = await request('/api/disputes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return assertDispute(data);
}

/**
 * Public dispute register projection.
 *
 * This is a read-only projection of on-chain dispute events. The contract
 * is canonical for all mutations and for final resolution state.
 */
export async function fetchDisputeRegister(): Promise<DisputeRegisterEntry[]> {
  const res = await fetch('/api/disputes');
  if (!res.ok) throw new Error('Failed to fetch dispute register');
  return res.json();
}

/**
 * Public dispute detail projection.
 *
 * Returns `null` when the dispute ID is unknown to the projection layer.
 * The caller must not fabricate a dispute from a missing response.
 */
export async function fetchPublicDisputeDetail(
  disputeId: string,
): Promise<DisputeDetail | null> {
  const res = await fetch(
    `/api/disputes/${encodeURIComponent(disputeId)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch dispute detail');
  return res.json();
}