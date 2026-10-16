/**
 * Transaction Step (Step 4 of 5)
 * 
 * TODO: Implement transaction UI with:
 * - Approval flow (if needed)
 * - Transaction progress (ConfirmationProgress integration)
 * - Error handling with recovery actions
 * - Uses existing useClaimCreationTransaction hook
 */

'use client';

import React from 'react';
import type { Hex } from 'viem';
import type { ClaimFormData } from '@/lib/claim-submission/validation';
import type { EvidenceState } from '@/lib/claim-submission/evidence';

export interface TransactionStepProps {
  claimDetails: ClaimFormData;
  evidence: EvidenceState;
  onTransactionHash: (hash: Hex) => void;
  onClaimId: (id: string) => void;
  onSuccess: () => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export default function TransactionStep({
  claimDetails,
  evidence,
  onTransactionHash,
  onClaimId,
  onSuccess,
  onError,
  onCancel,
}: TransactionStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">
          Submitting Transaction
        </h3>
        <p className="text-sm text-slate-400">
          Please confirm the transaction in your wallet
        </p>
      </div>

      <div className="text-center py-12 text-slate-400">
        [TODO: Implement transaction UI]
        <br />
        Integrates with useClaimCreationTransaction hook
        <br />
        Uses ConfirmationProgress component
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end pt-4 border-t border-[#232329]">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
