/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports -- test doubles and dynamic module access */
/**
 * Unit tests for useDisputeContext hook
 * Tests provisional outcome, deadline, bond, and eligibility fetching
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useAccount, useBlockNumber, useChainId } from 'wagmi';
import { useDisputeContext, canOpenDispute, getDisputeTimeRemaining } from '../useDisputeContext';
import type { DisputeContext } from '@/app/types/dispute';

// Mock Wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useBlockNumber: jest.fn(),
  useChainId: jest.fn(),
}));

const mockUseAccount = useAccount as jest.MockedFunction<typeof useAccount>;
const mockUseBlockNumber = useBlockNumber as jest.MockedFunction<typeof useBlockNumber>;
const mockUseChainId = useChainId as jest.MockedFunction<typeof useChainId>;

describe('useDisputeContext', () => {
  const mockConfig = {
    claimId: 'claim-123',
    contractAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E',
    expectedChainId: 11155420, // Optimism Sepolia
    pollInterval: 0, // Disable polling in tests
    enabled: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    mockUseAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
    } as any);

    mockUseBlockNumber.mockReturnValue({
      data: BigInt(12345678),
    } as any);

    mockUseChainId.mockReturnValue(11155420); // Optimism Sepolia
  });

  describe('Successful context fetch', () => {
    it('should fetch complete dispute context', async () => {
      const { result } = renderHook(() => useDisputeContext(mockConfig));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.context).not.toBeNull();
      expect(result.current.error).toBeNull();

      const context = result.current.context as DisputeContext;

      // Verify provisional outcome
      expect(context.provisionalOutcome).toBeDefined();
      expect(context.provisionalOutcome.claimId).toBe('claim-123');
      expect(context.provisionalOutcome.decision).toMatch(/VERIFIED|REJECTED/);
      expect(context.provisionalOutcome.isProvisional).toBe(true);

      // Verify deadline
      expect(context.deadline).toBeDefined();
      expect(context.deadline.claimId).toBe('claim-123');
      expect(context.deadline.isWindowOpen).toBeDefined();
      expect(context.deadline.timeRemaining).toBeGreaterThanOrEqual(0);

      // Verify bond
      expect(context.bond).toBeDefined();
      expect(context.bond.bondAmount).toBeDefined();
      expect(context.bond.slashPercentage).toBeGreaterThan(0);

      // Verify wallet position
      expect(context.walletPosition).toBeDefined();
      expect(context.walletPosition.userAddress).toBe('0x1234567890123456789012345678901234567890');

      // Verify eligibility computed
      expect(context.isEligible).toBeDefined();
    });

    it('should include provisional outcome with first-round results', async () => {
      const { result } = renderHook(() => useDisputeContext(mockConfig));

      await waitFor(() => {
        expect(result.current.context).not.toBeNull();
      });

      const outcome = result.current.context!.provisionalOutcome;

      expect(outcome.votesFor).toBeGreaterThanOrEqual(0);
      expect(outcome.votesAgainst).toBeGreaterThanOrEqual(0);
      expect(outcome.totalStake).toBeDefined();
      expect(outcome.outcomeAt).toBeDefined();
      expect(outcome.outcomeBlock).toBeGreaterThan(0);
    });

    it('should calculate deadline with time and block remaining', async () => {
      const { result } = renderHook(() => useDisputeContext(mockConfig));

      await waitFor(() => {
        expect(result.current.context).not.toBeNull();
      });

      const deadline = result.current.context!.deadline;

      expect(deadline.windowStartTime).toBeDefined();
      expect(deadline.windowEndTime).toBeDefined();
      expect(deadline.timeRemaining).toBeGreaterThanOrEqual(0);
      expect(deadline.windowEndBlock).toBeGreaterThan(0);
      expect(deadline.currentBlock).toBe(12345678);
      expect(deadline.blocksRemaining).toBeGreaterThanOrEqual(0);
    });

    it('should fetch bond requirements with slash and reward info', async () => {
      const { result } = renderHook(() => useDisputeContext(mockConfig));

      await waitFor(() => {
        expect(result.current.context).not.toBeNull();
      });

      const bond = result.current.context!.bond;

      expect(bond.bondAmount).toBe('1000000000000000000'); // 1 ETH
      expect(bond.slashAmount).toBeDefined();
      expect(bond.slashPercentage).toBe(10); // 10%
      expect(bond.potentialReward).toBeDefined();
      expect(bond.rewardMultiplier).toBeGreaterThan(1);
    });

    it('should check wallet balance and participation', async () => {
      const { result } = renderHook(() => useDisputeContext(mockConfig));

      await waitFor(() => {
        expect(result.current.context).not.toBeNull();
      });

      const position = result.current.context!.walletPosition;

      expect(position.currentBalance).toBeDefined();
      expect(position.hasSufficientBalance).toBeDefined();
      expect(position.balanceAfterBond).toBeDefined();
      expect(position.hasParticipatedInFirstRound).toBe(false);
      expect(position.hasOpenedDispute).toBe(false);
    });
  });

  describe('Eligibility computation', () => {
    it('should be eligible when all conditions met', async () => {
      const { result } = renderHook(() => useDisputeContext(mockConfig));

      await waitFor(() => {
        expect(result.current.context).not.toBeNull();
      });

      expect(result.current.context!.isEligible).toBe(true);
      expect(result.current.context!.ineligibilityReason).toBeUndefined();
    });

    it('should be ineligible when wallet not connected', async () => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
      } as any);

      const { result } = renderHook(() => useDisputeContext(mockConfig));

      await waitFor(() => {
        expect(result.current.context).not.toBeNull();
      });

      expect(result.current.context!.isEligible).toBe(false);
      expect(result.current.context!.ineligibilityReason).toContain('Wallet not connected');
    });

    it('should be ineligible on wrong network', async () => {
      mockUseChainId.mockReturnValue(1); // Ethereum mainnet instead of Optimism

      const { result } = renderHook(() => useDisputeContext(mockConfig));

      await waitFor(() => {
        expect(result.current.context).not.toBeNull();
      });

      expect(result.current.context!.isEligible).toBe(false);
      expect(result.current.context!.ineligibilityReason).toContain('Wrong network');
      expect(result.current.context!.ineligibilityReason).toContain('11155420');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid claim ID', async () => {
      const { result } = renderHook(() =>
        useDisputeContext({ ...mockConfig, claimId: '' })
      );

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error).toContain('Claim ID is required');
      expect(result.current.context).toBeNull();
    });

    it('should handle invalid contract address', async () => {
      const { result } = renderHook(() =>
        useDisputeContext({ ...mockConfig, contractAddress: 'invalid' })
      );

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error).toContain('Invalid contract address');
      expect(result.current.context).toBeNull();
    });

    it('should handle missing block number', async () => {
      mockUseBlockNumber.mockReturnValue({
        data: undefined,
      } as any);

      const { result } = renderHook(() => useDisputeContext(mockConfig));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should use fallback block number
      expect(result.current.context).not.toBeNull();
      expect(result.current.context!.deadline.currentBlock).toBeGreaterThan(0);
    });
  });

  describe('Refetch functionality', () => {
    it('should allow manual refetch', async () => {
      const { result } = renderHook(() => useDisputeContext(mockConfig));

      await waitFor(() => {
        expect(result.current.context).not.toBeNull();
      });

      const firstContext = result.current.context;

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.context).not.toBeNull();
      });

      expect(result.current.context).toBeDefined();
    });

    it('should update when block number changes', async () => {
      const { result, rerender } = renderHook(() => useDisputeContext(mockConfig));

      await waitFor(() => {
        expect(result.current.context).not.toBeNull();
      });

      const firstDeadline = result.current.context!.deadline;

      // Simulate block advancement
      mockUseBlockNumber.mockReturnValue({
        data: BigInt(12345680), // Advanced 2 blocks
      } as any);

      rerender();

      await waitFor(() => {
        expect(result.current.context!.deadline.currentBlock).toBe(12345680);
      });

      expect(result.current.context!.deadline.blocksRemaining).toBeLessThan(
        firstDeadline.blocksRemaining
      );
    });
  });

  describe('Disabled state', () => {
    it('should not fetch when disabled', async () => {
      const { result } = renderHook(() =>
        useDisputeContext({ ...mockConfig, enabled: false })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.context).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('Optimism mainnet support', () => {
    it('should work with Optimism mainnet chain ID', async () => {
      mockUseChainId.mockReturnValue(10); // Optimism mainnet

      const { result } = renderHook(() =>
        useDisputeContext({ ...mockConfig, expectedChainId: 10 })
      );

      await waitFor(() => {
        expect(result.current.context).not.toBeNull();
      });

      expect(result.current.context!.isEligible).toBe(true);
    });
  });
});

describe('canOpenDispute utility', () => {
  it('should return true for eligible context', () => {
    const mockContext: DisputeContext = {
      provisionalOutcome: {} as any,
      deadline: {} as any,
      bond: {} as any,
      walletPosition: {} as any,
      isEligible: true,
    };

    expect(canOpenDispute(mockContext)).toBe(true);
  });

  it('should return false for ineligible context', () => {
    const mockContext: DisputeContext = {
      provisionalOutcome: {} as any,
      deadline: {} as any,
      bond: {} as any,
      walletPosition: {} as any,
      isEligible: false,
      ineligibilityReason: 'Window closed',
    };

    expect(canOpenDispute(mockContext)).toBe(false);
  });

  it('should return false for null context', () => {
    expect(canOpenDispute(null)).toBe(false);
  });
});

describe('getDisputeTimeRemaining utility', () => {
  it('should format hours and minutes', () => {
    const mockDeadline = {
      timeRemaining: 7260, // 2h 1m
    } as any;

    expect(getDisputeTimeRemaining(mockDeadline)).toBe('2h 1m');
  });

  it('should format minutes only when less than 1 hour', () => {
    const mockDeadline = {
      timeRemaining: 600, // 10m
    } as any;

    expect(getDisputeTimeRemaining(mockDeadline)).toBe('10m');
  });

  it('should return Expired when time remaining is 0', () => {
    const mockDeadline = {
      timeRemaining: 0,
    } as any;

    expect(getDisputeTimeRemaining(mockDeadline)).toBe('Expired');
  });

  it('should return Expired for null deadline', () => {
    expect(getDisputeTimeRemaining(null)).toBe('Expired');
  });

  it('should return Expired for negative time', () => {
    const mockDeadline = {
      timeRemaining: -100,
    } as any;

    expect(getDisputeTimeRemaining(mockDeadline)).toBe('Expired');
  });
});
