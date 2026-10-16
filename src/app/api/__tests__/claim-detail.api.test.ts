/**
 * Unit tests for claim-detail API client
 */

import { fetchClaimDetailProjection, isClaimDetailError, getClaimDetailErrorCode } from '../claim-detail.api';
import type { ClaimDetailEnvelope } from '@/app/types/claim-detail-projection';

// Mock fetch globally
global.fetch = jest.fn();

describe('fetchClaimDetailProjection', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validEnvelope: ClaimDetailEnvelope = {
    claim: {
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
      voteCounts: { support: 10, reject: 2 },
      confidenceScore: 85,
    },
    projection: {
      freshness: 'fresh',
      generatedAt: '2026-09-27T10:00:00.000Z',
      indexedAtBlock: 1000,
      finalizedBlock: 995,
    },
  };

  describe('successful fetches', () => {
    it('fetches and validates claim detail projection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => validEnvelope,
      } as Response);

      const result = await fetchClaimDetailProjection('claim-123');

      expect(result).toEqual(validEnvelope);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/claims/claim-123',
        expect.objectContaining({
          headers: { Accept: 'application/json' },
        })
      );
    });

    it('trims claim ID before fetching', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => validEnvelope,
      } as Response);

      await fetchClaimDetailProjection('  claim-123  ');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/claims/claim-123',
        expect.anything()
      );
    });

    it('encodes claim ID for URL safety', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => validEnvelope,
      } as Response);

      await fetchClaimDetailProjection('claim/123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/claims/claim%2F123',
        expect.anything()
      );
    });

    it('passes abort signal through', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => validEnvelope,
      } as Response);

      const controller = new AbortController();
      await fetchClaimDetailProjection('claim-123', controller.signal);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });
  });

  describe('error handling', () => {
    it('throws CLAIM_NOT_FOUND for 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      await expect(fetchClaimDetailProjection('claim-123')).rejects.toMatchObject({
        code: 'CLAIM_NOT_FOUND',
        message: expect.stringContaining('does not exist'),
      });
    });

    it('throws PROJECTION_STALE for 503', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response);

      await expect(fetchClaimDetailProjection('claim-123')).rejects.toMatchObject({
        code: 'PROJECTION_STALE',
        message: expect.stringContaining('temporarily unavailable'),
      });
    });

    it('throws PROJECTION_UNAVAILABLE for 400', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      } as Response);

      await expect(fetchClaimDetailProjection('claim-123')).rejects.toMatchObject({
        code: 'PROJECTION_UNAVAILABLE',
        message: expect.stringContaining('rejected this request'),
      });
    });

    it('throws PROJECTION_UNAVAILABLE for 422', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
      } as Response);

      await expect(fetchClaimDetailProjection('claim-123')).rejects.toMatchObject({
        code: 'PROJECTION_UNAVAILABLE',
      });
    });

    it('throws PROJECTION_UNAVAILABLE for other error statuses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(fetchClaimDetailProjection('claim-123')).rejects.toMatchObject({
        code: 'PROJECTION_UNAVAILABLE',
        message: expect.stringContaining('status 500'),
      });
    });

    it('throws PROJECTION_UNAVAILABLE for network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchClaimDetailProjection('claim-123')).rejects.toMatchObject({
        code: 'PROJECTION_UNAVAILABLE',
        message: expect.stringContaining('Could not reach'),
      });
    });

    it('re-throws AbortError without wrapping', async () => {
      const abortError = new DOMException('Aborted', 'AbortError');
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(fetchClaimDetailProjection('claim-123')).rejects.toBe(abortError);
    });

    it('throws PROJECTION_MALFORMED for non-JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Not JSON');
        },
      } as Response);

      await expect(fetchClaimDetailProjection('claim-123')).rejects.toMatchObject({
        code: 'PROJECTION_MALFORMED',
        message: expect.stringContaining('non-JSON'),
      });
    });

    it('throws PROJECTION_MALFORMED for invalid envelope', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ invalid: 'data' }),
      } as Response);

      await expect(fetchClaimDetailProjection('claim-123')).rejects.toMatchObject({
        code: 'PROJECTION_MALFORMED',
        message: expect.stringContaining('schema validation'),
      });
    });
  });

  describe('input validation', () => {
    it('throws CLAIM_NOT_FOUND for empty claim ID', async () => {
      await expect(fetchClaimDetailProjection('')).rejects.toMatchObject({
        code: 'CLAIM_NOT_FOUND',
        message: expect.stringContaining('required'),
      });
    });

    it('throws CLAIM_NOT_FOUND for whitespace-only claim ID', async () => {
      await expect(fetchClaimDetailProjection('   ')).rejects.toMatchObject({
        code: 'CLAIM_NOT_FOUND',
      });
    });

    it('throws CLAIM_NOT_FOUND for non-string claim ID', async () => {
      await expect(fetchClaimDetailProjection(null as any)).rejects.toMatchObject({
        code: 'CLAIM_NOT_FOUND',
      });

      await expect(fetchClaimDetailProjection(123 as any)).rejects.toMatchObject({
        code: 'CLAIM_NOT_FOUND',
      });
    });
  });
});

describe('isClaimDetailError', () => {
  it('returns true for ClaimDetailError', () => {
    const error = Object.assign(new Error('Test'), { code: 'CLAIM_NOT_FOUND' });
    expect(isClaimDetailError(error)).toBe(true);
  });

  it('returns false for regular Error', () => {
    const error = new Error('Test');
    expect(isClaimDetailError(error)).toBe(false);
  });

  it('returns false for non-Error', () => {
    expect(isClaimDetailError('string')).toBe(false);
    expect(isClaimDetailError(null)).toBe(false);
    expect(isClaimDetailError({})).toBe(false);
  });
});

describe('getClaimDetailErrorCode', () => {
  it('extracts code from ClaimDetailError', () => {
    const error = Object.assign(new Error('Test'), { code: 'CLAIM_NOT_FOUND' });
    expect(getClaimDetailErrorCode(error)).toBe('CLAIM_NOT_FOUND');
  });

  it('returns UNKNOWN for regular Error', () => {
    const error = new Error('Test');
    expect(getClaimDetailErrorCode(error)).toBe('UNKNOWN');
  });

  it('returns UNKNOWN for non-Error', () => {
    expect(getClaimDetailErrorCode('string')).toBe('UNKNOWN');
    expect(getClaimDetailErrorCode(null)).toBe('UNKNOWN');
  });
});
