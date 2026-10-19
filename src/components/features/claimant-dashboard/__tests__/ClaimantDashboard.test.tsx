import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ClaimantDashboard } from '../ClaimantDashboard';
import { NextActionPanel } from '../NextActionPanel';
import { ClaimantSummaryCards } from '../ClaimantSummaryCards';
import { ClaimPhaseSummary } from '../ClaimPhaseSummary';
import { RecentOwnedClaims } from '../RecentOwnedClaims';
import { ClaimantActivityTimeline } from '../ClaimantActivityTimeline';
import type { ClaimantDashboardData } from '@/hooks/useClaimantDashboardData';
import type { Claim } from '@/app/types/claim';
import { APP_ROUTES } from '@/config/navigation';

const mockOwnedClaims: Claim[] = [
  {
    id: 'claim-101',
    title: 'Ethereum Consensus Specs v1.5 Verification',
    description: 'Specs verification for hard fork state transitions.',
    claimantAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E',
    status: 'UNDER_REVIEW',
    bountyAmount: 50,
    totalStaked: 300,
    evidence: [{ id: 'ev-1', type: 'link', value: 'https://example.com/spec', createdAt: '2026-03-01T00:00:00Z' }],
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-02T00:00:00Z',
    expiresAt: '2026-03-29T00:00:00Z',
  },
  {
    id: 'claim-102',
    title: 'Optimism Canon State Transition Root',
    description: 'Verification of state transition hash root.',
    claimantAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E',
    status: 'VERIFIED',
    bountyAmount: 100,
    totalStaked: 600,
    evidence: [{ id: 'ev-2', type: 'text', value: 'Evidence confirmed', createdAt: '2026-02-10T00:00:00Z' }],
    createdAt: '2026-02-10T00:00:00Z',
    updatedAt: '2026-02-15T00:00:00Z',
  },
  {
    id: 'claim-103',
    title: 'Contested Oracle Data Feed Report',
    description: 'Challenged oracle update on Chainlink aggregator.',
    claimantAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E',
    status: 'DISPUTED',
    bountyAmount: 80,
    totalStaked: 450,
    evidence: [{ id: 'ev-3', type: 'link', value: 'https://example.com/oracle', createdAt: '2026-03-10T00:00:00Z' }],
    createdAt: '2026-03-10T00:00:00Z',
    updatedAt: '2026-03-12T00:00:00Z',
    expiresAt: '2026-03-25T12:00:00Z',
  },
];

const mockRefetch = jest.fn();

const defaultMockData: ClaimantDashboardData = {
  account: '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E',
  isConnected: true,
  isSupportedChain: true,
  chainName: 'Optimism',
  isLoading: false,
  isStale: false,
  isOffline: false,
  isPartialFailure: false,
  ownedClaims: mockOwnedClaims,
  phaseCounts: {
    open: 0,
    underReview: 1,
    disputed: 1,
    verified: 1,
    rejected: 0,
    total: 3,
    active: 2,
    resolved: 1,
  },
  nextActions: [
    {
      id: 'dispute-claim-103',
      title: 'Dispute Resolution Active: "Contested Oracle Data Feed Report"',
      consequence: 'Consensus has been contested. Review dispute round arguments to protect staked reputation.',
      actionLabel: 'Inspect Dispute',
      actionHref: APP_ROUTES.DISPUTES,
      priority: 'critical',
      deadline: '2026-03-25T12:00:00Z',
      badge: 'High Stake Risk',
    },
    {
      id: 'action-rewards',
      title: 'Claimable Rewards Ready: 45.50 OP',
      consequence: '2 finalized reward allocation(s) ready for pull withdrawal.',
      actionLabel: 'Claim Rewards',
      actionHref: APP_ROUTES.REWARDS,
      priority: 'high',
      badge: 'Funds Available',
    },
  ],
  activity: [
    {
      id: 'act-1',
      title: 'Claim status updated to DISPUTED',
      description: 'Total consensus stake: 450 tokens',
      timestamp: '2026-03-12T00:00:00Z',
      type: 'status_change',
      linkHref: APP_ROUTES.CLAIM_DETAIL('claim-103'),
    },
    {
      id: 'act-2',
      title: 'Submitted claim "Contested Oracle Data Feed Report"',
      description: 'Bounty staked: 80 tokens • Initial state: OPEN',
      timestamp: '2026-03-10T00:00:00Z',
      type: 'claim_created',
      linkHref: APP_ROUTES.CLAIM_DETAIL('claim-103'),
    },
  ],
  rewardsSummary: {
    claimableDisplay: '45.50 OP',
    pendingCount: 2,
    isLoading: false,
    loadError: null,
    claimAll: jest.fn(),
    status: 'idle',
  },
  trustSummary: {
    reputation: 88,
    isVerified: true,
  },
  freshness: {
    lastUpdated: Date.now() - 10000,
    source: 'Optimism (EVM Indexer)',
    isFresh: true,
  },
  refetch: mockRefetch,
};

describe('Issue #437 V2-FE-152 — Canonical Claimant Dashboard', () => {
  beforeEach(() => {
    mockRefetch.mockClear();
  });

  describe('1. Summary Cards Constraints & Metadata', () => {
    it('renders exactly four high-priority summary cards preceding the claim list', () => {
      render(<ClaimantSummaryCards data={defaultMockData} />);

      const cards = screen.getAllByLabelText(/:/);
      expect(cards.length).toBe(4);

      // Verify specific personal metrics
      expect(screen.getByLabelText(/Claimable Rewards: 45.50 OP/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Active Owned Claims: 2/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Resolved Claims: 1/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/My Trust Score: 88/i)).toBeInTheDocument();
    });

    it('displays source and freshness metadata on material values', () => {
      render(<ClaimantSummaryCards data={defaultMockData} />);

      expect(screen.getByText('Optimism (EVM Indexer)')).toBeInTheDocument();
      expect(screen.getByText('Live Indexer')).toBeInTheDocument();
      expect(screen.getByText('Finalized on-chain')).toBeInTheDocument();
      expect(screen.getByText('Sybil Protection')).toBeInTheDocument();
    });

    it('displays "Unavailable" explicitly when reward data encounters load error', () => {
      const errorData: ClaimantDashboardData = {
        ...defaultMockData,
        rewardsSummary: {
          ...defaultMockData.rewardsSummary,
          claimableDisplay: null,
          loadError: 'RPC error: failed to fetch entitlements',
        },
      };

      render(<ClaimantSummaryCards data={errorData} />);
      expect(screen.getByLabelText(/Claimable Rewards: Unavailable/i)).toBeInTheDocument();
    });
  });

  describe('2. Next-Action Panel (Ordered by consequence and deadline)', () => {
    it('orders actions by consequence and urgency', () => {
      render(<NextActionPanel actions={defaultMockData.nextActions} />);

      const actionList = screen.getByRole('list');
      const items = within(actionList).getAllByRole('listitem');

      expect(items.length).toBe(2);
      expect(items[0]).toHaveTextContent(/Dispute Resolution Active/i);
      expect(items[0]).toHaveTextContent(/High Stake Risk/i);
      expect(items[1]).toHaveTextContent(/Claimable Rewards Ready/i);
      expect(items[1]).toHaveTextContent(/Funds Available/i);
    });

    it('routes primary actions through the canonical route contract', () => {
      render(<NextActionPanel actions={defaultMockData.nextActions} />);

      const disputeBtn = screen.getByRole('link', { name: /inspect dispute/i });
      expect(disputeBtn).toHaveAttribute('href', APP_ROUTES.DISPUTES);

      const claimBtn = screen.getByRole('link', { name: /claim rewards/i });
      expect(claimBtn).toHaveAttribute('href', APP_ROUTES.REWARDS);
    });

    it('renders "All caught up" reassuring status when zero actions are required', () => {
      render(<NextActionPanel actions={[]} />);

      expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
      expect(screen.getByText(/no immediate actions or approaching deadlines/i)).toBeInTheDocument();
    });
  });

  describe('3. Personal Claim Phase Summary', () => {
    it('summarizes counts across all 5 canonical protocol phases', () => {
      render(<ClaimPhaseSummary phaseCounts={defaultMockData.phaseCounts} />);

      expect(screen.getByText('3 total claims submitted')).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { name: /claims phase distribution/i })).toBeInTheDocument();

      // Counts per phase
      expect(screen.getByText('Under Review')).toBeInTheDocument();
      expect(screen.getByText('In Dispute')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('renders clean placeholder when user has submitted 0 claims', () => {
      render(
        <ClaimPhaseSummary
          phaseCounts={{
            open: 0,
            underReview: 0,
            disputed: 0,
            verified: 0,
            rejected: 0,
            total: 0,
            active: 0,
            resolved: 0,
          }}
        />,
      );

      expect(screen.getByText(/no claim submissions to summarize yet/i)).toBeInTheDocument();
    });
  });

  describe('4. Recent Owned Claims', () => {
    it('renders owned claims with status badges, deadlines, and permitted actions', () => {
      render(<RecentOwnedClaims claims={defaultMockData.ownedClaims} />);

      expect(screen.getByText('Ethereum Consensus Specs v1.5 Verification')).toBeInTheDocument();
      expect(screen.getByText('Under Review')).toBeInTheDocument();
      expect(screen.getByText('In Dispute')).toBeInTheDocument();
      expect(screen.getByText('Verified True')).toBeInTheDocument();

      // Links to canonical claim details
      expect(
        screen.getByRole('link', { name: 'Ethereum Consensus Specs v1.5 Verification' }),
      ).toHaveAttribute('href', APP_ROUTES.CLAIM_DETAIL('claim-101'));

      // Permitted action: dispute button for disputed claim
      expect(screen.getByRole('link', { name: /respond to dispute/i })).toHaveAttribute(
        'href',
        APP_ROUTES.DISPUTES,
      );
    });

    it('renders new-user guided empty state with CTA to /claims/new', () => {
      render(<RecentOwnedClaims claims={[]} />);

      expect(screen.getByText(/no claims submitted yet/i)).toBeInTheDocument();
      const cta = screen.getByRole('link', { name: /submit a claim/i });
      expect(cta).toHaveAttribute('href', APP_ROUTES.CLAIM_NEW);
    });
  });

  describe('5. Personal Protocol Activity Timeline', () => {
    it('renders recent claimant protocol activity items', () => {
      render(<ClaimantActivityTimeline activity={defaultMockData.activity} />);

      expect(screen.getByText(/claim status updated to DISPUTED/i)).toBeInTheDocument();
      expect(screen.getByText(/submitted claim "Contested Oracle Data Feed Report"/i)).toBeInTheDocument();
    });

    it('renders empty message when no protocol activity exists', () => {
      render(<ClaimantActivityTimeline activity={[]} />);

      expect(screen.getByText(/no recent protocol activity recorded/i)).toBeInTheDocument();
    });
  });

  describe('6. Resilient Dashboard States (Offline, Stale, Partial Failure, Guest)', () => {
    it('renders offline/stale banner with retry action', () => {
      const staleData: ClaimantDashboardData = {
        ...defaultMockData,
        isOffline: true,
        isStale: true,
      };

      render(<ClaimantDashboard testDataOverride={staleData} />);

      expect(screen.getByTestId('claimant-offline-stale-notice')).toBeInTheDocument();
      expect(screen.getByText(/offline mode active/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /retry sync/i }));
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('renders partial failure alert with retry when a sub-query fails', () => {
      const partialFailureData: ClaimantDashboardData = {
        ...defaultMockData,
        isPartialFailure: true,
        partialFailureMessage: 'Failed to refresh reward balances: RPC timed out',
      };

      render(<ClaimantDashboard testDataOverride={partialFailureData} />);

      expect(screen.getByTestId('claimant-partial-failure-notice')).toBeInTheDocument();
      expect(screen.getByText(/failed to refresh reward balances/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /retry failed query/i }));
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('renders unsupported network banner with switch chain button', () => {
      const wrongChainData: ClaimantDashboardData = {
        ...defaultMockData,
        isSupportedChain: false,
        chainName: 'Ethereum Mainnet',
      };

      render(<ClaimantDashboard testDataOverride={wrongChainData} />);

      expect(screen.getByTestId('claimant-unsupported-chain-notice')).toBeInTheDocument();
      expect(screen.getByText(/unsupported network \(ethereum mainnet\)/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /switch to optimism/i })).toBeInTheDocument();
    });

    it('renders guest callout linking to /identity when disconnected', () => {
      const guestData: ClaimantDashboardData = {
        ...defaultMockData,
        account: null,
        isConnected: false,
      };

      render(<ClaimantDashboard testDataOverride={guestData} />);

      expect(screen.getByTestId('claimant-guest-notice')).toBeInTheDocument();
      const connectLink = screen.getByRole('link', { name: /connect & verify/i });
      expect(connectLink).toHaveAttribute('href', APP_ROUTES.IDENTITY);
    });
  });
});
