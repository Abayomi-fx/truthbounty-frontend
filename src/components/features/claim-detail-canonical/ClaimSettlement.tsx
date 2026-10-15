'use client';

/**
 * ClaimSettlement — Settlement state and finalization display
 *
 * Shows settlement transaction and finalization status. Never fabricates
 * settlement or finality; all fields null when not settled.
 */

import { CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import type { ClaimDetailProjection } from '@/app/types/claim-detail-projection';

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
  const settledDate = new Date(settlement.settledAt).toLocaleString();

  return (
    <div className="pt-4 border-t border-[#232329] space-y-3">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Settlement
      </h2>

      <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
        {/* Settlement Status */}
        <div className="flex items-center gap-2">
          {settlement.isFinalized ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />
              <span className="text-sm font-medium text-green-500">Finalized</span>
            </>
          ) : (
            <>
              <Clock className="h-5 w-5 text-yellow-500" aria-hidden="true" />
              <span className="text-sm font-medium text-yellow-500">
                Confirming Settlement
              </span>
            </>
          )}
        </div>

        {/* Settlement Details */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Settled At:</span>
            <span className="text-gray-200">{settledDate}</span>
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

        {!settlement.isFinalized && (
          <p className="text-xs text-gray-500 italic">
            Settlement is pending finalization. This may take a few minutes.
          </p>
        )}
      </div>
    </div>
  );
}
