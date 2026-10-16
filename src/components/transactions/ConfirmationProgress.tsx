'use client';

/**
 * V2-FE Transaction Confirmation Progress Component
 *
 * Displays confirmation progress with:
 * - Progress bar with ARIA progressbar role
 * - Current confirmations / target confirmations
 * - Time estimate to completion
 * - Accessible labels for screen readers
 * - Compact mode for inline display
 *
 * Fail-closed: Never fabricates confirmation counts or block numbers.
 * All values must come from canonical RPC sources.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { calculateConfirmationProgress, formatTimeEstimate } from '@/lib/transaction-confirmation';

export interface ConfirmationProgressProps {
  /** Current confirmation count (from RPC) */
  confirmations: number;
  /** Target confirmation count (safe or finalized threshold) */
  targetConfirmations: number;
  /** Current block number (for display, optional) */
  blockNumber?: bigint;
  /** Compact mode: hide progress bar, show only counts */
  compact?: boolean;
  /** Show time estimate (requires blockTimeMs) */
  showTimeEstimate?: boolean;
  /** Block time in milliseconds (default: 2000ms for Optimism) */
  blockTimeMs?: number;
  /** Custom className for styling */
  className?: string;
}

export function ConfirmationProgress({
  confirmations,
  targetConfirmations,
  blockNumber,
  compact = false,
  showTimeEstimate = true,
  blockTimeMs = 2000,
  className = '',
}: ConfirmationProgressProps) {
  // Calculate progress percentage (0-100)
  const progress = calculateConfirmationProgress(confirmations, targetConfirmations);

  // Calculate time estimate
  const remainingBlocks = Math.max(0, targetConfirmations - confirmations);
  const estimatedTimeMs = remainingBlocks * blockTimeMs;
  const timeEstimate = showTimeEstimate && remainingBlocks > 0 
    ? formatTimeEstimate(estimatedTimeMs) 
    : null;

  // Accessible label
  const ariaLabel = `Transaction confirming, ${confirmations} of ${targetConfirmations} confirmations`;

  return (
    <div 
      className={`flex flex-col gap-2 ${className}`}
      data-testid="confirmation-progress"
    >
      {/* Header: Icon + Counts + Time Estimate */}
      <div className="flex items-center gap-2 text-sm">
        <Loader2 
          className="w-4 h-4 animate-spin text-orange-400 motion-reduce:animate-none" 
          aria-hidden="true" 
        />
        <span className="font-medium text-orange-300">
          Confirming...
        </span>
        <span className="text-slate-400">
          {confirmations} / {targetConfirmations}
        </span>
        {timeEstimate && (
          <span className="text-slate-500 text-xs">
            {timeEstimate} remaining
          </span>
        )}
      </div>

      {/* Progress Bar (hidden in compact mode) */}
      {!compact && (
        <div
          role="progressbar"
          aria-label={ariaLabel}
          aria-valuenow={confirmations}
          aria-valuemin={0}
          aria-valuemax={targetConfirmations}
          className="w-full h-2 bg-slate-800 rounded-full overflow-hidden"
          data-testid="confirmation-progress-bar"
        >
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Block Number (optional) */}
      {blockNumber !== undefined && (
        <div className="text-xs text-slate-500 font-mono">
          Block #{blockNumber.toString()}
        </div>
      )}

      {/* Screen reader announcement */}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {ariaLabel}
        {timeEstimate && `, approximately ${timeEstimate} remaining`}
      </span>
    </div>
  );
}

export default ConfirmationProgress;
