/**
 * V2-FE-058 — Optimistic UI Rollback on Canonical Failure
 * Type definitions for reversible optimistic updates.
 *
 * Design principles:
 *  - Optimistic updates are pure, reversible snapshots
 *  - Always paired with a rollback function that restores canonical state
 *  - Tied to transaction lifecycle via state machine events
 *  - Never fabricate data; only extrapolate from confirmed inputs
 *  - Fail closed: validation errors prevent optimistic state creation
 */

/**
 * Canonical failure modes that trigger rollback.
 * Aligned with transaction state machine terminal failure states.
 */
export type CanonicalFailureReason =
  | 'TRANSACTION_REVERTED'    // Receipt status === 0x0
  | 'TRANSACTION_DROPPED'     // Mempool timeout or eviction
  | 'TRANSACTION_REPLACED'    // Same nonce, different hash
  | 'TRANSACTION_REORG'       // Block reorg invalidated transaction
  | 'WRONG_NETWORK'           // User switched networks
  | 'STALE_RECEIPT'           // Receipt chainId mismatch
  | 'USER_REJECTED';          // User rejected signature

/**
 * A pure, reversible snapshot of optimistic state.
 * Must be paired with a rollback function.
 */
export interface OptimisticUpdate<T = unknown> {
  /** Unique identifier for this optimistic update (tied to transaction ID). */
  readonly id: string;

  /** Transaction hash this update is associated with (null until submitted). */
  readonly txHash: `0x${string}` | null;

  /** Timestamp when the optimistic update was created. */
  readonly createdAt: number;

  /** The optimistic state snapshot (what was optimistically shown to the user). */
  readonly optimisticState: T;

  /** Pure function to restore canonical state (called on rollback). */
  readonly rollback: () => void;

  /** Human-readable label for debugging. */
  readonly label: string;

  /** Whether this update has already been rolled back. */
  readonly rolledBack: boolean;
}

/**
 * Configuration for creating a reversible optimistic update.
 */
export interface OptimisticUpdateConfig<T = unknown> {
  /** Unique identifier (e.g., `claim-1:optimize`). */
  id: string;

  /** Human-readable label. */
  label: string;

  /** The optimistic state to apply. */
  optimisticState: T;

  /** Pure function to restore canonical state. */
  rollback: () => void;

  /** Optional initial txHash (available if transaction already submitted). */
  txHash?: `0x${string}`;

  /** Optional validation function — throw to prevent optimistic update. */
  validate?: () => void;
}

/**
 * Result of attempting to create an optimistic update.
 */
export type OptimisticUpdateResult<T = unknown> =
  | { success: true; update: OptimisticUpdate<T> }
  | { success: false; error: string; reason: 'VALIDATION_FAILED' | 'INVALID_PARAMS' };

/**
 * Callback fired when a rollback occurs.
 */
export type RollbackCallback = (
  reason: CanonicalFailureReason,
  update: OptimisticUpdate,
) => void;

/**
 * Storage for active optimistic updates.
 * Maps transaction IDs to their associated updates.
 */
export interface OptimisticUpdateStore {
  /** Create or retrieve an optimistic update. */
  add<T>(config: OptimisticUpdateConfig<T>): OptimisticUpdateResult<T>;

  /** Get an optimistic update by its ID. */
  get<T>(id: string): OptimisticUpdate<T> | null;

  /** Get all active optimistic updates. */
  getAll(): OptimisticUpdate[];

  /** Rollback a single update. */
  rollback(id: string, reason: CanonicalFailureReason): boolean;

  /** Rollback all updates matching a transaction hash. */
  rollbackByTxHash(txHash: `0x${string}`, reason: CanonicalFailureReason): number;

  /** Remove an update (called after finalized or rolled back). */
  remove(id: string): boolean;

  /** Register a callback fired on every rollback. */
  onRollback(callback: RollbackCallback): () => void;

  /** Clear all updates (used for cleanup/testing). */
  clear(): void;
}

/**
 * Lifecycle events for optimistic updates.
 */
export interface OptimisticUpdateLifecycle {
  /** Update was created. */
  onCreated?: (update: OptimisticUpdate) => void;

  /** Update txHash was bound (transaction submitted). */
  onBound?: (update: OptimisticUpdate, txHash: `0x${string}`) => void;

  /** Rollback is about to occur. */
  onRollbackStart?: (reason: CanonicalFailureReason, update: OptimisticUpdate) => void;

  /** Rollback completed. */
  onRollbackEnd?: (reason: CanonicalFailureReason, update: OptimisticUpdate) => void;

  /** Update was finalized (removed after terminal success). */
  onFinalized?: (update: OptimisticUpdate) => void;
}
