/**
 * Hook for detecting reorgs via RPC validation.
 * 
 * V2-FE Transaction Lifecycle — Validates transaction receipts and block hashes
 * to detect chain reorganizations when WebSocket events are missed/delayed.
 * 
 * Detection methods:
 *  1. Receipt validation: RPC returns null for previously seen txHash
 *  2. Block hash mismatch: Receipt's blockHash ≠ RPC block hash for same height
 * 
 * Security invariants:
 *  - Detects reorgs only via canonical RPC observation
 *  - Never fabricates reorg events
 *  - Fails closed: On RPC errors, assume uncertainty (do not show success)
 * 
 * See: docs/TRANSACTION_CONFIRMATION_FINALITY_MODEL.md §4
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { usePublicClient, useChainId } from 'wagmi';
import type { PublicClient, Block } from 'viem';

export interface UseReorgDetectionOptions {
  /** Transaction hash to monitor */
  txHash: `0x${string}` | null;
  /** Chain ID */
  chainId?: number;
  /** Transaction block number (from receipt) */
  txBlockNumber: bigint | null;
  /** Block hash from original receipt (for validation) */
  txBlockHash: `0x${string}` | null;
  /** Validation interval in ms (default: 5000) */
  validationInterval?: number;
  /** Whether to enable detection (default: true) */
  enabled?: boolean;
  /** Callback when reorg detected */
  onReorg?: (event: ReorgDetectionEvent) => void;
  /** Whether to enable debug logging */
  debug?: boolean;
}

export interface ReorgDetectionEvent {
  /** Detection method */
  method: 'receipt-missing' | 'block-hash-mismatch';
  /** Transaction hash that was reorged */
  txHash: `0x${string}`;
  /** Original block number */
  originalBlockNumber: bigint;
  /** Original block hash (if known) */
  originalBlockHash?: `0x${string}`;
  /** Current block hash at same height (for mismatch) */
  currentBlockHash?: `0x${string}`;
  /** Timestamp of detection */
  detectedAt: number;
}

export interface UseReorgDetectionResult {
  /** Whether a reorg has been detected */
  reorgDetected: boolean;
  /** Reorg event details (if detected) */
  reorgEvent: ReorgDetectionEvent | null;
  /** Whether currently monitoring */
  isMonitoring: boolean;
  /** Whether validation is in progress */
  isValidating: boolean;
  /** Clear reorg state (user acknowledged) */
  clearReorg: () => void;
  /** Error message if any */
  error: string | null;
}

/**
 * Detect transaction reorgs via RPC receipt and block validation.
 * 
 * Validates:
 *  1. Receipt still exists at RPC (eth_getTransactionReceipt)
 *  2. Block hash matches original receipt (eth_getBlockByNumber)
 * 
 * Runs validation periodically when:
 *  - enabled is true
 *  - txHash is not null
 *  - txBlockNumber is not null
 * 
 * @param options - Hook options
 * @returns Reorg detection state
 * 
 * @example
 * const { reorgDetected, reorgEvent, clearReorg } = useReorgDetection({
 *   txHash: '0xabc...',
 *   txBlockNumber: 12345n,
 *   txBlockHash: '0xdef...',
 *   onReorg: (event) => console.log('Reorg detected:', event),
 * });
 */
export function useReorgDetection(
  options: UseReorgDetectionOptions,
): UseReorgDetectionResult {
  const {
    txHash,
    chainId: chainIdProp,
    txBlockNumber,
    txBlockHash,
    validationInterval = 5000,
    enabled = true,
    onReorg,
    debug = false,
  } = options;

  // Get current chain ID and public client
  const wagmiChainId = useChainId();
  const chainId = chainIdProp ?? wagmiChainId;
  const publicClient = usePublicClient({ chainId });

  // State
  const [reorgDetected, setReorgDetected] = useState(false);
  const [reorgEvent, setReorgEvent] = useState<ReorgDetectionEvent | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for stable callbacks
  const onReorgRef = useRef(onReorg);
  useEffect(() => {
    onReorgRef.current = onReorg;
  }, [onReorg]);

  // Determine if monitoring should be active
  const shouldMonitor =
    enabled &&
    txHash !== null &&
    txBlockNumber !== null &&
    !reorgDetected &&
    publicClient !== undefined;

  /**
   * Validate transaction receipt still exists.
   */
  const validateReceipt = useCallback(
    async (
      client: PublicClient,
      hash: `0x${string}`,
      expectedBlockNumber: bigint,
    ): Promise<ReorgDetectionEvent | null> => {
      try {
        const receipt = await client.getTransactionReceipt({ hash });

        if (!receipt) {
          // Receipt missing: Transaction was reorged out
          if (debug) {
            console.log('[useReorgDetection] Receipt missing for', hash);
          }
          return {
            method: 'receipt-missing',
            txHash: hash,
            originalBlockNumber: expectedBlockNumber,
            detectedAt: Date.now(),
          };
        }

        if (debug) {
          console.log('[useReorgDetection] Receipt found', {
            hash,
            blockNumber: receipt.blockNumber,
            blockHash: receipt.blockHash,
          });
        }

        return null; // Receipt still exists
      } catch (err) {
        // RPC error: Don't treat as reorg, but log
        if (debug) {
          console.error('[useReorgDetection] Receipt validation error:', err);
        }
        throw err;
      }
    },
    [debug],
  );

  /**
   * Validate block hash matches original receipt.
   */
  const validateBlockHash = useCallback(
    async (
      client: PublicClient,
      hash: `0x${string}`,
      blockNumber: bigint,
      originalBlockHash: `0x${string}`,
    ): Promise<ReorgDetectionEvent | null> => {
      try {
        const block: Block | null = await client.getBlock({
          blockNumber,
        });

        if (!block) {
          // Block missing: Possible reorg or RPC issue
          if (debug) {
            console.log('[useReorgDetection] Block missing at height', blockNumber);
          }
          // Don't treat as definitive reorg; could be RPC lag
          return null;
        }

        // Normalize hashes for comparison (lowercase)
        const currentHash = block.hash?.toLowerCase();
        const expectedHash = originalBlockHash.toLowerCase();

        if (currentHash !== expectedHash) {
          // Block hash mismatch: Chain reorged
          if (debug) {
            console.log('[useReorgDetection] Block hash mismatch', {
              blockNumber,
              expected: expectedHash,
              current: currentHash,
            });
          }
          return {
            method: 'block-hash-mismatch',
            txHash: hash,
            originalBlockNumber: blockNumber,
            originalBlockHash,
            currentBlockHash: currentHash as `0x${string}`,
            detectedAt: Date.now(),
          };
        }

        if (debug) {
          console.log('[useReorgDetection] Block hash matches');
        }

        return null; // Block hash matches
      } catch (err) {
        if (debug) {
          console.error('[useReorgDetection] Block validation error:', err);
        }
        throw err;
      }
    },
    [debug],
  );

  /**
   * Run validation checks.
   */
  const runValidation = useCallback(async () => {
    if (!publicClient || !txHash || !txBlockNumber) return;

    setIsValidating(true);
    setError(null);

    try {
      // 1. Check if receipt still exists
      const receiptReorg = await validateReceipt(
        publicClient,
        txHash,
        txBlockNumber,
      );

      if (receiptReorg) {
        setReorgDetected(true);
        setReorgEvent(receiptReorg);
        onReorgRef.current?.(receiptReorg);
        return;
      }

      // 2. If we have original block hash, validate it matches
      if (txBlockHash) {
        const blockHashReorg = await validateBlockHash(
          publicClient,
          txHash,
          txBlockNumber,
          txBlockHash,
        );

        if (blockHashReorg) {
          setReorgDetected(true);
          setReorgEvent(blockHashReorg);
          onReorgRef.current?.(blockHashReorg);
          return;
        }
      }

      // No reorg detected
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Validation error: ${message}`);
      
      // On RPC errors, fail closed: Don't show success, but don't fabricate reorg
      if (debug) {
        console.error('[useReorgDetection] Validation failed:', err);
      }
    } finally {
      setIsValidating(false);
    }
  }, [
    publicClient,
    txHash,
    txBlockNumber,
    txBlockHash,
    validateReceipt,
    validateBlockHash,
    debug,
  ]);

  /**
   * Clear reorg state (user acknowledged).
   */
  const clearReorg = useCallback(() => {
    setReorgDetected(false);
    setReorgEvent(null);
    setError(null);
  }, []);

  /**
   * Set up validation interval.
   */
  useEffect(() => {
    if (!shouldMonitor) {
      setIsValidating(false);
      return;
    }

    // Run initial validation immediately
    runValidation();

    // Set up interval for periodic validation
    const intervalId = setInterval(runValidation, validationInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [shouldMonitor, runValidation, validationInterval]);

  return {
    reorgDetected,
    reorgEvent,
    isMonitoring: shouldMonitor,
    isValidating,
    clearReorg,
    error,
  };
}

/**
 * Hook for integrated reorg detection (WebSocket + RPC).
 * 
 * Combines:
 *  1. WebSocket ROLLBACK events (primary, from useReorgReconciliation)
 *  2. RPC validation (fallback, from useReorgDetection)
 * 
 * Use this when you need comprehensive reorg detection with fallback.
 * 
 * @param options - Combined options
 * @returns Integrated reorg detection state
 */
export function useIntegratedReorgDetection(
  options: UseReorgDetectionOptions & {
    /** Whether WebSocket detected a reorg */
    websocketReorgDetected?: boolean;
  },
): UseReorgDetectionResult {
  const {
    websocketReorgDetected = false,
    ...reorgOptions
  } = options;

  const rpcDetection = useReorgDetection(reorgOptions);

  // Combine WebSocket and RPC detection
  const reorgDetected = websocketReorgDetected || rpcDetection.reorgDetected;

  return {
    ...rpcDetection,
    reorgDetected,
  };
}

/**
 * Utility: Create reorg event from WebSocket ROLLBACK payload.
 * 
 * Converts backend reorg event to ReorgDetectionEvent format.
 * 
 * @param rollbackEvent - WebSocket ROLLBACK event
 * @param txHash - Transaction hash that was affected
 * @returns ReorgDetectionEvent
 */
export function reorgEventFromWebSocket(
  rollbackEvent: {
    blockNumber: number;
    lastValidCursor?: string;
  },
  txHash: `0x${string}`,
): ReorgDetectionEvent {
  return {
    method: 'receipt-missing', // WebSocket doesn't distinguish method
    txHash,
    originalBlockNumber: BigInt(rollbackEvent.blockNumber),
    detectedAt: Date.now(),
  };
}
