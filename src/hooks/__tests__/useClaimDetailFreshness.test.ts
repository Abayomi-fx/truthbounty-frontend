/**
 * Unit tests for useClaimDetailFreshness hook
 */

import { renderHook } from '@testing-library/react';
import { useClaimDetailFreshness } from '../useClaimDetailFreshness';
import type { ClaimDetailEnvelope } from '@/app/types/claim-detail-projection';

describe('useClaimDetailFreshness', () => {
  const createMockEnvelope = (overrides?: Partial<ClaimDetailEnvelope>): ClaimDetailEnvelope => ({
    claim: {
      id: 'claim-123',
      title: 'Test',
      description: 'Test',
      claimantAddress: '0x1234567890123456789012345678901234567890',
      status: 'OPEN',
      bountyAmount: 1,
      totalStaked: 0,
      evidence: [],
      createdAt: '2026-09-27T00:00:00.000Z',
      updatedAt: '2026-09-27T00:00:00.000Z',
      verifications: [],
      settlement: {
        settledAt: null,
        settlementTxHash: null,
        isFinalized: false,
        finalizedBlock: null,
      },
      claimantReputation: 75,
      voteCounts: { support: 0, reject: 0 },
      confidenceScore: null,
    },
    projection: {
      freshness: 'fresh',
      generatedAt: new Date().toISOString(),
      indexedAtBlock: 1000,
      finalizedBlock: 995,
    },
    ...overrides,
  });

  it('returns unknown status when envelope is null', () => {
    const { result } = renderHook(() => useClaimDetailFreshness(null));

    expect(result.current.status).toBe('unknown');
    expect(result.current.isStale).toBe(false);
    expect(result.current.isDegraded).toBe(false);
    expect(result.current.generatedAt).toBeNull();
    expect(result.current.lastUpdated).toBe('unknown');
  });

  it('returns fresh status for recent projection', () => {
    const envelope = createMockEnvelope();
    const { result } = renderHook(() => useClaimDetailFreshness(envelope));

    expect(result.current.status).toBe('fresh');
    expect(result.current.isStale).toBe(false);
    expect(result.current.isDegraded).toBe(false);
  });

  it('returns stale status when API reports stale', () => {
    const envelope = createMockEnvelope({
      projection: {
        freshness: 'stale',
        generatedAt: new Date().toISOString(),
        indexedAtBlock: 1000,
        finalizedBlock: 995,
      },
    });

    const { result } = renderHook(() => useClaimDetailFreshness(envelope));

    expect(result.current.status).toBe('stale');
    expect(result.current.isStale).toBe(true);
    expect(result.current.isDegraded).toBe(false);
  });

  it('returns degraded status when API reports degraded', () => {
    const envelope = createMockEnvelope({
      projection: {
        freshness: 'degraded',
        generatedAt: new Date().toISOString(),
        indexedAtBlock: 1000,
        finalizedBlock: 995,
        reason: 'Partial data unavailable',
      },
    });

    const { result } = renderHook(() => useClaimDetailFreshness(envelope));

    expect(result.current.status).toBe('degraded');
    expect(result.current.isStale).toBe(false);
    expect(result.current.isDegraded).toBe(true);
    expect(result.current.reason).toBe('Partial data unavailable');
  });

  it('returns stale status for old projection', () => {
    const envelope = createMockEnvelope({
      projection: {
        freshness: 'fresh',
        generatedAt: new Date(Date.now() - 60000).toISOString(), // 60s ago
        indexedAtBlock: 1000,
        finalizedBlock: 995,
      },
    });

    const { result } = renderHook(() => useClaimDetailFreshness(envelope));

    expect(result.current.status).toBe('stale');
    expect(result.current.isStale).toBe(true);
  });

  it('respects custom staleness threshold', () => {
    const envelope = createMockEnvelope({
      projection: {
        freshness: 'fresh',
        generatedAt: new Date(Date.now() - 10000).toISOString(), // 10s ago
        indexedAtBlock: 1000,
        finalizedBlock: 995,
      },
    });

    // With 5s threshold, 10s is stale
    const { result: staleResult } = renderHook(() => 
      useClaimDetailFreshness(envelope, 5000)
    );
    expect(staleResult.current.isStale).toBe(true);

    // With 15s threshold, 10s is fresh
    const { result: freshResult } = renderHook(() => 
      useClaimDetailFreshness(envelope, 15000)
    );
    expect(freshResult.current.isStale).toBe(false);
  });

  it('calculates block lag correctly', () => {
    const envelope = createMockEnvelope({
      projection: {
        freshness: 'fresh',
        generatedAt: new Date().toISOString(),
        indexedAtBlock: 990,
        finalizedBlock: 1000,
      },
    });

    const { result } = renderHook(() => useClaimDetailFreshness(envelope));

    expect(result.current.blockLag).toBe(10);
    expect(result.current.indexedAtBlock).toBe(990);
    expect(result.current.finalizedBlock).toBe(1000);
  });

  it('formats timestamps correctly', () => {
    const now = Date.now();
    
    // Just now (< 10s)
    const justNow = createMockEnvelope({
      projection: {
        freshness: 'fresh',
        generatedAt: new Date(now - 5000).toISOString(),
        indexedAtBlock: 1000,
        finalizedBlock: 995,
      },
    });
    const { result: justNowResult } = renderHook(() => useClaimDetailFreshness(justNow));
    expect(justNowResult.current.lastUpdated).toBe('just now');

    // Seconds ago
    const secondsAgo = createMockEnvelope({
      projection: {
        freshness: 'fresh',
        generatedAt: new Date(now - 30000).toISOString(),
        indexedAtBlock: 1000,
        finalizedBlock: 995,
      },
    });
    const { result: secondsResult } = renderHook(() => useClaimDetailFreshness(secondsAgo));
    expect(secondsResult.current.lastUpdated).toMatch(/30s ago/);

    // Minutes ago
    const minutesAgo = createMockEnvelope({
      projection: {
        freshness: 'fresh',
        generatedAt: new Date(now - 120000).toISOString(),
        indexedAtBlock: 1000,
        finalizedBlock: 995,
      },
    });
    const { result: minutesResult } = renderHook(() => useClaimDetailFreshness(minutesAgo));
    expect(minutesResult.current.lastUpdated).toMatch(/2m ago/);
  });

  it('updates when envelope changes', () => {
    const envelope1 = createMockEnvelope();
    const { result, rerender } = renderHook(
      ({ envelope }) => useClaimDetailFreshness(envelope),
      { initialProps: { envelope: envelope1 } }
    );

    expect(result.current.status).toBe('fresh');

    const envelope2 = createMockEnvelope({
      projection: {
        freshness: 'stale',
        generatedAt: new Date().toISOString(),
        indexedAtBlock: 1000,
        finalizedBlock: 995,
      },
    });

    rerender({ envelope: envelope2 });

    expect(result.current.status).toBe('stale');
  });
});
