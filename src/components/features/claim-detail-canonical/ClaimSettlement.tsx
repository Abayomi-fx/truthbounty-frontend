'use client';

/**
 * ClaimSettlement — Settlement state and finalization display
 *
 * Shows settlement transaction and finalization status. Never fabricates
 * settlement or finality; all fields null when not settled. Finalized and
 * merely-confirmed states remain distinct.
 */

import { CheckCircle2, Clock, ExternalLink, AlertTriangle } from 'lucide-react';
import type { ClaimDetailProjection } from '@/app/types/claim-detail-projection';
import { resolveFinalityState } from '@/app/lib/protocol-time';
import { formatLocalDateTime, formatUtcDateTime } from '@/app/lib/format';

export interface ClaimSettlementProps {
  claim: ClaimDetailProjection;
}

export function ClaimSettlement({ claim }: ClaimSettlementProps) {
  const { settlement } = claim;

  // No settlement yet
  if (!settlement.settledAt || !settlement.settlementTxHash) {
    return null;
  }

  const explorerUrl = `https://optimistic.etherscan.io/tx/${settlement.settlementTxHash}`;
  const settledMs = new Date(settlement.settledAt).getTime();
  const localSettled = formatLocalDateTime(settledMs, { includeSeconds: true });
  const utcSettled = formatUtcDateTime(settledMs, { includeSeconds: true });

  const finalityState = resolveFinalityState({
    isFinalized: settlement.isFinalized,
    isConfirmed: true,
  });

  return (
    <div className="pt-4 border-t border-[#232329] space-y-3">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Settlement
      </h2>

      <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
        {/* Settlement Status */}
        <div className="flex items-center gap-2">
          {finalityState === 'finalized' ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />
              <span className="text-sm font-medium text-green-500">Finalized</span>
            </>
          ) : finalityState === 'confirmed' ?
            <>
              <Clock className="h-5 w-5 text-yellow-500" aria-hidden="true" />
              <span className="text-sm font-medium text-yellow-500">
                Confirmed — awaiting finality
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 text-gray-400" aria-hidden="true" />
              <span className="text-sm font-medium text-gray-400">
                Finality unavailable
              </span>
            </>
          )}
        </div>

        {/* Settlement Details */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Settled At:</span>
            <span className="text-gray-200 text-right">
              {localSettled} <span className="text-gray-500">({utcSettled})</span>
            </span>
          </div>

          {settlement.finalizedBlock !== null && (
            <div className="flex justify-between">
              <span className="text-gray-400">Finalized Block:</span>
              <span className="text-gray-200 font-mono">
                {settlement.finalizedBlock.toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-gray-400">Transaction:</span>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1 font-mono"
              aria-label={`View settlement transaction ${settlement.settlementTxHash.slice(0, 10)}... on block explorer (opens in new tab)`}
            >
              {settlement.settlementTxHash.slice(0, 10)}...
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          </div>
        </div>

        {finalityState === 'confirmed' && (
          <p className="text-xs text-gray-500 italic">
            Settlement is confirmed but not yet finalized. This may take a few minutes.
          </p>
        )}

        {finalityState === 'unavailable' && (
          <p className="text-xs text-gray-500 italic">
            Finality status is unavailable. Refresh once canonical data is available.
          </p>
        )}
      </div>
    </div>
  );
}
