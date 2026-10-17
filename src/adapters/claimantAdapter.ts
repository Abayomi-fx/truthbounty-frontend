export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISPUTED' | 'SETTLED';

export interface OwnedClaim {
  id: string;
  title: string;
  category: string;
  status: ClaimStatus;
  amount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
}

export interface ClaimantMetrics {
  totalClaims: number;
  activeClaims: number;
  totalPayoutValue: number;
  currency: string;
}

export class ClaimantAdapter {
  async getOwnedClaims(userId?: string): Promise<OwnedClaim[]> {
    try {
      const response = await fetch(`/api/claimant/claims${userId ? `?userId=${userId}` : ''}`);
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }

  async getClaimantMetrics(userId?: string): Promise<ClaimantMetrics> {
    try {
      const response = await fetch(`/api/claimant/metrics${userId ? `?userId=${userId}` : ''}`);
      if (!response.ok) {
        return { totalClaims: 0, activeClaims: 0, totalPayoutValue: 0, currency: 'USDC' };
      }
      return await response.json();
    } catch {
      return { totalClaims: 0, activeClaims: 0, totalPayoutValue: 0, currency: 'USDC' };
    }
  }
}

export const claimantAdapter = new ClaimantAdapter();
