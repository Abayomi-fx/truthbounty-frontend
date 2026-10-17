/**
 * useResumableStream — Resumable stream engine with gap detection and canonical
 * HTTP backfill (UI-FE-056).
 *
 * Capabilities:
 *  - Versioned event IDs / cursors consumed from the WebSocket layer.
 *  - Opaque resume tokens (cursor) persisted across page loads.
 *  - Disconnect, duplicate, gap, expired-token, and release-rollover detection.
 *  - Bounded canonical HTTP backfill before showing fresh state.
 *  - Idempotent duplicate delivery (events applied exactly once by cursor/id).
 *  - Stream payloads can never override wallet/contract authority.
 *  - Fail-closed on missing/stale/wrong-release/wrong-chain context.
 *  - Tab sleep/wake and mobile background re-sync via Page Visibility API.
 *
 * Architecture:
 *  - Consumes the WebSocketProvider context for the live stream.
 *  - When a gap or disconnect is detected, triggers bounded HTTP backfill via
 *    `fetchCanonicalBackfill` before unblocking fresh-stream consumption.
 *  - Exposes `status`, `lastCursor`, `events`, and `gap*` diagnostics for
 *    consumers and for tests.
 *
 * Security / authority model:
 *  - Events are validated on entry; malformed events are dropped, never applied.
 *  - Release id and protocol version mismatch triggers `release-rollover` status
 *    (fail closed; caller must force full resync).
 *  - All persisted browser state (cursor in localStorage) is treated as
 *    untrusted and re-validated on load.
 */

'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { useWebSocketContext } from '@/components/providers/WebSocketProvider';
import {
  fetchCanonicalBackfill,
  deduplicateEvents,
  hasGapBeforeEvents,
  eventId,
  BackfillError,
  type BackfillOptions,
} from '@/lib/canonicalBackfill';
import type { WebSocketEvent, WebSocketEventType } from '@/app/types/websocket';
import type { WalletSessionScope } from '@/lib/session-store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** LocalStorage key for the last-acked cursor. */
export const RESUMABLE_STREAM_CURSOR_KEY = 'truthbounty:resumable-stream:cursor';

/** Maximum events kept in the in-memory ring buffer. */
const MAX_BUFFER_SIZE = 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Coarse status of the resumable stream lifecycle. */
export type ResumableStreamStatus =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'backfilling'
  | 'gap-detected'
  | 'release-rollover'
  | 'error'
  | 'closed';

export interface ResumableStreamDiagnostics {
  /** Number of events dropped as duplicates since mount. */
  duplicatesDropped: number;
  /** Number of out-of-order events absorbed. */
  outOfOrderCount: number;
  /** Number of gap-triggered backfills performed. */
  backfillCount: number;
  /** Number of reconnects that triggered backfill. */
  reconnectBackfillCount: number;
}

export interface UseResumableStreamOptions {
  /**
   * Release id from the canonical release manifest.
   * Mismatch triggers `release-rollover` fail-closed status.
   */
  expectedReleaseId?: string;
  /**
   * Protocol version from the canonical release manifest.
   * Mismatch triggers `release-rollover` fail-closed status.
   */
  expectedProtocolVersion?: string;
  /**
   * Wallet scope for authenticated backfill requests.
   * Null = unauthenticated (fine for read-only public endpoints).
   */
  sessionScope?: WalletSessionScope | null;
  /** Custom backfill URL (defaults to /api/claims/catchup). */
  backfillUrl?: string;
  /** Custom localStorage key for cursor persistence. */
  cursorStorageKey?: string;
  /**
   * Subset of event types to forward to `events`. When omitted, all types
   * are forwarded.
   */
  eventTypes?: WebSocketEventType[];
  /**
   * Called for every successfully applied event (after dedup and ordering).
   * Useful for downstream cache integration without having to poll `events`.
   */
  onEvent?: (event: WebSocketEvent) => void;
  /** Called when a gap or rollover requires a full canonical resync. */
  onResyncRequired?: (reason: 'gap' | 'overflow' | 'release-rollover' | 'expired-token') => void;
  /**
   * When true, a gap will always trigger a full canonical resync rather than
   * attempting bounded backfill. Default false.
   */
  forceFullResyncOnGap?: boolean;
}

export interface UseResumableStreamResult {
  /** Coarse lifecycle status. */
  status: ResumableStreamStatus;
  /** Last acknowledged event cursor (also persisted to localStorage). */
  lastCursor: string | null;
  /**
   * Ring buffer of the most recent events applied to the stream
   * (bounded to MAX_BUFFER_SIZE). Do not use for authority — always derive
   * authoritative state from canonical queries.
   */
  events: WebSocketEvent[];
  /** Diagnostics for debugging and test assertions. */
  diagnostics: ResumableStreamDiagnostics;
  /** Non-null when the stream is in an error or rollover state. */
  errorDetail: string | null;
  /** Manually trigger a canonical backfill from the last known cursor. */
  triggerBackfill: () => Promise<void>;
  /** Clear the persisted cursor (forces full resync on next connect). */
  clearCursor: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useResumableStream(
  options: UseResumableStreamOptions = {},
): UseResumableStreamResult {
  const {
    expectedReleaseId,
    expectedProtocolVersion,
    sessionScope = null,
    backfillUrl,
    cursorStorageKey = RESUMABLE_STREAM_CURSOR_KEY,
    eventTypes,
    onEvent,
    onResyncRequired,
    forceFullResyncOnGap = false,
  } = options;

  // -------------------------------------------------------------------------
  // WebSocket context
  // -------------------------------------------------------------------------
  const {
    isConnected,
    connectionState,
    subscribe,
    lastCursor: wsLastCursor,
  } = useWebSocketContext();

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [status, setStatus] = useState<ResumableStreamStatus>('idle');
  const [lastCursor, setLastCursor] = useState<string | null>(() => {
    // Load persisted cursor — treated as untrusted (validate shape)
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(cursorStorageKey);
      // Accept only non-empty strings; reject anything else
      if (typeof raw === 'string' && raw.length > 0) return raw;
    } catch {
      // localStorage unavailable
    }
    return null;
  });
  const [events, setEvents] = useState<WebSocketEvent[]>([]);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<ResumableStreamDiagnostics>({
    duplicatesDropped: 0,
    outOfOrderCount: 0,
    backfillCount: 0,
    reconnectBackfillCount: 0,
  });

  // -------------------------------------------------------------------------
  // Refs (mutable across renders without causing re-render)
  // -------------------------------------------------------------------------
  const seenIdsRef = useRef<Set<string>>(new Set());
  const lastCursorRef = useRef<string | null>(lastCursor);
  const isMountedRef = useRef(true);
  const backfillInProgressRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const wasConnectedRef = useRef(false);
  // Track previous connection state for reconnect detection
  const prevConnectionStateRef = useRef(connectionState);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Persist a new cursor to localStorage and state. */
  const advanceCursor = useCallback(
    (cursor: string) => {
      lastCursorRef.current = cursor;
      setLastCursor(cursor);
      try {
        window.localStorage.setItem(cursorStorageKey, cursor);
      } catch {
        // Storage unavailable — in-memory cursor is still valid
      }
    },
    [cursorStorageKey],
  );

  /** Add an event to the ring buffer. */
  const appendEvent = useCallback((event: WebSocketEvent) => {
    setEvents((prev) => {
      const next = [...prev, event];
      return next.length > MAX_BUFFER_SIZE ? next.slice(next.length - MAX_BUFFER_SIZE) : next;
    });
    onEvent?.(event);
  }, [onEvent]);

  /**
   * Apply a batch of events (e.g. from backfill or live stream), deduplicating
   * and respecting the event-type filter.
   * Returns the number of events applied.
   */
  const applyEvents = useCallback(
    (incoming: WebSocketEvent[]): number => {
      let applied = 0;
      const deduped = deduplicateEvents(incoming);
      for (const event of deduped) {
        const id = eventId(event);
        if (seenIdsRef.current.has(id)) {
          setDiagnostics((d) => ({ ...d, duplicatesDropped: d.duplicatesDropped + 1 }));
          continue;
        }
        seenIdsRef.current.add(id);
        // Maintain seen-set size to prevent unbounded memory growth
        if (seenIdsRef.current.size > MAX_BUFFER_SIZE * 2) {
          const iter = seenIdsRef.current.values();
          const oldest = iter.next().value;
          if (oldest !== undefined) seenIdsRef.current.delete(oldest);
        }
        // Event-type filter
        if (eventTypes && !eventTypes.includes(event.type)) continue;
        // Advance cursor
        if (typeof event.cursor === 'string' && event.cursor.length > 0) {
          advanceCursor(event.cursor);
        }
        appendEvent(event);
        applied++;
      }
      return applied;
    },
    [eventTypes, advanceCursor, appendEvent],
  );

  // -------------------------------------------------------------------------
  // Backfill
  // -------------------------------------------------------------------------

  const runBackfill = useCallback(
    async (opts?: { isReconnect?: boolean }) => {
      if (backfillInProgressRef.current || !isMountedRef.current) return;
      backfillInProgressRef.current = true;

      // Cancel any previous in-flight backfill
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setStatus('backfilling');
      setErrorDetail(null);

      const backfillOptions: BackfillOptions = {
        fromCursor: lastCursorRef.current,
        expectedReleaseId,
        expectedProtocolVersion,
        sessionScope,
        backfillUrl,
        signal: controller.signal,
      };

      try {
        const result = await fetchCanonicalBackfill(backfillOptions);

        if (!isMountedRef.current) return;

        // Check for gap before applying
        const gapDetected = hasGapBeforeEvents(lastCursorRef.current, result.events);
        if (gapDetected && forceFullResyncOnGap) {
          setStatus('gap-detected');
          onResyncRequired?.('gap');
          return;
        }

        applyEvents(result.events);

        // Advance cursor to the backfill endpoint even if no new events came
        if (result.nextCursor) {
          advanceCursor(result.nextCursor);
        }

        setDiagnostics((d) => ({
          ...d,
          backfillCount: d.backfillCount + 1,
          reconnectBackfillCount: opts?.isReconnect
            ? d.reconnectBackfillCount + 1
            : d.reconnectBackfillCount,
        }));

        if (result.truncated) {
          // We hit the overflow bound — a full resync may be required
          onResyncRequired?.('overflow');
        }

        setStatus('live');
      } catch (err) {
        if (!isMountedRef.current) return;

        if (err instanceof BackfillError) {
          if (err.code === 'ABORTED') {
            // Normal cancellation — don't change status
            return;
          }
          if (err.code === 'RELEASE_ROLLOVER') {
            setStatus('release-rollover');
            setErrorDetail(err.message);
            onResyncRequired?.('release-rollover');
            return;
          }
          if (err.code === 'EXPIRED_TOKEN') {
            setErrorDetail(err.message);
            onResyncRequired?.('expired-token');
            // Clear stale cursor so next connect starts fresh
            setLastCursor(null);
            lastCursorRef.current = null;
            try {
              window.localStorage.removeItem(cursorStorageKey);
            } catch {
              // ignore
            }
            setStatus('error');
            return;
          }
          if (err.code === 'BACKFILL_OVERFLOW') {
            setErrorDetail(err.message);
            onResyncRequired?.('overflow');
            setStatus('error');
            return;
          }
          setErrorDetail(err.message);
          setStatus('error');
        } else {
          setErrorDetail(err instanceof Error ? err.message : 'Unknown backfill error');
          setStatus('error');
        }
      } finally {
        backfillInProgressRef.current = false;
        abortControllerRef.current = null;
      }
    },
    [
      expectedReleaseId,
      expectedProtocolVersion,
      sessionScope,
      backfillUrl,
      cursorStorageKey,
      forceFullResyncOnGap,
      applyEvents,
      advanceCursor,
      onResyncRequired,
    ],
  );

  // -------------------------------------------------------------------------
  // Connection state tracking → reconnect backfill
  // -------------------------------------------------------------------------

  useEffect(() => {
    const prev = prevConnectionStateRef.current;
    prevConnectionStateRef.current = connectionState;

    if (connectionState === 'connecting') {
      setStatus('connecting');
      return;
    }

    if (connectionState === 'connected') {
      wasConnectedRef.current = true;
      // If we were previously disconnected/reconnecting, run backfill
      if (prev === 'reconnecting' || prev === 'disconnected' || prev === 'connecting') {
        runBackfill({ isReconnect: true });
      } else {
        setStatus('live');
      }
      return;
    }

    if (connectionState === 'reconnecting') {
      setStatus('connecting');
      return;
    }

    if (connectionState === 'disconnected') {
      if (wasConnectedRef.current) {
        setStatus('closed');
      }
      return;
    }

    if (connectionState === 'error') {
      setStatus('error');
    }
  }, [connectionState, runBackfill]);

  // -------------------------------------------------------------------------
  // Live stream subscription
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isConnected) return;

    // Subscribe to all event types and process via applyEvents for dedup/filter
    // We use a single catch-all approach: subscribe to the 14 known types and
    // funnel them all through applyEvents.
    const allTypes: WebSocketEventType[] = [
      'CLAIM_CREATED',
      'CLAIM_UPDATED',
      'CLAIM_STATUS_CHANGED',
      'VERIFICATION_ADDED',
      'VERIFICATION_UPDATED',
      'DISPUTE_CREATED',
      'DISPUTE_UPDATED',
      'DISPUTE_RESOLVED',
      'LEADERBOARD_UPDATED',
      'USER_STATS_UPDATED',
      'CONNECTION_STATUS',
      'ERROR',
      'ROLLBACK',
      'REPLACEMENT',
    ];

    const typesToSubscribe = eventTypes ?? allTypes;

    const unsubscribers = typesToSubscribe.map((type) =>
      subscribe(type, (payload) => {
        if (!isMountedRef.current) return;
        // Reconstruct a full WebSocketEvent for dedup and ordering
        const event: WebSocketEvent = {
          type,
          payload,
          timestamp: new Date().toISOString(),
          cursor: wsLastCursor ?? undefined,
        };
        applyEvents([event]);
      }),
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub?.());
    };
  }, [isConnected, subscribe, applyEvents, eventTypes, wsLastCursor]);

  // -------------------------------------------------------------------------
  // Tab sleep/wake and mobile background resync (Page Visibility API)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isConnected) {
        // Re-validate by running a backfill to catch any missed events
        // during the sleep window
        runBackfill({ isReconnect: false });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, runBackfill]);

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  const triggerBackfill = useCallback(async () => {
    await runBackfill({ isReconnect: false });
  }, [runBackfill]);

  const clearCursor = useCallback(() => {
    lastCursorRef.current = null;
    setLastCursor(null);
    try {
      window.localStorage.removeItem(cursorStorageKey);
    } catch {
      // ignore
    }
  }, [cursorStorageKey]);

  return useMemo(
    () => ({
      status,
      lastCursor,
      events,
      diagnostics,
      errorDetail,
      triggerBackfill,
      clearCursor,
    }),
    [status, lastCursor, events, diagnostics, errorDetail, triggerBackfill, clearCursor],
  );
}
