import type { Meta, StoryObj } from '@storybook/react';
import { ClaimantDashboard } from './ClaimantDashboard';

const meta: Meta<typeof ClaimantDashboard> = {
  title: 'Components/ClaimantDashboard',
  component: ClaimantDashboard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ClaimantDashboard>;

const mockMetrics = {
  totalClaims: 3,
  activeClaims: 2,
  totalPayoutValue: 12500,
  currency: 'USDC',
};

const mockClaims = [
  {
    id: 'CLM-1001',
    title: 'Data Integrity Dispute on Oracle Feed',
    category: 'Oracle Verification',
    status: 'PENDING' as const,
    amount: 5000,
    currency: 'USDC',
    createdAt: '2026-10-10',
    updatedAt: '2026-10-12',
  },
  {
    id: 'CLM-1002',
    title: 'Identity Claim Settlement Request',
    category: 'Attestation',
    status: 'APPROVED' as const,
    amount: 7500,
    currency: 'USDC',
    createdAt: '2026-09-28',
    updatedAt: '2026-10-01',
  },
];

export const DefaultView: Story = {
  args: {
    claims: mockClaims,
    metrics: mockMetrics,
    isLoading: false,
    onSelectClaim: (id) => alert(`Selected claim ${id}`),
  },
};

export const LoadingView: Story = {
  args: {
    claims: [],
    metrics: { totalClaims: 0, activeClaims: 0, totalPayoutValue: 0, currency: 'USDC' },
    isLoading: true,
  },
};

export const EmptyView: Story = {
  args: {
    claims: [],
    metrics: { totalClaims: 0, activeClaims: 0, totalPayoutValue: 0, currency: 'USDC' },
    isLoading: false,
  },
};
