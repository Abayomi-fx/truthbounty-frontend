'use client';

import { useTransactionMachine } from '@/hooks/useTransactionMachine';
import { submitVerification } from '@/app/lib/api';
import { TransactionStatusBadge } from '@/components/transactions/TransactionStatusBadge';
import {
  clearPendingTransaction,
  trackPendingTransaction,
} from '@/lib/pending-transactions';
import { ProtocolContractBoundary } from '@/components/protocol/ProtocolContractBoundary';
import { getReleaseChainId } from '@/lib/contracts/registry';
import type { ProtocolLifecycleState } from '@/lib/protocol-contract';
import type { TransactionStatus } from '@/lib/transaction-machine/transaction-machine.types';

function statusToLifecycle(
  status: TransactionStatus,
): ProtocolLifecycleState | undefined {
  switch (status) {
    case 'preparing':
    case 'signature-requested':
    case 'submitted':
    case 'confirming':
    case 'safe':
    case 'indexing':
      return 'pending';
    case 'finalized':
      return 'finalized';
    case 'dropped':
    case 'replaced':
    case 'reverted':
      return 'failed';
    case 'reorged':
      return 'reorged';
    default:
      return undefined;
  }
}

export function VerificationActions({
  claimId,
  stakeAmount,
  chainId,
}: {
  claimId: string;
  stakeAmount: number;
  /** Active wallet chain; defaults to the pinned release chain. */
  chainId?: number;
}) {
  const resolvedChainId = chainId ?? getReleaseChainId();
  const { state, send, reset } = useTransactionMachine({
    id: `verification:${claimId}`,
    label: 'Verification stake',
  });

  const submit = async (decision: 'verify' | 'reject') => {
    if (!stakeAmount || stakeAmount <= 0) {
      console.error('Stake amount is required and must be greater than 0');
      return;
    }

    const transactionId = `verification:${claimId}:${decision}`;

    try {
      send({ type: 'PREPARE', chainId: resolvedChainId });
      
      trackPendingTransaction({
        id: transactionId,
        kind: 'verification',
        title: decision === 'verify' ? 'Verification stake pending' : 'Rejection stake pending',
        description: `Claim ${claimId} is waiting for wallet confirmation.`,
        txHash: null,
        chainId: resolvedChainId,
        machineState: 'preparing',
      });

      send({ type: 'REQUEST_SIGNATURE' });
      
      await submitVerification({ claimId, decision, stakeAmount });
      
      clearPendingTransaction(transactionId);
    } catch (error) {
      clearPendingTransaction(transactionId);
      console.error('Verification failed:', error);
    }
  };

  const isTerminal =
    state.status === 'finalized' ||
    state.status === 'dropped' ||
    state.status === 'replaced' ||
    state.status === 'reverted' ||
    state.status === 'reorged';

  return (
    <ProtocolContractBoundary
      chainId={resolvedChainId}
      lifecycle={statusToLifecycle(state.status)}
      blockWhenNotReady={false}
    >
      <div className="card flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={() => submit('verify')}
            className="btn-primary flex-1 py-3 px-4 text-base min-h-[44px] touch-manipulation transition-colors"
            disabled={state.status !== 'idle'}
          >
            Verify
          </button>
          <button
            onClick={() => submit('reject')}
            className="btn-danger flex-1 py-3 px-4 text-base min-h-[44px] touch-manipulation transition-colors"
            disabled={state.status !== 'idle'}
          >
            Reject
          </button>
        </div>

        {state.status !== 'idle' && (
          <TransactionStatusBadge
            status={state.status}
            txHash={state.txHash}
            replacedBy={state.replacedBy}
            confirmations={state.confirmations}
          />
        )}

        {isTerminal && state.status !== 'finalized' && (
          <button
            onClick={reset}
            className="btn-secondary py-2 px-4 text-sm"
          >
            Try again
          </button>
        )}
      </div>
    </ProtocolContractBoundary>
  );
}
