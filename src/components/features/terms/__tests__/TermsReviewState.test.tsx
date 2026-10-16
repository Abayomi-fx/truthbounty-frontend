import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TermsReviewState, TermsReviewSummary } from '../TermsReviewState';

describe('TermsReviewState', () => {
  it('returns null for approved status', () => {
    const { container } = render(
      <TermsReviewState
        status="approved"
        clauseTitle="Eligibility"
        network="testnet"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders review banner for review status', () => {
    render(
      <TermsReviewState
        status="review"
        reviewerNotes="Pending legal review"
        clauseTitle="Staking"
        network="mainnet"
      />
    );

    expect(screen.getByText('Under Review')).toBeInTheDocument();
    expect(screen.getByText(/not yet legally effective/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Mainnet clause')).toBeInTheDocument();
  });

  it('renders unavailable banner for unavailable status', () => {
    render(
      <TermsReviewState
        status="unavailable"
        clauseTitle="Liability"
        network="testnet"
      />
    );

    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/pending legal review|regulatory approval|governance voting/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Testnet clause')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows reviewer notes when provided', () => {
    render(
      <TermsReviewState
        status="review"
        reviewerNotes="Pending legal review"
        clauseTitle="Staking"
        network="mainnet"
      />
    );

    expect(screen.getByText('Reviewer Notes')).toBeInTheDocument();
    const summary = screen.getByText('Reviewer Notes');
    fireEvent.click(summary);
    expect(screen.getByText('Pending legal review')).toBeInTheDocument();
  });

  it('does not show reviewer notes section when not provided', () => {
    render(
      <TermsReviewState
        status="review"
        clauseTitle="Staking"
        network="mainnet"
      />
    );

    expect(screen.queryByText('Reviewer Notes')).not.toBeInTheDocument();
  });

  it('has correct ARIA labels', () => {
    render(
      <TermsReviewState
        status="review"
        reviewerNotes="Pending legal review"
        clauseTitle="Staking"
        network="mainnet"
      />
    );

    expect(screen.getByRole('note')).toHaveAttribute('aria-label', 'Under Review: Staking');
  });

  it('applies correct styling classes for review status', () => {
    const { container } = render(
      <TermsReviewState
        status="review"
        clauseTitle="Staking"
        network="mainnet"
      />
    );

    const banner = container.querySelector('div[role="note"]');
    expect(banner).toHaveClass('bg-yellow-900/20');
    expect(banner).toHaveClass('border-yellow-700');
  });

  it('applies correct styling classes for unavailable status', () => {
    const { container } = render(
      <TermsReviewState
        status="unavailable"
        clauseTitle="Liability"
        network="testnet"
      />
    );

    const banner = container.querySelector('div[role="alert"]');
    expect(banner).toHaveClass('bg-red-900/20');
    expect(banner).toHaveClass('border-red-700');
  });
});

describe('TermsReviewSummary', () => {
  it('returns null when all clauses are approved', () => {
    const { container } = render(
      <TermsReviewSummary
        clauses={[
          { id: 'eligibility', title: 'Eligibility', status: 'approved' },
          { id: 'wallet', title: 'Wallet', status: 'approved' },
        ]}
        network="testnet"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders summary when some clauses are under review', () => {
    render(
      <TermsReviewSummary
        clauses={[
          { id: 'eligibility', title: 'Eligibility', status: 'approved' },
          { id: 'staking', title: 'Staking', status: 'review' },
          { id: 'liability', title: 'Liability', status: 'approved' },
        ]}
        network="mainnet"
      />
    );

    expect(screen.getByText('Clause Status Summary')).toBeInTheDocument();
    // Check for the specific count elements in the grid
    const approvedCount = screen.getByText('Approved').closest('div');
    expect(within(approvedCount!).getByText('2')).toBeInTheDocument();
    const reviewCount = screen.getByText('Under Review').closest('div');
    expect(within(reviewCount!).getByText('1')).toBeInTheDocument();
  });

  it('renders summary when some clauses are unavailable', () => {
    render(
      <TermsReviewSummary
        clauses={[
          { id: 'eligibility', title: 'Eligibility', status: 'approved' },
          { id: 'governing', title: 'Governing Law', status: 'unavailable' },
        ]}
        network="testnet"
      />
    );

    expect(screen.getByText('Clause Status Summary')).toBeInTheDocument();
    const approvedCount = screen.getByText('Approved').closest('div');
    expect(within(approvedCount!).getByText('1')).toBeInTheDocument();
    const unavailableCount = screen.getByText('Unavailable').closest('div');
    expect(within(unavailableCount!).getByText('1')).toBeInTheDocument();
  });

  it('shows mainnet disclaimer for mainnet', () => {
    render(
      <TermsReviewSummary
        clauses={[
          { id: 'staking', title: 'Staking', status: 'review' },
        ]}
        network="mainnet"
      />
    );

    expect(screen.getByText(/Mainnet:/)).toBeInTheDocument();
    expect(screen.getByText(/governance process is required/i)).toBeInTheDocument();
  });

  it('shows testnet disclaimer for testnet', () => {
    render(
      <TermsReviewSummary
        clauses={[
          { id: 'staking', title: 'Staking', status: 'review' },
        ]}
        network="testnet"
      />
    );

    expect(screen.getByText(/Testnet:/)).toBeInTheDocument();
    expect(screen.getByText(/board process is required/i)).toBeInTheDocument();
  });

  it('has correct ARIA region label', () => {
    render(
      <TermsReviewSummary
        clauses={[
          { id: 'staking', title: 'Staking', status: 'review' },
        ]}
        network="mainnet"
      />
    );

    expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Terms review summary');
  });
});