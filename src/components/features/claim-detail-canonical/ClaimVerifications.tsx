'use client';

import { ThumbsUp, ThumbsDown } from 'lucide-react';
import type { ClaimDetailProjection } from '@/app/types/claim-detail-projection';
import type { ClaimStatus } from '@/app/types/claim';
import { ConfidenceMeter } from '@/components/ui/primitives/ConfidenceMeter';
import { OutcomeBadge } from '@/components/ui/primitives/OutcomeBadge';
import { StakeWeightDisplay } from '@/components/ui/primitives/StakeWeightDisplay';

export interface ClaimVerificationsProps {
  claim: ClaimDetailProjection;
}

function mapClaimStatusToOutcome(status: ClaimStatus): 'verified' | 'disputed' | 'rejected' | 'inconclusive' | 'provisional' {
  switch (status) {
    case 'VERIFIED':
      return 'verified';
    case 'REJECTED':
      return 'rejected';
    case 'DISPUTED':
      return 'disputed';
    case 'UNDER_REVIEW':
    case 'OPEN':
      return 'provisional';
    default:
      return 'inconclusive';
  }
}

export function ClaimVerifications({ claim }: ClaimVerificationsProps) {
  const { verifications, voteCounts, confidenceScore, settlement, status } = claim;
  const totalVotes = voteCounts.support + voteCounts.reject;

  // Use canonical projected status from the projection (authoritative)
  // instead of deriving from vote counts in the UI
  const outcomeKind = mapClaimStatusToOutcome(status);
  const isProvisional = !settlement.isFinalized;

  // Use canonical settlement timestamp for provenance
  const determinedAt = settlement.settledAt ?? verifications[0]?.timestamp;

  return (
    <div className="space-y-4 pt-4 border-t border-[#232329]">
      {/* Outcome Badge */}
      <OutcomeBadge
        kind={outcomeKind}
        provisional={isProvisional}
        source="Canonical Projection"
        determinedAt={determinedAt}
      />

      {/* Vote Counts & Stake Weights */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Verification Breakdown
        </h2>

        {totalVotes > 0 ? (
          <>
            <StakeWeightDisplay
              supporting={{
                label: 'Supporting',
                value: voteCounts.support.toString(),
                unit: 'votes',
                icon: <ThumbsUp size={14} aria-hidden="true" />,
                tone: 'success',
              }}
              opposing={{
                label: 'Opposing',
                value: voteCounts.reject.toString(),
                unit: 'votes',
                icon: <ThumbsDown size={14} aria-hidden="true" />,
                tone: 'danger',
              }}
              showBars={true}
              showTable={true}
            />

            <p className="text-xs text-gray-500 mt-2">
              {verifications.length} {verifications.length === 1 ? 'verification' : 'verifications'}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-400">No verifications yet.</p>
        )}
      </div>

      {/* Confidence Score */}
      {confidenceScore !== null && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Confidence Score
          </h2>
          <ConfidenceMeter
            value={confidenceScore}
            label="Confidence Score"
            source="Canonical Projection"
            computedAt={verifications[0]?.timestamp}
            provisional={isProvisional}
            showValue={true}
            showBandLabel={true}
          />
        </div>
      )}

      {/* Verification List */}
      {verifications.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Recent Verifications
          </h2>

          <ul className="space-y-2" role="list">
            {verifications.slice(0, 5).map((verification) => (
              <li
                key={verification.id}
                className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {verification.decision === 'SUPPORT' ? (
                    <ThumbsUp
                      size={14}
                      className="text-green-500 flex-shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <ThumbsDown
                      size={14}
                      className="text-red-500 flex-shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span className="text-gray-300 font-mono truncate">
                    {verification.verifierAddress.slice(0, 6)}...
                    {verification.verifierAddress.slice(-4)}
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-gray-400">
                    {verification.stakeAmount} ETH
                  </span>
                  {verification.finalizedAt && (
                    <span className="text-green-500 text-xs">Finalized</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {verifications.length > 5 && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              and {verifications.length - 5} more {verifications.length - 5 === 1 ? 'verification' : 'verifications'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}