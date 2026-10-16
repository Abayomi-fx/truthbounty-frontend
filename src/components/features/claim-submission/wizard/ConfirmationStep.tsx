/**
 * Confirmation Step (Step 5 of 5)
 * 
 * TODO: Implement confirmation UI with:
 * - Success state (claim ID, tx hash, explorer link, next actions)
 * - Failure state (error reason, technical details, recovery actions)
 * - Focus management
 * - Screen reader announcements
 */

'use client';

import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { Hex } from 'viem';

export interface ConfirmationStepProps {
  status: 'success' | 'failure';
  claimId: string | null;
  transactionHash: Hex | null;
  error: string | null;
  onViewClaim: () => void;
  onCreateAnother: () => void;
  onClose: () => void;
}

export default function ConfirmationStep({
  status,
  claimId,
  transactionHash,
  error,
  onViewClaim,
  onCreateAnother,
  onClose,
}: ConfirmationStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        {status === 'success' ? (
          <>
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-400" aria-hidden="true" />
            <h3 className="text-2xl font-bold text-white mb-2">
              Claim Created Successfully!
            </h3>
            <p className="text-slate-400">
              Your claim has been submitted to the blockchain
            </p>
            {claimId && (
              <div className="mt-4 p-4 bg-[#232329] rounded-lg">
                <div className="text-xs text-slate-500 mb-1">Claim ID</div>
                <div className="text-sm font-mono text-white break-all">{claimId}</div>
              </div>
            )}
            {transactionHash && (
              <div className="mt-2 p-4 bg-[#232329] rounded-lg">
                <div className="text-xs text-slate-500 mb-1">Transaction Hash</div>
                <div className="text-sm font-mono text-white break-all">{transactionHash}</div>
              </div>
            )}
          </>
        ) : (
          <>
            <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" aria-hidden="true" />
            <h3 className="text-2xl font-bold text-white mb-2">
              Submission Failed
            </h3>
            <p className="text-slate-400 mb-4">
              There was an error submitting your claim
            </p>
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm text-left">
                {error}
              </div>
            )}
          </>
        )}
      </div>

      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {status === 'success' 
          ? `Claim created successfully. Claim ID: ${claimId}`
          : `Claim submission failed. ${error}`}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-3 pt-4 border-t border-[#232329]">
        {status === 'success' ? (
          <>
            <button
              onClick={onViewClaim}
              disabled={!claimId}
              className="px-6 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              View Claim
            </button>
            <button
              onClick={onCreateAnother}
              className="px-6 py-2 text-sm font-medium bg-[#232329] hover:bg-[#2a2a32] text-white rounded-lg transition-colors"
            >
              Create Another
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onCreateAnother}
              className="px-6 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium bg-[#232329] hover:bg-[#2a2a32] text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
