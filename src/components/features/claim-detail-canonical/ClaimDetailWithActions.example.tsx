/**
 * ClaimDetailWithActions — Example showing complete wallet integration
 *
 * This file demonstrates how to integrate ClaimDetailView with:
 * - Wallet connection UI
 * - Action workflows (verify, dispute)
 * - Transaction submission
 * - Success/error handling
 *
 * NOT FOR PRODUCTION USE - This is a reference implementation.
 */

'use client';

import React from 'react';
import { ClaimDetailView } from './ClaimDetailView';
import { ClaimDetailErrorBoundary } from './ClaimDetailErrorBoundary';
import { useClaimActionWorkflow } from '@/hooks/useClaimActionWorkflow';
import { useCanonicalWallet } from '@/hooks/useCanonicalWallet';

export interface ClaimDetailWithActionsProps {
  claimId: string;
}

/**
 * Example component showing complete integration with wallet and actions.
 */
export function ClaimDetailWithActions({ claimId }: ClaimDetailWithActionsProps) {
  const wallet = useCanonicalWallet();
  const workflow = useClaimActionWorkflow(claimId);

  const handleVerify = React.useCallback(() => {
    if (wallet.status !== 'ready') {
      // Prompt wallet connection
      if (wallet.status === 'disconnected') {
        wallet.connect();
      }
      return;
    }

    // Open verify modal/workflow
    workflow.openVerify();
  }, [wallet, workflow]);

  const handleDispute = React.useCallback(() => {
    if (wallet.status !== 'ready') {
      // Prompt wallet connection
      if (wallet.status === 'disconnected') {
        wallet.connect();
      }
      return;
    }

    // Open dispute modal/workflow
    workflow.openDispute();
  }, [wallet, workflow]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Wallet connection banner (when disconnected) */}
      {wallet.status === 'disconnected' && (
        <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-400 mb-3">
            Connect your wallet to verify or dispute claims
          </p>
          <button
            onClick={() => wallet.connect()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Connect Wallet
          </button>
        </div>
      )}

      {/* Main claim detail view */}
      <ClaimDetailErrorBoundary claimId={claimId}>
        <ClaimDetailView
          claimId={claimId}
          onVerify={handleVerify}
          onDispute={handleDispute}
        />
      </ClaimDetailErrorBoundary>

      {/* Action workflow modals would go here */}
      {/* Example: VerifyModal, DisputeModal components */}
      {workflow.state.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#18181b] border border-[#232329] rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-white mb-4">
              {workflow.state.action === 'verify' ? 'Verify Claim' : 'Dispute Claim'}
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              This is a placeholder. Implement the actual {workflow.state.action} form here.
            </p>
            
            {workflow.state.error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
                {workflow.state.error.message}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => workflow.close()}
                disabled={workflow.state.isSubmitting}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Simulate transaction submission
                  workflow.submit('0x1234...');
                  // In real implementation, submit actual transaction here
                  setTimeout(() => workflow.onSuccess(), 1000);
                }}
                disabled={workflow.state.isSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {workflow.state.isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Example with custom wallet connection flow.
 */
export function ClaimDetailWithCustomWalletUI({ claimId }: ClaimDetailWithActionsProps) {
  const wallet = useCanonicalWallet();

  // Handle unsupported network
  const handleNetworkSwitch = React.useCallback(async () => {
    try {
      await wallet.switchToSupportedNetwork();
    } catch (error) {
      console.error('Failed to switch network:', error);
    }
  }, [wallet]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Custom wallet status UI */}
      {wallet.status === 'loading' && (
        <div className="mb-4 p-4 bg-gray-800 border border-gray-700 rounded-lg text-center">
          <p className="text-sm text-gray-400">Connecting wallet...</p>
        </div>
      )}

      {wallet.status === 'unsupported' && (
        <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-sm text-yellow-500 mb-3">
            You're connected to an unsupported network. Please switch to Optimism or OP Sepolia.
          </p>
          <button
            onClick={handleNetworkSwitch}
            className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Switch Network
          </button>
        </div>
      )}

      {wallet.status === 'account_error' && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400 mb-3">
            {wallet.connectorError?.message ?? 'Wallet connection error'}
          </p>
          <button
            onClick={() => wallet.reconnect()}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Reconnect
          </button>
        </div>
      )}

      {wallet.status === 'config_error' && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">
            Wallet configuration error. Please refresh the page.
          </p>
        </div>
      )}

      {/* Main claim detail view */}
      <ClaimDetailErrorBoundary claimId={claimId}>
        <ClaimDetailView claimId={claimId} />
      </ClaimDetailErrorBoundary>
    </div>
  );
}
