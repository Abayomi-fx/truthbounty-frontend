/**
 * Evidence Upload Step (Step 2 of 5)
 * 
 * TODO: Implement full evidence upload with:
 * - File upload with drag & drop
 * - URL input option
 * - Progress bar (ARIA progressbar)
 * - Hash calculation UI
 * - Verification status
 * - Wallet change detection
 */

'use client';

import React from 'react';
import type { EvidenceState } from '@/lib/claim-submission/evidence';

export interface EvidenceUploadStepProps {
  evidenceState: EvidenceState;
  onEvidenceUpdate: (state: EvidenceState) => void;
  onNext: () => void;
  onBack: () => void;
  onCancel: () => void;
}

export default function EvidenceUploadStep({
  evidenceState,
  onEvidenceUpdate,
  onNext,
  onBack,
  onCancel,
}: EvidenceUploadStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">
          Evidence Upload
        </h3>
        <p className="text-sm text-slate-400">
          Upload evidence file or provide evidence URL
        </p>
      </div>

      <div className="text-center py-12 text-slate-400">
        [TODO: Implement evidence upload UI]
        <br />
        Current status: {evidenceState.status}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-[#232329]">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onNext}
            disabled={!evidenceState.canProceed}
            className={`
              px-6 py-2 text-sm font-medium rounded-lg transition-colors
              ${evidenceState.canProceed
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-[#232329] text-slate-500 cursor-not-allowed'}
            `}
          >
            Next: Review
          </button>
        </div>
      </div>
    </div>
  );
}
