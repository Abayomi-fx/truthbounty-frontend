/**
 * V2 Claim Detail API Client — Canonical projection read path
 *
 * Fetches claim detail projections from the indexer API with fail-closed
 * validation. Never fabricates protocol state; malformed or unavailable
 * projections throw canonical error codes that map to UI states.
 */

import {
  ClaimDetailEnvelope,
  ClaimDetailError,
  createClaimDetailError,
  isClaimDetailEnvelope,
} from '@/app/types/claim-detail-projection';

/**
 * Fetch a single claim detail projection by ID.
 *
 * Fails closed: any non-2xx, non-JSON, or schema-violating response throws a
 * ClaimDetailError with a canonical code. The UI must never render an
 * unvalidated response as protocol state.
 *
 * @param claimId - Canonical claim identifier
 * @param signal - Optional AbortSignal for request cancellation
 * @returns Validated ClaimDetailEnvelope
 * @throws ClaimDetailError with canonical error code
 */
export async function fetchClaimDetailProjection(
  claimId: string,
  signal?: AbortSignal
): Promise<ClaimDetailEnvelope> {
  if (!claimId || typeof claimId !== 'string' || claimId.trim().length === 0) {
    throw createClaimDetailError(
      'CLAIM_NOT_FOUND',
      'Claim ID is required and must be a non-empty string'
    );
  }

  const trimmedId = claimId.trim();
  let res: Response;

  try {
    res = await fetch(`/api/claims/${encodeURIComponent(trimmedId)}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    // Abort is a normal control flow path (React Query cancellation), not a failure.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw createClaimDetailError(
      'PROJECTION_UNAVAILABLE',
      'Could not reach the claim detail projection service',
      error
    );
  }

  // 404 is a first-class user-facing state (claim does not exist).
  if (res.status === 404) {
    throw createClaimDetailError(
      'CLAIM_NOT_FOUND',
      `Claim "${trimmedId}" does not exist or has been removed`
    );
  }

  // 503 means the indexer is lagging or rebuilding.
  if (res.status === 503) {
    throw createClaimDetailError(
      'PROJECTION_STALE',
      'The claim detail projection is temporarily unavailable (indexer lag or rebuild)'
    );
  }

  // 400/422 means the request was rejected (invalid claim ID format, etc.).
  if (res.status === 400 || res.status === 422) {
    throw createClaimDetailError(
      'PROJECTION_UNAVAILABLE',
      `The claim detail projection rejected this request (status ${res.status})`
    );
  }

  if (!res.ok) {
    throw createClaimDetailError(
      'PROJECTION_UNAVAILABLE',
      `Claim detail projection request failed with status ${res.status}`
    );
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (cause) {
    throw createClaimDetailError(
      'PROJECTION_MALFORMED',
      'Claim detail projection returned a non-JSON response',
      cause
    );
  }

  // Fail closed: validate the envelope structure before returning it.
  if (!isClaimDetailEnvelope(payload)) {
    throw createClaimDetailError(
      'PROJECTION_MALFORMED',
      'Claim detail projection envelope failed schema validation'
    );
  }

  return payload;
}

/**
 * Type guard to check if an error is a ClaimDetailError.
 */
export function isClaimDetailError(error: unknown): error is ClaimDetailError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as ClaimDetailError).code === 'string'
  );
}

/**
 * Extract the canonical error code from an error, defaulting to UNKNOWN.
 */
export function getClaimDetailErrorCode(error: unknown): ClaimDetailError['code'] {
  if (isClaimDetailError(error)) {
    return error.code;
  }
  return 'UNKNOWN';
}
