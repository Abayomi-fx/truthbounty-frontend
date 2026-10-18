'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import type { AppealRoundProgressionView } from '@/app/types/appeal';
import type { DisputeEligibility } from '@/app/types/dispute-entry';
import { AppealRoundProgression } from '@/components/features/appeals/AppealRoundProgression';
import {
  TransactionStatus,
  type TransactionStatusValue,
} from '@/components/features/claim-verification/TransactionStatus';
import { DisputeEntryForm } from '@/components/features/disputes/DisputeEntryForm';
import { SettlementStatusPanel } from '@/components/features/settlement/SettlementStatusPanel';
import { StakeWeightDisplay } from '@/components/ui/primitives/StakeWeightDisplay';
import { VerifierDashboard } from '@/features/verifier-dashboard/VerifierDashboard';
import type {
  EligibilityState,
  Outcome,
  QueueItem,
} from '@/features/verifier-dashboard/types';
import type { SettlementStatusInput } from '@/lib/settlement-status';

export const PINNED_RELEASE = {
  chainId: 11155420,
  releaseId: 'v2.0.0-sepolia',
  protocolVersion: '2.0.0',
  gitCommit: '5333c0acb9ccfb8a6a37ae76b3397d06781f0119',
} as const;

const FETCHED_AT = '2026-10-14T00:00:00.000Z';
const DEADLINE = '2026-10-14T12:00:00.000Z';
const PHASE_DEADLINE = '2026-10-14T10:00:00.000Z';
const WINDOW_END = '2026-10-15T00:00:00.000Z';
const TX_HASH: `0x${string}` = `0x${'ab'.repeat(32)}`;

const SPEC = {
  supporting: '1500000000000000000',
  opposing: '500000000000000000',
  quorum: '2000000000000000000',
  bond: '250000000000000000',
  appealBond: '100000000000000000',
} as const;

const fresh = { fetchedAt: FETCHED_AT, stale: false } as const;

export type JourneyScenario =
  | 'eligible-commit'
  | 'ineligible'
  | 'reveal-open'
  | 'missed-reveal'
  | 'wrong-salt'
  | 'replaced'
  | 'slashed'
  | 'tie-refund'
  | 'expired-dispute'
  | 'indexing-delay'
  | 'reorg'
  | 'appeal-open'
  | 'appeal-resolved';

const ELIGIBLE: EligibilityState = {
  status: 'eligible',
  authority: 'pinned release v2.0.0-sepolia (TruthBountyWeighted)',
  freshness: fresh,
};

const INELIGIBLE: EligibilityState = {
  status: 'ineligible',
  reason: 'Stake below the canonical verifier minimum',
  freshness: fresh,
};

const DISPUTE_ELIGIBLE: DisputeEligibility = {
  status: 'eligible',
  requiredBond: SPEC.bond,
  windowEnd: WINDOW_END,
  observedAtBlock: '12345678',
};

const DISPUTE_EXPIRED: DisputeEligibility = {
  status: 'expired-window',
  windowEnd: '2026-10-13T00:00:00.000Z',
};

const PENDING_SETTLEMENT: SettlementStatusInput = {
  state: 'PENDING_SETTLEMENT',
  finality: 'none',
};

function queueItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 'claim-638',
    title: 'Canonical verifier journey claim',
    deadlineIso: DEADLINE,
    phase: 'commit',
    phaseDeadlineIso: PHASE_DEADLINE,
    state: 'available',
    freshness: fresh,
    ...overrides,
  };
}

function outcome(id: string, result: string): Outcome {
  return {
    id,
    title: `Claim ${id}`,
    result,
    confirmedAtIso: '2026-10-14T11:00:00.000Z',
  };
}

function appealRound(
  overrides: Partial<AppealRoundProgressionView> = {},
): AppealRoundProgressionView {
  return {
    appealId: 'appeal-638',
    roundNumber: 1,
    requiredBond: SPEC.appealBond,
    deadlineSeconds: 1760000000,
    timeRemainingSeconds: 7200,
    supportStake: '1200000000000000000',
    opposeStake: '800000000000000000',
    state: 'ACTIVE',
    isActive: true,
    hasEnded: false,
    roundMatchesExpected: true,
    expectedRound: 1,
    ...overrides,
  };
}

interface ScenarioConfig {
  eligibility: EligibilityState;
  available: QueueItem[];
  commitments: QueueItem[];
  outcomes: Outcome[];
  dispute: DisputeEligibility;
  appeal: AppealRoundProgressionView;
  settlement: SettlementStatusInput;
  transaction?: {
    status: TransactionStatusValue;
    errorMessage?: string;
    retryable?: boolean;
  };
  weight: { supporting: string; opposing: string; provisional: boolean };
}

function scenarioConfig(scenario: JourneyScenario): ScenarioConfig {
  switch (scenario) {
    case 'ineligible':
      return {
        eligibility: INELIGIBLE,
        available: [queueItem({ title: 'Hidden claim' })],
        commitments: [],
        outcomes: [],
        dispute: DISPUTE_ELIGIBLE,
        appeal: appealRound(),
        settlement: PENDING_SETTLEMENT,
        weight: {
          supporting: SPEC.supporting,
          opposing: SPEC.opposing,
          provisional: true,
        },
      };
    case 'reveal-open':
      return {
        eligibility: ELIGIBLE,
        available: [],
        commitments: [
          queueItem({
            phase: 'reveal',
            state: 'in-progress',
            protectedEvidence: 'REVEAL-EVIDENCE-VISIBLE',
            protectedChoice: 'REVEAL-CHOICE-VISIBLE',
          }),
        ],
        outcomes: [],
        dispute: DISPUTE_ELIGIBLE,
        appeal: appealRound(),
        settlement: PENDING_SETTLEMENT,
        weight: {
          supporting: SPEC.supporting,
          opposing: SPEC.opposing,
          provisional: true,
        },
      };
    case 'missed-reveal':
      return {
        eligibility: ELIGIBLE,
        available: [],
        commitments: [queueItem({ phase: 'closed', state: 'missed-reveal' })],
        outcomes: [outcome('missed', 'Missed reveal — stake forfeited')],
        dispute: DISPUTE_ELIGIBLE,
        appeal: appealRound(),
        settlement: { state: 'SETTLED', finality: 'finalized', txHash: TX_HASH },
        transaction: {
          status: 'reverted',
          errorMessage: 'Reveal phase closed before submission',
          retryable: true,
        },
        weight: {
          supporting: '0',
          opposing: '0',
          provisional: false,
        },
      };
    case 'wrong-salt':
      return {
        eligibility: ELIGIBLE,
        available: [],
        commitments: [queueItem({ phase: 'closed', state: 'wrong-salt' })],
        outcomes: [outcome('salt', 'Wrong salt — reveal rejected')],
        dispute: DISPUTE_ELIGIBLE,
        appeal: appealRound(),
        settlement: { state: 'SETTLED', finality: 'finalized', txHash: TX_HASH },
        transaction: {
          status: 'reverted',
          errorMessage: 'Salt does not match the commitment',
          retryable: false,
        },
        weight: {
          supporting: '0',
          opposing: '0',
          provisional: false,
        },
      };
    case 'replaced':
      return {
        eligibility: ELIGIBLE,
        available: [],
        commitments: [queueItem({ phase: 'commit', state: 'replaced' })],
        outcomes: [outcome('replaced', 'Submission replaced before inclusion')],
        dispute: DISPUTE_ELIGIBLE,
        appeal: appealRound(),
        settlement: { state: 'PENDING_SETTLEMENT', finality: 'pending' },
        transaction: {
          status: 'replaced',
          errorMessage: 'Replaced by a higher-fee transaction',
          retryable: true,
        },
        weight: {
          supporting: SPEC.supporting,
          opposing: SPEC.opposing,
          provisional: true,
        },
      };
    case 'slashed':
      return {
        eligibility: ELIGIBLE,
        available: [],
        commitments: [queueItem({ phase: 'closed', state: 'slashed' })],
        outcomes: [outcome('slashed', 'Slashed — invalid reveal')],
        dispute: DISPUTE_ELIGIBLE,
        appeal: appealRound(),
        settlement: { state: 'SETTLED', finality: 'finalized', txHash: TX_HASH },
        weight: {
          supporting: '0',
          opposing: '0',
          provisional: false,
        },
      };
    case 'tie-refund':
      return {
        eligibility: ELIGIBLE,
        available: [],
        commitments: [queueItem({ phase: 'closed', state: 'refunded' })],
        outcomes: [outcome('tie', 'Tie — bond refunded')],
        dispute: DISPUTE_ELIGIBLE,
        appeal: appealRound({ state: 'SETTLED', isActive: false, hasEnded: true }),
        settlement: {
          state: 'SETTLED',
          finality: 'finalized',
          txHash: TX_HASH,
          payoutWei: BigInt(SPEC.bond),
          decimals: 18,
          symbol: 'TBNT',
        },
        weight: {
          supporting: '1000000000000000000',
          opposing: '1000000000000000000',
          provisional: false,
        },
      };
    case 'expired-dispute':
      return {
        eligibility: ELIGIBLE,
        available: [],
        commitments: [],
        outcomes: [],
        dispute: DISPUTE_EXPIRED,
        appeal: appealRound(),
        settlement: PENDING_SETTLEMENT,
        weight: {
          supporting: SPEC.supporting,
          opposing: SPEC.opposing,
          provisional: true,
        },
      };
    case 'indexing-delay':
      return {
        eligibility: ELIGIBLE,
        available: [],
        commitments: [queueItem({ state: 'confirmed' })],
        outcomes: [outcome('indexing', 'Settlement confirmed; indexing delayed')],
        dispute: DISPUTE_ELIGIBLE,
        appeal: appealRound(),
        settlement: {
          state: 'SETTLED',
          finality: 'confirmed',
          txHash: TX_HASH,
          payoutWei: BigInt(SPEC.bond),
          decimals: 18,
          symbol: 'TBNT',
        },
        transaction: { status: 'indexing' },
        weight: {
          supporting: SPEC.supporting,
          opposing: SPEC.opposing,
          provisional: true,
        },
      };
    case 'reorg':
      return {
        eligibility: ELIGIBLE,
        available: [],
        commitments: [queueItem({ state: 'confirmed' })],
        outcomes: [outcome('reorg', 'Reorged — awaiting canonical outcome')],
        dispute: DISPUTE_ELIGIBLE,
        appeal: appealRound({
          roundMatchesExpected: false,
          expectedRound: 2,
          roundNumber: 1,
        }),
        settlement: {
          state: 'SETTLED',
          finality: 'reorged',
          txHash: TX_HASH,
          payoutWei: BigInt(SPEC.bond),
          decimals: 18,
          symbol: 'TBNT',
        },
        transaction: {
          status: 'reorged',
          errorMessage: 'Receipt orphaned by reorganization',
          retryable: true,
        },
        weight: {
          supporting: SPEC.supporting,
          opposing: SPEC.opposing,
          provisional: true,
        },
      };
    case 'appeal-open':
      return {
        eligibility: ELIGIBLE,
        available: [],
        commitments: [queueItem({ phase: 'closed', state: 'confirmed' })],
        outcomes: [outcome('appeal', 'Dispute opened — appeal round 1 active')],
        dispute: DISPUTE_ELIGIBLE,
        appeal: appealRound(),
        settlement: { state: 'PENDING_APPEAL', finality: 'none' },
        weight: {
          supporting: SPEC.supporting,
          opposing: SPEC.opposing,
          provisional: true,
        },
      };
    case 'appeal-resolved':
      return {
        eligibility: ELIGIBLE,
        available: [],
        commitments: [queueItem({ phase: 'closed', state: 'confirmed' })],
        outcomes: [outcome('appeal-resolved', 'Appeal resolved — upheld')],
        dispute: DISPUTE_ELIGIBLE,
        appeal: appealRound({
          state: 'SETTLED',
          isActive: false,
          hasEnded: true,
          timeRemainingSeconds: 0,
        }),
        settlement: {
          state: 'APPEAL_SETTLED',
          finality: 'finalized',
          txHash: TX_HASH,
          payoutWei: BigInt('500000000000000000'),
          decimals: 18,
          symbol: 'TBNT',
        },
        weight: {
          supporting: SPEC.supporting,
          opposing: SPEC.opposing,
          provisional: false,
        },
      };
    case 'eligible-commit':
    default:
      return {
        eligibility: ELIGIBLE,
        available: [
          queueItem({
            protectedEvidence: 'COMMIT-EVIDENCE-MUST-STAY-SEALED',
            protectedChoice: 'COMMIT-CHOICE-MUST-STAY-SEALED',
          }),
        ],
        commitments: [],
        outcomes: [],
        dispute: DISPUTE_ELIGIBLE,
        appeal: appealRound(),
        settlement: PENDING_SETTLEMENT,
        weight: {
          supporting: SPEC.supporting,
          opposing: SPEC.opposing,
          provisional: true,
        },
      };
  }
}

export function VerifierDisputeJourney({
  scenario = 'eligible-commit',
}: {
  scenario?: JourneyScenario;
}) {
  const config = scenarioConfig(scenario);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 text-foreground">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">
          OP Sepolia verifier and dispute journey
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Optimism Sepolia verifier and dispute journey
        </h1>
        <p data-testid="pinned-release" className="text-xs text-muted-foreground">
          Pinned release {PINNED_RELEASE.releaseId} · protocol{' '}
          {PINNED_RELEASE.protocolVersion} · chain {PINNED_RELEASE.chainId} ·
          commit {PINNED_RELEASE.gitCommit}
        </p>
        <p data-testid="journey-scenario" className="text-xs text-muted-foreground">
          Scenario: {scenario}
        </p>
      </header>

      <VerifierDashboard
        online
        eligibility={config.eligibility}
        available={{ status: 'ready', data: config.available }}
        commitments={{ status: 'ready', data: config.commitments }}
        rewards={{
          status: 'ready',
          data: {
            reputation: '42',
            pendingRewards: '0',
            freshness: fresh,
          },
        }}
        outcomes={{ status: 'ready', data: config.outcomes }}
      />

      <section aria-labelledby="effective-weight-heading" className="space-y-3">
        <h2 id="effective-weight-heading" className="text-lg font-semibold">
          Effective weight
        </h2>
        <div className="overflow-x-auto rounded-lg border p-4">
          <StakeWeightDisplay
            supporting={{
              label: 'Support',
              value: config.weight.supporting,
              unit: 'wei',
              icon: <ThumbsUp size={14} aria-hidden="true" />,
              tone: 'success',
            }}
            opposing={{
              label: 'Oppose',
              value: config.weight.opposing,
              unit: 'wei',
              icon: <ThumbsDown size={14} aria-hidden="true" />,
              tone: 'danger',
            }}
            quorum={SPEC.quorum}
            provisional={config.weight.provisional}
            source="pinned release projection"
            computedAt={FETCHED_AT}
          />
        </div>
      </section>

      <section aria-labelledby="dispute-entry-heading" className="space-y-3">
        <h2 id="dispute-entry-heading" className="text-lg font-semibold">
          Dispute entry and bond
        </h2>
        <DisputeEntryForm
          claimId="claim-638"
          eligibility={config.dispute}
          initialReason="The verification ignored the supplied source document."
          initialEvidence={[{ uri: 'https://evidence.example.test/source' }]}
          onRefresh={() => undefined}
        />
      </section>

      <section aria-labelledby="appeal-heading" className="space-y-3">
        <h2 id="appeal-heading" className="text-lg font-semibold">
          Appeal progression
        </h2>
        <AppealRoundProgression
          progression={config.appeal}
          onRefresh={() => undefined}
        />
      </section>

      <section aria-labelledby="settlement-heading" className="space-y-3">
        <h2 id="settlement-heading" className="text-lg font-semibold">
          Settlement and resolution
        </h2>
        <SettlementStatusPanel {...config.settlement} />
        <TransactionStatus
          status={config.transaction?.status ?? 'idle'}
          errorMessage={config.transaction?.errorMessage}
          onRetry={config.transaction?.retryable ? () => undefined : undefined}
        />
      </section>
    </div>
  );
}

export default VerifierDisputeJourney;
