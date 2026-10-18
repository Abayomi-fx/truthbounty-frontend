/**
 * Unit tests for claim-detail-projection types and utilities
 */

import {
  isClaimDetailProjection,
  isClaimDetailEnvelope,
  isProjectionStale,
  deriveClaimDetailViewState,
  createClaimDetailError,
  type ClaimDetailProjection,
  type ClaimDetailEnvelope,
} from '../claim-detail-projection';

describe('claim-detail-projection types', () => {
  describe('isClaimDetailProjection', () => {
    it('returns true for valid projection', () => {
      const validProjection: ClaimDetailProjection = {
        id: 'claim-123',
        title: 'Test Claim',
        description: 'Test description',
        claimantAddress: '0x1234567890123456789012345678901234567890',
        status: 'OPEN',
        bountyAmount: 1.5,
        totalStaked: 0.5,
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
      };

      expect(isClaimDetailProjection(validProjection)).toBe(true);
    });

    it('returns false for invalid projection (missing required fields)', () => {
      const invalid = {
        id: 'claim-123',
        title: 'Test',
        // Missing required fields
      };

      expect(isClaimDetailProjection(invalid)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isClaimDetailProjection(null)).toBe(false);
    });

    it('returns false for non-object', () => {
      expect(isClaimDetailProjection('string')).toBe(false);
      expect(isClaimDetailProjection(123)).toBe(false);
    });

    it('returns false for invalid settlement structure', () => {
      const invalid = {
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
        settlement: 'invalid', // Should be object
        claimantReputation: 75,
        voteCounts: { support: 0, reject: 0 },
        confidenceScore: null,
      };

      expect(isClaimDetailProjection(invalid)).toBe(false);
    });
  });

  describe('isClaimDetailEnvelope', () => {
    const validEnvelope: ClaimDetailEnvelope = {
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
        generatedAt: '2026-09-27T10:00:00.000Z',
        indexedAtBlock: 1000,
        finalizedBlock: 995,
      },
    };

    it('returns true for valid envelope', () => {
      expect(isClaimDetailEnvelope(validEnvelope)).toBe(true);
    });

    it('returns false for invalid projection metadata', () => {
      const invalid = {
        ...validEnvelope,
        projection: {
          freshness: 'invalid', // Should be 'fresh' | 'stale' | 'degraded'
          generatedAt: '2026-09-27T10:00:00.000Z',
          indexedAtBlock: 1000,
          finalizedBlock: 995,
        },
      };

      expect(isClaimDetailEnvelope(invalid)).toBe(false);
    });

    it('returns false for missing projection', () => {
      const invalid = {
        claim: validEnvelope.claim,
        // Missing projection
      };

      expect(isClaimDetailEnvelope(invalid)).toBe(false);
    });
  });

  describe('isProjectionStale', () => {
    it('returns false for fresh projection (< 30s old)', () => {
      const now = new Date();
      const generatedAt = new Date(now.getTime() - 20000).toISOString(); // 20s ago

      expect(isProjectionStale(generatedAt, 30000)).toBe(false);
    });

    it('returns true for stale projection (> 30s old)', () => {
      const now = new Date();
      const generatedAt = new Date(now.getTime() - 35000).toISOString(); // 35s ago

      expect(isProjectionStale(generatedAt, 30000)).toBe(true);
    });

    it('uses default threshold when not provided', () => {
      const now = new Date();
      const generatedAt = new Date(now.getTime() - 35000).toISOString();

      expect(isProjectionStale(generatedAt)).toBe(true);
    });

    it('handles custom threshold', () => {
      const now = new Date();
      const generatedAt = new Date(now.getTime() - 5000).toISOString(); // 5s ago

      expect(isProjectionStale(generatedAt, 3000)).toBe(true);
      expect(isProjectionStale(generatedAt, 10000)).toBe(false);
    });
  });

  describe('deriveClaimDetailViewState', () => {
    const mockEnvelope: ClaimDetailEnvelope = {
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
    };

    it('returns loading when isLoading is true and no data', () => {
      const state = deriveClaimDetailViewState(true, false, null, null);
      expect(state).toBe('loading');
    });

    it('returns not-found when error code is CLAIM_NOT_FOUND', () => {
      const state = deriveClaimDetailViewState(false, true, 'CLAIM_NOT_FOUND', null);
      expect(state).toBe('not-found');
    });

    it('returns error when isError is true', () => {
      const state = deriveClaimDetailViewState(false, true, 'PROJECTION_UNAVAILABLE', null);
      expect(state).toBe('error');
    });

    it('returns ready for fresh projection', () => {
      const state = deriveClaimDetailViewState(false, false, null, mockEnvelope);
      expect(state).toBe('ready');
    });

    it('returns ready-stale for stale projection', () => {
      const staleEnvelope = {
        ...mockEnvelope,
        projection: {
          ...mockEnvelope.projection,
          freshness: 'stale' as const,
        },
      };

      const state = deriveClaimDetailViewState(false, false, null, staleEnvelope);
      expect(state).toBe('ready-stale');
    });

    it('returns ready-stale for degraded projection', () => {
      const degradedEnvelope = {
        ...mockEnvelope,
        projection: {
          ...mockEnvelope.projection,
          freshness: 'degraded' as const,
        },
      };

      const state = deriveClaimDetailViewState(false, false, null, degradedEnvelope);
      expect(state).toBe('ready-stale');
    });

    it('returns ready-stale for old projection', () => {
      const oldEnvelope = {
        ...mockEnvelope,
        projection: {
          ...mockEnvelope.projection,
          generatedAt: new Date(Date.now() - 60000).toISOString(), // 60s ago
        },
      };

      const state = deriveClaimDetailViewState(false, false, null, oldEnvelope);
      expect(state).toBe('ready-stale');
    });
  });

  describe('createClaimDetailError', () => {
    it('creates error with code and message', () => {
      const error = createClaimDetailError('CLAIM_NOT_FOUND', 'Claim not found');

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('CLAIM_NOT_FOUND');
      expect(error.message).toBe('Claim not found');
      expect(error.name).toBe('ClaimDetailError');
    });

    it('includes cause when provided', () => {
      const cause = new Error('Original error');
      const error = createClaimDetailError('PROJECTION_UNAVAILABLE', 'Service unavailable', cause);

      expect(error.code).toBe('PROJECTION_UNAVAILABLE');
      expect(error.cause).toBe(cause);
    });
  });
});
