/**
 * Unit tests for useAppealContext.
 *
 * The hook has no fabrication path: every field arrives from the canonical API
 * projection. These tests therefore drive the projection transport directly and
 * assert the hook fails closed whenever the projection cannot be trusted.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useAppealContext } from '../useAppealContext';
import { AppealProjectionError } from '@/lib/appeals/projection';
import {
  buildAppealProjection,
  FIXTURE_APPEAL_ID,
  type AppealProjectionOverrides,
} from '@/__tests__/fixtures/appealProjection';
import * as wagmi from 'wagmi';

jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useChainId: jest.fn(),
}));

const MOCK_CONTRACT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const MOCK_USER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const RELEASE_CHAIN_ID = 11155420; // OP Sepolia

/** Projection whose claim id matches the hook's `claimId`. */
function payload(overrides: AppealProjectionOverrides = {}) {
  return buildAppealProjection({
    appealId: FIXTURE_APPEAL_ID,
    chainId: RELEASE_CHAIN_ID,
    position: { userAddress: MOCK_USER },
    ...overrides,
  });
}

/** Projection for an arbitrary claim id. */
function payloadForClaim(claimId: string) {
  return buildAppealProjection({
    appealId: FIXTURE_APPEAL_ID,
    chainId: RELEASE_CHAIN_ID,
    snapshot: { claimId },
    position: { userAddress: MOCK_USER },
  });
}

function renderContext(
  overrides: Partial<Parameters<typeof useAppealContext>[0]> = {}
) {
  return renderHook(() =>
    useAppealContext({
      appealId: FIXTURE_APPEAL_ID,
      claimId: 'claim-456',
      contractAddress: MOCK_CONTRACT,
      pollInterval: 100000,
      fetcher: async () => payload(),
      ...overrides,
    })
  );
}

describe('useAppealContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (wagmi.useAccount as jest.Mock).mockReturnValue({
      address: MOCK_USER,
      isConnected: true,
    });
    (wagmi.useChainId as jest.Mock).mockReturnValue(RELEASE_CHAIN_ID);
  });

  describe('successful projection load', () => {
    it('exposes every field from the projection verbatim', async () => {
      const source = payload();
      const { result } = renderContext({ fetcher: async () => source });

      await waitFor(() => expect(result.current.context).not.toBeNull());

      expect(result.current.error).toBeNull();
      expect(result.current.context?.snapshot).toEqual(source.snapshot);
      expect(result.current.context?.deadline).toEqual(source.deadline);
      expect(result.current.context?.stakeBounds).toEqual(source.stakeBounds);
      expect(result.current.context?.walletPosition).toEqual(source.position);
    });

    it('computes eligibility from projected deadline and position', async () => {
      const { result } = renderContext();

      await waitFor(() => expect(result.current.context).not.toBeNull());

      expect(result.current.context?.isEligible).toBe(true);
      expect(result.current.context?.ineligibilityReason).toBeUndefined();
    });

    it('marks the user ineligible when the projection reports an ended appeal', async () => {
      const ended = payload();
      ended.deadline = {
        ...ended.deadline,
        blocksRemaining: 0,
        timeRemaining: 0,
        isActive: false,
        hasEnded: true,
      };

      const { result } = renderContext({ fetcher: async () => ended });

      await waitFor(() => expect(result.current.context).not.toBeNull());

      expect(result.current.context?.isEligible).toBe(false);
      expect(result.current.context?.ineligibilityReason).toContain('ended');
    });

    it('marks the user ineligible when the projection reports an existing position', async () => {
      const participated = payload({
        position: {
          userAddress: MOCK_USER,
          hasParticipated: true,
          existingDecision: 'SUPPORT',
          existingStake: '500000000000000000',
        },
      });

      const { result } = renderContext({ fetcher: async () => participated });

      await waitFor(() => expect(result.current.context).not.toBeNull());

      expect(result.current.context?.isEligible).toBe(false);
      expect(result.current.context?.ineligibilityReason).toContain(
        'already participated'
      );
    });

    it('marks the user ineligible when the projection reports an insufficient balance', async () => {
      const broke = payload({
        position: { userAddress: MOCK_USER, hasMinimumBalance: false },
      });

      const { result } = renderContext({ fetcher: async () => broke });

      await waitFor(() => expect(result.current.context).not.toBeNull());

      expect(result.current.context?.isEligible).toBe(false);
      expect(result.current.context?.ineligibilityReason).toContain(
        'Insufficient balance'
      );
    });
  });

  describe('fail-closed behaviour', () => {
    it('returns no context when the projection endpoint is unavailable', async () => {
      const { result } = renderContext({
        fetcher: async () => {
          throw new AppealProjectionError('UNAVAILABLE', 'Projection offline.');
        },
      });

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.error).toMatch(/Projection offline/);
      expect(result.current.context).toBeNull();
    });

    it('returns no context when the appeal is not found', async () => {
      const { result } = renderContext({
        fetcher: async () => {
          throw new AppealProjectionError('NOT_FOUND', 'Appeal missing.');
        },
      });

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.context).toBeNull();
    });

    it('returns no context when the projection is for another chain', async () => {
      const { result } = renderContext({ fetcher: async () => payload({ chainId: 10 }) });

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.error).toMatch(/does not match the pinned release chain/);
      expect(result.current.context).toBeNull();
    });

    it('returns no context when the projection is for another claim', async () => {
      const { result } = renderContext({
        fetcher: async () => payloadForClaim('claim-999'),
      });

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.error).toMatch(/does not match the requested claim/);
      expect(result.current.context).toBeNull();
    });

    it('returns no context when the projection carries another wallet position', async () => {
      const foreign = payload({
        position: { userAddress: `0x${'22'.repeat(20)}` },
      });

      const { result } = renderContext({ fetcher: async () => foreign });

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.context).toBeNull();
    });

    it('returns no context when the transport throws', async () => {
      const { result } = renderContext({
        fetcher: async () => {
          throw new Error('socket hang up');
        },
      });

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.error).toMatch(/socket hang up/);
      expect(result.current.context).toBeNull();
    });

    it('never invents values when the projection is malformed', async () => {
      const { result } = renderContext({
        fetcher: async () => ({ appealId: FIXTURE_APPEAL_ID, chainId: RELEASE_CHAIN_ID }),
      });

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.context).toBeNull();
    });
  });

  describe('preconditions', () => {
    it('returns an error when the wallet is not connected', async () => {
      (wagmi.useAccount as jest.Mock).mockReturnValue({
        address: undefined,
        isConnected: false,
      });

      const { result } = renderContext();

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.error).toContain('Wallet not connected');
      expect(result.current.context).toBeNull();
    });

    it('returns an error on the wrong chain without fetching a projection', async () => {
      const fetcher = jest.fn(async () => payload());
      (wagmi.useChainId as jest.Mock).mockReturnValue(1);

      const { result } = renderContext({ fetcher });

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.error).toContain('Wrong network');
      expect(result.current.error).toContain(String(RELEASE_CHAIN_ID));
      expect(result.current.error).toContain('1');
      expect(fetcher).not.toHaveBeenCalled();
      expect(result.current.context).toBeNull();
    });

    it('rejects an invalid contract address', async () => {
      const { result } = renderContext({ contractAddress: 'invalid-address' });

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.error).toContain('Invalid contract address');
      expect(result.current.context).toBeNull();
    });

    it('rejects a contract address without the 0x prefix', async () => {
      const { result } = renderContext({
        contractAddress: '742d35Cc6634C0532925a3b844Bc9e7595f0eB1E',
      });

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.error).toContain('Invalid contract address');
    });

    it('rejects an empty appeal id', async () => {
      const { result } = renderContext({ appealId: '' });

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.error).toContain('Invalid appeal or claim ID');
    });

    it('rejects an empty claim id', async () => {
      const { result } = renderContext({ claimId: '' });

      await waitFor(() => expect(result.current.error).not.toBeNull());

      expect(result.current.error).toContain('Invalid appeal or claim ID');
    });
  });

  describe('refetch', () => {
    it('re-reads the projection when refetch is called', async () => {
      let block = 40_000;
      const fetcher = jest.fn(async () => {
        const base = payload();
        return {
          ...base,
          deadline: { ...base.deadline, blocksRemaining: block },
        };
      });

      const { result } = renderContext({ fetcher });

      await waitFor(() => expect(result.current.context).not.toBeNull());
      expect(result.current.context?.deadline.blocksRemaining).toBe(40_000);
      expect(fetcher).toHaveBeenCalledTimes(1);

      block = 12_000;
      await result.current.refetch();

      await waitFor(() =>
        expect(result.current.context?.deadline.blocksRemaining).toBe(12_000)
      );
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(result.current.error).toBeNull();
    });

    it('clears a previously loaded context when a later refetch fails closed', async () => {
      let shouldFail = false;
      const fetcher = jest.fn(async () => {
        if (shouldFail) {
          throw new AppealProjectionError('UNAVAILABLE', 'Projection offline.');
        }
        return payload();
      });

      const { result } = renderContext({ fetcher });

      await waitFor(() => expect(result.current.context).not.toBeNull());

      shouldFail = true;
      await result.current.refetch();

      await waitFor(() => expect(result.current.error).not.toBeNull());
      expect(result.current.context).toBeNull();
    });
  });
});
