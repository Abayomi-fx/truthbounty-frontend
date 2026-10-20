/**
 * V2-FE-058 — Optimistic UI Rollback on Canonical Failure
 * In-memory optimistic update manager.
 *
 * Responsibilities:
 *  - Store reversible optimistic updates
 *  - Trigger rollbacks on canonical failure
 *  - Fire lifecycle callbacks
 *  - Prevent memory leaks via cleanup
 */

import type {
  OptimisticUpdate,
  OptimisticUpdateConfig,
  OptimisticUpdateResult,
  OptimisticUpdateStore,
  CanonicalFailureReason,
  RollbackCallback,
  OptimisticUpdateLifecycle,
} from './optimistic.types';

/**
 * Default in-memory store for optimistic updates.
 * Thread-safe (single-threaded JS, but structurally isolated).
 */
export class OptimisticUpdateStore implements OptimisticUpdateStore {
  private updates: Map<string, OptimisticUpdate> = new Map();
  private rollbackCallbacks: RollbackCallback[] = [];
  private lifecycle: OptimisticUpdateLifecycle;

  constructor(lifecycle?: OptimisticUpdateLifecycle) {
    this.lifecycle = lifecycle || {};
  }

  /**
   * Create and store a reversible optimistic update.
   * Throws if validation fails.
   */
  add<T>(config: OptimisticUpdateConfig<T>): OptimisticUpdateResult<T> {
    // Validate config
    if (!config.id || typeof config.id !== 'string') {
      return {
        success: false,
        error: 'Optimistic update id is required and must be a string',
        reason: 'INVALID_PARAMS',
      };
    }

    if (!config.label || typeof config.label !== 'string') {
      return {
        success: false,
        error: 'Optimistic update label is required and must be a string',
        reason: 'INVALID_PARAMS',
      };
    }

    if (typeof config.rollback !== 'function') {
      return {
        success: false,
        error: 'Optimistic update rollback must be a function',
        reason: 'INVALID_PARAMS',
      };
    }

    // Run user-provided validation
    if (config.validate) {
      try {
        config.validate();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Validation failed';
        return {
          success: false,
          error: `Validation error: ${message}`,
          reason: 'VALIDATION_FAILED',
        };
      }
    }

    // Create update snapshot
    const update: OptimisticUpdate<T> = {
      id: config.id,
      txHash: config.txHash ?? null,
      createdAt: Date.now(),
      optimisticState: config.optimisticState,
      rollback: config.rollback,
      label: config.label,
      rolledBack: false,
    };

    // Store
    this.updates.set(config.id, update);

    // Fire lifecycle callback
    this.lifecycle.onCreated?.(update);

    return { success: true, update };
  }

  /**
   * Retrieve an optimistic update by ID.
   */
  get<T>(id: string): OptimisticUpdate<T> | null {
    return (this.updates.get(id) ?? null) as OptimisticUpdate<T> | null;
  }

  /**
   * Get all active optimistic updates.
   */
  getAll(): OptimisticUpdate[] {
    return Array.from(this.updates.values());
  }

  /**
   * Rollback a single update by ID.
   * Returns true if rollback occurred, false if update not found or already rolled back.
   */
  rollback(id: string, reason: CanonicalFailureReason): boolean {
    const update = this.updates.get(id);
    if (!update || update.rolledBack) {
      return false;
    }

    // Fire pre-rollback callback
    this.lifecycle.onRollbackStart?.(reason, update);

    try {
      // Execute rollback function (pure, no side-effects beyond user intent)
      update.rollback();

      // Mark as rolled back (prevent double-rollback)
      (update as Mutable<OptimisticUpdate>).rolledBack = true;

      // Fire rollback callbacks
      for (const callback of this.rollbackCallbacks) {
        callback(reason, update);
      }

      // Fire post-rollback callback
      this.lifecycle.onRollbackEnd?.(reason, update);

      return true;
    } catch (err) {
      console.error(
        `[OptimisticUpdateStore] Rollback failed for ${id}:`,
        err,
      );
      return false;
    }
  }

  /**
   * Rollback all updates associated with a transaction hash.
   * Returns the number of updates that were rolled back.
   */
  rollbackByTxHash(
    txHash: `0x${string}`,
    reason: CanonicalFailureReason,
  ): number {
    let count = 0;
    for (const update of this.updates.values()) {
      if (
        update.txHash &&
        update.txHash.toLowerCase() === txHash.toLowerCase() &&
        this.rollback(update.id, reason)
      ) {
        count++;
      }
    }
    return count;
  }

  /**
   * Remove an update from the store.
   * Typically called after finalized or rolled back.
   */
  remove(id: string): boolean {
    const update = this.updates.get(id);
    if (!update) return false;

    // Fire finalized callback if not already rolled back
    if (!update.rolledBack) {
      this.lifecycle.onFinalized?.(update);
    }

    this.updates.delete(id);
    return true;
  }

  /**
   * Register a callback to fire on every rollback.
   * Returns a cleanup function to deregister.
   */
  onRollback(callback: RollbackCallback): () => void {
    this.rollbackCallbacks.push(callback);
    return () => {
      this.rollbackCallbacks = this.rollbackCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  /**
   * Clear all stored updates.
   * Use with caution — typically only in tests or app reset.
   */
  clear(): void {
    this.updates.clear();
    this.rollbackCallbacks = [];
  }
}

// Utility type for mutable fields (used internally during rollback marking)
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * Global singleton store for optimistic updates.
 * Initialized on first use.
 */
let globalStore: OptimisticUpdateStore | null = null;

/**
 * Get or create the global optimistic update store.
 */
export function getGlobalOptimisticStore(): OptimisticUpdateStore {
  if (!globalStore) {
    globalStore = new OptimisticUpdateStore();
  }
  return globalStore;
}

/**
 * Reset the global store (primarily for testing).
 */
export function resetGlobalOptimisticStore(): void {
  globalStore = null;
}
