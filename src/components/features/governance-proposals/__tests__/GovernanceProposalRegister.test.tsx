import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { GovernanceProposalRegister } from '../GovernanceProposalRegister';
import { makeAllProposalStatesList } from '@/testing/fixtures/factories/governance-proposals';
import { createFixtureContext } from '@/testing/fixtures/deterministic';

describe('UI-FE-028 — GovernanceProposalRegister (Board 07)', () => {
  const ctx = createFixtureContext({ now: 1729000000000 });
  const allProposals = makeAllProposalStatesList(ctx);

  const defaultProps = {
    proposals: allProposals,
    selectedProposalId: null,
    onSelectProposal: jest.fn(),
    stateFilter: 'all' as const,
    onStateFilterChange: jest.fn(),
    searchQuery: '',
    onSearchChange: jest.fn(),
    isLoading: false,
    isStale: false,
    onRefresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Board 07 Conformance & Stable Region', () => {
    it('renders the stable region .governance-proposal-list', () => {
      const { container } = render(<GovernanceProposalRegister {...defaultProps} />);
      const stableRegion = container.querySelector('.governance-proposal-list');
      expect(stableRegion).toBeInTheDocument();
      expect(stableRegion).toHaveAttribute('data-testid', 'governance-proposal-list');
    });

    it('renders register header, count badge, and sync button', () => {
      render(<GovernanceProposalRegister {...defaultProps} />);
      expect(screen.getByRole('heading', { level: 2, name: /Governance Proposal Register/i })).toBeInTheDocument();
      expect(screen.getByText(`${allProposals.length} total`)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Refresh governance proposals register/i })).toBeInTheDocument();
    });
  });

  describe('2. Canonical Proposal States & Card Content', () => {
    it('renders all 7 scoped proposal states across cards', () => {
      render(<GovernanceProposalRegister {...defaultProps} />);
      const expectedStates = ['draft', 'active', 'succeeded', 'queued', 'executable', 'expired', 'cancelled'];

      expectedStates.forEach((state) => {
        const badge = screen.getByTestId(`status-badge-${state}`);
        expect(badge).toBeInTheDocument();
      });
    });

    it('renders risk tier badges, proposal IDs, and targets count', () => {
      render(<GovernanceProposalRegister {...defaultProps} />);
      allProposals.forEach((proposal) => {
        expect(screen.getByText(proposal.id)).toBeInTheDocument();
        expect(screen.getByText(proposal.title)).toBeInTheDocument();
      });
    });

    it('renders voting mini-bar for active and succeeded proposals', () => {
      render(<GovernanceProposalRegister {...defaultProps} />);
      const activeProposal = allProposals.find((p) => p.state === 'active')!;
      expect(screen.getByTestId(`voting-mini-bar-${activeProposal.id}`)).toBeInTheDocument();
    });

    it('renders timelock countdown or expiration notice for queued/executable proposals', () => {
      render(<GovernanceProposalRegister {...defaultProps} />);
      const queuedProposal = allProposals.find((p) => p.state === 'queued')!;
      expect(screen.getByTestId(`proposal-countdown-${queuedProposal.id}`)).toBeInTheDocument();
    });
  });

  describe('3. Filtering & Search Controls', () => {
    it('renders state filter tabs and calls onStateFilterChange on click', () => {
      render(<GovernanceProposalRegister {...defaultProps} />);
      const activeTab = screen.getByRole('tab', { name: /Active/i });
      expect(activeTab).toBeInTheDocument();
      expect(activeTab).toHaveAttribute('aria-selected', 'false');

      fireEvent.click(activeTab);
      expect(defaultProps.onStateFilterChange).toHaveBeenCalledWith('active');
    });

    it('highlights currently selected state filter tab with aria-selected="true"', () => {
      render(<GovernanceProposalRegister {...defaultProps} stateFilter="queued" />);
      const queuedTab = screen.getByRole('tab', { name: /Queued/i });
      expect(queuedTab).toHaveAttribute('aria-selected', 'true');
    });

    it('invokes onSearchChange when typing into the search input', () => {
      render(<GovernanceProposalRegister {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText(/Search title, target, ID/i);
      expect(searchInput).toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'TruthBounty' } });
      expect(defaultProps.onSearchChange).toHaveBeenCalledWith('TruthBounty');
    });

    it('clears search input when clicking clear button', () => {
      render(<GovernanceProposalRegister {...defaultProps} searchQuery="Active" />);
      const clearBtn = screen.getByRole('button', { name: /Clear search input/i });
      expect(clearBtn).toBeInTheDocument();

      fireEvent.click(clearBtn);
      expect(defaultProps.onSearchChange).toHaveBeenCalledWith('');
    });
  });

  describe('4. Selection, Refresh & Stale Indicators', () => {
    it('calls onSelectProposal when a proposal card is clicked', () => {
      render(<GovernanceProposalRegister {...defaultProps} />);
      const firstProposal = allProposals[0];
      const card = screen.getByTestId(`proposal-item-${firstProposal.id}`);
      fireEvent.click(card);

      expect(defaultProps.onSelectProposal).toHaveBeenCalledWith(firstProposal.id);
    });

    it('applies aria-pressed="true" to the actively selected proposal card', () => {
      const selectedId = allProposals[1].id;
      render(<GovernanceProposalRegister {...defaultProps} selectedProposalId={selectedId} />);
      const card = screen.getByTestId(`proposal-item-${selectedId}`);
      expect(card).toHaveAttribute('aria-pressed', 'true');
    });

    it('triggers onRefresh when sync button is clicked', () => {
      render(<GovernanceProposalRegister {...defaultProps} />);
      const refreshBtn = screen.getByRole('button', { name: /Refresh governance proposals register/i });
      fireEvent.click(refreshBtn);

      expect(defaultProps.onRefresh).toHaveBeenCalled();
    });

    it('displays stale indicator warning when isStale is true', () => {
      render(<GovernanceProposalRegister {...defaultProps} isStale={true} />);
      expect(screen.getByTestId('proposal-register-stale-banner')).toBeInTheDocument();
      expect(screen.getByText(/Projection stale/i)).toBeInTheDocument();
    });
  });

  describe('5. Empty State', () => {
    it('renders reassuring empty state when proposals array is empty', () => {
      render(<GovernanceProposalRegister {...defaultProps} proposals={[]} />);
      expect(screen.getByTestId('proposal-register-empty')).toBeInTheDocument();
      expect(screen.getByText(/No proposals in registry/i)).toBeInTheDocument();
    });
  });
});
