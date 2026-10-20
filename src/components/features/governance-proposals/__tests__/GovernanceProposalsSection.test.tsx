import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GovernanceProposalsSection } from '../GovernanceProposalsSection';
import { createFixtureContext } from '@/testing/fixtures/deterministic';
import { makeAllProposalStatesList } from '@/testing/fixtures/factories/governance-proposals';

describe('UI-FE-028 — GovernanceProposalsSection Component', () => {
  const ctx = createFixtureContext({ now: 1729000000000 });
  const allProposals = makeAllProposalStatesList(ctx);

  describe('1. Unauthorized & Explicit Denied State', () => {
    it('renders AdminUnauthorizedState when wallet is disconnected or unauthorized', () => {
      render(
        <GovernanceProposalsSection
          options={{
            testProposalsOverride: allProposals,
            overrideIsConnected: false,
            overrideConnectedAddress: null,
            overrideIsAdmin: false,
            overrideIsSupportedChain: false,
          }}
        />,
      );

      expect(screen.getByTestId('governance-proposals-denied')).toBeInTheDocument();
      expect(screen.getByText(/Wallet not connected/i)).toBeInTheDocument();
    });

    it('renders unauthorized state when on unsupported chain', () => {
      render(
        <GovernanceProposalsSection
          options={{
            testProposalsOverride: allProposals,
            overrideIsConnected: true,
            overrideConnectedAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
            overrideIsAdmin: true,
            overrideIsSupportedChain: false,
          }}
        />,
      );

      expect(screen.getByTestId('governance-proposals-denied')).toBeInTheDocument();
      expect(screen.getByText(/Connected network is unsupported/i)).toBeInTheDocument();
    });
  });

  describe('2. Authorized Proposal Section Lifecycle', () => {
    const authorizedOptions = {
      testProposalsOverride: allProposals,
      overrideIsConnected: true,
      overrideConnectedAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' as const,
      overrideIsAdmin: true,
      overrideIsSupportedChain: true,
    };

    it('renders register region and selects proposal on click to show detail card', () => {
      render(<GovernanceProposalsSection options={authorizedOptions} />);

      // Board 07 stable region
      expect(screen.getByTestId('governance-proposal-list')).toBeInTheDocument();

      // Click on proposal 2 (Active)
      const proposal2Card = screen.getByTestId('proposal-item-TB-PROP-002');
      fireEvent.click(proposal2Card);

      // Board 08 stable region appears
      expect(screen.getByTestId('proposal-detail-card')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: /Adjust Dispute Minimum Bond Parameters/i })).toBeInTheDocument();
    });

    it('renders detail directly when initialSelectedId is provided', () => {
      render(
        <GovernanceProposalsSection
          options={{
            ...authorizedOptions,
            initialSelectedId: 'TB-PROP-005', // Executable
          }}
        />,
      );

      expect(screen.getByTestId('proposal-detail-card')).toBeInTheDocument();
      expect(screen.getByTestId('execute-proposal-button')).toBeInTheDocument();
    });

    it('executes action and renders success notification banner', async () => {
      render(
        <GovernanceProposalsSection
          options={{
            ...authorizedOptions,
            initialSelectedId: 'TB-PROP-005', // Executable proposal
          }}
        />,
      );

      const executeBtn = screen.getByTestId('execute-proposal-button');
      fireEvent.click(executeBtn);

      await waitFor(() => {
        expect(screen.getByTestId('proposal-feedback-alert')).toBeInTheDocument();
        expect(screen.getByText(/submitted to canonical Governor contract/i)).toBeInTheDocument();
      });
    });
  });
});
