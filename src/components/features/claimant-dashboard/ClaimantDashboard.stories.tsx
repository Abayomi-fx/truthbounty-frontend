import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ClaimantDashboard } from './ClaimantDashboard';
import type { ClaimantDashboardData } from '@/hooks/useClaimantDashboardData';
import type { Claim } from '@/app/types/claim';

const mockOwnedClaims: Claim[] = [
  {
    id: 'claim-001',
    title: 'Arbitrum Sequencer Outage Report for March 2026',
    description: 'Detailed analysis of downtime events and sequencer fallback mechanisms.',
    claimantAddress: '0x742d35cc6634c0532925a3b844bc9e7595f0eb1e',
    status: 'UNDER_REVIEW',
    bountyAmount: 50,
    totalStaked: 250,
    evidence: [{ id: 'ev-1', type: 'link', value: 'https://example.com/report', createdAt: '2026-03-01T10:00:00Z' }],
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-02T12:00:00Z',
    expiresAt: '2026-03-30T18:00:00Z',
  },
  {
    id: 'claim-002',
    title: 'Optimism Bedrock Upgrade Transaction Hash Verification',
    description: 'Verification of state transition commit batch 44102.',
    claimantAddress: '0x742d35cc6634c0532925a3b844bc9e7595f0eb1e',
    status: 'VERIFIED',
    bountyAmount: 100,
    totalStaked: 500,
    evidence: [{ id: 'ev-2', type: 'text', value: 'Confirmed on Etherscan', createdAt: '2026-02-15T08:00:00Z' }],
    createdAt: '2026-02-15T08:00:00Z',
    updatedAt: '2026-02-18T14:30:00Z',
  },
  {
    id: 'claim-003',
    title: 'Contested Bounty Settlement Claim #992',
    description: 'Disputed claim regarding oracle price feed divergence.',
    claimantAddress: '0x742d35cc6634c0532925a3b844bc9e7595f0eb1e',
    status: 'DISPUTED',
    bountyAmount: 75,
    totalStaked: 400,
    evidence: [{ id: 'ev-3', type: 'link', value: 'https://example.com/oracle-data', createdAt: '2026-03-05T09:00:00Z' }],
    createdAt: '2026-03-05T09:00:00Z',
    updatedAt: '2026-03-10T16:00:00Z',
    expiresAt: '2026-03-28T23:59:59Z',
  },
];

const baseMockData: ClaimantDashboardData = {
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
      id: 'dispute-claim-003',
      title: 'Dispute Resolution Active: "Contested Bounty Settlement Claim #992"',
      consequence: 'Consensus has been contested. Review dispute round arguments to protect staked reputation.',
      actionLabel: 'Inspect Dispute',
      actionHref: '/disputes',
      priority: 'critical',
      deadline: '2026-03-28T23:59:59Z',
      badge: 'High Stake Risk',
    },
    {
      id: 'action-rewards',
      title: 'Claimable Rewards Ready: 125.00 OP',
      consequence: '2 finalized reward allocation(s) ready for pull withdrawal.',
      actionLabel: 'Claim Rewards',
      actionHref: '/rewards',
      priority: 'high',
      badge: 'Funds Available',
    },
  ],
  activity: [
    {
      id: 'act-1',
      title: 'Claim status updated to DISPUTED',
      description: 'Total consensus stake: 400 tokens',
      timestamp: '2026-03-10T16:00:00Z',
      type: 'status_change',
      linkHref: '/claims/claim-003',
    },
    {
      id: 'act-2',
      title: 'Submitted claim "Contested Bounty Settlement Claim #992"',
      description: 'Bounty staked: 75 tokens • Initial state: OPEN',
      timestamp: '2026-03-05T09:00:00Z',
      type: 'claim_created',
      linkHref: '/claims/claim-003',
    },
    {
      id: 'act-3',
      title: 'Claim status updated to VERIFIED',
      description: 'Total consensus stake: 500 tokens',
      timestamp: '2026-02-18T14:30:00Z',
      type: 'status_change',
      linkHref: '/claims/claim-002',
    },
  ],
  rewardsSummary: {
    claimableDisplay: '125.00 OP',
    pendingCount: 2,
    isLoading: false,
    loadError: null,
    claimAll: async () => {},
    status: 'idle',
  },
  trustSummary: {
    reputation: 92,
    isVerified: true,
  },
  freshness: {
    lastUpdated: Date.now() - 5000,
    source: 'Optimism (EVM Indexer)',
    isFresh: true,
  },
  refetch: async () => {},
};

const meta: Meta<typeof ClaimantDashboard> = {
  title: 'Features/ClaimantDashboard',
  component: ClaimantDashboard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ClaimantDashboard>;

export const Default: Story = {
  render: () => <ClaimantDashboard testDataOverride={baseMockData} />,
};

export const LoadingState: Story = {
  render: () => (
    <ClaimantDashboard
      testDataOverride={{
        ...baseMockData,
        isLoading: true,
      }}
    />
  ),
};

export const NewUserEmptyState: Story = {
  render: () => (
    <ClaimantDashboard
      testDataOverride={{
        ...baseMockData,
        ownedClaims: [],
        phaseCounts: {
          open: 0,
          underReview: 0,
          disputed: 0,
          verified: 0,
          rejected: 0,
          total: 0,
          active: 0,
          resolved: 0,
        },
        nextActions: [],
        activity: [],
        rewardsSummary: {
          ...baseMockData.rewardsSummary,
          claimableDisplay: '0.00 OP',
          pendingCount: 0,
        },
      }}
    />
  ),
};

export const GuestDisconnected: Story = {
  render: () => (
    <ClaimantDashboard
      testDataOverride={{
        ...baseMockData,
        account: null,
        isConnected: false,
        ownedClaims: [],
        nextActions: [
          {
            id: 'action-connect',
            title: 'Connect Wallet to Access Claimant Controls',
            consequence: 'Wallet authentication required to view your owned claims and rewards.',
            actionLabel: 'Connect Wallet',
            actionHref: '/identity',
            priority: 'critical',
          },
        ],
      }}
    />
  ),
};

export const UnsupportedChain: Story = {
  render: () => (
    <ClaimantDashboard
      testDataOverride={{
        ...baseMockData,
        isSupportedChain: false,
        chainName: 'Ethereum Mainnet',
      }}
    />
  ),
};

export const StaleOfflineState: Story = {
  render: () => (
    <ClaimantDashboard
      testDataOverride={{
        ...baseMockData,
        isOffline: true,
        isStale: true,
      }}
    />
  ),
};

export const PartialFailureState: Story = {
  render: () => (
    <ClaimantDashboard
      testDataOverride={{
        ...baseMockData,
        isPartialFailure: true,
        partialFailureMessage: 'Failed to refresh reward balances: RPC timed out after 3 retries.',
        rewardsSummary: {
          ...baseMockData.rewardsSummary,
          loadError: 'RPC timed out',
        },
      }}
    />
  ),
};
