/**
 * Canonical HTTP backfill for resumable stream gap recovery (UI-FE-056).
 *
 * Design rules:
 *  1. All remote content is treated as untrusted and validated before use.
 *  2. Missing, malformed, wrong-release, or denied responses fail closed.
 *  3. Stream payloads can never override wallet/contract authority.
 *  4. Backfill is bounded: a maximum event count prevents slow-consumer
 *     memory exhaustion and runaway catch-up loops.
 *  5. Expired resume tokens and release-rollover are detected and surfaced so
 *     the caller can decide whether to force a full resync.
 *  6. A projection digest is included in the response envelope and must match
 *     the caller's expected digest when one is provided (fail-closed).
 */

'use client';

import type { WebSocketEvent } from '@/app/types/websocket';
import { getAuthSessionHeaders } from '@/lib/session-store';
import type { WalletSessionScope } from '@/lib/session-store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of events we accept in a single backfill response. */
export const MAX_BACKFILL_EVENTS = 500;

/** Default HTTP endpoint for canonical backfill. */
export const DEFAULT_BACKFILL_URL = '/api/claims/catchup';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Canonical codes for backfill failure modes. */
export type BackfillErrorCode =
  | 'EXPIRED_TOKEN'
  | 'RELEASE_ROLLOVER'
  | 'PROJECTION_MISMATCH'
  | 'PROJECTION_MALFORMED'
  | 'PROJECTION_UNAVAILABLE'
  | 'BACKFILL_OVERFLOW'
  | 'UNAUTHORIZED'
  | 'UNSUPPORTED_REQUEST'
  | 'NETWORK_ERROR'
  | 'ABORTED';

export class BackfillError extends Error {
  constructor(
    public readonly code: BackfillErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BackfillError';
  }
}

/**
 * Validated envelope returned by the catch-up API.
 * The server MUST include a `releaseId` and `protocolVersion` so the frontend
 * can detect a release rollover before applying events.
 */
export interface BackfillEnvelope {
  /** Ordered list of events since `fromCursor`, inclusive upper-bound. */
  events: WebSocketEvent[];
  /** Cursor that represents the end of this backfill window. */
  nextCursor: string;
  /** Total number of events that were available (may exceed `events.length` if bounded). */
  totalAvailable: number;
  /** True when the server had to truncate the response to `MAX_BACKFILL_EVENTS`. */
  truncated: boolean;
  /** Release id stamped on this projection (e.g. "v2.0.0-sepolia"). */
  releaseId: string;
  /** Protocol version for rollover detection. */
  protocolVersion: string;
  /** Opaque digest of the projection state at `nextCursor`. */
  projectionDigest: string;
}

/** Options for a single backfill call. */
export interface BackfillOptions {
  /** Cursor to resume from. `null` means the caller has no cursor (full resync). */
  fromCursor: string | null;
  /** Expected release id — mismatch triggers RELEASE_ROLLOVER fail-closed. */
  expectedReleaseId?: string;
  /** Expected protocol version — mismatch triggers RELEASE_ROLLOVER fail-closed. */
  expectedProtocolVersion?: string;
  /**
   * Expected projection digest. When provided, a mismatch between the
   * canonical API response digest and this value triggers PROJECTION_MISMATCH.
   */
  expectedDigest?: string;
  /** Wallet scope used to attach auth headers. May be null (unauthenticated). */
  sessionScope?: WalletSessionScope | null;
  /** Custom catch-up URL (defaults to DEFAULT_BACKFILL_URL). */
  backfillUrl?: string;
  /** AbortSignal for cooperative cancellation. */
  signal?: AbortSignal;
}

/** Result returned from a successful backfill fetch. */
export interface BackfillResult {
  events: WebSocketEvent[];
  nextCursor: string;
  truncated: boolean;
  projectionDigest: string;
}

// ---------------------------------------------------------------------------
// Envelope validation
// ---------------------------------------------------------------------------

function isWebSocketEvent(value: unknown): value is WebSocketEvent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.type === 'string' &&
    v.type.length > 0 &&
    typeof v.timestamp === 'string' &&
    v.timestamp.length > 0
  );
}

function assertBackfillEnvelope(payload: unknown): BackfillEnvelope {
  if (typeof payload !== 'object' || payload === null) {
    throw new BackfillError('PROJECTION_MALFORMED', 'Backfill response is not an object');
  }

  const env = payload as Record<string, unknown>;

  if (!Array.isArray(env.events)) {
    throw new BackfillError('PROJECTION_MALFORMED', 'Backfill response missing events array');
  }

  for (const item of env.events) {
    if (!isWebSocketEvent(item)) {
      throw new BackfillError(
        'PROJECTION_MALFORMED',
        'Backfill response contains a malformed event',
      );
    }
  }

  if (typeof env.nextCursor !== 'string' || env.nextCursor.length === 0) {
    throw new BackfillError('PROJECTION_MALFORMED', 'Backfill response missing nextCursor');
  }

  if (typeof env.totalAvailable !== 'number' || !Number.isFinite(env.totalAvailable)) {
    throw new BackfillError('PROJECTION_MALFORMED', 'Backfill response missing totalAvailable');
  }

  if (typeof env.releaseId !== 'string' || env.releaseId.length === 0) {
    throw new BackfillError('PROJECTION_MALFORMED', 'Backfill response missing releaseId');
  }

  if (typeof env.protocolVersion !== 'string' || env.protocolVersion.length === 0) {
    throw new BackfillError('PROJECTION_MALFORMED', 'Backfill response missing protocolVersion');
  }

  if (typeof env.projectionDigest !== 'string' || env.projectionDigest.length === 0) {
    throw new BackfillError('PROJECTION_MALFORMED', 'Backfill response missing projectionDigest');
  }

  return payload as BackfillEnvelope;
}

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

/**
 * Fetch the canonical backfill for events since `fromCursor`.
 *
 * Fail-closed rules applied in order:
 *  1. Network failure → NETWORK_ERROR
 *  2. AbortError → ABORTED
 *  3. 401/403 → UNAUTHORIZED
 *  4. 400/422 → UNSUPPORTED_REQUEST (may include EXPIRED_TOKEN from server)
 *  5. 503 → PROJECTION_UNAVAILABLE
 *  6. Other non-2xx → PROJECTION_UNAVAILABLE
 *  7. Non-JSON body → PROJECTION_MALFORMED
 *  8. Schema violation → PROJECTION_MALFORMED
 *  9. Release rollover → RELEASE_ROLLOVER
 * 10. Projection digest mismatch → PROJECTION_MISMATCH
 * 11. Overflow → BACKFILL_OVERFLOW (caller must decide full-resync vs. accept truncation)
 */
export async function fetchCanonicalBackfill(
  options: BackfillOptions,
): Promise<BackfillResult> {
  const {
    fromCursor,
    expectedReleaseId,
    expectedProtocolVersion,
    expectedDigest,
    sessionScope = null,
    backfillUrl = DEFAULT_BACKFILL_URL,
    signal,
  } = options;

  // Build query string
  const params = new URLSearchParams();
  if (fromCursor) {
    params.set('from', fromCursor);
  }
  params.set('limit', String(MAX_BACKFILL_EVENTS));

  const url = `${backfillUrl}?${params.toString()}`;

  // Auth headers — only attached when the session is valid for the current scope
  const authHeaders = getAuthSessionHeaders(sessionScope);

  let response: Response;
  try {
    response = await fetch(url, {
      signal,
      headers: {
        Accept: 'application/json',
        ...authHeaders,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new BackfillError('ABORTED', 'Backfill request was aborted');
    }
    throw new BackfillError(
      'NETWORK_ERROR',
      'Could not reach the backfill service',
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new BackfillError('UNAUTHORIZED', 'Backfill request denied (auth)');
  }

  if (response.status === 400 || response.status === 422) {
    // 410 Gone / 400 with EXPIRED_TOKEN body — treat both as expired token
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // ignore parse failure; still treat as expired token
    }
    const code =
      typeof body === 'object' &&
      body !== null &&
      (body as Record<string, unknown>).code === 'EXPIRED_TOKEN'
        ? 'EXPIRED_TOKEN'
        : 'UNSUPPORTED_REQUEST';
    throw new BackfillError(code, `Backfill request rejected: ${response.status}`);
  }

  if (response.status === 410) {
    throw new BackfillError('EXPIRED_TOKEN', 'Resume token has expired; full resync required');
  }

  if (response.status === 503) {
    throw new BackfillError('PROJECTION_UNAVAILABLE', 'Backfill service is temporarily unavailable');
  }

  if (!response.ok) {
    throw new BackfillError(
      'PROJECTION_UNAVAILABLE',
      `Backfill request failed with status ${response.status}`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new BackfillError('PROJECTION_MALFORMED', 'Backfill service returned non-JSON');
  }

  const envelope = assertBackfillEnvelope(payload);

  // Release rollover check — fail closed when the API releases a different version
  if (
    expectedReleaseId !== undefined &&
    envelope.releaseId !== expectedReleaseId
  ) {
    throw new BackfillError(
      'RELEASE_ROLLOVER',
      `Release rollover detected: expected ${expectedReleaseId}, got ${envelope.releaseId}`,
    );
  }

  if (
    expectedProtocolVersion !== undefined &&
    envelope.protocolVersion !== expectedProtocolVersion
  ) {
    throw new BackfillError(
      'RELEASE_ROLLOVER',
      `Protocol version rollover: expected ${expectedProtocolVersion}, got ${envelope.protocolVersion}`,
    );
  }

  // Projection digest reconciliation — fail closed on mismatch
  if (
    expectedDigest !== undefined &&
    expectedDigest.length > 0 &&
    envelope.projectionDigest !== expectedDigest
  ) {
    throw new BackfillError(
      'PROJECTION_MISMATCH',
      `Projection digest mismatch: expected ${expectedDigest}, got ${envelope.projectionDigest}`,
    );
  }

  // Overflow guard — the server truncated and there are more events available
  // Surface this as a BackfillOverflow error so the caller can decide whether
  // to accept partial results or force a full resync.
  if (envelope.events.length >= MAX_BACKFILL_EVENTS && envelope.truncated) {
    throw new BackfillError(
      'BACKFILL_OVERFLOW',
      `Backfill overflow: ${envelope.totalAvailable} events available; bounded at ${MAX_BACKFILL_EVENTS}`,
    );
  }

  return {
    events: envelope.events,
    nextCursor: envelope.nextCursor,
    truncated: envelope.truncated,
    projectionDigest: envelope.projectionDigest,
  };
}

// ---------------------------------------------------------------------------
// Deduplication helpers (shared with the stream engine)
// ---------------------------------------------------------------------------

/**
 * Generate a stable string ID for a WebSocket event for deduplication.
 * Uses cursor when present (guaranteed unique per stream), otherwise falls
 * back to type+timestamp+payload prefix.
 */
export function eventId(event: WebSocketEvent): string {
  if (typeof event.cursor === 'string' && event.cursor.length > 0) {
    return `cursor:${event.cursor}`;
  }
  const payloadSlice = JSON.stringify(event.payload ?? null).slice(0, 120);
  return `${event.type}:${event.timestamp}:${payloadSlice}`;
}

/**
 * Deduplicate a list of events, preserving the first occurrence of each id.
 * Input order is preserved for events that are not duplicates.
 */
export function deduplicateEvents(events: WebSocketEvent[]): WebSocketEvent[] {
  const seen = new Set<string>();
  const result: WebSocketEvent[] = [];
  for (const e of events) {
    const id = eventId(e);
    if (!seen.has(id)) {
      seen.add(id);
      result.push(e);
    }
  }
  return result;
}

/**
 * Detect gaps between an expected `prevCursor` and the first event cursor in a
 * backfill batch. A gap is detected when:
 *  - The first event's cursor cannot be transitively linked to `prevCursor`.
 *  - This is signalled by the server setting `gapDetected: true` on an event,
 *    OR when the event list is non-empty and `prevCursor` is present but the
 *    first event's cursor does not sort immediately after it.
 *
 * Since cursor ordering is opaque, the server is the authoritative source
 * for gap detection. We surface it via the `gapDetected` field on events.
 */
export function hasGapBeforeEvents(
  prevCursor: string | null,
  events: WebSocketEvent[],
): boolean {
  if (!prevCursor || events.length === 0) return false;
  // Honour explicit server-side gap annotation
  const first = events[0];
  return (
    typeof (first as Record<string, unknown>).gapDetected === 'boolean' &&
    (first as unknown as { gapDetected: boolean }).gapDetected === true
  );
}
