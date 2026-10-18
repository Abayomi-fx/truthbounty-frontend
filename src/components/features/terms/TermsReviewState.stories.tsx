import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TermsReviewState, TermsReviewSummary } from './TermsReviewState';

const meta = {
  title: 'Features/Terms/TermsReviewState',
  component: TermsReviewState,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['approved', 'review', 'unavailable'],
      description: 'Clause review status',
    },
    network: {
      control: 'select',
      options: ['testnet', 'mainnet'],
      description: 'Network type',
    },
  },
} satisfies Meta<typeof TermsReviewState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReviewStatus: Story = {
  args: {
    status: 'review',
    reviewerNotes: 'Legal team reviewing staking slashing conditions. Expected completion: 2026-02-15.',
    clauseTitle: 'Staking, Rewards & Disputes',
    network: 'mainnet',
  },
};

export const UnavailableStatus: Story = {
  args: {
    status: 'unavailable',
    clauseTitle: 'Governing Law',
    network: 'testnet',
  },
};

export const ApprovedStatus: Story = {
  args: {
    status: 'approved',
    clauseTitle: 'Eligibility',
    network: 'testnet',
  },
};

export const ReviewWithLongNotes: Story = {
  args: {
    status: 'review',
    reviewerNotes: `Comprehensive review in progress:
- Slashing conditions under legal review
- Reward calculation methodology being validated
- Dispute resolution timeline being finalized
- Cross-jurisdictional compliance check pending

Expected completion: 2026-03-01.
Stakeholders: Legal, Protocol, Governance teams.`,
    clauseTitle: 'Staking, Rewards & Disputes',
    network: 'mainnet',
  },
};

export const TestnetReview: Story = {
  args: {
    status: 'review',
    reviewerNotes: 'Board reviewing testnet parameter updates.',
    clauseTitle: 'Wallet Responsibility',
    network: 'testnet',
  },
};

// TermsReviewSummary stories
export const ReviewSummaryWithReview: Story = {
  render: () => (
    <TermsReviewSummary
      clauses={[
        { id: 'eligibility', title: 'Eligibility', status: 'approved' },
        { id: 'wallet', title: 'Wallet Responsibility', status: 'approved' },
        { id: 'staking', title: 'Staking, Rewards & Disputes', status: 'review' },
        { id: 'acceptable', title: 'Acceptable Use', status: 'approved' },
      ]}
      network="mainnet"
    />
  ),
};

export const ReviewSummaryWithUnavailable: Story = {
  render: () => (
    <TermsReviewSummary
      clauses={[
        { id: 'eligibility', title: 'Eligibility', status: 'approved' },
        { id: 'governing', title: 'Governing Law', status: 'unavailable' },
        { id: 'revision', title: 'Revision & Amendments', status: 'review' },
      ]}
      network="testnet"
    />
  ),
};

export const ReviewSummaryAllApproved: Story = {
  render: () => (
    <TermsReviewSummary
      clauses={[
        { id: 'eligibility', title: 'Eligibility', status: 'approved' },
        { id: 'wallet', title: 'Wallet Responsibility', status: 'approved' },
        { id: 'claims', title: 'Claims & Evidence', status: 'approved' },
      ]}
      network="mainnet"
    />
  ),
};

export const ReviewSummaryManyIssues: Story = {
  render: () => (
    <TermsReviewSummary
      clauses={[
        { id: 'eligibility', title: 'Eligibility', status: 'approved' },
        { id: 'wallet', title: 'Wallet Responsibility', status: 'review' },
        { id: 'claims', title: 'Claims & Evidence', status: 'review' },
        { id: 'staking', title: 'Staking', status: 'unavailable' },
        { id: 'acceptable', title: 'Acceptable Use', status: 'approved' },
        { id: 'deps', title: 'Dependencies', status: 'unavailable' },
        { id: 'avail', title: 'Availability', status: 'approved' },
        { id: 'liability', title: 'Liability', status: 'review' },
        { id: 'governing', title: 'Governing Law', status: 'unavailable' },
        { id: 'revision', title: 'Revision', status: 'approved' },
      ]}
      network="mainnet"
    />
  ),
};