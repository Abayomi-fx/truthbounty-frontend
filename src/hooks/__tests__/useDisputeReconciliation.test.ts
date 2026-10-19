/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports -- test doubles and dynamic module access */
/**
 * Unit tests for useDisputeReconciliation hook
 * Tests transaction confirmation, bond lock tracking, and dispute ID extraction
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import {
  useDisputeReconciliation,
  wasDisputeOpened,
  getDisputeStatus,
  isDuplicateSubmission,
  wasTransactionReplaced,
} from '../useDisputeReconciliation';
import type {
  DisputeTransaction,
  DisputeReconciliationResult,
} from '@/app/types/dispute';
import {
  trackPendingTransaction,
  clearPendingTransaction,
} from '@/lib/pending-transactions';

// Mock Wagmi hooks
jest.mock('wagmi', () => ({
  useWaitForTransactionReceipt: jest.fn(),
  usePublicClient: jest.fn(),
}));

// Mock pending transactions
jest.mock('@/lib/pending-transactions', () => ({
  trackPendingTransaction: jest.fn(),
  clearPendingTransaction: jest.fn(),
}));

const mockUseWaitForTransactionReceipt =
  useWaitForTransactionReceipt as jest.MockedFunction<
    typeof useWaitForTransactionReceipt
  >;
const mockUsePublicClient = usePublicClient as jest.MockedFunction<
  typeof usePublicClient
>;
const mockTrackPendingTransaction = trackPendingTransaction as jest.MockedFunction<
  typeof trackPendingTransaction
>;
const mockClearPendingTransaction = clearPendingTransaction as jest.MockedFunction<
  typeof clearPendingTransaction
>;

describe('useDisputeReconciliation', () => {
  const mockTransaction: DisputeTransaction = {
    transactionHash: '0xabc123def456789012345678901234567890123456789012345678901234abcd',
    from: '0x1234567890123456789012345678901234567890',
    to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E',
    status: 'PENDING',
    claimId: 'claim-123',
    reason: 'The verification was flawed',
    bondAmount: '1000000000000000000', // 1 ETH
    timestamp: new Date().toISOString(),
    bondLocked: false,
  };

  const mockReceipt = {
    status: 'success',
    blockNumber: BigInt(12345680),
    transactionHash: mockTransaction.transactionHash,
    logs: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUsePublicClient.mockReturnValue({} as any);

    // Default: no receipt yet (waiting)
    mockUseWaitForTransactionReceipt.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);
  });

  describe('Transaction confirmation', () => {
    it('should reconcile confirmed transaction', async () => {
      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: mockReceipt,
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
          confirmations: 1,
        })
      );

      await waitFor(() => {
        expect(result.current.result).not.toBeNull();
      });

      expect(result.current.result?.status).toBe('confirmed');
      expect(result.current.result?.bondLocked).toBe(true);
      expect(result.current.result?.disputeId).toBeDefined();
      expect(result.current.bondLocked).toBe(true);
      expect(result.current.disputeId).not.toBeNull();
    });

    it('should extract dispute ID from logs', async () => {
      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: mockReceipt,
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
        })
      );

      await waitFor(() => {
        expect(result.current.result).not.toBeNull();
      });

      expect(result.current.disputeId).toMatch(/^dispute-/);
      expect(result.current.result?.disputeId).toContain('0xabc123def4');
    });

    it('should update wallet balance after bond lock', async () => {
      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: mockReceipt,
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
        })
      );

      await waitFor(() => {
        expect(result.current.result).not.toBeNull();
      });

      expect(result.current.result?.newBalance).toBe('4000000000000000000'); // 4 ETH
    });

    it('should track isWaiting state', () => {
      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      const { result } = renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
        })
      );

      expect(result.current.isWaiting).toBe(true);
      expect(result.current.result).toBeNull();
    });

    it('should call onConfirmed callback', async () => {
      const onConfirmed = jest.fn();

      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: mockReceipt,
        isLoading: false,
        error: null,
      } as any);

      renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
          onConfirmed,
        })
      );

      await waitFor(() => {
        expect(onConfirmed).toHaveBeenCalled();
      });

      expect(onConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'confirmed',
          bondLocked: true,
        })
      );
    });
  });

  describe('Reverted transactions', () => {
    it('should handle reverted transaction', async () => {
      const revertedReceipt = {
        ...mockReceipt,
        status: 'reverted',
      };

      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: revertedReceipt,
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
        })
      );

      await waitFor(() => {
        expect(result.current.result).not.toBeNull();
      });

      expect(result.current.result?.status).toBe('reverted');
      expect(result.current.result?.bondLocked).toBe(false);
      expect(result.current.result?.error).toBe('Transaction reverted');
      expect(result.current.bondLocked).toBe(false);
    });

    it('should extract revert reason', async () => {
      const revertedReceipt = {
        ...mockReceipt,
        status: 'reverted',
      };

      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: revertedReceipt,
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
        })
      );

      await waitFor(() => {
        expect(result.current.result).not.toBeNull();
      });

      // In mock, revertReason is undefined for successful extractions
      expect(result.current.result?.revertReason).toBeDefined();
    });

    it('should not update balance on revert', async () => {
      const revertedReceipt = {
        ...mockReceipt,
        status: 'reverted',
      };

      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: revertedReceipt,
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
        })
      );

      await waitFor(() => {
        expect(result.current.result).not.toBeNull();
      });

      // Balance should be unchanged (from address)
      expect(result.current.result?.newBalance).toBe(mockTransaction.from);
    });

    it('should call onReverted callback', async () => {
      const onReverted = jest.fn();

      const revertedReceipt = {
        ...mockReceipt,
        status: 'reverted',
      };

      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: revertedReceipt,
        isLoading: false,
        error: null,
      } as any);

      renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
          onReverted,
        })
      );

      await waitFor(() => {
        expect(onReverted).toHaveBeenCalled();
      });

      expect(onReverted).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'reverted',
          bondLocked: false,
        })
      );
    });
  });

  describe('Timeout handling', () => {
    it('should handle transaction timeout', async () => {
      const timeoutError = new Error('Transaction confirmation timeout');

      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: timeoutError,
      } as any);

      const { result } = renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
          timeout: 60000,
        })
      );

      await waitFor(() => {
        expect(result.current.result).not.toBeNull();
      });

      expect(result.current.result?.status).toBe('timeout');
      expect(result.current.result?.bondLocked).toBe(false);
      expect(result.current.result?.error).toBe('Transaction confirmation timeout');
      expect(result.current.error).toBeDefined();
    });

    it('should call onTimeout callback', async () => {
      const onTimeout = jest.fn();
      const timeoutError = new Error('Timeout');

      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: timeoutError,
      } as any);

      renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
          onTimeout,
        })
      );

      await waitFor(() => {
        expect(onTimeout).toHaveBeenCalled();
      });

      expect(onTimeout).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'timeout',
        })
      );
    });

    it('should support custom timeout duration', () => {
      const { result } = renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
          timeout: 120000, // 2 minutes
        })
      );

      // Timeout config is passed to useWaitForTransactionReceipt
      expect(mockUseWaitForTransactionReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 120000,
        })
      );
    });
  });

  describe('Pending transaction tracking', () => {
    it('should track pending transaction', () => {
      renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
        })
      );

      expect(mockTrackPendingTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockTransaction.transactionHash,
          kind: 'dispute',
          title: 'Opening Dispute',
          description: expect.stringContaining('claim-123'),
        })
      );
    });

    it('should clear pending transaction on confirmation', async () => {
      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: mockReceipt,
        isLoading: false,
        error: null,
      } as any);

      renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
        })
      );

      await waitFor(() => {
        expect(mockClearPendingTransaction).toHaveBeenCalled();
      });

      expect(mockClearPendingTransaction).toHaveBeenCalledWith(
        mockTransaction.transactionHash
      );
    });

    it('should clear pending transaction on revert', async () => {
      const revertedReceipt = {
        ...mockReceipt,
        status: 'reverted',
      };

      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: revertedReceipt,
        isLoading: false,
        error: null,
      } as any);

      renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
        })
      );

      await waitFor(() => {
        expect(mockClearPendingTransaction).toHaveBeenCalled();
      });
    });

    it('should clear pending transaction on timeout', async () => {
      const timeoutError = new Error('Timeout');

      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: timeoutError,
      } as any);

      renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
        })
      );

      await waitFor(() => {
        expect(mockClearPendingTransaction).toHaveBeenCalled();
      });
    });
  });

  describe('Manual reconciliation', () => {
    it('should allow manual reconcile call', async () => {
      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: mockReceipt,
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
        })
      );

      await waitFor(() => {
        expect(result.current.result).not.toBeNull();
      });

      const manualResult = await result.current.reconcile();

      expect(manualResult).not.toBeNull();
      expect(manualResult?.status).toBe('confirmed');
    });

    it('should return null when no transaction', async () => {
      const { result } = renderHook(() =>
        useDisputeReconciliation({
          transaction: null,
        })
      );

      const manualResult = await result.current.reconcile();

      expect(manualResult).toBeNull();
    });

    it('should return null when no receipt', async () => {
      mockUseWaitForTransactionReceipt.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      const { result } = renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
        })
      );

      const manualResult = await result.current.reconcile();

      expect(manualResult).toBeNull();
    });
  });

  describe('Confirmation settings', () => {
    it('should use default 1 confirmation for Optimism', () => {
      renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
        })
      );

      expect(mockUseWaitForTransactionReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmations: 1,
        })
      );
    });

    it('should support custom confirmation count', () => {
      renderHook(() =>
        useDisputeReconciliation({
          transaction: mockTransaction,
          confirmations: 3,
        })
      );

      expect(mockUseWaitForTransactionReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmations: 3,
        })
      );
    });
  });

  describe('Null transaction handling', () => {
    it('should handle null transaction gracefully', () => {
      const { result } = renderHook(() =>
        useDisputeReconciliation({
          transaction: null,
        })
      );

      expect(result.current.result).toBeNull();
      expect(result.current.isWaiting).toBe(false);
      expect(result.current.bondLocked).toBe(false);
      expect(result.current.disputeId).toBeNull();
    });
  });
});

describe('wasDisputeOpened utility', () => {
  it('should return true for confirmed with bond locked', () => {
    const result: DisputeReconciliationResult = {
      transactionHash: '0xabc',
      status: 'confirmed',
      bondLocked: true,
      bondAmount: '1000000000000000000',
      newBalance: '4000000000000000000',
      disputeId: 'dispute-123',
    };

    expect(wasDisputeOpened(result)).toBe(true);
  });

  it('should return false for confirmed without bond locked', () => {
    const result: DisputeReconciliationResult = {
      transactionHash: '0xabc',
      status: 'confirmed',
      bondLocked: false,
      bondAmount: '1000000000000000000',
      newBalance: '5000000000000000000',
    };

    expect(wasDisputeOpened(result)).toBe(false);
  });

  it('should return false for reverted', () => {
    const result: DisputeReconciliationResult = {
      transactionHash: '0xabc',
      status: 'reverted',
      bondLocked: false,
      bondAmount: '1000000000000000000',
      newBalance: '5000000000000000000',
      error: 'Reverted',
    };

    expect(wasDisputeOpened(result)).toBe(false);
  });

  it('should return false for null result', () => {
    expect(wasDisputeOpened(null)).toBe(false);
  });
});

describe('getDisputeStatus utility', () => {
  it('should return success message for confirmed', () => {
    const result: DisputeReconciliationResult = {
      transactionHash: '0xabc',
      status: 'confirmed',
      bondLocked: true,
      bondAmount: '1000000000000000000',
      newBalance: '4000000000000000000',
    };

    expect(getDisputeStatus(result)).toBe('Dispute opened successfully');
  });

  it('should return revert reason for reverted', () => {
    const result: DisputeReconciliationResult = {
      transactionHash: '0xabc',
      status: 'reverted',
      bondLocked: false,
      bondAmount: '1000000000000000000',
      newBalance: '5000000000000000000',
      revertReason: 'Dispute window closed',
    };

    expect(getDisputeStatus(result)).toBe('Dispute window closed');
  });

  it('should return generic message when no revert reason', () => {
    const result: DisputeReconciliationResult = {
      transactionHash: '0xabc',
      status: 'reverted',
      bondLocked: false,
      bondAmount: '1000000000000000000',
      newBalance: '5000000000000000000',
    };

    expect(getDisputeStatus(result)).toBe('Transaction failed');
  });

  it('should return timeout message', () => {
    const result: DisputeReconciliationResult = {
      transactionHash: '0xabc',
      status: 'timeout',
      bondLocked: false,
      bondAmount: '1000000000000000000',
      newBalance: '5000000000000000000',
    };

    expect(getDisputeStatus(result)).toBe('Transaction confirmation timeout');
  });

  it('should return replaced message', () => {
    const result: DisputeReconciliationResult = {
      transactionHash: '0xabc',
      status: 'replaced',
      bondLocked: false,
      bondAmount: '1000000000000000000',
      newBalance: '5000000000000000000',
    };

    expect(getDisputeStatus(result)).toBe('Transaction replaced');
  });

  it('should return Unknown for null', () => {
    expect(getDisputeStatus(null)).toBe('Unknown');
  });
});

describe('isDuplicateSubmission utility', () => {
  it('should detect duplicate when already confirmed', () => {
    const existingTx: DisputeTransaction = {
      transactionHash: '0xabc',
      from: '0x123',
      to: '0x456',
      status: 'CONFIRMED',
      claimId: 'claim-123',
      reason: 'Test',
      bondAmount: '1000000000000000000',
      timestamp: new Date().toISOString(),
      bondLocked: true,
    };

    expect(isDuplicateSubmission(existingTx, 'claim-456')).toBe(true);
  });

  it('should detect duplicate when pending for same claim', () => {
    const existingTx: DisputeTransaction = {
      transactionHash: '0xabc',
      from: '0x123',
      to: '0x456',
      status: 'PENDING',
      claimId: 'claim-123',
      reason: 'Test',
      bondAmount: '1000000000000000000',
      timestamp: new Date().toISOString(),
      bondLocked: false,
    };

    expect(isDuplicateSubmission(existingTx, 'claim-123')).toBe(true);
  });

  it('should not detect duplicate when pending for different claim', () => {
    const existingTx: DisputeTransaction = {
      transactionHash: '0xabc',
      from: '0x123',
      to: '0x456',
      status: 'PENDING',
      claimId: 'claim-123',
      reason: 'Test',
      bondAmount: '1000000000000000000',
      timestamp: new Date().toISOString(),
      bondLocked: false,
    };

    expect(isDuplicateSubmission(existingTx, 'claim-456')).toBe(false);
  });

  it('should not detect duplicate when no existing transaction', () => {
    expect(isDuplicateSubmission(null, 'claim-123')).toBe(false);
  });
});

describe('wasTransactionReplaced utility', () => {
  it('should detect replaced transaction', () => {
    expect(wasTransactionReplaced('0xabc', '0xdef')).toBe(true);
  });

  it('should not detect replacement for same hash', () => {
    expect(wasTransactionReplaced('0xabc', '0xabc')).toBe(false);
  });

  it('should return false for undefined current hash', () => {
    expect(wasTransactionReplaced('0xabc', undefined)).toBe(false);
  });
});
