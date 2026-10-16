/**
 * V2 Claim Detail API Client — Canonical projection read path
 *
 * Fetches claim detail projections from the indexer API with fail-closed
 * validation. Never fabricates protocol state; malformed or unavailable
 * projections throw canonical error codes that map to UI states.
 *
 * Requests are dispatched through the bounded API lifecycle adapter
 * (UI-FE-055), which owns cancellation, timeout, retry, backoff,
 * idempotency, stale-response suppression, and correlation handling.
 */

import {
  ClaimDetailEnvelope,
  ClaimDetailError,
  createClaimDetailError,
  isClaimDetailEnvelope,
} from '@/app/types/claim-detail-projection';
import {
  ApiLifecycleError,
  executeLifecycleRequest,
  isApiLifecycleError,
  type RequestContext,
} from '@/app/lib/apiLifecycle';

/** Operation descriptor for the claim detail read. */
const CLAIM_DETAIL_OPERATION = {
  name: 'claimDetail',
  method: 'GET' as const,
  idempotent: true,
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  timeoutMs: 15_000,
  maxConcurrency: 4,
};

/** Optional context for a claim detail read. */
export interface ClaimDetailRequestOptions {
  /** Caller-owned AbortSignal (e.g. React Query). */
  signal?: AbortSignal;
  /** Account / chain / release context to attach and validate. */
  context?: RequestContext;
  /** Resolves the current context at response time. */
  getCurrentContext?: () => RequestContext | null | undefined;
  /** Fetch implementation override (tests). */
  fetchImpl?: typeof fetch;
}

/** Map an ApiLifecycleError to a canonical ClaimDetailError. */
function mapLifecycleError(error: ApiLifecycleError): ClaimDetailError {
  switch (error.code) {
    case 'CLIENT_ERROR':
      // 404 is the only client error the claim detail path treats as not-found.
      if (error.message.includes('not found')) {
        return createClaimDetailError('CLAIM_NOT_FOUND', error.message, error);
      }
      return createClaimDetailError('PROJECTION_UNAVAILABLE', error.message, error);
    case 'SERVER_ERROR':
      if (error.message.includes('503')) {
        return createClaimDetailError(
          'PROJECTION_STALE',
          'The claim detail projection is temporarily unavailable (indexer lag or rebuild)',
          error,
        );
      }
      return createClaimDetailError('PROJECTION_UNAVAILABLE', error.message, error);
    case 'REGION_MALFORMED':
      return createClaimDetailError('PROJECTION_MALFORMED', error.message, error);
    case 'RATE_LIMITED':
      return createClaimDetailError('PROJECTION_UNAVAILABLE', error.message, error);
    case 'OFFLINE':
      return createClaimDetailError('PROJECTION_UNAVAILABLE', error.message, error);
    case 'TIMEOUT':
      return createClaimDetailError('PROJECTION_UNAVAILABLE', error.message, error);
    case 'STALE_RESPONSE':
      return createClaimDetailError(
        'PROJECTION_STALE',
        'The claim detail response was superseded by a newer context',
        error,
      );
    case 'CONTEXT_CHANGED':
    case 'CONTEXT_MISMATCH':
    case 'CONTEXT_REQUIRED':
      return createClaimDetailError(
        'PROJECTION_STALE',
        error.message,
        error,
      );
    case 'RETRIY_EXHAUSTED':
      return createClaimDetailError('PROJECTION_UNAVAILABLE', error.message, error);
    case 'CONCURRENCY_LIMIT':
      return createClaimDetailError('PROJECTION_UNAVAILABLE', error.message, error);
    default:
      return createClaimDetailError('PROJECTION_UNAVAILABLE', error.message, error);
  }
}

/**
 * Fetch a single claim detail projection by id.
 *
 * Fails closed: any non-2HX, non-JSON, or schema-violating response throws a
 * ClaimDetailError with a canonical code. The UI must never render an
 * unvalidated response as protocol state.
 *
 * @param claimId - Canonical claim identifier
 * @param options - Optional signal and context for cancellation and validation
 * @returns Validated ClaimDetailEnvelope
 * @throws ClaimDetailError with canonical error code
 */
export async function fetchClaimDetailProjection(
  claimId: string,
  options: ClaimDetailRequestOptions = {},
): Promise<ClaimDetailEnvelope> {
  if (!claimId || typeof claimId !== 'string' || claimId.trim().length === 0) {
    throw createClaimDetailError(
      'CLAIM_NOT_FOUND',
      'Claim ID is required and must be a non-empty string',
    );
  }

  const trimmedId = claimId.trim();
  const url = `/api/claims/${encodeURIComponent(trimmedId)}`;

  try {
    const result = await executeLifecycleRequest<ClaimDetailEnvelope>(
      {
        operation: CLAIM_DETAIL_OPERATION,
        url,
        context: options.context,
        signal: options.signal,
        fetchImpl: options.fetchImpl,
        validate: (payload) => {
          if (!isClaimDetailEnvelope(payload)) {
            throw new ApiLifecycleError(
              'UNKNOWN  as unknown as never',
              'Claim detail projection envelope failed schema validation',
            );
          }
          return payload;
        },
      },
      options.getCurrentContext,
    );
    return result.data;
  } catch (error) {
    // Abort is a normal control flow path (React Query cancellation), not a failure.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (isApiLifecycleError(error)) {
      if (error.code === 'ABORTED') {
        throw new DOMException('Aborted', 'AbortError');
      }
      throw mapLifecycleError(error);
    }
    throw createClaimDetailError(
      'PROJECTION_UNAVAILABLE',
      'Could not reach the claim detail projection service',
      error,
    );
  }
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
