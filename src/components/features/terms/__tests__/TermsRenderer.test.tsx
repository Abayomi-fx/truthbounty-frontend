import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TermsRenderer } from '../TermsRenderer';
import type { TermsVersion } from '@/app/types/terms';

const mockVersion: TermsVersion = {
  version: '1.0.0',
  effectiveDate: '2026-01-15',
  materialChanges: 'Initial testnet terms publication.',
  network: 'testnet',
  clauses: [
    {
      id: 'eligibility',
      title: 'Eligibility',
      content: '1.1. You must be 18 or older.\n1.2. You must not be in a prohibited jurisdiction.',
      status: 'approved',
      lastReviewedAt: '2026-01-15T00:00:00.000Z',
    },
    {
      id: 'wallet-responsibility',
      title: 'Wallet Responsibility',
      content: '2.1. You are responsible for your wallet security.\n2.2. Transactions cannot be reversed.',
      status: 'approved',
      lastReviewedAt: '2026-01-15T00:00:00.000Z',
    },
    {
      id: 'staking-rewards-disputes',
      title: 'Staking, Rewards & Disputes',
      content: '4.1. Testnet staking uses test tokens.\n4.2. Rewards are simulated.',
      status: 'review',
      reviewerNotes: 'Pending final testnet economic parameters.',
    },
  ],
  status: 'published',
  publishedAt: '2026-01-15T00:00:00.000Z',
  source: 'board',
};

const mockAllVersions: TermsVersion[] = [
  mockVersion,
  {
    ...mockVersion,
    version: '0.9.0',
    effectiveDate: '2025-12-01',
    materialChanges: 'Pre-release draft.',
    status: 'draft',
    publishedAt: undefined,
    source: 'board',
  },
];

describe('TermsRenderer', () => {
  const onVersionChange = jest.fn();

  beforeEach(() => {
    onVersionChange.mockClear();
  });

  it('renders terms header with version and network', () => {
    render(
      <TermsRenderer
        version={mockVersion}
        allVersions={mockAllVersions}
        network="testnet"
        onVersionChange={onVersionChange}
      />
    );

    expect(screen.getByRole('heading', { name: 'Terms of Use', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Version 1\.0\.0/)).toBeInTheDocument();
    const headers = screen.getAllByRole('banner');
    expect(within(headers[0]).getByText(/Effective:/)).toBeInTheDocument();
    expect(within(headers[0]).getByText('Testnet')).toBeInTheDocument();
    expect(within(headers[0]).getByText('Board')).toBeInTheDocument();
    expect(within(headers[0]).getByText('Published')).toBeInTheDocument();
  });

  it('renders material changes in details', () => {
    render(
      <TermsRenderer
        version={mockVersion}
        allVersions={mockAllVersions}
        network="testnet"
        onVersionChange={onVersionChange}
      />
    );

    const summary = screen.getByText('Material Changes in This Version');
    fireEvent.click(summary);

    const details = summary.closest('details');
    expect(within(details!).getByText('Initial testnet terms publication.')).toBeInTheDocument();
  });

  it('renders review summary when clauses have non-approved status', () => {
    render(
      <TermsRenderer
        version={mockVersion}
        allVersions={mockAllVersions}
        network="testnet"
        onVersionChange={onVersionChange}
      />
    );

    const reviewSummary = screen.getByRole('region', { name: 'Terms review summary' });
    expect(within(reviewSummary).getByText('Clause Status Summary')).toBeInTheDocument();
    expect(within(reviewSummary).getByText('Under Review')).toBeInTheDocument();
  });

  it('renders all clauses as expandable sections', () => {
    render(
      <TermsRenderer
        version={mockVersion}
        allVersions={mockAllVersions}
        network="testnet"
        onVersionChange={onVersionChange}
      />
    );

    expect(screen.getByRole('heading', { name: 'Eligibility' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Wallet Responsibility' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Staking, Rewards & Disputes' })).toBeInTheDocument();
  });

  it('shows review state banner for review clauses', () => {
    render(
      <TermsRenderer
        version={mockVersion}
        allVersions={mockAllVersions}
        network="testnet"
        onVersionChange={onVersionChange}
      />
    );

    const stakingButton = screen.getByRole('button', { name: /staking, rewards & disputes/i });
    fireEvent.click(stakingButton);

    const stakingSection = screen.getByTestId('staking-rewards-disputes');
    expect(within(stakingSection).getByText('Under Review')).toBeInTheDocument();
    expect(within(stakingSection).getByText('Pending final testnet economic parameters.')).toBeInTheDocument();
  });

  it('shows approved state for approved clauses', () => {
    render(
      <TermsRenderer
        version={mockVersion}
        allVersions={mockAllVersions}
        network="testnet"
        onVersionChange={onVersionChange}
      />
    );

    const eligibilityButton = screen.getByRole('button', { name: /eligibility/i });
    fireEvent.click(eligibilityButton);

    const eligibilitySection = screen.getByTestId('eligibility');
    expect(within(eligibilitySection).getByText('Approved')).toBeInTheDocument();
    expect(within(eligibilitySection).getByText('1.1. You must be 18 or older.')).toBeInTheDocument();
  });

  it('does not show view button for current or draft versions', () => {
    render(
      <TermsRenderer
        version={mockVersion}
        allVersions={mockAllVersions}
        network="testnet"
        onVersionChange={onVersionChange}
      />
    );

    expect(screen.queryByRole('button', { name: /view version 1\.0\.0/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view version 0\.9\.0/i })).not.toBeInTheDocument();
  });

  it('renders version history with all versions', () => {
    render(
      <TermsRenderer
        version={mockVersion}
        allVersions={mockAllVersions}
        network="testnet"
        onVersionChange={onVersionChange}
      />
    );

    expect(screen.getByText('Version History')).toBeInTheDocument();
    expect(screen.getByText('Published Versions')).toBeInTheDocument();
    expect(screen.getByText('Draft Versions (Not Published)')).toBeInTheDocument();
    
    const publishedList = screen.getByLabelText('Published versions');
    expect(within(publishedList).getByText('1.0.0')).toBeInTheDocument();
    
    const draftList = screen.getByLabelText('Draft versions');
    expect(within(draftList).getByText('0.9.0')).toBeInTheDocument();
  });

  it('shows draft warning in version history', () => {
    render(
      <TermsRenderer
        version={mockVersion}
        allVersions={mockAllVersions}
        network="testnet"
        onVersionChange={onVersionChange}
      />
    );

    expect(screen.getByText('Draft content cannot be published as approved.')).toBeInTheDocument();
  });

  it('renders footer disclaimer for testnet', () => {
    render(
      <TermsRenderer
        version={mockVersion}
        allVersions={mockAllVersions}
        network="testnet"
        onVersionChange={onVersionChange}
      />
    );

    expect(screen.getByText(/Testnet:/)).toBeInTheDocument();
    expect(screen.getByText(/testnet tokens have no monetary value/i)).toBeInTheDocument();
  });

  it('renders footer disclaimer for mainnet', () => {
    const mainnetVersion = { ...mockVersion, network: 'mainnet' as const, source: 'governance' as const };
    const mainnetVersions = [mainnetVersion];

    render(
      <TermsRenderer
        version={mainnetVersion}
        allVersions={mainnetVersions}
        network="mainnet"
        onVersionChange={onVersionChange}
      />
    );

    expect(screen.getByText(/Mainnet:/)).toBeInTheDocument();
    expect(screen.getByText(/optimism mainnet/i)).toBeInTheDocument();
  });

  it('has expand/collapse all buttons', () => {
    render(
      <TermsRenderer
        version={mockVersion}
        allVersions={mockAllVersions}
        network="testnet"
        onVersionChange={onVersionChange}
      />
    );

    expect(screen.getByRole('button', { name: 'Expand All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse All' })).toBeInTheDocument();
  });

  it('sanitizes content - prevents XSS', () => {
    const maliciousVersion = {
      ...mockVersion,
      clauses: [
        {
          ...mockVersion.clauses[0],
          content: '1.1. Safe content.\x00<script>alert("xss")</script>',
        },
      ],
    };

    const { container } = render(
      <TermsRenderer
        version={maliciousVersion}
        allVersions={[maliciousVersion]}
        network="testnet"
        onVersionChange={onVersionChange}
      />
    );

    const eligibilityButton = screen.getByRole('button', { name: /eligibility/i });
    fireEvent.click(eligibilityButton);

    const eligibilitySection = screen.getByTestId('eligibility');
    expect(within(eligibilitySection).getByText(/1\.1\. Safe content\./)).toBeInTheDocument();
    expect(container.querySelector('script')).not.toBeInTheDocument();
  });

  it('has correct ARIA structure', () => {
    render(
      <TermsRenderer
        version={mockVersion}
        allVersions={mockAllVersions}
        network="testnet"
        onVersionChange={onVersionChange}
      />
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Version History' })).toBeInTheDocument();
  });
});