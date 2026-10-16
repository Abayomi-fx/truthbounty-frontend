import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { TermsSection } from '../TermsSection';
import { TermsVersionSelector } from '../TermsVersionSelector';
import { TermsReviewState, TermsReviewSummary } from '../TermsReviewState';
import { TermsRenderer } from '../TermsRenderer';
import type { TermsVersion, TermsClause } from '@/app/types/terms';

expect.extend(toHaveNoViolations);

const mockClause: TermsClause = {
  id: 'eligibility',
  title: 'Eligibility',
  content: '1.1. You must be 18 or older.\n1.2. You must not be in a prohibited jurisdiction.',
  status: 'approved',
  lastReviewedAt: '2026-01-15T00:00:00.000Z',
};

const mockVersion: TermsVersion = {
  version: '1.0.0',
  effectiveDate: '2026-01-15',
  materialChanges: 'Initial testnet terms publication.',
  network: 'testnet',
  clauses: [
    mockClause,
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

describe('TermsSection accessibility', () => {
  it('has no accessibility violations for approved clause', async () => {
    const { container } = render(<TermsSection clause={mockClause} sectionId="eligibility" network="testnet" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations for review clause', async () => {
    const reviewClause = { ...mockClause, status: 'review' as const, reviewerNotes: 'Pending legal review' };
    const { container } = render(<TermsSection clause={reviewClause} sectionId="staking-rewards-disputes" network="mainnet" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations for unavailable clause', async () => {
    const unavailableClause = { ...mockClause, status: 'unavailable' as const };
    const { container } = render(<TermsSection clause={unavailableClause} sectionId="liability" network="testnet" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has proper heading hierarchy', () => {
    const { container } = render(<TermsSection clause={mockClause} sectionId="eligibility" network="testnet" />);
    const heading = container.querySelector('h2');
    expect(heading).toHaveAttribute('id', 'eligibility-title');
  });

  it('has ARIA labels for status badges', () => {
    const { container } = render(<TermsSection clause={mockClause} sectionId="eligibility" network="testnet" />);
    const badge = container.querySelector('[aria-label="This clause has been approved and is legally effective"]');
    expect(badge).toBeInTheDocument();
  });

  it('has network badge with ARIA label', () => {
    const { container } = render(<TermsSection clause={mockClause} sectionId="eligibility" network="testnet" />);
    const badge = container.querySelector('[aria-label="Testnet terms — no real value at stake"]');
    expect(badge).toBeInTheDocument();
  });
});

describe('TermsVersionSelector accessibility', () => {
  const onVersionChange = jest.fn();

  // Use versions where there's a published version that's not current
  const testVersions: TermsVersion[] = [
    {
      version: '1.0.0',
      effectiveDate: '2026-01-15',
      materialChanges: 'Initial testnet terms publication.',
      network: 'testnet',
      clauses: [],
      status: 'published',
      publishedAt: '2026-01-15T00:00:00.000Z',
      source: 'board',
    },
    {
      version: '1.1.0',
      effectiveDate: '2026-06-01',
      materialChanges: 'Updated staking parameters.',
      network: 'testnet',
      clauses: [],
      status: 'published',
      publishedAt: '2026-06-01T00:00:00.000Z',
      source: 'board',
    },
    {
      version: '0.9.0',
      effectiveDate: '2025-12-01',
      materialChanges: 'Pre-release draft.',
      status: 'draft',
      publishedAt: undefined,
      source: 'board',
    },
  ];

  it('has no accessibility violations', async () => {
    const { container } = render(
      <TermsVersionSelector versions={testVersions} currentVersion="1.0.0" network="testnet" onVersionChange={onVersionChange} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has region with ARIA label', () => {
    const { container } = render(
      <TermsVersionSelector versions={testVersions} currentVersion="1.0.0" network="testnet" onVersionChange={onVersionChange} />
    );
    expect(container.querySelector('[aria-label="Version selector"]')).toBeInTheDocument();
  });

  it('has lists with ARIA labels', () => {
    const { container } = render(
      <TermsVersionSelector versions={testVersions} currentVersion="1.0.0" network="testnet" onVersionChange={onVersionChange} />
    );
    expect(container.querySelector('[aria-label="Published versions"]')).toBeInTheDocument();
    expect(container.querySelector('[aria-label="Draft versions"]')).toBeInTheDocument();
  });

  it('buttons have accessible names', () => {
    render(
      <TermsVersionSelector versions={testVersions} currentVersion="1.0.0" network="testnet" onVersionChange={onVersionChange} />
    );

    const button = screen.getByRole('button', { name: /view version 1\.1\.0/i });
    expect(button).toBeInTheDocument();
  });

  it('details/summary elements are accessible', () => {
    const { container } = render(
      <TermsVersionSelector versions={testVersions} currentVersion="1.0.0" network="testnet" onVersionChange={onVersionChange} />
    );
    const summaries = container.querySelectorAll('details summary');
    expect(summaries.length).toBeGreaterThan(0);
    summaries.forEach((summary) => {
      expect(summary.getAttribute('role')).toBeNull();
    });
  });
});

describe('TermsReviewState accessibility', () => {
  it('has no accessibility violations for review status', async () => {
    const { container } = render(
      <TermsReviewState status="review" reviewerNotes="Pending legal review" clauseTitle="Staking" network="mainnet" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations for unavailable status', async () => {
    const { container } = render(
      <TermsReviewState status="unavailable" clauseTitle="Liability" network="testnet" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('uses role="note" for review status', () => {
    const { container } = render(
      <TermsReviewState status="review" clauseTitle="Staking" network="mainnet" />
    );
    expect(container.querySelector('[role="note"]')).toBeInTheDocument();
  });

  it('uses role="alert" for unavailable status', () => {
    const { container } = render(
      <TermsReviewState status="unavailable" clauseTitle="Liability" network="testnet" />
    );
    expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
  });

  it('has ARIA label with clause title', () => {
    const { container } = render(
      <TermsReviewState status="review" clauseTitle="Staking" network="mainnet" />
    );
    expect(container.querySelector('[aria-label="Under Review: Staking"]')).toBeInTheDocument();
  });
});

describe('TermsReviewSummary accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(
      <TermsReviewSummary
        clauses={[
          { id: 'eligibility', title: 'Eligibility', status: 'approved' },
          { id: 'staking', title: 'Staking', status: 'review' },
        ]}
        network="mainnet"
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has region with ARIA label', () => {
    const { container } = render(
      <TermsReviewSummary
        clauses={[{ id: 'staking', title: 'Staking', status: 'review' }]}
        network="mainnet"
      />
    );
    expect(container.querySelector('[role="region"][aria-label="Terms review summary"]')).toBeInTheDocument();
  });
});

describe('TermsRenderer accessibility', () => {
  const onVersionChange = jest.fn();

  it('has no accessibility violations', async () => {
    const { container } = render(
      <TermsRenderer version={mockVersion} allVersions={mockAllVersions} network="testnet" onVersionChange={onVersionChange} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has banner landmark', () => {
    const { container } = render(
      <TermsRenderer version={mockVersion} allVersions={mockAllVersions} network="testnet" onVersionChange={onVersionChange} />
    );
    expect(container.querySelector('[role="banner"]')).toBeInTheDocument();
  });

  it('has contentinfo landmark', () => {
    const { container } = render(
      <TermsRenderer version={mockVersion} allVersions={mockAllVersions} network="testnet" onVersionChange={onVersionChange} />
    );
    expect(container.querySelector('[role="contentinfo"]')).toBeInTheDocument();
  });

  it('has proper heading hierarchy', () => {
    const { container } = render(
      <TermsRenderer version={mockVersion} allVersions={mockAllVersions} network="testnet" onVersionChange={onVersionChange} />
    );
    const h1 = container.querySelector('h1');
    expect(h1).toHaveTextContent('Terms of Use');
    const h2s = container.querySelectorAll('h2');
    expect(h2s.length).toBeGreaterThan(0);
  });

  it('expandable sections have proper ARIA attributes', () => {
    const { container } = render(
      <TermsRenderer version={mockVersion} allVersions={mockAllVersions} network="testnet" onVersionChange={onVersionChange} />
    );
    const buttons = container.querySelectorAll('button[aria-expanded]');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((button) => {
      expect(button).toHaveAttribute('aria-controls');
    });
  });

  it('version history has region label', () => {
    render(
      <TermsRenderer version={mockVersion} allVersions={mockAllVersions} network="testnet" onVersionChange={onVersionChange} />
    );
    // The section has both aria-labelledby and aria-label; aria-labelledby takes precedence
    expect(screen.getByRole('region', { name: 'Version History' })).toBeInTheDocument();
  });

  it('expand/collapse buttons are accessible', () => {
    render(
      <TermsRenderer version={mockVersion} allVersions={mockAllVersions} network="testnet" onVersionChange={onVersionChange} />
    );
    expect(screen.getByRole('button', { name: 'Expand All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse All' })).toBeInTheDocument();
  });
});