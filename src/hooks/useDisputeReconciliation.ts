/**
 * Hook for reconciling dispute opening transactions after finality
 * Tracks bond lock, confirmation, and indexing of challenge submissions
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import {
  DisputeTransaction,
  DisputeReconciliationResult,
  DisputeSubmissionStatus,
} from '@/app/types/dispute';
import {
  trackPendingTransaction,
  clearPendingTransaction,
} from '@/lib/pending-transactions';

interface UseDisputeReconciliationConfig {
  transaction: DisputeTransaction | null;
  confirmations?: number; // Number of blocks to wait (default 1 for Optimism)
  timeout?: number; // Timeout in ms (default 60000)
  onConfirmed?: (result: DisputeReconciliationResult) => void;
  onReverted?: (result: DisputeReconciliationResult) => void;
  onTimeout?: (result: DisputeReconciliationResult) => void;
}

interface DisputeReconciliationHookResult {
  reconcile: () => Promise<DisputeReconciliationResult | null>;
  result: DisputeReconciliationResult | null;
  isWaiting: boolean;
  isReconciling: boolean;
  error: string | null;
  bondLocked: boolean;
  disputeId: string | null;
}

const DEFAULT_CONFIRMATIONS = 1; // Optimism has fast finality
const DEFAULT_TIMEOUT = 60000; // 60 seconds

/**
 * Hook for reconciling dispute opening after transaction confirmation
 * Tracks bond lock and dispute indexing
 */
export function useDisputeReconciliation(
  config: UseDisputeReconciliationConfig
): DisputeReconciliationHookResult {
  const {
    transaction,
    confirmations = DEFAULT_CONFIRMATIONS,
    timeout = DEFAULT_TIMEOUT,
    onConfirmed,
    onReverted,
    onTimeout,
  } = config;

  const publicClient = usePublicClient();

  const [result, setResult] = useState<DisputeReconciliationResult | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bondLocked, setBondLocked] = useState(false);
  const [disputeId, setDisputeId] = useState<string | null>(null);

  // Use Wagmi's built-in receipt waiting
  const {
    data: receipt,
    isLoading: isWaitingForReceipt,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: transaction?.transactionHash as `0x${string}` | undefined,
    confirmations,
    timeout,
  });

  /**
   * Extract dispute ID from transaction logs
   */
  const extractDisputeId = useCallback(
    async (txHash: string): Promise<string | undefined> => {
      try {
        // In production, this would:
        // 1. Parse transaction receipt logs
        // 2. Find DisputeOpened event
        // 3. Decode disputeId from event parameters
        // 4. Event signature: DisputeOpened(bytes32 indexed claimId, bytes32 indexed disputeId, address challenger, uint256 bond)

        throw new Error('Not implemented');
      } catch (err) {
        return undefined;
      }
    },
    []
  );

  /**
   * Extract revert reason from transaction receipt
   */
  const extractRevertReason = useCallback(
    async (txHash: string): Promise<string | undefined> => {
      try {
        // In production, this would:
        // 1. Use Viem's getTransactionReceipt with detailed logs
        // 2. Decode revert reason from receipt logs
        // 3. Parse custom error messages from contract
        // Common revert reasons:
        //   - "Dispute window closed"
        //   - "Dispute already opened"
        //   - "Insufficient bond"
        //   - "Contract paused"

        throw new Error('Not implemented');
      } catch (err) {
        return 'Unknown revert reason';
      }
    },
    []
  );

  /**
   * Query updated wallet balance after bond lock
   */
  const fetchUpdatedBalance = useCallback(
    async (userAddress: string, txHash: string): Promise<string> => {
      try {
        // In production, this would:
        // 1. Call contract.balanceOf(userAddress)
        // 2. Verify balance decreased by bond amount
        // 3. Return new balance

        throw new Error('Not implemented');
      } catch (err) {
        throw new Error(
          `Failed to fetch updated balance: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },
    []
  );

  /**
   * Wait for indexer to catch up with dispute
   */
  const waitForIndexing = useCallback(
    async (disputeIdParam: string, maxRetries = 10): Promise<boolean> => {
      // In production, this would:
      // 1. Poll indexer GET /api/disputes/:disputeId
      // 2. Retry with exponential backoff
      // 3. Return true when dispute is indexed
      // 4. Return false if timeout

      throw new Error('Not implemented');
    },
    []
  );

  /**
   * Track pending transaction in localStorage
   */
  const trackDispute = useCallback((tx: DisputeTransaction) => {
    trackPendingTransaction({
      id: tx.transactionHash,
      kind: 'dispute',
      title: 'Opening Dispute',
      description: `Challenge for claim ${tx.claimId.slice(0, 10)}...`,
      txHash: (tx.transactionHash as `0x${string}`) || null,
      chainId: null,
      machineState: 'submitted',
    });
  }, []);

  /**
   * Clear pending transaction from localStorage
   */
  const clearDispute = useCallback((txHash: string) => {
    clearPendingTransaction(txHash);
  }, []);

  /**
   * Reconcile transaction after confirmation
   */
  const reconcile = useCallback(async (): Promise<DisputeReconciliationResult | null> => {
    if (!transaction || !receipt) return null;

    setIsReconciling(true);
    setError(null);

    try {
      const txHash = transaction.transactionHash;

      // Check if transaction was successful or reverted
      const status =
        receipt.status === 'success' ? 'confirmed' : 'reverted';

      if (status === 'reverted') {
        // Extract revert reason
        const revertReason = await extractRevertReason(txHash);

        const revertedResult: DisputeReconciliationResult = {
          transactionHash: txHash,
          status: 'reverted',
          bondLocked: false,
          bondAmount: transaction.bondAmount,
          newBalance: transaction.from, // Balance unchanged
          error: 'Transaction reverted',
          revertReason,
        };

        setResult(revertedResult);
        setBondLocked(false);
        clearDispute(txHash);
        onReverted?.(revertedResult);

        return revertedResult;
      }

      // Transaction confirmed - extract dispute ID
      const extractedDisputeId = await extractDisputeId(txHash);

      if (!extractedDisputeId) {
        throw new Error('Failed to extract dispute ID from transaction logs');
      }

      // Fetch updated balance
      const newBalance = await fetchUpdatedBalance(
        transaction.from,
        txHash
      );

      // Wait for indexer to catch up
      const indexed = await waitForIndexing(extractedDisputeId);

      const confirmedResult: DisputeReconciliationResult = {
        transactionHash: txHash,
        status: 'confirmed',
        disputeId: extractedDisputeId,
        bondLocked: true,
        bondAmount: transaction.bondAmount,
        newBalance,
      };

      setResult(confirmedResult);
      setBondLocked(true);
      setDisputeId(extractedDisputeId);
      clearDispute(txHash);
      onConfirmed?.(confirmedResult);

      return confirmedResult;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Reconciliation failed';
      setError(errorMsg);

      const errorResult: DisputeReconciliationResult = {
        transactionHash: transaction.transactionHash,
        status: 'reverted',
        bondLocked: false,
        bondAmount: transaction.bondAmount,
        newBalance: transaction.from,
        error: errorMsg,
      };

      setResult(errorResult);
      return errorResult;
    } finally {
      setIsReconciling(false);
    }
  }, [
    transaction,
    receipt,
    extractDisputeId,
    extractRevertReason,
    fetchUpdatedBalance,
    waitForIndexing,
    clearDispute,
    onConfirmed,
    onReverted,
  ]);

  // Auto-reconcile when receipt is available
  useEffect(() => {
    if (receipt && transaction && !result) {
      void reconcile();
    }
  }, [receipt, transaction, result, reconcile]);

  // Track pending transaction when created
  useEffect(() => {
    if (transaction && transaction.status === 'PENDING') {
      trackDispute(transaction);
    }
  }, [transaction, trackDispute]);

  // Handle timeout
  useEffect(() => {
    if (receiptError && transaction) {
      const timeoutResult: DisputeReconciliationResult = {
        transactionHash: transaction.transactionHash,
        status: 'timeout',
        bondLocked: false,
        bondAmount: transaction.bondAmount,
        newBalance: transaction.from,
        error: 'Transaction confirmation timeout',
      };

      setResult(timeoutResult);
      setError('Transaction confirmation timeout');
      clearDispute(transaction.transactionHash);
      onTimeout?.(timeoutResult);
    }
  }, [receiptError, transaction, clearDispute, onTimeout]);

  return {
    reconcile,
    result,
    isWaiting: transaction ? isWaitingForReceipt : false,
    isReconciling,
    error,
    bondLocked,
    disputeId,
  };
}

/**
 * Utility: Check if dispute was successfully opened
 */
export function wasDisputeOpened(
  result: DisputeReconciliationResult | null
): boolean {
  return result?.status === 'confirmed' && result.bondLocked === true;
}

/**
 * Utility: Get human-readable status message
 */
export function getDisputeStatus(
  result: DisputeReconciliationResult | null
): string {
  if (!result) return 'Unknown';

  switch (result.status) {
    case 'confirmed':
      return 'Dispute opened successfully';
    case 'reverted':
      return result.revertReason || 'Transaction failed';
    case 'timeout':
      return 'Transaction confirmation timeout';
    case 'replaced':
      return 'Transaction replaced';
    default:
      return 'Unknown status';
  }
}

/**
 * Utility: Handle duplicate submission attempts
 */
export function isDuplicateSubmission(
  existingTx: DisputeTransaction | null,
  newClaimId: string
): boolean {
  if (!existingTx) return false;
  if (existingTx.status === 'CONFIRMED') return true;
  if (existingTx.status === 'PENDING' && existingTx.claimId === newClaimId) {
    return true;
  }
  return false;
}

/**
 * Utility: Check if transaction was replaced (higher gas)
 */
export function wasTransactionReplaced(
  originalHash: string,
  currentHash: string | undefined
): boolean {
  if (!currentHash) return false;
  return originalHash !== currentHash;
}
