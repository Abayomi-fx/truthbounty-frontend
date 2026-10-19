/**
 * V2-FE-058 — Optimistic UI Rollback on Canonical Failure
 * Unit tests for useOptimisticUpdates hook.
 */

import { renderHook, act } from '@testing-library/react';
import { useOptimisticUpdates } from '@/hooks/useOptimisticUpdates';
import {
  OptimisticUpdateStore,
  resetGlobalOptimisticStore,
} from '@/lib/optimistic/optimistic-store';

describe('useOptimisticUpdates', () => {
  beforeEach(() => {
    resetGlobalOptimisticStore();
  });

  it('should create a reversible optimistic update', () => {
    const { result } = renderHook(() => useOptimisticUpdates('tx-1'));

    let rollbackCalled = false;

    act(() => {
      const res = result.current.optimistic('update-1', {
        label: 'Test update',
        optimisticState: { value: 42 },
        rollback: () => {
          rollbackCalled = true;
        },
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.update.id).toBe('tx-1:update-1');
      }
    });

    // Verify rollback function works
    act(() => {
      result.current.rollbackAll('TRANSACTION_REVERTED');
    });

    expect(rollbackCalled).toBe(true);
  });

  it('should filter updates by transaction id', () => {
    const { result: result1 } = renderHook(() => useOptimisticUpdates('tx-1'));
    const { result: result2 } = renderHook(() => useOptimisticUpdates('tx-2'));

    act(() => {
      result1.current.optimistic('update-1', {
        label: 'TX1 Update',
        optimisticState: {},
        rollback: () => {},
      });
      result2.current.optimistic('update-1', {
        label: 'TX2 Update',
        optimisticState: {},
        rollback: () => {},
      });
    });

    const tx1Updates = result1.current.getAll();
    const tx2Updates = result2.current.getAll();

    expect(tx1Updates).toHaveLength(1);
    expect(tx2Updates).toHaveLength(1);
    expect(tx1Updates[0].id).toBe('tx-1:update-1');
    expect(tx2Updates[0].id).toBe('tx-2:update-1');
  });

  it('should rollback all updates for a transaction', () => {
    const { result } = renderHook(() => useOptimisticUpdates('tx-1'));

    const rollback1 = jest.fn();
    const rollback2 = jest.fn();

    act(() => {
      result.current.optimistic('update-1', {
        label: 'Test 1',
        optimisticState: {},
        rollback: rollback1,
      });
      result.current.optimistic('update-2', {
        label: 'Test 2',
        optimisticState: {},
        rollback: rollback2,
      });
    });

    act(() => {
      const count = result.current.rollbackAll('TRANSACTION_REVERTED');
      expect(count).toBe(2);
    });

    expect(rollback1).toHaveBeenCalled();
    expect(rollback2).toHaveBeenCalled();
  });

  it('should rollback a single update', () => {
    const { result } = renderHook(() => useOptimisticUpdates('tx-1'));

    const rollback1 = jest.fn();
    const rollback2 = jest.fn();

    act(() => {
      result.current.optimistic('update-1', {
        label: 'Test 1',
        optimisticState: {},
        rollback: rollback1,
      });
      result.current.optimistic('update-2', {
        label: 'Test 2',
        optimisticState: {},
        rollback: rollback2,
      });
    });

    act(() => {
      result.current.rollbackOne('update-1', 'TRANSACTION_REVERTED');
    });

    expect(rollback1).toHaveBeenCalled();
    expect(rollback2).not.toHaveBeenCalled();
  });

  it('should get all updates for a transaction', () => {
    const { result } = renderHook(() => useOptimisticUpdates('tx-1'));

    act(() => {
      result.current.optimistic('update-1', {
        label: 'Test 1',
        optimisticState: {},
        rollback: () => {},
      });
      result.current.optimistic('update-2', {
        label: 'Test 2',
        optimisticState: {},
        rollback: () => {},
      });
    });

    const updates = result.current.getAll();

    expect(updates).toHaveLength(2);
    expect(updates.map((u) => u.label)).toContain('Test 1');
    expect(updates.map((u) => u.label)).toContain('Test 2');
  });

  it('should get a specific update', () => {
    const { result } = renderHook(() => useOptimisticUpdates('tx-1'));

    act(() => {
      result.current.optimistic('update-1', {
        label: 'Test',
        optimisticState: { value: 42 },
        rollback: () => {},
      });
    });

    const update = result.current.getOne('update-1');

    expect(update).not.toBeNull();
    expect(update?.label).toBe('Test');
    expect(update?.optimisticState).toEqual({ value: 42 });
  });

  it('should cleanup an optimistic update', () => {
    const { result } = renderHook(() => useOptimisticUpdates('tx-1'));

    act(() => {
      result.current.optimistic('update-1', {
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
      });
    });

    expect(result.current.getOne('update-1')).not.toBeNull();

    act(() => {
      result.current.cleanup('update-1');
    });

    expect(result.current.getOne('update-1')).toBeNull();
  });

  it('should clear all updates for a transaction', () => {
    const { result } = renderHook(() => useOptimisticUpdates('tx-1'));

    act(() => {
      result.current.optimistic('update-1', {
        label: 'Test 1',
        optimisticState: {},
        rollback: () => {},
      });
      result.current.optimistic('update-2', {
        label: 'Test 2',
        optimisticState: {},
        rollback: () => {},
      });
    });

    expect(result.current.getAll()).toHaveLength(2);

    act(() => {
      result.current.clear();
    });

    expect(result.current.getAll()).toHaveLength(0);
  });

  it('should support custom store', () => {
    const customStore = new OptimisticUpdateStore();
    const { result } = renderHook(() =>
      useOptimisticUpdates('tx-1', { store: customStore }),
    );

    act(() => {
      result.current.optimistic('update-1', {
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
      });
    });

    const storedUpdate = customStore.get('tx-1:update-1');
    expect(storedUpdate).not.toBeNull();
  });

  it('should fire onRollback callback', () => {
    const onRollback = jest.fn();
    const { result } = renderHook(() =>
      useOptimisticUpdates('tx-1', { onRollback }),
    );

    act(() => {
      result.current.optimistic('update-1', {
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
      });
    });

    act(() => {
      result.current.rollbackAll('TRANSACTION_REVERTED');
    });

    expect(onRollback).toHaveBeenCalledWith(
      'TRANSACTION_REVERTED',
      expect.objectContaining({ id: 'tx-1:update-1' }),
    );
  });

  it('should validate optimistic state before creating update', () => {
    const { result } = renderHook(() => useOptimisticUpdates('tx-1'));

    let validationCalled = false;

    act(() => {
      const res = result.current.optimistic('update-1', {
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
        validate: () => {
          validationCalled = true;
          throw new Error('Invalid state');
        },
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.reason).toBe('VALIDATION_FAILED');
      }
    });

    expect(validationCalled).toBe(true);
  });

  it('should handle all failure reasons', () => {
    const reasons = [
      'TRANSACTION_REVERTED',
      'TRANSACTION_DROPPED',
      'TRANSACTION_REPLACED',
      'WRONG_NETWORK',
      'STALE_RECEIPT',
      'USER_REJECTED',
    ] as const;

    for (const reason of reasons) {
      const { result } = renderHook(() => useOptimisticUpdates(`tx-${reason}`));

      const rollbackFn = jest.fn();

      act(() => {
        result.current.optimistic('update-1', {
          label: reason,
          optimisticState: {},
          rollback: rollbackFn,
        });
      });

      act(() => {
        result.current.rollbackAll(reason);
      });

      expect(rollbackFn).toHaveBeenCalled();
    }
  });
});
