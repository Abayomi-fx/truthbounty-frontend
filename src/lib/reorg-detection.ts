/**
 * Reorg Detection Utilities (Pure)
 * 
 * V2-FE Transaction Lifecycle — Pure functions for reorg detection validation,
 * state management, and recovery flow coordination.
 * 
 * Security invariants:
 *  - Only canonical RPC/WebSocket observations trigger reorg state
 *  - Never fabricate reorg events or orphaned block hashes
 *  - Fail closed: On uncertainty, withhold success (don't invent outcomes)
 * 
 * See: docs/TRANSACTION_CONFIRMATION_FINALITY_MODEL.md §4
 */

import type { TransactionState, TransactionStatus } from './transaction-machine/transaction-machine.types';

// ---------------------------------------------------------------------------
// Reorg Detection Types
// ---------------------------------------------------------------------------

export type ReorgDetectionMethod =
  | 'websocket-rollback'
  | 'websocket-replacement'
  | 'rpc-receipt-missing'
  | 'rpc-block-hash-mismatch';

export interface ReorgDetectionResult {
  /** Whether reorg was detected */
  detected: boolean;
  /** Detection method used */
  method: ReorgDetectionMethod | null;
  /** Original block number (before reorg) */
  originalBlockNumber: bigint | null;
  /** Original block hash (if known) */
  originalBlockHash: `0x${string}` | null;
  /** Current block hash at same height (for mismatch detection) */
  currentBlockHash: `0x${string}` | null;
  /** Timestamp when reorg was detected */
  detectedAt: number | null;
}

// ---------------------------------------------------------------------------
// Reorg State Checks
// ---------------------------------------------------------------------------

/**
 * Check if transaction state indicates a reorg.
 * 
 * @param txState - Transaction state
 * @returns True if transaction is in reorged state
 */
export function isReorged(txState: TransactionState): boolean {
  return txState.status === 'reorged';
}

/**
 * Check if transaction state is vulnerable to reorg.
 * 
 * Vulnerable states:
 *  - confirming: Not yet safe
 *  - safe: L2 safe but not L1 finalized
 *  - indexing: Backend processing but not finalized
 * 
 * @param txState - Transaction state
 * @returns True if transaction could be reorged
 */
export function isVulnerableToReorg(txState: TransactionState): boolean {
  const vulnerableStates: TransactionStatus[] = ['confirming', 'safe', 'indexing'];
  return vulnerableStates.includes(txState.status);
}

/**
 * Check if transaction state is reorg-proof.
 * 
 * Reorg-proof:
 *  - finalized: L1 finalized, cannot reorg
 * 
 * @param txState - Transaction state
 * @returns True if transaction cannot be reorged
 */
export function isReorgProof(txState: TransactionState): boolean {
  return txState.status === 'finalized';
}

/**
 * Check if transaction state can transition to reorged.
 * 
 * Only post-SUBMITTED states can transition to reorged:
 *  - submitted, confirming, safe, indexing
 * 
 * Terminal states and pre-submission states cannot reorg.
 * 
 * @param txState - Transaction state
 * @returns True if state can transition to reorged
 */
export function canTransitionToReorged(txState: TransactionState): boolean {
  const canReorgStates: TransactionStatus[] = [
    'submitted',
    'confirming',
    'safe',
    'indexing',
  ];
  return canReorgStates.includes(txState.status);
}

// ---------------------------------------------------------------------------
// Reorg Recovery State
// ---------------------------------------------------------------------------

export type ReorgRecoveryStep =
  | 'detected'
  | 'caches-invalidated'
  | 'user-notified'
  | 'acknowledged'
  | 'retrying';

export interface ReorgRecoveryState {
  /** Current recovery step */
  step: ReorgRecoveryStep;
  /** Whether recovery is in progress */
  isRecovering: boolean;
  /** Whether user has acknowledged the reorg */
  acknowledged: boolean;
  /** Whether user has initiated retry */
  retrying: boolean;
  /** Query keys that were invalidated */
  invalidatedQueryKeys: string[];
}

/**
 * Create initial reorg recovery state.
 * 
 * @returns Initial recovery state
 */
export function createReorgRecoveryState(): ReorgRecoveryState {
  return {
    step: 'detected',
    isRecovering: true,
    acknowledged: false,
    retrying: false,
    invalidatedQueryKeys: [],
  };
}

/**
 * Advance reorg recovery to next step.
 * 
 * @param current - Current recovery state
 * @param nextStep - Next step to transition to
 * @param invalidatedKeys - Query keys invalidated (for caches-invalidated step)
 * @returns Updated recovery state
 */
export function advanceReorgRecovery(
  current: ReorgRecoveryState,
  nextStep: ReorgRecoveryStep,
  invalidatedKeys: string[] = [],
): ReorgRecoveryState {
  return {
    ...current,
    step: nextStep,
    isRecovering: nextStep !== 'acknowledged' && nextStep !== 'retrying',
    acknowledged: nextStep === 'acknowledged' || current.acknowledged,
    retrying: nextStep === 'retrying',
    invalidatedQueryKeys:
      nextStep === 'caches-invalidated'
        ? [...current.invalidatedQueryKeys, ...invalidatedKeys]
        : current.invalidatedQueryKeys,
  };
}

// ---------------------------------------------------------------------------
// Reorg Impact Analysis
// ---------------------------------------------------------------------------

export interface ReorgImpactAnalysis {
  /** Affected transaction states */
  affectedStates: TransactionStatus[];
  /** Whether projections need refresh */
  needsProjectionRefresh: boolean;
  /** Whether pending transactions need validation */
  needsPendingValidation: boolean;
  /** Severity: low (safe tx reorged) | high (finalized tx reorged, should not happen) */
  severity: 'low' | 'high';
  /** Recommended recovery actions */
  recoveryActions: ReorgRecoveryAction[];
}

export type ReorgRecoveryAction =
  | 'invalidate-caches'
  | 'validate-all-receipts'
  | 'clear-pending-state'
  | 'notify-user'
  | 'report-anomaly'; // For finalized tx reorgs (should not happen)

/**
 * Analyze reorg impact on transaction state.
 * 
 * @param txState - Transaction state before reorg
 * @returns Impact analysis and recommended actions
 */
export function analyzeReorgImpact(
  txState: TransactionState,
): ReorgImpactAnalysis {
  const affectedStates: TransactionStatus[] = [txState.status];
  let severity: 'low' | 'high' = 'low';
  const recoveryActions: ReorgRecoveryAction[] = [];

  // Finalized transaction reorged: Should not happen, high severity
  if (txState.status === 'finalized') {
    severity = 'high';
    recoveryActions.push('report-anomaly', 'validate-all-receipts');
  }

  // Safe/indexing reorged: Low severity (expected on L2)
  if (txState.status === 'safe' || txState.status === 'indexing') {
    severity = 'low';
  }

  // Always need to invalidate caches and notify user
  recoveryActions.push('invalidate-caches', 'notify-user');

  // If confirmations were accumulating, validate pending state
  if (txState.status === 'confirming') {
    recoveryActions.push('validate-all-receipts', 'clear-pending-state');
  }

  return {
    affectedStates,
    needsProjectionRefresh: true,
    needsPendingValidation: txState.status === 'confirming',
    severity,
    recoveryActions,
  };
}

// ---------------------------------------------------------------------------
// Reorg Validation
// ---------------------------------------------------------------------------

/**
 * Validate reorg detection event for consistency.
 * 
 * Checks:
 *  - Block number is valid (positive integer)
 *  - Block hash format is valid (0x-prefixed, 64 hex chars)
 *  - Method is known
 * 
 * @param event - Reorg detection event
 * @returns True if event is valid
 */
export function isValidReorgEvent(event: {
  method?: string;
  originalBlockNumber?: unknown;
  originalBlockHash?: unknown;
}): boolean {
  // Method must be known
  const validMethods: ReorgDetectionMethod[] = [
    'websocket-rollback',
    'websocket-replacement',
    'rpc-receipt-missing',
    'rpc-block-hash-mismatch',
  ];
  if (event.method && !validMethods.includes(event.method as ReorgDetectionMethod)) {
    return false;
  }

  // Block number must be positive integer
  if (event.originalBlockNumber !== undefined) {
    const bn = event.originalBlockNumber;
    if (typeof bn === 'bigint') {
      if (bn < 0n) return false;
    } else if (typeof bn === 'number') {
      if (!Number.isInteger(bn) || bn < 0) return false;
    } else {
      return false;
    }
  }

  // Block hash must be valid format if provided
  if (event.originalBlockHash !== undefined) {
    const bh = event.originalBlockHash;
    if (typeof bh !== 'string') return false;
    if (!/^0x[0-9a-fA-F]{64}$/.test(bh)) return false;
  }

  return true;
}

/**
 * Determine if reorg is plausible given confirmation count.
 * 
 * Deep reorgs (many confirmations) are very rare on Optimism L2.
 * Flag suspicious cases for review.
 * 
 * @param confirmations - Confirmations before reorg
 * @param chainId - Chain ID
 * @returns 'plausible' | 'suspicious' | 'anomalous'
 */
export function assessReorgPlausibility(
  confirmations: number,
  chainId: number,
): 'plausible' | 'suspicious' | 'anomalous' {
  // Optimism L2 thresholds
  const OP_CHAINS = [10, 11155420];
  const isOptimism = OP_CHAINS.includes(chainId);

  if (isOptimism) {
    if (confirmations <= 3) return 'plausible'; // Common on L2
    if (confirmations <= 10) return 'suspicious'; // Rare but possible
    return 'anomalous'; // Very rare, investigate
  }

  // Other chains: Use conservative thresholds
  if (confirmations <= 6) return 'plausible';
  if (confirmations <= 20) return 'suspicious';
  return 'anomalous';
}

// ---------------------------------------------------------------------------
// Reorg Notification Content
// ---------------------------------------------------------------------------

export interface ReorgNotificationContent {
  /** Title for banner/modal */
  title: string;
  /** Description of what happened */
  description: string;
  /** Severity indicator */
  severity: 'warning' | 'error';
  /** Recommended action for user */
  action: string;
  /** Whether to show technical details */
  showDetails: boolean;
}

/**
 * Generate user-friendly notification content for reorg.
 * 
 * @param method - Detection method
 * @param confirmations - Confirmations before reorg
 * @param chainId - Chain ID
 * @returns Notification content
 */
export function generateReorgNotification(
  method: ReorgDetectionMethod,
  confirmations: number,
  chainId: number,
): ReorgNotificationContent {
  const plausibility = assessReorgPlausibility(confirmations, chainId);
  const severity = plausibility === 'anomalous' ? 'error' : 'warning';

  let title = 'Chain Reorganization Detected';
  let description =
    'Your transaction was removed from the blockchain due to a chain reorganization. This is a rare but normal occurrence.';
  let action = 'You may retry the transaction.';
  let showDetails = false;

  // Customize based on detection method
  if (method === 'websocket-rollback' || method === 'websocket-replacement') {
    description =
      'The blockchain reorganized, and this transaction was affected. The network detected and notified us immediately.';
  } else if (method === 'rpc-receipt-missing') {
    description =
      'This transaction is no longer found in the blockchain. It may have been replaced or reorged out.';
    showDetails = true;
  } else if (method === 'rpc-block-hash-mismatch') {
    description =
      'The block containing this transaction has a different hash than expected, indicating a blockchain reorganization.';
    showDetails = true;
  }

  // Warn for anomalous reorgs
  if (plausibility === 'anomalous') {
    title = 'Unusual Chain Reorganization';
    description += ` This transaction had ${confirmations} confirmations before being reorged, which is unusual. Please verify the network status.`;
    action = 'Contact support if you continue experiencing issues.';
    severity = 'error';
    showDetails = true;
  }

  return {
    title,
    description,
    severity,
    action,
    showDetails,
  };
}

// ---------------------------------------------------------------------------
// Reorg Metrics (for monitoring/telemetry)
// ---------------------------------------------------------------------------

export interface ReorgMetrics {
  /** Total reorgs detected */
  totalReorgs: number;
  /** Reorgs by detection method */
  byMethod: Record<ReorgDetectionMethod, number>;
  /** Reorgs by depth (confirmations) */
  byDepth: {
    shallow: number; // 0-3 confirmations
    medium: number; // 4-10 confirmations
    deep: number; // 11+ confirmations
  };
  /** Last reorg timestamp */
  lastReorgAt: number | null;
}

/**
 * Create initial reorg metrics.
 */
export function createReorgMetrics(): ReorgMetrics {
  return {
    totalReorgs: 0,
    byMethod: {
      'websocket-rollback': 0,
      'websocket-replacement': 0,
      'rpc-receipt-missing': 0,
      'rpc-block-hash-mismatch': 0,
    },
    byDepth: {
      shallow: 0,
      medium: 0,
      deep: 0,
    },
    lastReorgAt: null,
  };
}

/**
 * Record a reorg in metrics.
 * 
 * @param metrics - Current metrics
 * @param method - Detection method
 * @param confirmations - Confirmations before reorg
 * @returns Updated metrics
 */
export function recordReorgMetric(
  metrics: ReorgMetrics,
  method: ReorgDetectionMethod,
  confirmations: number,
): ReorgMetrics {
  let depthCategory: 'shallow' | 'medium' | 'deep' = 'shallow';
  if (confirmations >= 11) depthCategory = 'deep';
  else if (confirmations >= 4) depthCategory = 'medium';

  return {
    totalReorgs: metrics.totalReorgs + 1,
    byMethod: {
      ...metrics.byMethod,
      [method]: metrics.byMethod[method] + 1,
    },
    byDepth: {
      ...metrics.byDepth,
      [depthCategory]: metrics.byDepth[depthCategory] + 1,
    },
    lastReorgAt: Date.now(),
  };
}
