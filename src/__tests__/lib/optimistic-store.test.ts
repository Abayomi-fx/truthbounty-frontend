/**
 * V2-FE-058 — Optimistic UI Rollback on Canonical Failure
 * Unit tests for OptimisticUpdateStore.
 */

import {
  OptimisticUpdateStore,
  resetGlobalOptimisticStore,
} from '@/lib/optimistic/optimistic-store';
import type {
  OptimisticUpdateConfig,
  CanonicalFailureReason,
} from '@/lib/optimistic/optimistic.types';

describe('OptimisticUpdateStore', () => {
  let store: OptimisticUpdateStore;

  beforeEach(() => {
    store = new OptimisticUpdateStore();
    resetGlobalOptimisticStore();
  });

  describe('add', () => {
    it('should create and store an optimistic update', () => {
      let rolled = false;
      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test update',
        optimisticState: { value: 42 },
        rollback: () => {
          rolled = true;
        },
      };

      const result = store.add(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.update.id).toBe('test-1');
        expect(result.update.label).toBe('Test update');
        expect(result.update.optimisticState).toEqual({ value: 42 });
        expect(result.update.rolledBack).toBe(false);
        expect(result.update.txHash).toBeNull();
      }
    });

    it('should accept optional txHash on creation', () => {
      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
        txHash: '0xabc123',
      };

      const result = store.add(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.update.txHash).toBe('0xabc123');
      }
    });

    it('should run validation function before storing', () => {
      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
        validate: () => {
          throw new Error('Validation failed');
        },
      };

      const result = store.add(config);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('VALIDATION_FAILED');
        expect(result.error).toContain('Validation failed');
      }
    });

    it('should reject if id is missing', () => {
      const config = {
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
      } as OptimisticUpdateConfig;

      const result = store.add(config);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('INVALID_PARAMS');
      }
    });

    it('should reject if rollback is not a function', () => {
      const config = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: 'not a function',
      } as unknown as OptimisticUpdateConfig;

      const result = store.add(config);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('INVALID_PARAMS');
      }
    });

    it('should fire onCreated lifecycle callback', () => {
      const onCreated = jest.fn();
      const storeWithCallback = new OptimisticUpdateStore({ onCreated });

      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
      };

      storeWithCallback.add(config);

      expect(onCreated).toHaveBeenCalledTimes(1);
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-1' }));
    });
  });

  describe('get', () => {
    it('should retrieve a stored update by id', () => {
      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: { value: 42 },
        rollback: () => {},
      };

      store.add(config);
      const retrieved = store.get('test-1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('test-1');
    });

    it('should return null for non-existent id', () => {
      const retrieved = store.get('does-not-exist');
      expect(retrieved).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return all stored updates', () => {
      const config1: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test 1',
        optimisticState: {},
        rollback: () => {},
      };

      const config2: OptimisticUpdateConfig = {
        id: 'test-2',
        label: 'Test 2',
        optimisticState: {},
        rollback: () => {},
      };

      store.add(config1);
      store.add(config2);

      const all = store.getAll();

      expect(all).toHaveLength(2);
      expect(all.map((u) => u.id)).toContain('test-1');
      expect(all.map((u) => u.id)).toContain('test-2');
    });

    it('should return empty array when no updates stored', () => {
      const all = store.getAll();
      expect(all).toEqual([]);
    });
  });

  describe('rollback', () => {
    it('should call the rollback function', () => {
      const rollbackFn = jest.fn();
      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: rollbackFn,
      };

      store.add(config);
      const success = store.rollback('test-1', 'TRANSACTION_REVERTED');

      expect(success).toBe(true);
      expect(rollbackFn).toHaveBeenCalledTimes(1);
    });

    it('should mark update as rolled back', () => {
      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
      };

      store.add(config);
      store.rollback('test-1', 'TRANSACTION_REVERTED');

      const update = store.get('test-1');
      expect(update?.rolledBack).toBe(true);
    });

    it('should prevent double rollback', () => {
      const rollbackFn = jest.fn();
      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: rollbackFn,
      };

      store.add(config);
      store.rollback('test-1', 'TRANSACTION_REVERTED');
      store.rollback('test-1', 'TRANSACTION_REVERTED');

      expect(rollbackFn).toHaveBeenCalledTimes(1);
    });

    it('should return false for non-existent id', () => {
      const success = store.rollback('does-not-exist', 'TRANSACTION_REVERTED');
      expect(success).toBe(false);
    });

    it('should fire rollback callbacks', () => {
      const callback = jest.fn();
      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
      };

      store.add(config);
      store.onRollback(callback);

      store.rollback('test-1', 'TRANSACTION_REVERTED');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        'TRANSACTION_REVERTED',
        expect.objectContaining({ id: 'test-1' }),
      );
    });

    it('should fire lifecycle callbacks onRollbackStart and onRollbackEnd', () => {
      const onRollbackStart = jest.fn();
      const onRollbackEnd = jest.fn();
      const storeWithCallbacks = new OptimisticUpdateStore({
        onRollbackStart,
        onRollbackEnd,
      });

      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
      };

      storeWithCallbacks.add(config);
      storeWithCallbacks.rollback('test-1', 'TRANSACTION_REVERTED');

      expect(onRollbackStart).toHaveBeenCalledTimes(1);
      expect(onRollbackEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('rollbackByTxHash', () => {
    it('should rollback all updates with matching txHash', () => {
      const rollback1 = jest.fn();
      const rollback2 = jest.fn();
      const rollback3 = jest.fn();

      const config1: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test 1',
        optimisticState: {},
        rollback: rollback1,
        txHash: '0xabc123',
      };

      const config2: OptimisticUpdateConfig = {
        id: 'test-2',
        label: 'Test 2',
        optimisticState: {},
        rollback: rollback2,
        txHash: '0xabc123',
      };

      const config3: OptimisticUpdateConfig = {
        id: 'test-3',
        label: 'Test 3',
        optimisticState: {},
        rollback: rollback3,
        txHash: '0xdef456',
      };

      store.add(config1);
      store.add(config2);
      store.add(config3);

      const count = store.rollbackByTxHash('0xabc123', 'TRANSACTION_REVERTED');

      expect(count).toBe(2);
      expect(rollback1).toHaveBeenCalled();
      expect(rollback2).toHaveBeenCalled();
      expect(rollback3).not.toHaveBeenCalled();
    });

    it('should be case-insensitive for txHash comparison', () => {
      const rollbackFn = jest.fn();
      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: rollbackFn,
        txHash: '0xABC123',
      };

      store.add(config);
      store.rollbackByTxHash('0xabc123', 'TRANSACTION_REVERTED');

      expect(rollbackFn).toHaveBeenCalled();
    });

    it('should return 0 if no matching txHash', () => {
      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
        txHash: '0xabc123',
      };

      store.add(config);
      const count = store.rollbackByTxHash('0xdef456', 'TRANSACTION_REVERTED');

      expect(count).toBe(0);
    });
  });

  describe('remove', () => {
    it('should remove an update from the store', () => {
      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
      };

      store.add(config);
      const success = store.remove('test-1');

      expect(success).toBe(true);
      expect(store.get('test-1')).toBeNull();
    });

    it('should return false for non-existent id', () => {
      const success = store.remove('does-not-exist');
      expect(success).toBe(false);
    });

    it('should fire onFinalized lifecycle callback', () => {
      const onFinalized = jest.fn();
      const storeWithCallback = new OptimisticUpdateStore({ onFinalized });

      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
      };

      storeWithCallback.add(config);
      storeWithCallback.remove('test-1');

      expect(onFinalized).toHaveBeenCalledTimes(1);
    });

    it('should not fire onFinalized if already rolled back', () => {
      const onFinalized = jest.fn();
      const storeWithCallback = new OptimisticUpdateStore({ onFinalized });

      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
      };

      storeWithCallback.add(config);
      storeWithCallback.rollback('test-1', 'TRANSACTION_REVERTED');
      storeWithCallback.remove('test-1');

      // Only the created callback should have fired, not onFinalized
      expect(onFinalized).not.toHaveBeenCalled();
    });
  });

  describe('onRollback', () => {
    it('should register and fire rollback callback', () => {
      const callback = jest.fn();
      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
      };

      store.add(config);
      store.onRollback(callback);
      store.rollback('test-1', 'TRANSACTION_REVERTED');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const callback = jest.fn();
      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: () => {},
      };

      store.add(config);
      const unsubscribe = store.onRollback(callback);
      unsubscribe();

      store.rollback('test-1', 'TRANSACTION_REVERTED');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all stored updates', () => {
      const config1: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test 1',
        optimisticState: {},
        rollback: () => {},
      };

      const config2: OptimisticUpdateConfig = {
        id: 'test-2',
        label: 'Test 2',
        optimisticState: {},
        rollback: () => {},
      };

      store.add(config1);
      store.add(config2);
      store.clear();

      expect(store.getAll()).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle rollback function throwing error gracefully', () => {
      const config: OptimisticUpdateConfig = {
        id: 'test-1',
        label: 'Test',
        optimisticState: {},
        rollback: () => {
          throw new Error('Rollback failed');
        },
      };

      store.add(config);

      // Should not throw, should return false
      const success = store.rollback('test-1', 'TRANSACTION_REVERTED');

      expect(success).toBe(false);
    });

    it('should handle multiple failure reasons correctly', () => {
      const reasons: CanonicalFailureReason[] = [
        'TRANSACTION_REVERTED',
        'TRANSACTION_DROPPED',
        'TRANSACTION_REPLACED',
        'WRONG_NETWORK',
        'STALE_RECEIPT',
        'USER_REJECTED',
      ];

      for (const reason of reasons) {
        const rollbackFn = jest.fn();
        const config: OptimisticUpdateConfig = {
          id: `test-${reason}`,
          label: reason,
          optimisticState: {},
          rollback: rollbackFn,
        };

        store.add(config);
        store.rollback(`test-${reason}`, reason);

        expect(rollbackFn).toHaveBeenCalled();
      }
    });
  });
});
