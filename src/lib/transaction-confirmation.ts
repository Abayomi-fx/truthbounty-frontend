/**
 * Transaction Confirmation Tracking Utilities
 * 
 * V2-FE Transaction Lifecycle — Pure functions for confirmation counting,
 * finality threshold validation, and polling interval calculation.
 * 
 * Security invariants:
 *  - Never fabricate confirmation counts; always calculated from canonical block numbers
 *  - Fail closed: Return 0 for invalid/stale inputs
 *  - Chain-specific thresholds from canonical configuration only
 * 
 * See: docs/TRANSACTION_CONFIRMATION_FINALITY_MODEL.md
 */

import type { TransactionState, TransactionStatus } from './transaction-machine/transaction-machine.types';

// ---------------------------------------------------------------------------
// Chain-Specific Configuration
// ---------------------------------------------------------------------------

export interface ConfirmationThresholds {
  /** Confirmations required for "safe" status (unlikely to reorg) */
  readonly safeConfirmations: number;
  /** Confirmations required for "finalized" status (L1 finalized) */
  readonly finalizedConfirmations: number;
  /** Average block time in milliseconds */
  readonly blockTimeMs: number;
}

/**
 * Canonical confirmation thresholds per chain.
 * 
 * Optimism L2:
 *  - Safe: 1 conf (~2s) — unlikely to reorg on L2
 *  - Finalized: 12 conf (~24s) — high confidence L1 batch submitted
 */
export const CONFIRMATION_THRESHOLDS: Record<number, ConfirmationThresholds> = {
  // Optimism Mainnet
  10: {
    safeConfirmations: 1,
    finalizedConfirmations: 12,
    blockTimeMs: 2000, // 2 seconds
  },
  // OP Sepolia Testnet
  11155420: {
    safeConfirmations: 1,
    finalizedConfirmations: 12,
    blockTimeMs: 2000,
  },
  // Hardhat Local Fork (dev only)
  31337: {
    safeConfirmations: 1,
    finalizedConfirmations: 1,
    blockTimeMs: 100, // Instant blocks
  },
};

/**
 * Get confirmation thresholds for a given chain.
 * 
 * @param chainId - Chain ID
 * @returns Confirmation thresholds or null if chain not supported
 */
export function getConfirmationThresholds(
  chainId: number,
): ConfirmationThresholds | null {
  return CONFIRMATION_THRESHOLDS[chainId] ?? null;
}

// ---------------------------------------------------------------------------
// Confirmation Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate confirmation count from transaction block and current block.
 * 
 * Formula: (currentBlock - txBlock) + 1
 * 
 * Returns 0 if:
 *  - Transaction not yet included (txBlockNumber is null)
 *  - Current block is stale (< txBlockNumber)
 *  - Invalid inputs
 * 
 * @param txBlockNumber - Block number where transaction was included
 * @param currentBlockNumber - Latest block number from RPC
 * @returns Confirmation count (≥ 0)
 * 
 * @example
 * calculateConfirmations(1000n, 1005n) // => 6 confirmations
 * calculateConfirmations(null, 1005n)  // => 0 (not included)
 * calculateConfirmations(1000n, 999n)  // => 0 (stale current block)
 */
export function calculateConfirmations(
  txBlockNumber: bigint | null,
  currentBlockNumber: bigint,
): number {
  // Transaction not yet included
  if (txBlockNumber === null) return 0;

  // Stale current block (should not happen with proper RPC, but fail closed)
  if (currentBlockNumber < txBlockNumber) return 0;

  // Valid: calculate confirmations
  return Number(currentBlockNumber - txBlockNumber) + 1;
}

/**
 * Calculate confirmation count from transaction state and current block.
 * 
 * Convenience wrapper around calculateConfirmations that extracts blockNumber
 * from transaction state.
 * 
 * @param txState - Transaction state
 * @param currentBlockNumber - Latest block number from RPC
 * @returns Confirmation count (≥ 0)
 */
export function getConfirmationsFromState(
  txState: TransactionState,
  currentBlockNumber: bigint,
): number {
  return calculateConfirmations(txState.blockNumber, currentBlockNumber);
}

// ---------------------------------------------------------------------------
// Finality Checks
// ---------------------------------------------------------------------------

/**
 * Check if transaction has reached "safe" threshold.
 * 
 * Safe: Sufficient confirmations that L2 reorg is unlikely.
 * Does NOT check indexer acknowledgement.
 * 
 * @param confirmations - Current confirmation count
 * @param chainId - Chain ID
 * @returns True if confirmations >= safe threshold for this chain
 */
export function isSafeConfirmations(
  confirmations: number,
  chainId: number,
): boolean {
  const thresholds = getConfirmationThresholds(chainId);
  if (!thresholds) return false; // Unknown chain: fail closed
  return confirmations >= thresholds.safeConfirmations;
}

/**
 * Check if transaction has reached "finalized" threshold.
 * 
 * Finalized: Sufficient confirmations for high confidence in L1 finality.
 * Does NOT check indexer acknowledgement.
 * 
 * @param confirmations - Current confirmation count
 * @param chainId - Chain ID
 * @returns True if confirmations >= finalized threshold for this chain
 */
export function isFinalizedConfirmations(
  confirmations: number,
  chainId: number,
): boolean {
  const thresholds = getConfirmationThresholds(chainId);
  if (!thresholds) return false; // Unknown chain: fail closed
  return confirmations >= thresholds.finalizedConfirmations;
}

/**
 * Determine finality level from confirmation count.
 * 
 * Levels:
 *  - 'none': < safe threshold
 *  - 'safe': >= safe threshold, < finalized threshold
 *  - 'finalized': >= finalized threshold
 * 
 * @param confirmations - Current confirmation count
 * @param chainId - Chain ID
 * @returns Finality level or null if chain not supported
 */
export function getFinalityLevel(
  confirmations: number,
  chainId: number,
): 'none' | 'safe' | 'finalized' | null {
  const thresholds = getConfirmationThresholds(chainId);
  if (!thresholds) return null; // Unknown chain

  if (confirmations >= thresholds.finalizedConfirmations) {
    return 'finalized';
  } else if (confirmations >= thresholds.safeConfirmations) {
    return 'safe';
  } else {
    return 'none';
  }
}

// ---------------------------------------------------------------------------
// Finality Guards (Fail-Closed)
// ---------------------------------------------------------------------------

/**
 * Guard: Can show durable success UI?
 * 
 * Fail-closed: Returns false unless ALL conditions met:
 *  1. Transaction is in 'finalized' state
 *  2. Confirmations >= finalized threshold
 *  3. Indexer has acknowledged (projection updated)
 *  4. Transaction is not reorged
 * 
 * Use this before showing success messages, rewards, reputation updates, etc.
 * 
 * @param txState - Transaction state
 * @param indexerAcknowledged - Whether backend projection is updated
 * @returns True only if durable success can be shown
 */
export function canShowDurableSuccess(
  txState: TransactionState,
  indexerAcknowledged: boolean,
): boolean {
  // Must be in finalized state
  if (txState.status !== 'finalized') return false;

  // Must have valid confirmation count
  if (txState.confirmations === null) return false;

  // Must meet finalized threshold for this chain
  if (!isFinalizedConfirmations(txState.confirmations, txState.chainId)) {
    return false;
  }

  // Must have indexer acknowledgement (projection updated)
  if (!indexerAcknowledged) return false;

  // Must not be reorged
  if (txState.error === 'REORGED') return false;

  return true;
}

/**
 * Guard: Can show provisional success UI?
 * 
 * Provisional: Safe to show optimistic UI (e.g., "Processing...") but not
 * durable success (e.g., rewards claimed).
 * 
 * Returns true if:
 *  - Transaction is in 'safe' or 'indexing' state
 *  - Confirmations >= safe threshold
 *  - Transaction is not reorged
 * 
 * @param txState - Transaction state
 * @returns True if provisional success can be shown
 */
export function canShowProvisionalSuccess(
  txState: TransactionState,
): boolean {
  // Must be in safe, indexing, or finalized state
  const validStates: TransactionStatus[] = ['safe', 'indexing', 'finalized'];
  if (!validStates.includes(txState.status)) return false;

  // Must have valid confirmation count
  if (txState.confirmations === null) return false;

  // Must meet safe threshold for this chain
  if (!isSafeConfirmations(txState.confirmations, txState.chainId)) {
    return false;
  }

  // Must not be reorged
  if (txState.error === 'REORGED') return false;

  return true;
}

/**
 * Guard: Should withhold all success affordances?
 * 
 * Returns true if transaction is in a state where no success UI should be shown:
 *  - Terminal failure states (dropped, reverted, reorged, replaced)
 *  - Pre-inclusion states (idle, preparing, signature-requested)
 *  - Submitted but not yet confirmed
 * 
 * @param txState - Transaction state
 * @returns True if success affordances should be withheld
 */
export function shouldWithholdSuccess(txState: TransactionState): boolean {
  const withholdStates: TransactionStatus[] = [
    'idle',
    'preparing',
    'signature-requested',
    'submitted',
    'dropped',
    'reverted',
    'reorged',
    'replaced',
  ];
  return withholdStates.includes(txState.status);
}

// ---------------------------------------------------------------------------
// Time Estimates
// ---------------------------------------------------------------------------

/**
 * Estimate time remaining to reach safe threshold.
 * 
 * @param confirmations - Current confirmation count
 * @param chainId - Chain ID
 * @returns Estimated milliseconds to safe, or null if already safe or unknown chain
 */
export function estimateTimeToSafe(
  confirmations: number,
  chainId: number,
): number | null {
  const thresholds = getConfirmationThresholds(chainId);
  if (!thresholds) return null;

  if (confirmations >= thresholds.safeConfirmations) return null; // Already safe

  const blocksRemaining = thresholds.safeConfirmations - confirmations;
  return blocksRemaining * thresholds.blockTimeMs;
}

/**
 * Estimate time remaining to reach finalized threshold.
 * 
 * @param confirmations - Current confirmation count
 * @param chainId - Chain ID
 * @returns Estimated milliseconds to finalized, or null if already finalized or unknown chain
 */
export function estimateTimeToFinalized(
  confirmations: number,
  chainId: number,
): number | null {
  const thresholds = getConfirmationThresholds(chainId);
  if (!thresholds) return null;

  if (confirmations >= thresholds.finalizedConfirmations) return null; // Already finalized

  const blocksRemaining = thresholds.finalizedConfirmations - confirmations;
  return blocksRemaining * thresholds.blockTimeMs;
}

/**
 * Format time estimate as human-readable string.
 * 
 * @param ms - Milliseconds
 * @returns Human-readable string (e.g., "~2s", "~30s", "~2m")
 */
export function formatTimeEstimate(ms: number | null): string {
  if (ms === null) return '';
  if (ms < 1000) return '~1s';
  if (ms < 60000) return `~${Math.ceil(ms / 1000)}s`;
  return `~${Math.ceil(ms / 60000)}m`;
}

// ---------------------------------------------------------------------------
// Polling Intervals
// ---------------------------------------------------------------------------

/**
 * Determine polling interval for transaction state.
 * 
 * Intervals:
 *  - submitted: 2000ms (mempool → inclusion)
 *  - confirming: 3000ms (accumulating confirmations)
 *  - safe: 5000ms (awaiting indexer)
 *  - indexing: 5000ms (awaiting backend)
 *  - terminal: null (stop polling)
 * 
 * @param status - Transaction status
 * @returns Polling interval in milliseconds, or null to stop polling
 */
export function getPollingInterval(status: TransactionStatus): number | null {
  const intervals: Record<TransactionStatus, number | null> = {
    idle: null,
    preparing: null,
    'signature-requested': null,
    submitted: 2000,
    confirming: 3000,
    safe: 5000,
    indexing: 5000,
    finalized: null, // Terminal success
    dropped: null, // Terminal failure
    replaced: null, // Terminal failure
    reverted: null, // Terminal failure
    reorged: null, // Terminal failure
  };

  return intervals[status];
}

/**
 * Determine if transaction state should be actively polled.
 * 
 * @param status - Transaction status
 * @returns True if polling should be active
 */
export function shouldPoll(status: TransactionStatus): boolean {
  return getPollingInterval(status) !== null;
}

// ---------------------------------------------------------------------------
// Progress Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate confirmation progress as percentage.
 * 
 * @param confirmations - Current confirmation count
 * @param targetConfirmations - Target (safe or finalized threshold)
 * @returns Progress percentage (0-100)
 */
export function calculateConfirmationProgress(
  confirmations: number,
  targetConfirmations: number,
): number {
  if (targetConfirmations <= 0) return 100;
  const progress = (confirmations / targetConfirmations) * 100;
  return Math.min(Math.max(progress, 0), 100); // Clamp to 0-100
}

/**
 * Determine which threshold to display progress for.
 * 
 * If confirmations >= safe, show progress to finalized.
 * Otherwise, show progress to safe.
 * 
 * @param confirmations - Current confirmation count
 * @param chainId - Chain ID
 * @returns 'safe' | 'finalized' | null
 */
export function getProgressTarget(
  confirmations: number,
  chainId: number,
): 'safe' | 'finalized' | null {
  const thresholds = getConfirmationThresholds(chainId);
  if (!thresholds) return null;

  if (confirmations >= thresholds.safeConfirmations) {
    return 'finalized';
  } else {
    return 'safe';
  }
}

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

/**
 * Validate that confirmation count is consistent with transaction state.
 * 
 * Checks:
 *  - Confirming/safe/finalized states must have confirmations > 0
 *  - Submitted state should have confirmations === null or 0
 *  - Terminal failure states should not have confirmations
 * 
 * @param txState - Transaction state
 * @returns True if confirmation count is consistent with state
 */
export function isConfirmationCountValid(txState: TransactionState): boolean {
  const { status, confirmations } = txState;

  // States that must have confirmations
  const requireConfirmations: TransactionStatus[] = [
    'confirming',
    'safe',
    'indexing',
    'finalized',
  ];
  if (requireConfirmations.includes(status)) {
    return confirmations !== null && confirmations > 0;
  }

  // States that should not have confirmations
  const noConfirmations: TransactionStatus[] = [
    'idle',
    'preparing',
    'signature-requested',
    'submitted',
  ];
  if (noConfirmations.includes(status)) {
    return confirmations === null || confirmations === 0;
  }

  // Reverted: May have confirmations (transaction was included before reverting)
  if (status === 'reverted') {
    return true; // Valid with or without confirmations
  }

  // Other terminal states: Should not have confirmations
  return confirmations === null;
}

/**
 * Validate that transaction state transitions make sense with confirmation counts.
 * 
 * Examples of invalid transitions:
 *  - confirmations decreasing (unless reorg)
 *  - jumping from 1 to 12 confirmations without intermediate states
 * 
 * @param prevState - Previous transaction state
 * @param nextState - Next transaction state
 * @returns True if transition is valid
 */
export function isConfirmationTransitionValid(
  prevState: TransactionState,
  nextState: TransactionState,
): boolean {
  const prevConf = prevState.confirmations ?? 0;
  const nextConf = nextState.confirmations ?? 0;

  // Reorg: Confirmations can reset
  if (nextState.status === 'reorged') return true;

  // Confirmations should only increase (or stay the same)
  if (nextConf < prevConf) return false;

  // Transition from submitted to confirming: Should be 1 confirmation
  if (prevState.status === 'submitted' && nextState.status === 'confirming') {
    return nextConf === 1;
  }

  return true;
}
