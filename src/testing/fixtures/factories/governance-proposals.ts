/**
 * UI-FE-028 / UI-FE-088 — Governance proposal fixture factory.
 *
 * Deterministic fixtures for proposal register and detail surfaces.
 * Covers all 7 scoped states: draft, active, succeeded, queued, executable,
 * expired, cancelled, plus executed proposals with canonical receipts.
 */

import type {
  AffectedContract,
  GovernanceProposal,
  GovernanceProposalState,
  ProposalBlastRadius,
  ProposalReceiptProvenance,
  ProposalSimulation,
  ProposalTargetCall,
  ProposalTimelockLifecycle,
  ProposalVotingOutcome,
} from '../../../lib/governance-proposals/types';
import type { CanonicalReceiptRecord } from '../../../lib/receipts/types';
import { createFixtureContext, type FixtureContext } from '../deterministic';

export function makeProposalTargetCall(
  overrides: Partial<ProposalTargetCall> = {},
): ProposalTargetCall {
  return {
    target: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    contractName: 'TruthBountyWeighted',
    methodName: 'setMinBond(uint256)',
    selector: '0x6198f10f',
    value: '0',
    parameters: [
      {
        name: 'newMinBond',
        type: 'uint256',
        value: '1500000000000000000',
      },
    ],
    calldata:
      '0x6198f10f00000000000000000000000000000000000000000000000014d1120d7b160000',
    abiVerified: true,
    abiMissingReason: null,
    ...overrides,
  };
}

export function makeProposalSimulation(
  overrides: Partial<ProposalSimulation> = {},
): ProposalSimulation {
  return {
    status: 'success',
    simulatedAt: '2026-10-14T00:00:00.000Z',
    gasEstimate: '48,500 gas',
    revertReason: null,
    traceSummary: [
      'CALL TruthBountyWeighted.setMinBond(1500000000000000000)',
      'EMIT MinBondUpdated(1000000000000000000, 1500000000000000000)',
    ],
    returnValues: ['true'],
    ...overrides,
  };
}

export function makeProposalBlastRadius(
  overrides: Partial<ProposalBlastRadius> = {},
): ProposalBlastRadius {
  return {
    scope: 'fee-config',
    moduleLabel: 'TruthBounty Dispute Engine',
    riskTier: 'medium',
    userImpact:
      'Affects new dispute filings; existing disputes retain original bond stake requirement.',
    stateMutability: 'parameter-only',
    reversibility: 'reversible-via-proposal',
    affectedUserCount: 'Active verifiers & future claimants',
    affectedOperations: ['op-sync-dispute-projection'],
    ...overrides,
  };
}

export function makeAffectedContracts(
  address: `0x${string}` = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
): readonly AffectedContract[] {
  return [
    {
      address,
      name: 'TruthBountyWeighted',
      role: 'Core Dispute Engine & Bond Escrow',
      isPinned: true,
      verificationStatus: 'verified',
      functionsCalled: ['setMinBond(uint256)'],
    },
    {
      address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
      name: 'TruthBountyTreasury',
      role: 'Treasury Vault & Slashing Recipient',
      isPinned: true,
      verificationStatus: 'verified',
      functionsCalled: ['syncEscrowRequirements()'],
    },
  ];
}

export function makeCanonicalReceiptRecord(
  ctx: FixtureContext,
  txHash: `0x${string}`,
): CanonicalReceiptRecord {
  return {
    schemaVersion: '1.0.0',
    receiptId: `rcpt-gov-${txHash.slice(2, 10)}`,
    action: 'governance',
    status: 'finalized',
    timestamp: ctx.isoAt(-3600_000),
    actionDetails: {
      actionType: 'governance',
      referenceId: 'TB-PROP-004',
      targetResource: 'TimelockController#executeProposal',
      parameters: {
        proposalId: 'TB-PROP-004',
        targets: 'TruthBountyWeighted',
      },
      notes: 'Canonical timelock execution confirmed on Optimism Sepolia',
    },
    provenance: {
      chain: {
        chainId: 11155420,
        chainName: 'Optimism Sepolia',
        protocolVersion: '2.0.0',
        releaseId: 'v2.0.0-sepolia',
        gitCommit: '5333c0acb9ccfb8a6a37ae76b3397d06781f0119',
        contractAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        contractName: 'TimelockController',
        apiVersion: 'v2',
        indexerReference: 'graph-node-op-sepolia-0',
      },
      consensus: {
        txHash,
        blockNumber: '12345680',
        blockHash: `0x${'aa'.repeat(32)}`,
        confirmations: 64,
        safeThreshold: 32,
        finalizedThreshold: 64,
        finalityLevel: 'finalized',
        indexerAcknowledged: true,
      },
      history: {
        isReplaced: false,
        replacedBy: null,
        originalTxHash: null,
        isReorged: false,
        orphanedBlockHash: null,
        reorgDetectedAt: null,
      },
    },
    checksum: `0x${'dd'.repeat(32)}`,
  };
}

export interface MakeProposalOptions {
  readonly ctx?: FixtureContext;
  readonly state?: GovernanceProposalState;
  readonly proposalNumber?: number;
  readonly overrides?: Partial<GovernanceProposal>;
}

export function makeGovernanceProposal(
  options: MakeProposalOptions = {},
): GovernanceProposal {
  const ctx = options.ctx ?? createFixtureContext();
  const state = options.state ?? 'active';
  const number = options.proposalNumber ?? 1;
  const propId = `TB-PROP-${String(number).padStart(3, '0')}`;

  const defaultCalls = [makeProposalTargetCall()];

  const defaultVoting: ProposalVotingOutcome = {
    forVotes: '1,450,000 TB',
    againstVotes: '280,000 TB',
    abstainVotes: '95,000 TB',
    forPercent: 82,
    againstPercent: 18,
    quorum: '1,000,000 TB',
    quorumPercent: 182,
    quorumReached: true,
    votingStartedAt: ctx.isoAt(-86400_000 * 2),
    votingEndsAt: ctx.isoAt(86400_000 * 3),
    snapshotBlock: 12340000,
  };

  const defaultTimelock: ProposalTimelockLifecycle = {
    timelockId: null,
    queuedAt: null,
    delaySeconds: 172800,
    earliestExecution: null,
    eta: null,
    ready: false,
    secondsRemaining: null,
    blockNumber: null,
    executedAt: null,
    cancelledAt: null,
  };

  const defaultReceipt: ProposalReceiptProvenance = {
    txHash: null,
    blockNumber: null,
    confirmations: null,
    timestamp: null,
    executedBy: null,
    receipt: null,
  };

  const base: GovernanceProposal = {
    id: propId,
    proposalNumber: number,
    title: `Adjust Dispute Minimum Bond Parameters (${propId})`,
    description:
      'Increases baseline bond required to file a formal dispute from 1.00 ETH to 1.50 ETH to eliminate frivolous challenge spam.',
    proposer: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    createdAt: ctx.isoAt(-86400_000 * 3),
    state,
    calls: defaultCalls,
    voting: defaultVoting,
    timelock: defaultTimelock,
    simulation: makeProposalSimulation(),
    affectedContracts: makeAffectedContracts(),
    blastRadius: makeProposalBlastRadius(),
    receipt: defaultReceipt,
    sourceClass: 'pinned-contract',
    freshness: {
      isFresh: true,
      lastUpdated: ctx.isoAt(-120_000),
      source: 'Optimism Sepolia Governor contract (L2 RPC)',
    },
  };

  // Adjust properties based on state
  switch (state) {
    case 'draft':
      return {
        ...base,
        title: `Draft: Parameter Update Specification (${propId})`,
        voting: {
          ...defaultVoting,
          forVotes: '0 TB',
          againstVotes: '0 TB',
          abstainVotes: '0 TB',
          forPercent: 0,
          againstPercent: 0,
          quorumReached: false,
          votingStartedAt: null,
          votingEndsAt: null,
        },
        simulation: makeProposalSimulation({ status: 'unsimulated' }),
        ...options.overrides,
      };

    case 'succeeded':
      return {
        ...base,
        title: `Protocol Fee Allocation Rebalancing (${propId})`,
        voting: {
          ...defaultVoting,
          votingEndsAt: ctx.isoAt(-3600_000),
          quorumReached: true,
        },
        ...options.overrides,
      };

    case 'queued':
      return {
        ...base,
        title: `Timelock Scheduled: Upgrade Implementation Bytecode (${propId})`,
        voting: {
          ...defaultVoting,
          votingEndsAt: ctx.isoAt(-86400_000),
        },
        timelock: {
          timelockId: `0x${'ee'.repeat(32)}`,
          queuedAt: ctx.isoAt(-86400_000),
          delaySeconds: 172800,
          earliestExecution: ctx.isoAt(86400_000),
          eta: ctx.isoAt(86400_000),
          ready: false,
          secondsRemaining: 86400,
          blockNumber: 12345600,
          executedAt: null,
          cancelledAt: null,
        },
        blastRadius: makeProposalBlastRadius({
          riskTier: 'critical',
          scope: 'protocol-wide',
          stateMutability: 'upgrade',
        }),
        ...options.overrides,
      };

    case 'executable':
      return {
        ...base,
        title: `Timelock Ready: Secondary Oracle Hub Registration (${propId})`,
        voting: {
          ...defaultVoting,
          votingEndsAt: ctx.isoAt(-86400_000 * 3),
        },
        timelock: {
          timelockId: `0x${'ff'.repeat(32)}`,
          queuedAt: ctx.isoAt(-86400_000 * 2.5),
          delaySeconds: 172800,
          earliestExecution: ctx.isoAt(-3600_000),
          eta: ctx.isoAt(-3600_000),
          ready: true,
          secondsRemaining: 0,
          blockNumber: 12345000,
          executedAt: null,
          cancelledAt: null,
        },
        blastRadius: makeProposalBlastRadius({
          riskTier: 'high',
          scope: 'module-specific',
        }),
        ...options.overrides,
      };

    case 'expired':
      return {
        ...base,
        title: `Expired Proposal: Outdated Fee Waiver (${propId})`,
        voting: {
          ...defaultVoting,
          votingEndsAt: ctx.isoAt(-86400_000 * 20),
        },
        timelock: {
          timelockId: `0x${'11'.repeat(32)}`,
          queuedAt: ctx.isoAt(-86400_000 * 18),
          delaySeconds: 172800,
          earliestExecution: ctx.isoAt(-86400_000 * 16),
          eta: ctx.isoAt(-86400_000 * 16),
          ready: false,
          secondsRemaining: 0,
          blockNumber: 12340000,
          executedAt: null,
          cancelledAt: null,
        },
        ...options.overrides,
      };

    case 'cancelled':
      return {
        ...base,
        title: `Cancelled Proposal: Experimental Staking Logic (${propId})`,
        cancelReason:
          'Audit team identified an unhandled edge case in bond liquidation. Superseded by TB-PROP-009.',
        timelock: {
          ...defaultTimelock,
          cancelledAt: ctx.isoAt(-86400_000),
        },
        ...options.overrides,
      };

    case 'active':
    default: {
      const executedTxHash =
        options.overrides?.receipt?.txHash || `0x${'cc'.repeat(32)}`;
      if (options.overrides?.receipt) {
        return {
          ...base,
          receipt: {
            txHash: executedTxHash,
            blockNumber: '12345680',
            confirmations: 64,
            timestamp: ctx.isoAt(-3600_000),
            executedBy: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
            receipt: makeCanonicalReceiptRecord(ctx, executedTxHash),
          },
          ...options.overrides,
        };
      }
      return {
        ...base,
        ...options.overrides,
      };
    }
  }
}

/**
 * Builds a deterministic list containing all 7 canonical proposal lifecycle states.
 */
export function makeAllProposalStatesList(
  ctx: FixtureContext = createFixtureContext(),
): readonly GovernanceProposal[] {
  return [
    makeGovernanceProposal({ ctx, state: 'draft', proposalNumber: 1 }),
    makeGovernanceProposal({ ctx, state: 'active', proposalNumber: 2 }),
    makeGovernanceProposal({ ctx, state: 'succeeded', proposalNumber: 3 }),
    makeGovernanceProposal({ ctx, state: 'queued', proposalNumber: 4 }),
    makeGovernanceProposal({ ctx, state: 'executable', proposalNumber: 5 }),
    makeGovernanceProposal({ ctx, state: 'expired', proposalNumber: 6 }),
    makeGovernanceProposal({ ctx, state: 'cancelled', proposalNumber: 7 }),
  ];
}
