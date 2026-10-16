/**
 * Hook for tracking transaction confirmations with polling.
 * 
 * V2-FE Transaction Lifecycle — Polls RPC for current block number and
 * calculates confirmation count, finality status, and time estimates.
 * 
 * Security invariants:
 *  - Never fabricates block numbers; uses only RPC-provided values
 *  - Fails closed: Returns 0 confirmations on errors
 *  - Respects polling intervals to avoid rate limiting
 * 
 * See: docs/TRANSACTION_CONFIRMATION_FINALITY_MODEL.md
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useBlockNumber, useChainId } from 'wagmi';
import {
  calculateConfirmations,
  getConfirmationThresholds,
  isSafeConfirmations,
  isFinalizedConfirmations,
  estimateTimeToSafe,
  estimateTimeToFinalized,
  getFinalityLevel,
} from '@/lib/transaction-confirmation';

export interface UseTransactionConfirmationsOptions {
  /** Transaction hash to track (null if not yet submitted) */
  txHash: `0x${string}` | null;
  /** Chain ID */
  chainId?: number;
  /** Transaction block number (from receipt) */
  txBlockNumber: bigint | null;
  /** Polling interval in ms (default: 3000) */
  pollingInterval?: number;
  /** Whether to enable polling (default: true) */
  enabled?: boolean;
  /** Whether to enable debug logging */
  debug?: boolean;
}

export interface UseTransactionConfirmationsResult {
  /** Current confirmation count */
  confirmations: number;
  /** Current block number from RPC */
  currentBlockNumber: bigint | null;
  /** Whether currently polling */
  isPolling: boolean;
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether confirmations >= safe threshold */
  isSafe: boolean;
  /** Whether confirmations >= finalized threshold */
  isFinalized: boolean;
  /** Finality level: 'none' | 'safe' | 'finalized' | null */
  finalityLevel: 'none' | 'safe' | 'finalized' | null;
  /** Estimated time to safe (ms) */
  estimatedTimeToSafe: number | null;
  /** Estimated time to finalized (ms) */
  estimatedTimeToFinalized: number | null;
  /** Safe confirmation threshold for this chain */
  safeThreshold: number | null;
  /** Finalized confirmation threshold for this chain */
  finalizedThreshold: number | null;
  /** Error message if any */
  error: string | null;
}

/**
 * Track transaction confirmations with automatic polling.
 * 
 * Polls RPC for current block number and calculates:
 *  - Confirmation count
 *  - Safe/finalized status
 *  - Time estimates to reach thresholds
 * 
 * Polling automatically stops when:
 *  - enabled is false
 *  - txHash is null
 *  - txBlockNumber is null
 * 
 * @param options - Hook options
 * @returns Confirmation tracking state
 * 
 * @example
 * const { confirmations, isSafe, isFinalized } = useTransactionConfirmations({
 *   txHash: '0xabc...',
 *   txBlockNumber: 12345n,
 *   pollingInterval: 3000,
 * });
 */
export function useTransactionConfirmations(
  options: UseTransactionConfirmationsOptions,
): UseTransactionConfirmationsResult {
  const {
    txHash,
    chainId: chainIdProp,
    txBlockNumber,
    pollingInterval = 3000,
    enabled = true,
    debug = false,
  } = options;

  // Get current chain ID from wagmi
  const wagmiChainId = useChainId();
  const chainId = chainIdProp ?? wagmiChainId;

  // Get chain configuration
  const thresholds = getConfirmationThresholds(chainId);

  // State
  const [confirmations, setConfirmations] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Use wagmi's useBlockNumber hook with polling
  const shouldPoll = enabled && txHash !== null && txBlockNumber !== null;
  
  const {
    data: currentBlockNumber,
    isLoading,
    error: blockNumberError,
  } = useBlockNumber({
    chainId,
    query: {
      enabled: shouldPoll,
      refetchInterval: shouldPoll ? pollingInterval : false,
    },
  });

  // Track whether we're actively polling
  useEffect(() => {
    setIsPolling(shouldPoll && !isLoading);
  }, [shouldPoll, isLoading]);

  // Calculate confirmations when block number updates
  useEffect(() => {
    if (!currentBlockNumber || !txBlockNumber) {
      setConfirmations(0);
      return;
    }

    const conf = calculateConfirmations(txBlockNumber, currentBlockNumber);
    setConfirmations(conf);

    if (debug) {
      console.log('[useTransactionConfirmations]', {
        txBlockNumber: txBlockNumber.toString(),
        currentBlockNumber: currentBlockNumber.toString(),
        confirmations: conf,
      });
    }
  }, [currentBlockNumber, txBlockNumber, debug]);

  // Handle errors
  useEffect(() => {
    if (blockNumberError) {
      setError(`Failed to fetch block number: ${blockNumberError.message}`);
    } else {
      setError(null);
    }
  }, [blockNumberError]);

  // Calculate derived state
  const isSafe = thresholds
    ? isSafeConfirmations(confirmations, chainId)
    : false;
  const isFinalized = thresholds
    ? isFinalizedConfirmations(confirmations, chainId)
    : false;
  const finalityLevel = getFinalityLevel(confirmations, chainId);
  const estTimeToSafe = estimateTimeToSafe(confirmations, chainId);
  const estTimeToFinalized = estimateTimeToFinalized(confirmations, chainId);

  return {
    confirmations,
    currentBlockNumber: currentBlockNumber ?? null,
    isPolling,
    isLoading,
    isSafe,
    isFinalized,
    finalityLevel,
    estimatedTimeToSafe: estTimeToSafe,
    estimatedTimeToFinalized: estTimeToFinalized,
    safeThreshold: thresholds?.safeConfirmations ?? null,
    finalizedThreshold: thresholds?.finalizedConfirmations ?? null,
    error,
  };
}

/**
 * Hook variant that tracks confirmations for a transaction state object.
 * 
 * Convenience wrapper that extracts txHash and txBlockNumber from state.
 * 
 * @param txState - Transaction state
 * @param options - Additional options
 * @returns Confirmation tracking state
 */
export function useTransactionConfirmationsFromState(
  txState: {
    txHash: `0x${string}` | null;
    blockNumber: bigint | null;
    chainId: number;
  },
  options: Omit<UseTransactionConfirmationsOptions, 'txHash' | 'txBlockNumber' | 'chainId'> = {},
): UseTransactionConfirmationsResult {
  return useTransactionConfirmations({
    ...options,
    txHash: txState.txHash,
    txBlockNumber: txState.blockNumber,
    chainId: txState.chainId,
  });
}

/**
 * Hook for announcement management (accessibility).
 * 
 * Announces confirmation milestones to screen readers without spamming on
 * every block update.
 * 
 * Announces:
 *  - Transaction included (1 confirmation)
 *  - Every 3 confirmations
 *  - Safe threshold reached
 *  - Finalized threshold reached
 * 
 * @param confirmations - Current confirmation count
 * @param safeThreshold - Safe confirmation threshold
 * @param finalizedThreshold - Finalized confirmation threshold
 * @returns Message to announce (empty string if nothing to announce)
 */
export function useConfirmationAnnouncement(
  confirmations: number,
  safeThreshold: number | null,
  finalizedThreshold: number | null,
): string {
  const [lastAnnounced, setLastAnnounced] = useState<number>(0);
  const [announcement, setAnnouncement] = useState<string>('');

  useEffect(() => {
    // Don't announce if no thresholds
    if (safeThreshold === null || finalizedThreshold === null) return;

    let newAnnouncement = '';

    // First confirmation
    if (confirmations === 1 && lastAnnounced === 0) {
      newAnnouncement = 'Transaction included in block';
    }
    // Safe threshold reached
    else if (
      confirmations >= safeThreshold &&
      lastAnnounced < safeThreshold
    ) {
      newAnnouncement = `Transaction safe with ${confirmations} confirmations`;
    }
    // Finalized threshold reached
    else if (
      confirmations >= finalizedThreshold &&
      lastAnnounced < finalizedThreshold
    ) {
      newAnnouncement = `Transaction finalized with ${confirmations} confirmations`;
    }
    // Every 3 confirmations (but not at thresholds already announced)
    else if (
      confirmations > 0 &&
      confirmations % 3 === 0 &&
      confirmations !== lastAnnounced &&
      confirmations < safeThreshold
    ) {
      newAnnouncement = `${confirmations} confirmations received`;
    }

    if (newAnnouncement) {
      setAnnouncement(newAnnouncement);
      setLastAnnounced(confirmations);

      // Clear announcement after screen reader picks it up
      const timer = setTimeout(() => setAnnouncement(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [confirmations, safeThreshold, finalizedThreshold, lastAnnounced]);

  return announcement;
}
