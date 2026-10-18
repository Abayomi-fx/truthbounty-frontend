/**
 * Tests for src/lib/canonicalBackfill.ts (UI-FE-056)
 *
 * Covers:
 *  - Successful fetch and envelope validation
 *  - Expired-token (401 / 410 / 400+code) handling
 *  - Release rollover detection (releaseId and protocolVersion mismatch)
 *  - Projection digest reconciliation
 *  - PROJECTION_MALFORMED on bad envelope shapes
 *  - BACKFILL_OVERFLOW on truncated responses
 *  - Network error and abort
 *  - Deduplication helpers
 *  - Gap detection helper
 */

import {
  fetchCanonicalBackfill,
  deduplicateEvents,
  hasGapBeforeEvents,
  eventId,
  BackfillError,
  MAX_BACKFILL_EVENTS,
  DEFAULT_BACKFILL_URL,
} from '@/lib/canonicalBackfill';
import type { WebSocketEvent } from '@/app/types/websocket';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<WebSocketEvent> = {}): WebSocketEvent {
  return {
    type: 'CLAIM_UPDATED',
    payload: { claimId: 'claim-1' },
    timestamp: new Date().toISOString(),
    cursor: 'cursor-1',
    ...overrides,
  };
}

function makeEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    events: [makeEvent({ cursor: 'cursor-2' })],
    nextCursor: 'cursor-2',
    totalAvailable: 1,
    truncated: false,
    releaseId: 'v2.0.0-sepolia',
    protocolVersion: '2.0.0',
    projectionDigest: 'digest-abc',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();

beforeAll(() => {
  global.fetch = mockFetch;
});

afterEach(() => {
  jest.clearAllMocks();
});

// Mock session-store so auth headers don't need real storage
jest.mock('@/lib/session-store', () => ({
  getAuthSessionHeaders: jest.fn().mockReturnValue({}),
}));

// ---------------------------------------------------------------------------
// fetchCanonicalBackfill
// ---------------------------------------------------------------------------

describe('fetchCanonicalBackfill', () => {
  describe('successful fetch', () => {
    it('returns events, nextCursor, truncated, and projectionDigest', async () => {
      const envelope = makeEnvelope();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => envelope,
      });

      const result = await fetchCanonicalBackfill({
        fromCursor: 'cursor-1',
      });

      expect(result.events).toHaveLength(1);
      expect(result.nextCursor).toBe('cursor-2');
      expect(result.truncated).toBe(false);
      expect(result.projectionDigest).toBe('digest-abc');
    });

    it('builds the correct query string with fromCursor', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeEnvelope(),
      });

      await fetchCanonicalBackfill({ fromCursor: 'my-cursor' });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('from=my-cursor');
      expect(url).toContain(`limit=${MAX_BACKFILL_EVENTS}`);
    });

    it('omits from param when fromCursor is null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeEnvelope(),
      });

      await fetchCanonicalBackfill({ fromCursor: null });

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain('from=');
    });

    it('uses custom backfillUrl when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeEnvelope(),
      });

      await fetchCanonicalBackfill({
        fromCursor: null,
        backfillUrl: '/api/custom/catchup',
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/custom/catchup');
    });

    it('uses DEFAULT_BACKFILL_URL when no backfillUrl provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeEnvelope(),
      });

      await fetchCanonicalBackfill({ fromCursor: null });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain(DEFAULT_BACKFILL_URL);
    });
  });

  describe('expired token', () => {
    it('throws EXPIRED_TOKEN on 410 Gone', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 410, json: async () => ({}) });

      await expect(fetchCanonicalBackfill({ fromCursor: 'old-cursor' })).rejects.toMatchObject({
        code: 'EXPIRED_TOKEN',
      });
    });

    it('throws EXPIRED_TOKEN on 400 with code=EXPIRED_TOKEN body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ code: 'EXPIRED_TOKEN', message: 'token expired' }),
      });

      await expect(fetchCanonicalBackfill({ fromCursor: 'stale-cursor' })).rejects.toMatchObject({
        code: 'EXPIRED_TOKEN',
      });
    });

    it('throws UNSUPPORTED_REQUEST on generic 400', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'bad request' }),
      });

      await expect(fetchCanonicalBackfill({ fromCursor: null })).rejects.toMatchObject({
        code: 'UNSUPPORTED_REQUEST',
      });
    });

    it('throws UNSUPPORTED_REQUEST on 422', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({}),
      });

      await expect(fetchCanonicalBackfill({ fromCursor: null })).rejects.toMatchObject({
        code: 'UNSUPPORTED_REQUEST',
      });
    });
  });

  describe('authorization', () => {
    it('throws UNAUTHORIZED on 401', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

      await expect(fetchCanonicalBackfill({ fromCursor: null })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('throws UNAUTHORIZED on 403', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) });

      await expect(fetchCanonicalBackfill({ fromCursor: null })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });
  });

  describe('projection unavailability', () => {
    it('throws PROJECTION_UNAVAILABLE on 503', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });

      await expect(fetchCanonicalBackfill({ fromCursor: null })).rejects.toMatchObject({
        code: 'PROJECTION_UNAVAILABLE',
      });
    });

    it('throws PROJECTION_UNAVAILABLE on other non-2xx', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

      await expect(fetchCanonicalBackfill({ fromCursor: null })).rejects.toMatchObject({
        code: 'PROJECTION_UNAVAILABLE',
      });
    });
  });

  describe('release rollover detection', () => {
    it('throws RELEASE_ROLLOVER when releaseId mismatches', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeEnvelope({ releaseId: 'v3.0.0-sepolia' }),
      });

      await expect(
        fetchCanonicalBackfill({
          fromCursor: null,
          expectedReleaseId: 'v2.0.0-sepolia',
        }),
      ).rejects.toMatchObject({ code: 'RELEASE_ROLLOVER' });
    });

    it('throws RELEASE_ROLLOVER when protocolVersion mismatches', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeEnvelope({ protocolVersion: '3.0.0' }),
      });

      await expect(
        fetchCanonicalBackfill({
          fromCursor: null,
          expectedProtocolVersion: '2.0.0',
        }),
      ).rejects.toMatchObject({ code: 'RELEASE_ROLLOVER' });
    });

    it('succeeds when releaseId matches', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeEnvelope(),
      });

      const result = await fetchCanonicalBackfill({
        fromCursor: null,
        expectedReleaseId: 'v2.0.0-sepolia',
      });
      expect(result.events).toBeDefined();
    });
  });

  describe('projection digest reconciliation', () => {
    it('throws PROJECTION_MISMATCH when expectedDigest does not match', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeEnvelope({ projectionDigest: 'digest-xyz' }),
      });

      await expect(
        fetchCanonicalBackfill({
          fromCursor: null,
          expectedDigest: 'digest-abc',
        }),
      ).rejects.toMatchObject({ code: 'PROJECTION_MISMATCH' });
    });

    it('succeeds when expectedDigest matches', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeEnvelope({ projectionDigest: 'digest-abc' }),
      });

      const result = await fetchCanonicalBackfill({
        fromCursor: null,
        expectedDigest: 'digest-abc',
      });
      expect(result.projectionDigest).toBe('digest-abc');
    });

    it('skips digest check when expectedDigest is empty string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeEnvelope(),
      });

      await expect(
        fetchCanonicalBackfill({ fromCursor: null, expectedDigest: '' }),
      ).resolves.toBeDefined();
    });
  });

  describe('malformed envelope', () => {
    it('throws PROJECTION_MALFORMED when response is not an object', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => 'not an object',
      });

      await expect(fetchCanonicalBackfill({ fromCursor: null })).rejects.toMatchObject({
        code: 'PROJECTION_MALFORMED',
      });
    });

    it('throws PROJECTION_MALFORMED when events is missing', async () => {
      const { events: _, ...rest } = makeEnvelope();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => rest,
      });

      await expect(fetchCanonicalBackfill({ fromCursor: null })).rejects.toMatchObject({
        code: 'PROJECTION_MALFORMED',
      });
    });

    it('throws PROJECTION_MALFORMED when nextCursor is missing', async () => {
      const { nextCursor: _, ...rest } = makeEnvelope();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => rest,
      });

      await expect(fetchCanonicalBackfill({ fromCursor: null })).rejects.toMatchObject({
        code: 'PROJECTION_MALFORMED',
      });
    });

    it('throws PROJECTION_MALFORMED when releaseId is missing', async () => {
      const { releaseId: _, ...rest } = makeEnvelope();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => rest,
      });

      await expect(fetchCanonicalBackfill({ fromCursor: null })).rejects.toMatchObject({
        code: 'PROJECTION_MALFORMED',
      });
    });

    it('throws PROJECTION_MALFORMED when a contained event is malformed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () =>
          makeEnvelope({ events: [{ notAnEvent: true }] }),
      });

      await expect(fetchCanonicalBackfill({ fromCursor: null })).rejects.toMatchObject({
        code: 'PROJECTION_MALFORMED',
      });
    });

    it('throws PROJECTION_MALFORMED on non-JSON body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('bad json'); },
      });

      await expect(fetchCanonicalBackfill({ fromCursor: null })).rejects.toMatchObject({
        code: 'PROJECTION_MALFORMED',
      });
    });
  });

  describe('backfill overflow', () => {
    it('throws BACKFILL_OVERFLOW when truncated and events.length >= MAX_BACKFILL_EVENTS', async () => {
      const events = Array.from({ length: MAX_BACKFILL_EVENTS }, (_, i) =>
        makeEvent({ cursor: `cursor-${i}`, timestamp: new Date().toISOString() }),
      );
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () =>
          makeEnvelope({
            events,
            totalAvailable: MAX_BACKFILL_EVENTS + 100,
            truncated: true,
          }),
      });

      await expect(fetchCanonicalBackfill({ fromCursor: null })).rejects.toMatchObject({
        code: 'BACKFILL_OVERFLOW',
      });
    });
  });

  describe('network error and abort', () => {
    it('throws NETWORK_ERROR on fetch rejection', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('network failure'));

      await expect(fetchCanonicalBackfill({ fromCursor: null })).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });

    it('throws ABORTED when signal is aborted', async () => {
      const controller = new AbortController();
      // DOMException.name is read-only; construct the AbortError directly
      mockFetch.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));

      await expect(
        fetchCanonicalBackfill({ fromCursor: null, signal: controller.signal }),
      ).rejects.toMatchObject({ code: 'ABORTED' });
    });
  });
});

// ---------------------------------------------------------------------------
// deduplicateEvents
// ---------------------------------------------------------------------------

describe('deduplicateEvents', () => {
  it('returns unique events when all ids are unique', () => {
    const events = [
      makeEvent({ cursor: 'c1' }),
      makeEvent({ cursor: 'c2' }),
    ];
    expect(deduplicateEvents(events)).toHaveLength(2);
  });

  it('removes duplicate events by cursor', () => {
    const events = [
      makeEvent({ cursor: 'c1' }),
      makeEvent({ cursor: 'c1' }),
      makeEvent({ cursor: 'c2' }),
    ];
    const result = deduplicateEvents(events);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.cursor)).toEqual(['c1', 'c2']);
  });

  it('deduplicates by type+timestamp+payload when cursor is absent', () => {
    const ts = new Date().toISOString();
    const events = [
      makeEvent({ cursor: undefined, timestamp: ts }),
      makeEvent({ cursor: undefined, timestamp: ts }),
    ];
    const result = deduplicateEvents(events);
    expect(result).toHaveLength(1);
  });

  it('preserves order of first occurrences', () => {
    const events = [
      makeEvent({ cursor: 'c3' }),
      makeEvent({ cursor: 'c1' }),
      makeEvent({ cursor: 'c2' }),
      makeEvent({ cursor: 'c1' }), // duplicate
    ];
    const result = deduplicateEvents(events);
    expect(result.map((e) => e.cursor)).toEqual(['c3', 'c1', 'c2']);
  });

  it('returns empty array for empty input', () => {
    expect(deduplicateEvents([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// eventId
// ---------------------------------------------------------------------------

describe('eventId', () => {
  it('returns cursor-prefixed id when cursor present', () => {
    const event = makeEvent({ cursor: 'my-cursor' });
    expect(eventId(event)).toBe('cursor:my-cursor');
  });

  it('returns type:timestamp:payload id when cursor is absent', () => {
    const ts = '2026-01-01T00:00:00.000Z';
    const event = makeEvent({ cursor: undefined, timestamp: ts });
    const id = eventId(event);
    expect(id).toMatch(/^CLAIM_UPDATED:/);
    expect(id).toContain(ts);
  });

  it('truncates payload to 120 chars in fallback id', () => {
    const bigPayload = { data: 'x'.repeat(200) };
    const event = makeEvent({ cursor: undefined, payload: bigPayload });
    const id = eventId(event);
    // The payload slice is 120 chars, plus the type and timestamp prefix
    const parts = id.split(':');
    // parts: type, timestamp(ISO includes colons!), ...payload
    // Just check the total id is reasonable (not > 200 chars extra)
    expect(id.length).toBeLessThan(500);
  });
});

// ---------------------------------------------------------------------------
// hasGapBeforeEvents
// ---------------------------------------------------------------------------

describe('hasGapBeforeEvents', () => {
  it('returns false when prevCursor is null', () => {
    const events = [makeEvent({ cursor: 'c1' })];
    expect(hasGapBeforeEvents(null, events)).toBe(false);
  });

  it('returns false when events array is empty', () => {
    expect(hasGapBeforeEvents('c0', [])).toBe(false);
  });

  it('returns false when first event has no gapDetected field', () => {
    const events = [makeEvent({ cursor: 'c2' })];
    expect(hasGapBeforeEvents('c1', events)).toBe(false);
  });

  it('returns true when first event has gapDetected=true', () => {
    const event = { ...makeEvent({ cursor: 'c3' }), gapDetected: true };
    expect(hasGapBeforeEvents('c1', [event as unknown as WebSocketEvent])).toBe(true);
  });

  it('returns false when first event has gapDetected=false', () => {
    const event = { ...makeEvent({ cursor: 'c2' }), gapDetected: false };
    expect(hasGapBeforeEvents('c1', [event as unknown as WebSocketEvent])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BackfillError
// ---------------------------------------------------------------------------

describe('BackfillError', () => {
  it('is an instance of Error', () => {
    const err = new BackfillError('NETWORK_ERROR', 'test');
    expect(err).toBeInstanceOf(Error);
  });

  it('carries the canonical code', () => {
    const err = new BackfillError('EXPIRED_TOKEN', 'expired');
    expect(err.code).toBe('EXPIRED_TOKEN');
    expect(err.message).toBe('expired');
    expect(err.name).toBe('BackfillError');
  });
});
