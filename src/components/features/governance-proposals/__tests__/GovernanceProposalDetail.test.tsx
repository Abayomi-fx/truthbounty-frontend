import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GovernanceProposalDetail } from '../GovernanceProposalDetail';
import {
  createFixtureContext,
} from '@/testing/fixtures/deterministic';
import {
  makeGovernanceProposal,
  makeCanonicalReceiptRecord,
} from '@/testing/fixtures/factories/governance-proposals';
import type { ProposalActionGate } from '@/lib/governance-proposals/types';

describe('UI-FE-028 — GovernanceProposalDetail (Board 08)', () => {
  const ctx = createFixtureContext({ now: 1729000000000 });

  const activeProposal = makeGovernanceProposal({
    ctx,
    state: 'active',
    proposalNumber: 2,
  });

  const succeededProposal = makeGovernanceProposal({
    ctx,
    state: 'succeeded',
    proposalNumber: 3,
  });

  const executableProposal = makeGovernanceProposal({
    ctx,
    state: 'executable',
    proposalNumber: 5,
  });

  const executedProposalWithReceipt = makeGovernanceProposal({
    ctx,
    state: 'active',
    proposalNumber: 8,
    overrides: {
      receipt: {
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        blockNumber: '12345680',
        confirmations: 64,
        timestamp: ctx.isoAt(-3600_000),
        executedBy: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        receipt: makeCanonicalReceiptRecord(
          ctx,
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        ),
      },
    },
  });

  const mockOnQueue = jest.fn();
  const mockOnExecute = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Board 08 Conformance & Stable Region', () => {
    it('renders the stable region .proposal-detail-card', () => {
      const { container } = render(
        <GovernanceProposalDetail proposal={activeProposal} />,
      );
      const stableRegion = container.querySelector('.proposal-detail-card');
      expect(stableRegion).toBeInTheDocument();
      expect(stableRegion).toHaveAttribute('data-testid', 'proposal-detail-card');
    });

    it('renders proposal header with ID, title, proposer, and risk tier', () => {
      render(<GovernanceProposalDetail proposal={activeProposal} />);
      expect(screen.getByText(activeProposal.id)).toBeInTheDocument();
      expect(screen.getByText(activeProposal.title)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(activeProposal.proposer.slice(0, 8), 'i'))).toBeInTheDocument();
    });
  });

  describe('2. Exact Target Calls & Calldata Inspector', () => {
    it('renders call targets, method names, decoded parameters, and hex calldata', () => {
      render(<GovernanceProposalDetail proposal={activeProposal} />);
      const firstCall = activeProposal.calls[0];

      expect(screen.getByText(firstCall.contractName)).toBeInTheDocument();
      expect(screen.getByText(firstCall.methodName)).toBeInTheDocument();
      expect(screen.getAllByText(firstCall.target).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(firstCall.calldata)).toBeInTheDocument();
    });

    it('allows copying hex calldata via copy button', async () => {
      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      render(<GovernanceProposalDetail proposal={activeProposal} />);
      const copyBtn = screen.getByRole('button', { name: /Copy calldata for call #1/i });
      expect(copyBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(copyBtn);
      });
      expect(writeTextMock).toHaveBeenCalledWith(activeProposal.calls[0].calldata);
    });

    it('renders fail-closed warning when target contract ABI is unverified', () => {
      const unverifiedProposal = makeGovernanceProposal({
        ctx,
        state: 'active',
        proposalNumber: 9,
        overrides: {
          calls: [
            {
              ...activeProposal.calls[0],
              abiVerified: false,
              abiMissingReason: 'Release manifest verification failed: bytecode mismatch at address',
            },
          ],
        },
      });

      render(<GovernanceProposalDetail proposal={unverifiedProposal} />);
      expect(screen.getByText(/Release manifest verification failed/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Missing Verified Contract ABI/i })).toBeInTheDocument();
    });
  });

  describe('3. Simulation, Affected Contracts & Blast Radius', () => {
    it('renders simulation card with gas estimate and execution trace', () => {
      render(<GovernanceProposalDetail proposal={activeProposal} />);
      expect(screen.getByRole('heading', { name: /Transaction Simulation/i })).toBeInTheDocument();
      expect(screen.getByText(activeProposal.simulation.gasEstimate)).toBeInTheDocument();
      expect(screen.getByText(/Simulation Success/i)).toBeInTheDocument();

      activeProposal.simulation.traceSummary.forEach((step) => {
        expect(screen.getByText(step)).toBeInTheDocument();
      });
    });

    it('renders affected contracts and blast radius grid (scope, impact, reversibility)', () => {
      render(<GovernanceProposalDetail proposal={activeProposal} />);
      expect(screen.getByText(/Affected Contracts & Blast Radius/i)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(activeProposal.blastRadius.scope.replace('-', ' '), 'i'))).toBeInTheDocument();
      expect(screen.getByText(activeProposal.blastRadius.userImpact)).toBeInTheDocument();

      activeProposal.affectedContracts.forEach((contract) => {
        expect(screen.getByText(contract.name)).toBeInTheDocument();
        expect(screen.getAllByText(contract.address).length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('4. Canonical Receipt Modal Integration', () => {
    it('renders canonical receipt summary when proposal has receipt data', () => {
      render(<GovernanceProposalDetail proposal={executedProposalWithReceipt} />);
      expect(screen.getByText(/Canonical Transaction Receipt/i)).toBeInTheDocument();
      expect(screen.getByText(executedProposalWithReceipt.receipt.txHash!)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Inspect Canonical Receipt/i })).toBeInTheDocument();
    });

    it('opens TransactionReceiptModal when clicking Inspect Canonical Receipt', () => {
      render(<GovernanceProposalDetail proposal={executedProposalWithReceipt} />);
      const inspectBtn = screen.getByRole('button', { name: /Inspect Canonical Receipt/i });

      fireEvent.click(inspectBtn);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Cryptographic Action Receipt/i)).toBeInTheDocument();
    });
  });

  describe('5. Action Controls & Fail-Closed Security Gates', () => {
    it('renders queue button for succeeded proposal and fires onQueue when authorized', () => {
      const authorizedGate: ProposalActionGate = {
        canQueue: true,
        canExecute: false,
        canCancel: true,
        blockingReasons: [],
        missingAbi: false,
        isActionable: true,
      };

      render(
        <GovernanceProposalDetail
          proposal={succeededProposal}
          actionGate={authorizedGate}
          onQueue={mockOnQueue}
        />,
      );

      const queueBtn = screen.getByTestId('queue-proposal-button');
      expect(queueBtn).toBeInTheDocument();
      expect(queueBtn).not.toBeDisabled();

      fireEvent.click(queueBtn);
      expect(mockOnQueue).toHaveBeenCalledWith(succeededProposal.id);
    });

    it('disables queue button with blocking alert when unauthorized', () => {
      const unauthorizedGate: ProposalActionGate = {
        canQueue: false,
        canExecute: false,
        canCancel: false,
        blockingReasons: ['Wallet not connected with Governance Operator role'],
        missingAbi: false,
        isActionable: false,
      };

      render(
        <GovernanceProposalDetail
          proposal={succeededProposal}
          actionGate={unauthorizedGate}
          onQueue={mockOnQueue}
        />,
      );

      const queueBtn = screen.getByTestId('queue-proposal-button');
      expect(queueBtn).toBeDisabled();
      expect(screen.getByText(/Wallet not connected with Governance Operator role/i)).toBeInTheDocument();

      fireEvent.click(queueBtn);
      expect(mockOnQueue).not.toHaveBeenCalled();
    });

    it('renders execute button for executable proposal and fires onExecute when authorized', () => {
      const authorizedGate: ProposalActionGate = {
        canQueue: false,
        canExecute: true,
        canCancel: false,
        blockingReasons: [],
        missingAbi: false,
        isActionable: true,
      };

      render(
        <GovernanceProposalDetail
          proposal={executableProposal}
          actionGate={authorizedGate}
          onExecute={mockOnExecute}
        />,
      );

      const executeBtn = screen.getByTestId('execute-proposal-button');
      expect(executeBtn).toBeInTheDocument();
      expect(executeBtn).not.toBeDisabled();

      fireEvent.click(executeBtn);
      expect(mockOnExecute).toHaveBeenCalledWith(executableProposal.id);
    });

    it('renders cancel button and triggers onCancel when clicked', () => {
      const cancelGate: ProposalActionGate = {
        canQueue: false,
        canExecute: false,
        canCancel: true,
        blockingReasons: [],
        missingAbi: false,
        isActionable: true,
      };

      render(
        <GovernanceProposalDetail
          proposal={activeProposal}
          actionGate={cancelGate}
          onCancel={mockOnCancel}
        />,
      );

      const cancelBtn = screen.getByTestId('cancel-proposal-button');
      expect(cancelBtn).toBeInTheDocument();
      expect(cancelBtn).not.toBeDisabled();

      fireEvent.click(cancelBtn);
      expect(mockOnCancel).toHaveBeenCalledWith(activeProposal.id);
    });
  });
});
