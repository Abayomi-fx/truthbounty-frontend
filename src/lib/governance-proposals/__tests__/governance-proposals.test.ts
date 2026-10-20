import { describe, expect, it } from '@jest/globals';
import {
  filterProposals,
  formatProposalCountdown,
  resolveProposalActionGate,
  validateProposalCalls,
} from '../governance-proposals';
import type { ProposalActionContext } from '../types';
import {
  makeAllProposalStatesList,
  makeGovernanceProposal,
  makeProposalTargetCall,
} from '../../../testing/fixtures/factories/governance-proposals';

const AUTHORIZED_OPERATOR = '0x90F79bf6EB2c4f870365E785982E1f101E93b906' as const;
const UNAUTHORIZED_USER = '0x1234567890123456789012345678901234567890' as const;

const validContext: ProposalActionContext = {
  connectedAddress: AUTHORIZED_OPERATOR,
  authorizedGovernanceOperator: AUTHORIZED_OPERATOR,
  isAuthorizedOperator: true,
  isSupportedChain: true,
  releaseVerified: true,
};

describe('UI-FE-028 — Governance Proposals Pure Logic', () => {
  describe('validateProposalCalls', () => {
    it('passes when all calls have verified ABIs', () => {
      const calls = [makeProposalTargetCall({ abiVerified: true })];
      const result = validateProposalCalls(calls);
      expect(result.allVerified).toBe(true);
      expect(result.missingCount).toBe(0);
      expect(result.failureReasons).toEqual([]);
    });

    it('fails closed when a call is missing verified ABI', () => {
      const calls = [
        makeProposalTargetCall({
          abiVerified: false,
          abiMissingReason: 'Release manifest does not pin setMinBond ABI.',
        }),
      ];
      const result = validateProposalCalls(calls);
      expect(result.allVerified).toBe(false);
      expect(result.missingCount).toBe(1);
      expect(result.failureReasons[0]).toMatch(/does not pin setMinBond ABI/i);
    });

    it('fails closed when calls list is empty', () => {
      const result = validateProposalCalls([]);
      expect(result.allVerified).toBe(false);
      expect(result.failureReasons[0]).toMatch(/contains no executable target calls/i);
    });
  });

  describe('resolveProposalActionGate', () => {
    it('blocks all mutations if connected chain is unsupported', () => {
      const proposal = makeGovernanceProposal({ state: 'executable' });
      const gate = resolveProposalActionGate(proposal, {
        ...validContext,
        isSupportedChain: false,
      });

      expect(gate.canExecute).toBe(false);
      expect(gate.blockingReasons).toContain(
        'Connected chain is not the pinned Optimism EVM release.',
      );
    });

    it('blocks all mutations if release manifest is unverified', () => {
      const proposal = makeGovernanceProposal({ state: 'executable' });
      const gate = resolveProposalActionGate(proposal, {
        ...validContext,
        releaseVerified: false,
      });

      expect(gate.canExecute).toBe(false);
      expect(gate.blockingReasons).toContain(
        'Release manifest or contract verification is missing or unverified.',
      );
    });

    it('blocks mutations if caller is not an authorized operator', () => {
      const proposal = makeGovernanceProposal({ state: 'executable' });
      const gate = resolveProposalActionGate(proposal, {
        ...validContext,
        connectedAddress: UNAUTHORIZED_USER,
        isAuthorizedOperator: false,
      });

      expect(gate.canExecute).toBe(false);
      expect(gate.blockingReasons[0]).toMatch(/does not hold the Governance Operator role/i);
    });

    it('blocks mutations if wallet is disconnected', () => {
      const proposal = makeGovernanceProposal({ state: 'executable' });
      const gate = resolveProposalActionGate(proposal, {
        ...validContext,
        connectedAddress: null,
        isAuthorizedOperator: false,
      });

      expect(gate.canExecute).toBe(false);
      expect(gate.blockingReasons).toContain(
        'Wallet not connected. Connect an authorized Governance Operator account.',
      );
    });

    it('blocks mutations when a target call is missing ABI (fails closed)', () => {
      const proposal = makeGovernanceProposal({
        state: 'executable',
        overrides: {
          calls: [makeProposalTargetCall({ abiVerified: false })],
        },
      });

      const gate = resolveProposalActionGate(proposal, validContext);
      expect(gate.canExecute).toBe(false);
      expect(gate.missingAbiCount).toBe(1);
      expect(gate.blockingReasons.some((r) => r.includes('missing verified release ABI'))).toBe(true);
    });

    it('allows queuing for a succeeded proposal', () => {
      const proposal = makeGovernanceProposal({ state: 'succeeded' });
      const gate = resolveProposalActionGate(proposal, validContext);

      expect(gate.canQueue).toBe(true);
      expect(gate.canExecute).toBe(false);
      expect(gate.blockingReasons).toEqual([]);
    });

    it('blocks queuing if proposal was already queued in timelock', () => {
      const proposal = makeGovernanceProposal({
        state: 'succeeded',
        overrides: {
          timelock: {
            timelockId: '0x123',
            queuedAt: '2026-10-14T00:00:00.000Z',
            delaySeconds: 172800,
            earliestExecution: '2026-10-16T00:00:00.000Z',
            eta: '2026-10-16T00:00:00.000Z',
            ready: false,
            secondsRemaining: 86400,
            blockNumber: 1234,
            executedAt: null,
            cancelledAt: null,
          },
        },
      });

      const gate = resolveProposalActionGate(proposal, validContext);
      expect(gate.canQueue).toBe(false);
    });

    it('blocks execution when queued proposal delay has not elapsed', () => {
      const proposal = makeGovernanceProposal({
        state: 'queued',
        overrides: {
          timelock: {
            timelockId: '0x123',
            queuedAt: '2026-10-14T00:00:00.000Z',
            delaySeconds: 172800,
            earliestExecution: '2026-10-16T00:00:00.000Z',
            eta: '2026-10-16T00:00:00.000Z',
            ready: false,
            secondsRemaining: 86400,
            blockNumber: 1234,
            executedAt: null,
            cancelledAt: null,
          },
        },
      });

      const gate = resolveProposalActionGate(proposal, validContext);
      expect(gate.canExecute).toBe(false);
      expect(gate.blockingReasons.some((r) => r.includes('Timelock delay is active'))).toBe(true);
    });

    it('allows execution when queued proposal timelock is ready', () => {
      const proposal = makeGovernanceProposal({
        state: 'queued',
        overrides: {
          timelock: {
            timelockId: '0x123',
            queuedAt: '2026-10-14T00:00:00.000Z',
            delaySeconds: 172800,
            earliestExecution: '2026-10-16T00:00:00.000Z',
            eta: '2026-10-16T00:00:00.000Z',
            ready: true,
            secondsRemaining: 0,
            blockNumber: 1234,
            executedAt: null,
            cancelledAt: null,
          },
        },
      });

      const gate = resolveProposalActionGate(proposal, validContext);
      expect(gate.canExecute).toBe(true);
      expect(gate.blockingReasons).toEqual([]);
    });

    it('allows execution for an executable state proposal', () => {
      const proposal = makeGovernanceProposal({ state: 'executable' });
      const gate = resolveProposalActionGate(proposal, validContext);

      expect(gate.canExecute).toBe(true);
      expect(gate.blockingReasons).toEqual([]);
    });

    it('permanently blocks execution for expired proposal', () => {
      const proposal = makeGovernanceProposal({ state: 'expired' });
      const gate = resolveProposalActionGate(proposal, validContext);

      expect(gate.canExecute).toBe(false);
      expect(gate.canQueue).toBe(false);
      expect(gate.blockingReasons).toContain(
        'Proposal timelock execution grace period has expired.',
      );
    });

    it('permanently blocks execution for cancelled proposal', () => {
      const proposal = makeGovernanceProposal({ state: 'cancelled' });
      const gate = resolveProposalActionGate(proposal, validContext);

      expect(gate.canExecute).toBe(false);
      expect(gate.canQueue).toBe(false);
      expect(gate.blockingReasons).toContain(
        'Proposal has been cancelled and cannot be executed.',
      );
    });
  });

  describe('formatProposalCountdown', () => {
    it('returns "Ready to execute" when seconds <= 0', () => {
      expect(formatProposalCountdown(0)).toBe('Ready to execute');
      expect(formatProposalCountdown(-10)).toBe('Ready to execute');
    });

    it('returns "Pending schedule" for null or undefined', () => {
      expect(formatProposalCountdown(null)).toBe('Pending schedule');
    });

    it('formats days, hours, minutes correctly', () => {
      expect(formatProposalCountdown(90000)).toBe('1d 1h 0m');
      expect(formatProposalCountdown(3665)).toBe('1h 1m 5s');
      expect(formatProposalCountdown(75)).toBe('1m 15s');
    });
  });

  describe('filterProposals', () => {
    const proposals = makeAllProposalStatesList();

    it('returns all proposals when filter is "all" and search is empty', () => {
      const filtered = filterProposals(proposals, 'all', '');
      expect(filtered.length).toBe(7);
    });

    it('filters strictly by state', () => {
      const draft = filterProposals(proposals, 'draft');
      expect(draft.length).toBe(1);
      expect(draft[0].state).toBe('draft');

      const queued = filterProposals(proposals, 'queued');
      expect(queued.length).toBe(1);
      expect(queued[0].state).toBe('queued');

      const cancelled = filterProposals(proposals, 'cancelled');
      expect(cancelled.length).toBe(1);
      expect(cancelled[0].state).toBe('cancelled');
    });

    it('filters by search query', () => {
      const match = filterProposals(proposals, 'all', 'TB-PROP-004');
      expect(match.length).toBe(1);
      expect(match[0].id).toBe('TB-PROP-004');

      const byTarget = filterProposals(proposals, 'all', 'TruthBountyWeighted');
      expect(byTarget.length).toBeGreaterThan(0);
    });
  });
});
