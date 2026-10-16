'use client';

/**
 * useClaimantDashboardData — V2-FE-152
 *
 * Canonical adapter hook for the role-aware Claimant Dashboard.
 * Consolidates on-chain and projected data from useClaims, useRewards,
 * and useTrust for the connected claimant.
 *
 * Security & Integrity Invariants:
 *  - Never presents network-wide statistics as personal metrics.
 *  - Every count, phase, and balance is strictly derived from the connected account.
 *  - Unavailable data is surfaced explicitly; never fabricated or defaulted to mock amounts.
 *  - Next actions are ordered deterministically by consequence and deadline.
 */

import { useMemo, useCallback } from 'react';
import { useClaims } from '@/app/queries/claims.queries';
import { useRewards, type ClaimStatus } from '@/hooks/useRewards';
import { useTrust } from '@/components/hooks/useTrust';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useAppShellContext } from '@/context/AppShellContext';
import { APP_ROUTES } from '@/config/navigation';
import type { Claim } from '@/app/types/claim';

export interface ClaimantActionItem {
  id: string;
  title: string;
  consequence: string;
  actionLabel: string;
  actionHref: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  deadline?: string;
  badge?: string;
}

export interface ClaimPhaseCounts {
  open: number;
  underReview: number;
  disputed: number;
  verified: number;
  rejected: number;
  total: number;
  active: number;
  resolved: number;
}

export interface ClaimantActivityItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'claim_created' | 'status_change' | 'reward_available' | 'reward_claimed';
  linkHref?: string;
}

export interface ClaimantDashboardData {
  account: string | null;
  isConnected: boolean;
  isSupportedChain: boolean;
  chainName: string;
  isLoading: boolean;
  isStale: boolean;
  isOffline: boolean;
  isPartialFailure: boolean;
  partialFailureMessage?: string;
  ownedClaims: Claim[];
  phaseCounts: ClaimPhaseCounts;
  nextActions: ClaimantActionItem[];
  activity: ClaimantActivityItem[];
  rewardsSummary: {
    claimableDisplay: string | null;
    pendingCount: number;
    isLoading: boolean;
    loadError: string | null;
    claimAll: () => Promise<void>;
    status: ClaimStatus;
  };
  trustSummary: {
    reputation: number | null;
    isVerified: boolean;
  };
  freshness: {
    lastUpdated: number;
    source: string;
    isFresh: boolean;
  };
  refetch: () => Promise<void>;
}

export function useClaimantDashboardData(): ClaimantDashboardData {
  const { account, isConnected, isSupportedChain, chainName } = useAppShellContext();
  const { isOnline } = useNetworkStatus();

  // Canonical claims query
  const {
    data: allClaims,
    isLoading: isClaimsLoading,
    isError: isClaimsError,
    error: claimsError,
    dataUpdatedAt: claimsUpdatedAt,
    refetch: refetchClaims,
  } = useClaims();

  // Canonical rewards adapter
  const {
    totalClaimableDisplay,
    pendingRewards,
    isLoading: isRewardsLoading,
    loadError: rewardsLoadError,
    claimAll,
    status: rewardsStatus,
    refresh: refreshRewards,
  } = useRewards();

  // Canonical trust adapter
  const trust = useTrust();

  // Filter claims strictly owned by the connected account
  const ownedClaims = useMemo<Claim[]>(() => {
    if (!account || !allClaims || !Array.isArray(allClaims)) {
      return [];
    }
    const normalizedAccount = account.toLowerCase();
    return allClaims.filter(
      (claim) =>
        claim.claimantAddress &&
        claim.claimantAddress.toLowerCase() === normalizedAccount,
    );
  }, [account, allClaims]);

  // Derive phase distribution strictly from owned claims
  const phaseCounts = useMemo<ClaimPhaseCounts>(() => {
    const counts: ClaimPhaseCounts = {
      open: 0,
      underReview: 0,
      disputed: 0,
      verified: 0,
      rejected: 0,
      total: ownedClaims.length,
      active: 0,
      resolved: 0,
    };

    ownedClaims.forEach((claim) => {
      switch (claim.status) {
        case 'OPEN':
          counts.open += 1;
          break;
        case 'UNDER_REVIEW':
          counts.underReview += 1;
          break;
        case 'DISPUTED':
          counts.disputed += 1;
          break;
        case 'VERIFIED':
          counts.verified += 1;
          break;
        case 'REJECTED':
          counts.rejected += 1;
          break;
        default:
          break;
      }
    });

    counts.active = counts.open + counts.underReview + counts.disputed;
    counts.resolved = counts.verified + counts.rejected;

    return counts;
  }, [ownedClaims]);

  // Order next actions deterministically by consequence and deadline
  const nextActions = useMemo<ClaimantActionItem[]>(() => {
    if (!isConnected) {
      return [
        {
          id: 'action-connect',
          title: 'Connect Wallet to Access Claimant Controls',
          consequence: 'Wallet authentication required to view your owned claims and rewards.',
          actionLabel: 'Connect Wallet',
          actionHref: APP_ROUTES.IDENTITY,
          priority: 'critical',
        },
      ];
    }

    const actions: ClaimantActionItem[] = [];

    // 1. Critical Consequence: Active disputes on owned claims
    ownedClaims
      .filter((c) => c.status === 'DISPUTED')
      .forEach((claim) => {
        actions.push({
          id: `dispute-${claim.id}`,
          title: `Dispute Resolution Active: "${claim.title}"`,
          consequence:
            'Consensus has been contested. Review dispute round arguments to protect staked reputation.',
          actionLabel: 'Inspect Dispute',
          actionHref: APP_ROUTES.DISPUTES,
          priority: 'critical',
          deadline: claim.expiresAt,
          badge: 'High Stake Risk',
        });
      });

    // 2. High Consequence: Claimable rewards available for withdrawal
    if (
      totalClaimableDisplay &&
      totalClaimableDisplay !== '0' &&
      totalClaimableDisplay !== '0.00' &&
      pendingRewards.length > 0
    ) {
      actions.push({
        id: 'action-rewards',
        title: `Claimable Rewards Ready: ${totalClaimableDisplay}`,
        consequence: `${pendingRewards.length} finalized reward allocation(s) ready for pull withdrawal.`,
        actionLabel: 'Claim Rewards',
        actionHref: APP_ROUTES.REWARDS,
        priority: 'high',
        badge: 'Funds Available',
      });
    }

    // 3. Medium Consequence: Missing Worldcoin humanity verification
    if (!trust.isVerified) {
      actions.push({
        id: 'action-verify-humanity',
        title: 'Verify Unique Humanity',
        consequence:
          'Sybil-resistant proof is required to unlock full reputation accrual and dispute rights.',
        actionLabel: 'Verify with Worldcoin',
        actionHref: APP_ROUTES.IDENTITY,
        priority: 'medium',
        badge: 'Protocol Trust',
      });
    }

    // 4. Low Consequence: Claims pending verification
    ownedClaims
      .filter((c) => c.status === 'UNDER_REVIEW')
      .forEach((claim) => {
        actions.push({
          id: `review-${claim.id}`,
          title: `Verification in Progress: "${claim.title}"`,
          consequence: 'Community verifiers are evaluating submission evidence.',
          actionLabel: 'Track Progress',
          actionHref: APP_ROUTES.CLAIM_DETAIL(claim.id),
          priority: 'low',
          deadline: claim.expiresAt,
        });
      });

    // Sort by priority weight
    const priorityWeight: Record<ClaimantActionItem['priority'], number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return actions.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]);
  }, [isConnected, ownedClaims, totalClaimableDisplay, pendingRewards.length, trust.isVerified]);

  // Derive protocol activity timeline for the claimant
  const activity = useMemo<ClaimantActivityItem[]>(() => {
    const list: ClaimantActivityItem[] = [];

    ownedClaims.forEach((claim) => {
      list.push({
        id: `activity-create-${claim.id}`,
        title: `Submitted claim "${claim.title}"`,
        description: `Bounty staked: ${claim.bountyAmount} tokens • Initial state: ${claim.status}`,
        timestamp: claim.createdAt,
        type: 'claim_created',
        linkHref: APP_ROUTES.CLAIM_DETAIL(claim.id),
      });

      if (claim.status !== 'OPEN' && claim.updatedAt !== claim.createdAt) {
        list.push({
          id: `activity-status-${claim.id}-${claim.status}`,
          title: `Claim status updated to ${claim.status.replace('_', ' ')}`,
          description: `Total consensus stake: ${claim.totalStaked} tokens`,
          timestamp: claim.updatedAt,
          type: 'status_change',
          linkHref: APP_ROUTES.CLAIM_DETAIL(claim.id),
        });
      }
    });

    // Sort newest first
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [ownedClaims]);

  // Aggregate loading and error states
  const isLoading = isClaimsLoading || isRewardsLoading;
  const isOffline = !isOnline;
  const isStale = Boolean(claimsUpdatedAt && Date.now() - claimsUpdatedAt > 60_000);

  // Partial failure detection
  const isPartialFailure = Boolean(
    (isClaimsError && !rewardsLoadError) || (!isClaimsError && rewardsLoadError),
  );
  const partialFailureMessage = isClaimsError
    ? `Failed to load claim submissions: ${claimsError instanceof Error ? claimsError.message : 'Unknown error'}`
    : rewardsLoadError
      ? `Failed to refresh reward balances: ${rewardsLoadError}`
      : undefined;

  const refetch = useCallback(async () => {
    await Promise.allSettled([refetchClaims(), refreshRewards()]);
  }, [refetchClaims, refreshRewards]);

  return {
    account,
    isConnected,
    isSupportedChain,
    chainName,
    isLoading,
    isStale,
    isOffline,
    isPartialFailure,
    partialFailureMessage,
    ownedClaims,
    phaseCounts,
    nextActions,
    activity,
    rewardsSummary: {
      claimableDisplay: totalClaimableDisplay,
      pendingCount: pendingRewards.length,
      isLoading: isRewardsLoading,
      loadError: rewardsLoadError,
      claimAll,
      status: rewardsStatus,
    },
    trustSummary: {
      reputation: trust.reputation,
      isVerified: trust.isVerified,
    },
    freshness: {
      lastUpdated: claimsUpdatedAt || Date.now(),
      source: `${chainName} (EVM Indexer)`,
      isFresh: !isStale && !isOffline,
    },
    refetch,
  };
}
