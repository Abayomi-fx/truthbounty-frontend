'use client';

/**
 * V2-FE Transaction Status Compound Component
 *
 * Unified transaction status display for all 12 lifecycle states.
 * Integrates ConfirmationProgress, ReorgBanner, and state-specific UI.
 *
 * States handled:
 * - idle: No transaction
 * - preparing: Building transaction
 * - signature-requested: Wallet modal open
 * - submitted: In mempool
 * - confirming: Accumulating confirmations (shows ConfirmationProgress)
 * - safe: Safe threshold reached
 * - indexing: API projection in progress
 * - finalized: Durable success
 * - dropped: Transaction dropped from mempool
 * - replaced: Transaction replaced by another
 * - reverted: Transaction reverted on-chain
 * - reorged: Chain reorganization detected (shows ReorgBanner)
 *
 * Security: Never fabricates transaction state; all values from canonical sources.
 */

import React from 'react';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Wallet,
  Clock,
  Database,
  CheckCheck,
  AlertTriangle,
} from 'lucide-react';
import type { TransactionState } from '@/lib/transaction-machine/transaction-machine.types';
import { ConfirmationProgress } from './ConfirmationProgress';
import { ReorgBanner } from './ReorgBanner';
import type { ReorgBannerView } from '@/lib/reorg-reconciliation';
import { getTransactionExplorerUrl } from '@/lib/explorer';

export interface TransactionStatusProps {
  /** Transaction state from transaction machine */
  state: TransactionState;
  /** Safe confirmation threshold (default: 1 for Optimism) */
  safeThreshold?: number;
  /** Finalized confirmation threshold (default: 12 for Optimism) */
  finalizedThreshold?: number;
  /** Whether indexer has acknowledged the transaction */
  indexerAcknowledged?: boolean;
  /** Current block number for confirmation tracking */
  currentBlockNumber?: bigint;
  /** Retry callback for failed/reorged transactions */
  onRetry?: () => void;
  /** Acknowledge reorg callback */
  onAcknowledgeReorg?: () => void;
  /** Reorg banner view (from useReorgReconciliation) */
  reorgBannerView?: ReorgBannerView;
  /** Custom className */
  className?: string;
}

/**
 * Main compound component that delegates to state-specific sub-components
 */
export function TransactionStatus({
  state,
  safeThreshold = 1,
  finalizedThreshold = 12,
  indexerAcknowledged = false,
  currentBlockNumber,
  onRetry,
  onAcknowledgeReorg,
  reorgBannerView,
  className = '',
}: TransactionStatusProps) {
  const chainId = state.chainId ?? 10;

  switch (state.status) {
    case 'idle':
      return null;

    case 'preparing':
      return <PreparingStatus className={className} />;

    case 'signature-requested':
      return <SignatureRequestedStatus className={className} />;

    case 'submitted':
      return <SubmittedStatus txHash={state.txHash} chainId={chainId} className={className} />;

    case 'confirming': {
      const confirmations = state.confirmations ?? 0;
      return (
        <ConfirmingStatus
          txHash={state.txHash}
          chainId={chainId}
          confirmations={confirmations}
          targetConfirmations={safeThreshold}
          blockNumber={state.blockNumber ?? undefined}
          currentBlockNumber={currentBlockNumber}
          className={className}
        />
      );
    }

    case 'safe':
      return (
        <SafeStatus
          txHash={state.txHash}
          chainId={chainId}
          confirmations={state.confirmations ?? 0}
          className={className}
        />
      );

    case 'indexing':
      return (
        <IndexingStatus
          txHash={state.txHash}
          chainId={chainId}
          confirmations={state.confirmations ?? 0}
          className={className}
        />
      );

    case 'finalized':
      return (
        <FinalizedStatus
          txHash={state.txHash}
          chainId={chainId}
          confirmations={state.confirmations ?? 0}
          indexerAcknowledged={indexerAcknowledged}
          className={className}
        />
      );

    case 'dropped':
      return (
        <DroppedStatus
          txHash={state.txHash}
          chainId={chainId}
          onRetry={onRetry}
          className={className}
        />
      );

    case 'replaced':
      return (
        <ReplacedStatus
          originalHash={state.txHash}
          replacementHash={state.replacedBy}
          chainId={chainId}
          className={className}
        />
      );

    case 'reverted':
      return (
        <RevertedStatus
          txHash={state.txHash}
          chainId={chainId}
          error={state.error}
          onRetry={onRetry}
          className={className}
        />
      );

    case 'reorged':
      return (
        <ReorgedStatus
          txHash={state.txHash}
          chainId={chainId}
          reorgBannerView={reorgBannerView}
          onRetry={onRetry}
          onAcknowledge={onAcknowledgeReorg}
          className={className}
        />
      );

    default:
      // Exhaustive check
      const _exhaustive: never = state;
      return null;
  }
}

// ---------------------------------------------------------------------------
// State-specific sub-components
// ---------------------------------------------------------------------------

function PreparingStatus({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${className}`} role="status" aria-live="polite">
      <Loader2 className="w-4 h-4 animate-spin text-slate-400 motion-reduce:animate-none" aria-hidden="true" />
      <span className="text-slate-400">Preparing transaction...</span>
    </div>
  );
}

function SignatureRequestedStatus({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${className}`} role="status" aria-live="polite">
      <Wallet className="w-4 h-4 text-blue-400" aria-hidden="true" />
      <span className="text-blue-400 font-medium">Waiting for signature...</span>
      <span className="text-slate-500 text-xs">Check your wallet</span>
    </div>
  );
}

function SubmittedStatus({ 
  txHash, 
  chainId, 
  className 
}: { 
  txHash: `0x${string}`; 
  chainId: number; 
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 text-sm ${className}`} role="status" aria-live="polite">
      <Clock className="w-4 h-4 text-slate-400 motion-reduce:animate-none" aria-hidden="true" />
      <span className="text-slate-400">Submitted to network</span>
      <a
        href={getTransactionExplorerUrl(txHash, chainId)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-400 hover:underline"
      >
        View
      </a>
    </div>
  );
}

function ConfirmingStatus({
  txHash,
  chainId,
  confirmations,
  targetConfirmations,
  blockNumber,
  currentBlockNumber,
  className,
}: {
  txHash: `0x${string}`;
  chainId: number;
  confirmations: number;
  targetConfirmations: number;
  blockNumber?: bigint;
  currentBlockNumber?: bigint;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <ConfirmationProgress
        confirmations={confirmations}
        targetConfirmations={targetConfirmations}
        blockNumber={blockNumber}
        showTimeEstimate={true}
      />
      <a
        href={getTransactionExplorerUrl(txHash, chainId)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-400 hover:underline self-start"
      >
        View on explorer
      </a>
    </div>
  );
}

function SafeStatus({
  txHash,
  chainId,
  confirmations,
  className,
}: {
  txHash: `0x${string}`;
  chainId: number;
  confirmations: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="w-5 h-5 text-green-500" aria-hidden="true" />
        <span className="text-green-400 font-medium">Transaction Safe</span>
        <span className="text-slate-500 text-xs">{confirmations} confirmations</span>
      </div>
      <a
        href={getTransactionExplorerUrl(txHash, chainId)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-400 hover:underline self-start"
      >
        View on explorer
      </a>
    </div>
  );
}

function IndexingStatus({
  txHash,
  chainId,
  confirmations,
  className,
}: {
  txHash: `0x${string}`;
  chainId: number;
  confirmations: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm">
        <Database className="w-5 h-5 text-blue-400 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
        <span className="text-blue-400 font-medium">Indexing...</span>
        <span className="text-slate-500 text-xs">{confirmations} confirmations</span>
      </div>
      <a
        href={getTransactionExplorerUrl(txHash, chainId)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-400 hover:underline self-start"
      >
        View on explorer
      </a>
    </div>
  );
}

function FinalizedStatus({
  txHash,
  chainId,
  confirmations,
  indexerAcknowledged,
  className,
}: {
  txHash: `0x${string}`;
  chainId: number;
  confirmations: number;
  indexerAcknowledged: boolean;
  className?: string;
}) {
  const isDurableSuccess = indexerAcknowledged;

  return (
    <div className={`flex flex-col gap-2 ${className}`} role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm">
        <CheckCheck className="w-5 h-5 text-green-600" aria-hidden="true" />
        <span className="text-green-500 font-medium">
          {isDurableSuccess ? 'Confirmed' : 'Finalized'}
        </span>
        <span className="text-slate-500 text-xs">{confirmations} confirmations</span>
      </div>
      {!isDurableSuccess && (
        <span className="text-xs text-slate-500">Waiting for indexer acknowledgement...</span>
      )}
      <a
        href={getTransactionExplorerUrl(txHash, chainId)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-400 hover:underline self-start"
      >
        View on explorer
      </a>
    </div>
  );
}

function DroppedStatus({
  txHash,
  chainId,
  onRetry,
  className,
}: {
  txHash: `0x${string}`;
  chainId: number;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} role="alert" aria-live="assertive">
      <div className="flex items-center gap-2 text-sm">
        <AlertCircle className="w-5 h-5 text-amber-500" aria-hidden="true" />
        <span className="text-amber-400 font-medium">Transaction Dropped</span>
      </div>
      <p className="text-xs text-slate-400">
        Transaction was removed from the mempool. This can happen if gas price was too low or the network was congested.
      </p>
      <div className="flex gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-blue-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-2 py-1"
          >
            Retry Transaction
          </button>
        )}
        <a
          href={getTransactionExplorerUrl(txHash, chainId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:underline"
        >
          View details
        </a>
      </div>
    </div>
  );
}

function ReplacedStatus({
  originalHash,
  replacementHash,
  chainId,
  className,
}: {
  originalHash: `0x${string}`;
  replacementHash: `0x${string}` | null;
  chainId: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm">
        <AlertCircle className="w-5 h-5 text-blue-400" aria-hidden="true" />
        <span className="text-blue-400 font-medium">Transaction Replaced</span>
      </div>
      <p className="text-xs text-slate-400">
        This transaction was replaced by a new one (likely due to gas price adjustment).
      </p>
      {replacementHash && (
        <a
          href={getTransactionExplorerUrl(replacementHash, chainId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:underline"
        >
          View replacement transaction
        </a>
      )}
    </div>
  );
}

function RevertedStatus({
  txHash,
  chainId,
  error,
  onRetry,
  className,
}: {
  txHash: `0x${string}`;
  chainId: number;
  error: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} role="alert" aria-live="assertive">
      <div className="flex items-center gap-2 text-sm">
        <XCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
        <span className="text-red-400 font-medium">Transaction Reverted</span>
      </div>
      {error && (
        <p className="text-xs text-slate-400 font-mono bg-slate-900 p-2 rounded">
          {error}
        </p>
      )}
      <p className="text-xs text-slate-400">
        The transaction was included but reverted on-chain. Check the error details above.
      </p>
      <div className="flex gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-blue-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-2 py-1"
          >
            Retry Transaction
          </button>
        )}
        <a
          href={getTransactionExplorerUrl(txHash, chainId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:underline"
        >
          View on explorer
        </a>
      </div>
    </div>
  );
}

function ReorgedStatus({
  txHash,
  chainId,
  reorgBannerView,
  onRetry,
  onAcknowledge,
  className,
}: {
  txHash: `0x${string}`;
  chainId: number;
  reorgBannerView?: ReorgBannerView;
  onRetry?: () => void;
  onAcknowledge?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {reorgBannerView && reorgBannerView.state !== 'hidden' ? (
        <ReorgBanner
          view={reorgBannerView}
          onAcknowledge={onAcknowledge}
          chainId={chainId}
        />
      ) : (
        <div className="flex flex-col gap-2" role="alert" aria-live="assertive">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-500" aria-hidden="true" />
            <span className="text-amber-400 font-medium">Chain Reorganization Detected</span>
          </div>
          <p className="text-xs text-slate-400">
            This transaction was affected by a chain reorganization and may no longer be valid.
          </p>
        </div>
      )}
      
      <div className="flex gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-blue-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-2 py-1"
          >
            Retry Transaction
          </button>
        )}
        <a
          href={getTransactionExplorerUrl(txHash, chainId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:underline"
        >
          View details
        </a>
      </div>
    </div>
  );
}

export default TransactionStatus;
