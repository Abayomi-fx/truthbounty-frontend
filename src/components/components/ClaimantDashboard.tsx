import React from 'react';
import { OwnedClaim, ClaimantMetrics, ClaimStatus } from '../adapters/claimantAdapter';

interface ClaimantDashboardProps {
  claims: OwnedClaim[];
  metrics: ClaimantMetrics;
  isLoading?: boolean;
  onSelectClaim?: (claimId: string) => void;
}

const getStatusBadgeClass = (status: ClaimStatus): string => {
  switch (status) {
    case 'APPROVED':
    case 'SETTLED':
      return 'bg-green-900/40 text-green-400 border-green-600/40';
    case 'PENDING':
      return 'bg-yellow-900/40 text-yellow-400 border-yellow-600/40';
    case 'DISPUTED':
      return 'bg-orange-900/40 text-orange-400 border-orange-600/40';
    case 'REJECTED':
      return 'bg-red-900/40 text-red-400 border-red-600/40';
    default:
      return 'bg-gray-800 text-gray-300 border-gray-600';
  }
};

export const ClaimantDashboard: React.FC<ClaimantDashboardProps> = ({
  claims,
  metrics,
  isLoading = false,
  onSelectClaim,
}) => {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-400 animate-pulse">
        Loading claimant dashboard data...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-gray-950 text-white rounded-xl border border-gray-800">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Claimant Dashboard</h2>
        <p className="text-sm text-gray-400 mt-1">Manage and track your active and historical claims.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <p className="text-xs text-gray-400 uppercase font-medium">Total Owned Claims</p>
          <p className="text-2xl font-bold mt-1">{metrics.totalClaims}</p>
        </div>
        <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <p className="text-xs text-gray-400 uppercase font-medium">Active Claims</p>
          <p className="text-2xl font-bold mt-1 text-blue-400">{metrics.activeClaims}</p>
        </div>
        <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <p className="text-xs text-gray-400 uppercase font-medium">Total Payout Value</p>
          <p className="text-2xl font-bold mt-1 text-green-400">
            {metrics.totalPayoutValue.toLocaleString()} {metrics.currency}
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Your Owned Claims</h3>

        {claims.length === 0 ? (
          <div className="p-8 text-center bg-gray-900/50 rounded-lg border border-dashed border-gray-800">
            <p className="text-gray-400">No owned claims found.</p>
            <p className="text-xs text-gray-500 mt-1">When you initiate or receive claims, they will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {claims.map((claim) => (
              <div
                key={claim.id}
                onClick={() => onSelectClaim?.(claim.id)}
                className="p-4 bg-gray-900 hover:bg-gray-850 transition cursor-pointer rounded-lg border border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-400">#{claim.id}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusBadgeClass(claim.status)}`}>
                      {claim.status}
                    </span>
                  </div>
                  <h4 className="font-semibold text-white mt-1">{claim.title}</h4>
                  <p className="text-xs text-gray-400 mt-0.5">{claim.category} • Created {claim.createdAt}</p>
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold text-white">
                    {claim.amount} {claim.currency}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
