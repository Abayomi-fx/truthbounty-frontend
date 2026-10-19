/**
 * V2-FE-058 — Optimistic UI Rollback on Canonical Failure
 * Integration tests for optimistic UI rollback on canonical transaction failure.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useEvmTransactionWithOptimistic } from '@/hooks/useEvmTransactionWithOptimistic';
import { resetGlobalOptimisticStore } from '@/lib/optimistic/optimistic-store';

// Mock useEvmTransaction
jest.mock('@/hooks/useEvmTransaction', () => ({
  useEvmTransaction: jest.fn(),
}));

const { useEvmTransaction } = require('@/hooks/useEvmTransaction');

describe('Optimistic Rollback on Canonical Failure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetGlobalOptimisticStore();
  });

  describe('TRANSACTION_REVERTED', () => {
    it('should rollback optimistic updates when transaction reverts', async () => {
      let mockTxState = {
        status: 'submitted' as const,
        txHash: '0xabc123' as const,
        chainId: 10,
        blockNumber: null,
        confirmations: null,
        error: null,
        replacedBy: null,
      };

      useEvmTransaction.mockReturnValue({
        state: mockTxState,
        send: jest.fn(),
        reset: jest.fn(),
        lastError: null,
      });

      const rollbackFn = jest.fn();
      const onOptimisticRollback = jest.fn();

      const { result } = renderHook(() =>
        useEvmTransactionWithOptimistic({
          id: 'test-tx',
          onOptimisticRollback,
        }),
      );

      // Create optimistic update
      act(() => {
        result.current.optimistic.optimistic('display', {
          label: 'Optimistic display',
          optimisticState: { claimId: 'temp-123' },
          rollback: rollbackFn,
        });
      });

      expect(rollbackFn).not.toHaveBeenCalled();

      // Simulate transaction revert
      mockTxState = {
        status: 'reverted',
        txHash: '0xabc123' as const,
        chainId: 10,
        blockNumber: 100n,
        confirmations: null,
        error: 'REVERT',
        replacedBy: null,
      };

      useEvmTransaction.mockReturnValue({
        state: mockTxState,
        send: jest.fn(),
        reset: jest.fn(),
        lastError: null,
      });

      // Re-render to trigger effect
      const { rerender } = renderHook(() =>
        useEvmTransactionWithOptimistic({
          id: 'test-tx',
          onOptimisticRollback,
        }),
      );

      act(() => {
        rerender();
      });

      await waitFor(() => {
        expect(rollbackFn).toHaveBeenCalled();
      });

      expect(onOptimisticRollback).toHaveBeenCalledWith(
        'TRANSACTION_REVERTED',
        1,
      );
    });
  });

  describe('TRANSACTION_DROPPED', () => {
    it('should rollback optimistic updates when transaction is dropped', async () => {
      let mockTxState = {
        status: 'submitted' as const,
        txHash: '0xabc123' as const,
        chainId: 10,
        blockNumber: null,
        confirmations: null,
        error: null,
        replacedBy: null,
      };

      useEvmTransaction.mockReturnValue({
        state: mockTxState,
        send: jest.fn(),
        reset: jest.fn(),
        lastError: null,
      });

      const rollbackFn = jest.fn();

      const { result } = renderHook(() =>
        useEvmTransactionWithOptimistic({
          id: 'test-tx',
        }),
      );

      act(() => {
        result.current.optimistic.optimistic('display', {
          label: 'Optimistic display',
          optimisticState: { claimId: 'temp-123' },
          rollback: rollbackFn,
        });
      });

      // Simulate transaction drop
      mockTxState = {
        status: 'dropped',
        txHash: '0xabc123' as const,
        chainId: 10,
        blockNumber: null,
        confirmations: null,
        error: 'DROPPED',
        replacedBy: null,
      };

      useEvmTransaction.mockReturnValue({
        state: mockTxState,
        send: jest.fn(),
        reset: jest.fn(),
        lastError: null,
      });

      const { rerender } = renderHook(() =>
        useEvmTransactionWithOptimistic({
          id: 'test-tx',
        }),
      );

      act(() => {
        rerender();
      });

      await waitFor(() => {
        expect(rollbackFn).toHaveBeenCalled();
      });
    });
  });

  describe('TRANSACTION_REPLACED', () => {
    it('should rollback optimistic updates when transaction is replaced', async () => {
      let mockTxState = {
        status: 'submitted' as const,
        txHash: '0xabc123' as const,
        chainId: 10,
        blockNumber: null,
        confirmations: null,
        error: null,
        replacedBy: null,
      };

      useEvmTransaction.mockReturnValue({
        state: mockTxState,
        send: jest.fn(),
        reset: jest.fn(),
        lastError: null,
      });

      const rollbackFn = jest.fn();

      const { result } = renderHook(() =>
        useEvmTransactionWithOptimistic({
          id: 'test-tx',
        }),
      );

      act(() => {
        result.current.optimistic.optimistic('display', {
          label: 'Optimistic display',
          optimisticState: { claimId: 'temp-123' },
          rollback: rollbackFn,
        });
      });

      // Simulate transaction replacement
      mockTxState = {
        status: 'replaced',
        txHash: '0xabc123' as const,
        chainId: 10,
        blockNumber: null,
        confirmations: null,
        error: null,
        replacedBy: '0xdef456',
      };

      useEvmTransaction.mockReturnValue({
        state: mockTxState,
        send: jest.fn(),
        reset: jest.fn(),
        lastError: null,
      });

      const { rerender } = renderHook(() =>
        useEvmTransactionWithOptimistic({
          id: 'test-tx',
        }),
      );

      act(() => {
        rerender();
      });

      await waitFor(() => {
        expect(rollbackFn).toHaveBeenCalled();
      });
    });
  });

  describe('Multiple optimistic updates', () => {
    it('should rollback all optimistic updates on canonical failure', async () => {
      let mockTxState = {
        status: 'submitted' as const,
        txHash: '0xabc123' as const,
        chainId: 10,
        blockNumber: null,
        confirmations: null,
        error: null,
        replacedBy: null,
      };

      useEvmTransaction.mockReturnValue({
        state: mockTxState,
        send: jest.fn(),
        reset: jest.fn(),
        lastError: null,
      });

      const rollback1 = jest.fn();
      const rollback2 = jest.fn();
      const rollback3 = jest.fn();

      const { result } = renderHook(() =>
        useEvmTransactionWithOptimistic({
          id: 'test-tx',
        }),
      );

      // Create multiple optimistic updates
      act(() => {
        result.current.optimistic.optimistic('display', {
          label: 'Display',
          optimisticState: { claimId: 'temp-1' },
          rollback: rollback1,
        });
        result.current.optimistic.optimistic('balance', {
          label: 'Balance',
          optimisticState: { balance: '100' },
          rollback: rollback2,
        });
        result.current.optimistic.optimistic('status', {
          label: 'Status',
          optimisticState: { status: 'pending' },
          rollback: rollback3,
        });
      });

      // Simulate failure
      mockTxState = {
        status: 'reverted',
        txHash: '0xabc123' as const,
        chainId: 10,
        blockNumber: 100n,
        confirmations: null,
        error: 'REVERT',
        replacedBy: null,
      };

      useEvmTransaction.mockReturnValue({
        state: mockTxState,
        send: jest.fn(),
        reset: jest.fn(),
        lastError: null,
      });

      const { rerender } = renderHook(() =>
        useEvmTransactionWithOptimistic({
          id: 'test-tx',
        }),
      );

      act(() => {
        rerender();
      });

      await waitFor(() => {
        expect(rollback1).toHaveBeenCalled();
        expect(rollback2).toHaveBeenCalled();
        expect(rollback3).toHaveBeenCalled();
      });
    });
  });

  describe('Rollback disabling', () => {
    it('should not rollback when enableOptimisticRollback is false', async () => {
      let mockTxState = {
        status: 'submitted' as const,
        txHash: '0xabc123' as const,
        chainId: 10,
        blockNumber: null,
        confirmations: null,
        error: null,
        replacedBy: null,
      };

      useEvmTransaction.mockReturnValue({
        state: mockTxState,
        send: jest.fn(),
        reset: jest.fn(),
        lastError: null,
      });

      const rollbackFn = jest.fn();

      const { result } = renderHook(() =>
        useEvmTransactionWithOptimistic({
          id: 'test-tx',
          enableOptimisticRollback: false,
        }),
      );

      act(() => {
        result.current.optimistic.optimistic('display', {
          label: 'Display',
          optimisticState: { claimId: 'temp-123' },
          rollback: rollbackFn,
        });
      });

      // Simulate failure
      mockTxState = {
        status: 'reverted',
        txHash: '0xabc123' as const,
        chainId: 10,
        blockNumber: 100n,
        confirmations: null,
        error: 'REVERT',
        replacedBy: null,
      };

      useEvmTransaction.mockReturnValue({
        state: mockTxState,
        send: jest.fn(),
        reset: jest.fn(),
        lastError: null,
      });

      const { rerender } = renderHook(() =>
        useEvmTransactionWithOptimistic({
          id: 'test-tx',
          enableOptimisticRollback: false,
        }),
      );

      act(() => {
        rerender();
      });

      await waitFor(() => {
        expect(rollbackFn).not.toHaveBeenCalled();
      });
    });
  });

  describe('Finalization cleanup', () => {
    it('should cleanup optimistic updates when transaction finalizes', async () => {
      let mockTxState = {
        status: 'submitted' as const,
        txHash: '0xabc123' as const,
        chainId: 10,
        blockNumber: null,
        confirmations: null,
        error: null,
        replacedBy: null,
      };

      useEvmTransaction.mockReturnValue({
        state: mockTxState,
        send: jest.fn(),
        reset: jest.fn(),
        lastError: null,
      });

      const { result } = renderHook(() =>
        useEvmTransactionWithOptimistic({
          id: 'test-tx',
        }),
      );

      // Create optimistic update
      act(() => {
        result.current.optimistic.optimistic('display', {
          label: 'Display',
          optimisticState: { claimId: 'temp-123' },
          rollback: () => {},
        });
      });

      expect(result.current.optimistic.getAll()).toHaveLength(1);

      // Simulate finalization
      mockTxState = {
        status: 'finalized',
        txHash: '0xabc123' as const,
        chainId: 10,
        blockNumber: 100n,
        confirmations: 1,
        error: null,
        replacedBy: null,
      };

      useEvmTransaction.mockReturnValue({
        state: mockTxState,
        send: jest.fn(),
        reset: jest.fn(),
        lastError: null,
      });

      const { rerender } = renderHook(() =>
        useEvmTransactionWithOptimistic({
          id: 'test-tx',
        }),
      );

      act(() => {
        rerender();
      });

      await waitFor(() => {
        expect(result.current.optimistic.getAll()).toHaveLength(0);
      });
    });
  });
});
