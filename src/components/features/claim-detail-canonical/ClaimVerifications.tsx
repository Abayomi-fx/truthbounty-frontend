'use client';

/**
 * ClaimVerifications — Verification list, vote counts, and confidence score
 *
 * Displays verifications from canonical projection. Never fabricates vote counts
 * or confidence scores; null values are shown as "Not available".
 */

import { ThumbsUp, ThumbsDown, TrendingUp } from 'lucide-react';
import type { ClaimDetailProjection } from '@/app/types/claim-detail-projection';

export interface ClaimVerificationsProps {
  claim: ClaimDetailProjection;
}

export function ClaimVerifications({ claim }: ClaimVerificationsProps) {
  const { verifications, voteCounts, confidenceScore } = claim;
  const totalVotes = voteCounts.support + voteCounts.reject;
  const supportPercentage = totalVotes > 0 ? (voteCounts.support / totalVotes) * 100 : 0;
  const rejectPercentage = totalVotes > 0 ? (voteCounts.reject / totalVotes) * 100 : 0;

  return (
    <div className="space-y-4 pt-4 border-t border-[#232329]">
      {/* Vote Counts */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Verification Breakdown
        </h2>

        {totalVotes > 0 ? (
          <>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-green-500 flex items-center gap-1">
                <ThumbsUp size={14} aria-hidden="true" />
                Support: {voteCounts.support}
              </span>
              <span className="text-red-500 flex items-center gap-1">
                Reject: {voteCounts.reject}
                <ThumbsDown size={14} aria-hidden="true" />
              </span>
            </div>

            <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-800 mb-2">
              <div
                style={{ width: `${supportPercentage}%` }}
                className="bg-green-500"
                role="progressbar"
                aria-label="Support percentage"
                aria-valuenow={supportPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
              />
              <div
                style={{ width: `${rejectPercentage}%` }}
                className="bg-red-500"
                role="progressbar"
                aria-label="Reject percentage"
                aria-valuenow={rejectPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>

            <p className="text-xs text-gray-500">
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

          <div className="flex items-center gap-4">
            <div className="flex-1 h-2.5 rounded-full bg-gray-800 overflow-hidden">
              <div
                style={{ width: `${confidenceScore}%` }}
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400"
                role="progressbar"
                aria-label="Confidence score"
                aria-valuenow={confidenceScore}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>

            <span className="text-green-500 font-bold text-xl flex items-center gap-1">
              <TrendingUp size={18} aria-hidden="true" />
              {confidenceScore}%
            </span>
          </div>
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
