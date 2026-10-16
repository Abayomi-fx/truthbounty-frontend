/**
 * Review Step (Step 3 of 5)
 * 
 * TODO: Implement full review UI with:
 * - Display all claim details
 * - Display evidence info (sanitized)
 * - Show transaction estimate
 * - Fail-closed validation checks
 * - Edit buttons for each section
 */

'use client';

import React from 'react';
import type { ClaimFormData } from '@/lib/claim-submission/validation';
import type { EvidenceState } from '@/lib/claim-submission/evidence';

export interface ReviewStepProps {
  claimDetails: ClaimFormData;
  evidence: EvidenceState;
  onEditDetails: () => void;
  onEditEvidence: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  validationError?: string | null;
}

export default function ReviewStep({
  claimDetails,
  evidence,
  onEditDetails,
  onEditEvidence,
  onSubmit,
  onCancel,
  validationError,
}: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">
          Review Your Claim
        </h3>
        <p className="text-sm text-slate-400">
          Review all information before submitting to the blockchain
        </p>
      </div>

      {validationError && (
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {validationError}
        </div>
      )}

      <div className="text-center py-12 text-slate-400">
        [TODO: Implement review UI]
        <br />
        Title: {claimDetails.title}
        <br />
        Evidence: {evidence.status}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-[#232329]">
        <button
          onClick={onEditDetails}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          Edit Details
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!!validationError}
            className={`
              px-6 py-2 text-sm font-medium rounded-lg transition-colors
              ${!validationError
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-[#232329] text-slate-500 cursor-not-allowed'}
            `}
          >
            Submit to Blockchain
          </button>
        </div>
      </div>
    </div>
  );
}
