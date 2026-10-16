import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TermsVersionSelector } from '../TermsVersionSelector';
import type { TermsVersion } from '@/app/types/terms';

const mockVersions: TermsVersion[] = [
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
    materialChanges: 'Updated staking parameters and dispute resolution.',
    previousVersion: '1.0.0',
    network: 'testnet',
    clauses: [],
    status: 'published',
    publishedAt: '2026-06-01T00:00:00.000Z',
    source: 'board',
  },
  {
    version: '2.0.0',
    effectiveDate: '2026-12-01',
    materialChanges: 'Major revision for mainnet launch.',
    previousVersion: '1.1.0',
    network: 'testnet',
    clauses: [],
    status: 'draft',
    source: 'board',
  },
];

describe('TermsVersionSelector', () => {
  const onVersionChange = jest.fn();

  beforeEach(() => {
    onVersionChange.mockClear();
  });

  it('renders current version indicator', () => {
    render(<TermsVersionSelector versions={mockVersions} currentVersion="1.1.0" network="testnet" onVersionChange={onVersionChange} />);

    expect(screen.getByText('Current Version')).toBeInTheDocument();
    // Current version appears in the header section with "Active" badge
    const activeBadge = screen.getByText('Active');
    const currentVersionContainer = activeBadge.closest('div');
    expect(within(currentVersionContainer!).getByText('1.1.0')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders published versions list', () => {
    render(<TermsVersionSelector versions={mockVersions} currentVersion="1.1.0" network="testnet" onVersionChange={onVersionChange} />);

    expect(screen.getByText('Published Versions')).toBeInTheDocument();
    // Lists use aria-label only, no role="list"
    const publishedList = screen.getByLabelText('Published versions');
    expect(within(publishedList).getByText('1.0.0')).toBeInTheDocument();
    expect(within(publishedList).getByText('1.1.0')).toBeInTheDocument();
  });

  it('marks current version as selected', () => {
    render(<TermsVersionSelector versions={mockVersions} currentVersion="1.1.0" network="testnet" onVersionChange={onVersionChange} />);

    const currentBadge = screen.getByText('Current');
    const currentVersionItem = currentBadge.closest('article');
    expect(currentVersionItem).toHaveClass('ring-1');
    expect(currentVersionItem).toHaveClass('ring-action/20');
  });

  it('shows view button for non-current versions', () => {
    render(<TermsVersionSelector versions={mockVersions} currentVersion="1.1.0" network="testnet" onVersionChange={onVersionChange} />);

    expect(screen.getByRole('button', { name: /view version 1\.0\.0/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view version 1\.1\.0/i })).not.toBeInTheDocument();
  });

  it('calls onVersionChange when version button clicked', () => {
    render(<TermsVersionSelector versions={mockVersions} currentVersion="1.1.0" network="testnet" onVersionChange={onVersionChange} />);

    fireEvent.click(screen.getByRole('button', { name: /view version 1\.0\.0/i }));
    expect(onVersionChange).toHaveBeenCalledWith('1.0.0');
  });

  it('shows material changes in details', () => {
    render(<TermsVersionSelector versions={mockVersions} currentVersion="1.1.0" network="testnet" onVersionChange={onVersionChange} />);

    const publishedList = screen.getByLabelText('Published versions');
    const version110Item = within(publishedList).getByText('1.1.0').closest('article');
    const summary = within(version110Item!).getByText('Material Changes');
    fireEvent.click(summary);

    expect(within(version110Item!).getByText('Updated staking parameters and dispute resolution.')).toBeInTheDocument();
  });

  it('renders draft versions section', () => {
    render(<TermsVersionSelector versions={mockVersions} currentVersion="1.1.0" network="testnet" onVersionChange={onVersionChange} />);

    expect(screen.getByText('Draft Versions (Not Published)')).toBeInTheDocument();
    expect(screen.getByText('2.0.0')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('shows draft warning notice', () => {
    render(<TermsVersionSelector versions={mockVersions} currentVersion="1.1.0" network="testnet" onVersionChange={onVersionChange} />);

    expect(screen.getByText('Draft content cannot be published as approved.')).toBeInTheDocument();
  });

  it('shows source badge for board approved', () => {
    render(<TermsVersionSelector versions={mockVersions} currentVersion="1.1.0" network="testnet" onVersionChange={onVersionChange} />);

    expect(screen.getAllByText('Board')).toHaveLength(2);
  });

  it('shows testnet badge for testnet versions', () => {
    render(<TermsVersionSelector versions={mockVersions} currentVersion="1.1.0" network="testnet" onVersionChange={onVersionChange} />);

    expect(screen.getAllByText('Testnet').length).toBeGreaterThanOrEqual(2);
  });

  it('shows effective date and published date', () => {
    render(<TermsVersionSelector versions={mockVersions} currentVersion="1.1.0" network="testnet" onVersionChange={onVersionChange} />);

    expect(screen.getAllByText(/Effective:/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Published:/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Previous:/).length).toBeGreaterThanOrEqual(1);
  });

  it('does not show view button for draft versions', () => {
    render(<TermsVersionSelector versions={mockVersions} currentVersion="1.1.0" network="testnet" onVersionChange={onVersionChange} />);

    expect(screen.queryByRole('button', { name: /view version 2\.0\.0/i })).not.toBeInTheDocument();
  });

  it('applies correct network badge for mainnet', () => {
    const mainnetVersions: TermsVersion[] = [
      {
        ...mockVersions[0],
        network: 'mainnet',
        source: 'governance',
      },
    ];

    render(<TermsVersionSelector versions={mainnetVersions} currentVersion="1.0.0" network="mainnet" onVersionChange={onVersionChange} />);

    expect(screen.getByText('Mainnet')).toBeInTheDocument();
    expect(screen.getByText('Governance')).toBeInTheDocument();
  });

  it('has correct ARIA labels', () => {
    render(<TermsVersionSelector versions={mockVersions} currentVersion="1.1.0" network="testnet" onVersionChange={onVersionChange} />);

    expect(screen.getByLabelText('Version selector')).toBeInTheDocument();
    expect(screen.getByLabelText('Published versions')).toBeInTheDocument();
    expect(screen.getByLabelText('Draft versions')).toBeInTheDocument();
  });
});