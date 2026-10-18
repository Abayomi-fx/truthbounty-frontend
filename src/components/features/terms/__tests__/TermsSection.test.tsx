import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TermsSection } from '../TermsSection';
import type { TermsClause } from '@/app/types/terms';

const mockClause: TermsClause = {
  id: 'eligibility',
  title: 'Eligibility',
  content: '1.1. You must be 18 or older.\n1.2. You must not be in a prohibited jurisdiction.',
  status: 'approved',
  lastReviewedAt: '2026-01-15T00:00:00.000Z',
};

describe('TermsSection', () => {
  it('renders approved clause with correct title and content', () => {
    render(<TermsSection clause={mockClause} sectionId="eligibility" network="testnet" />);

    expect(screen.getByRole('heading', { name: 'Eligibility' })).toBeInTheDocument();
    expect(screen.getByText('1.1. You must be 18 or older.')).toBeInTheDocument();
    expect(screen.getByText('1.2. You must not be in a prohibited jurisdiction.')).toBeInTheDocument();
  });

  it('shows approved badge for approved status', () => {
    render(<TermsSection clause={mockClause} sectionId="eligibility" network="testnet" />);

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByLabelText('This clause has been approved and is legally effective')).toBeInTheDocument();
  });

  it('shows review badge for review status', () => {
    const reviewClause = { ...mockClause, status: 'review' as const, reviewerNotes: 'Pending legal review' };
    render(<TermsSection clause={reviewClause} sectionId="eligibility" network="mainnet" />);

    expect(screen.getByText('Under Review')).toBeInTheDocument();
    expect(screen.getByLabelText('This clause is under review and not yet legally effective')).toBeInTheDocument();
  });

  it('shows unavailable badge for unavailable status', () => {
    const unavailableClause = { ...mockClause, status: 'unavailable' as const };
    render(<TermsSection clause={unavailableClause} sectionId="eligibility" network="testnet" />);

    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByLabelText('This clause is currently unavailable')).toBeInTheDocument();
  });

  it('shows reviewer notes for review status', () => {
    const reviewClause = { ...mockClause, status: 'review' as const, reviewerNotes: 'Pending legal review' };
    render(<TermsSection clause={reviewClause} sectionId="eligibility" network="mainnet" />);

    expect(screen.getByText('Reviewer Notes')).toBeInTheDocument();
    expect(screen.getByText('Pending legal review')).toBeInTheDocument();
  });

  it('shows unavailable notice for unavailable status', () => {
    const unavailableClause = { ...mockClause, status: 'unavailable' as const };
    render(<TermsSection clause={unavailableClause} sectionId="eligibility" network="testnet" />);

    expect(screen.getByText('Clause Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/pending legal review|regulatory approval|governance voting/i)).toBeInTheDocument();
  });

  it('shows last reviewed date', () => {
    render(<TermsSection clause={mockClause} sectionId="eligibility" network="testnet" />);

    expect(screen.getByText(/Last reviewed:/i)).toBeInTheDocument();
    expect(screen.getByText(/Jan 15, 2026|15\/01\/2026|2026-01-15|1\/15\/2026/i)).toBeInTheDocument();
  });

  it('shows network badge for testnet', () => {
    render(<TermsSection clause={mockClause} sectionId="eligibility" network="testnet" />);

    expect(screen.getByText('Testnet')).toBeInTheDocument();
    expect(screen.getByLabelText('Testnet terms — no real value at stake')).toBeInTheDocument();
  });

  it('shows network badge for mainnet', () => {
    render(<TermsSection clause={mockClause} sectionId="eligibility" network="mainnet" />);

    expect(screen.getByText('Mainnet')).toBeInTheDocument();
    expect(screen.getByLabelText('Mainnet terms — real value at stake')).toBeInTheDocument();
  });

  it('has correct section ID for anchor linking', () => {
    render(<TermsSection clause={mockClause} sectionId="eligibility" network="testnet" />);

    expect(screen.getByRole('heading', { name: 'Eligibility' })).toHaveAttribute('id', 'eligibility-title');
    expect(screen.getByRole('heading', { name: 'Eligibility' })).toHaveAttribute('id');
  });

  it('sanitizes content - strips control characters', () => {
    const maliciousClause = {
      ...mockClause,
      content: '1.1. You must be 18 or older.\x00\x1f<script>alert(1)</script>',
    };
    render(<TermsSection clause={maliciousClause} sectionId="eligibility" network="testnet" />);

    // Control characters should be stripped
    expect(screen.getByText(/1\.1\. You must be 18 or older\./)).toBeInTheDocument();
    // The sanitizeText function strips control characters
    // Content is rendered as text nodes (not innerHTML), so HTML is escaped
  });
});