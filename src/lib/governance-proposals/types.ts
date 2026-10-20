/**
 * UI-FE-028 — Governance Proposal Register & Detail State Model.
 *
 * Sourced from Governor / Timelock contracts and freshness-labelled API projections.
 *
 * Security & Architectural Invariants:
 * - Optimism/EVM only. UI context, wallet connection, API data, or fixtures
 *   never grant authority.
 * - Contracts are canonical for mutations; API data is freshness-labelled projection data.
 * - Exact calls, targets, parameters, and calldata are inspectable before any action.
 * - Missing release/ABI fails closed. Execution is blocked unless all gates pass.
 * - Fixtures stay strictly out of production.
 */

import type { CanonicalReceiptRecord } from '@/lib/receipts/types';

export type GovernanceProposalState =
  | 'draft'
  | 'active'
  | 'succeeded'
  | 'queued'
  | 'executable'
  | 'expired'
  | 'cancelled';

export type GovernanceProposalSurfaceState =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'error'
  | 'denied'
  | 'stale'
  | 'unavailable'
  | 'wrong-chain';

export type ProposalSourceClass =
  | 'pinned-contract'
  | 'fresh-api-projection'
  | 'verified-release-manifest'
  | 'wallet-session-local';

export type ProposalSimulationStatus =
  | 'unsimulated'
  | 'simulating'
  | 'success'
  | 'revert';

export type ProposalRiskTier = 'low' | 'medium' | 'high' | 'critical';

export type BlastRadiusScope =
  | 'protocol-wide'
  | 'module-specific'
  | 'fee-config'
  | 'emergency-guardian';

export type StateMutability = 'state-modifying' | 'upgrade' | 'parameter-only';

export type ReversibilityType =
  | 'reversible-via-proposal'
  | 'irreversible'
  | 'timelock-delayed';

export interface DecodedCallParameter {
  readonly name: string;
  readonly type: string;
  readonly value: string | number | boolean;
}

export interface ProposalTargetCall {
  readonly target: `0x${string}`;
  readonly contractName: string;
  readonly methodName: string;
  readonly selector: `0x${string}`;
  readonly value: string;
  readonly parameters: readonly DecodedCallParameter[];
  readonly calldata: `0x${string}`;
  readonly abiVerified: boolean;
  readonly abiMissingReason?: string | null;
}

export interface ProposalSimulation {
  readonly status: ProposalSimulationStatus;
  readonly simulatedAt: string | null;
  readonly gasEstimate: string | null;
  readonly revertReason: string | null;
  readonly traceSummary: readonly string[];
  readonly returnValues: readonly string[];
}

export interface ProposalVotingOutcome {
  readonly forVotes: string;
  readonly againstVotes: string;
  readonly abstainVotes: string;
  readonly forPercent: number;
  readonly againstPercent: number;
  readonly quorum: string;
  readonly quorumPercent: number;
  readonly quorumReached: boolean;
  readonly votingStartedAt: string | null;
  readonly votingEndsAt: string | null;
  readonly snapshotBlock: number | null;
}

export interface ProposalTimelockLifecycle {
  readonly timelockId: string | null;
  readonly queuedAt: string | null;
  readonly delaySeconds: number | null;
  readonly earliestExecution: string | null;
  readonly eta: string | null;
  readonly ready: boolean;
  readonly secondsRemaining: number | null;
  readonly blockNumber: number | null;
  readonly executedAt: string | null;
  readonly cancelledAt: string | null;
}

export interface AffectedContract {
  readonly address: `0x${string}`;
  readonly name: string;
  readonly role: string;
  readonly isPinned: boolean;
  readonly verificationStatus: 'verified' | 'unverified' | 'modified';
  readonly functionsCalled: readonly string[];
}

export interface ProposalBlastRadius {
  readonly scope: BlastRadiusScope;
  readonly moduleLabel: string;
  readonly riskTier: ProposalRiskTier;
  readonly userImpact: string;
  readonly stateMutability: StateMutability;
  readonly reversibility: ReversibilityType;
  readonly affectedUserCount: string | null;
  readonly affectedOperations: readonly string[];
}

export interface ProposalReceiptProvenance {
  readonly txHash: `0x${string}` | null;
  readonly blockNumber: string | null;
  readonly confirmations: number | null;
  readonly timestamp: string | null;
  readonly executedBy: `0x${string}` | null;
  readonly receipt: CanonicalReceiptRecord | null;
}

export interface ProposalFreshness {
  readonly isFresh: boolean;
  readonly lastUpdated: string;
  readonly source: string;
}

export interface GovernanceProposal {
  readonly id: string;
  readonly proposalNumber: number;
  readonly title: string;
  readonly description: string;
  readonly proposer: `0x${string}`;
  readonly createdAt: string;
  readonly state: GovernanceProposalState;
  readonly calls: readonly ProposalTargetCall[];
  readonly voting: ProposalVotingOutcome;
  readonly timelock: ProposalTimelockLifecycle;
  readonly simulation: ProposalSimulation;
  readonly affectedContracts: readonly AffectedContract[];
  readonly blastRadius: ProposalBlastRadius;
  readonly receipt: ProposalReceiptProvenance;
  readonly sourceClass: ProposalSourceClass;
  readonly freshness: ProposalFreshness;
  readonly cancelReason?: string | null;
}

export interface ProposalActionGate {
  readonly canQueue: boolean;
  readonly canExecute: boolean;
  readonly canCancel: boolean;
  readonly isActionable: boolean;
  readonly blockingReasons: readonly string[];
  readonly missingAbiCount: number;
}

export interface ProposalActionContext {
  readonly connectedAddress: `0x${string}` | null;
  readonly authorizedGovernanceOperator: `0x${string}` | null;
  readonly isAuthorizedOperator: boolean;
  readonly isSupportedChain: boolean;
  readonly releaseVerified: boolean;
}
