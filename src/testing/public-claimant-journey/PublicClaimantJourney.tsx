'use client';

import { ClaimHeader } from '@/components/features/claim-detail-canonical/ClaimHeader';
import { ClaimContent } from '@/components/features/claim-detail-canonical/ClaimContent';
import { ClaimVerifications } from '@/components/features/claim-detail-canonical/ClaimVerifications';
import { ClaimSettlement } from '@/components/features/claim-detail-canonical/ClaimSettlement';
import { ClaimantDashboardContent } from '@/components/features/claimant-dashboard/ClaimantDashboard';
import ActiveClaimsTable, { type ActiveClaim } from '@/components/features/ActiveClaimsTable';
import ClaimDetailsStep from '@/components/features/claim-submission/wizard/ClaimDetailsStep';
import ConfirmationStep from '@/components/features/claim-submission/wizard/ConfirmationStep';
import ReviewStep from '@/components/features/claim-submission/wizard/ReviewStep';
import {
  TransactionStatus,
  type TransactionStatusValue,
} from '@/components/features/claim-verification/TransactionStatus';
import { TransactionCenter } from '@/components/features/rewards-center/TransactionCenter';
import { RewardsCenter } from '@/components/features/rewards-center/RewardsCenter';
import {
  rewardsFixture,
  transactionFixture,
} from '@/components/features/rewards-center/stories/fixtures';
import { EvidenceUploadProgress } from '@/features/evidence-upload/EvidenceUploadProgress';
import type { UploadState } from '@/features/evidence-upload/types';
import type { Claim, ClaimStatus, Evidence } from '@/app/types/claim';
import type { ClaimDetailProjection } from '@/app/types/claim-detail-projection';
import type { ClaimantDashboardData } from '@/hooks/useClaimantDashboardData';
import {
  createEvidenceState,
  type EvidenceState,
} from '@/lib/claim-submission/evidence';
import type { ClaimFormData } from '@/lib/claim-submission/validation';
import type { TransactionStatus as MachineTransactionStatus } from '@/lib/transaction-machine/transaction-machine.types';

export const PINNED_RELEASE = {
  chainId: 11155420,
  releaseId: 'v2.0.0-sepolia',
  protocolVersion: '2.0.0',
  gitCommit: '5333c0acb9ccfb8a6a37ae76b3397d06781f0119',
} as const;

export const TEST_ACCOUNT = '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E' as const;
const TX_HASH: `0x${string}` = `0x${'ab'.repeat(32)}`;
const CREATED_AT = '2026-10-14T00:00:00.000Z';
const UPDATED_AT = '2026-10-14T12:00:00.000Z';

export type PublicClaimantScenario =
  | 'happy-path'
  | 'wallet-rejected'
  | 'reverted'
  | 'replaced'
  | 'indexing-delay'
  | 'reorg'
  | 'evidence-outage'
  | 'reload-recovery'
  | 'unsupported-chain'
  | 'guest';

const ACTIVE_CLAIMS: ActiveClaim[] = [
  {
    category: 'Technology',
    impact: 'High Impact',
    title: 'Optimism Sepolia claimant journey claim',
    source: 'Public indexer projection',
    status: 'Under Review',
    confidence: 67,
    votes: '12',
    stake: '500 TBNT',
    time: '2d 4h',
    actions: 'Review',
  },
  {
    category: 'Environment',
    impact: 'Medium',
    title: 'Evidence outage recovery claim',
    source: 'Public indexer projection',
    status: 'Verified',
    confidence: 91,
    votes: '20',
    stake: '800 TBNT',
    time: 'Finalized',
    actions: 'Review',
  },
  {
    category: 'Finance',
    impact: 'High Impact',
    title: 'Reorg settlement claim',
    source: 'Public indexer projection',
    status: 'Disputed',
    confidence: null,
    votes: '8',
    stake: '300 TBNT',
    time: '1d 2h',
    actions: 'Review',
  },
];

const EVIDENCE: Evidence[] = [
  {
    id: 'ev-1',
    type: 'link',
    value: 'https://evidence.example.test/claim-source',
    createdAt: CREATED_AT,
  },
  {
    id: 'ev-2',
    type: 'text',
    value: 'Witness statement reviewed by the claimant.',
    createdAt: CREATED_AT,
  },
];

const OWNED_CLAIMS: Claim[] = [
  {
    id: 'claim-639',
    title: 'Optimism Sepolia claimant journey claim',
    description: 'A deterministic claimant journey claim on the pinned release.',
    claimantAddress: TEST_ACCOUNT,
    status: 'UNDER_REVIEW',
    bountyAmount: 100,
    totalStaked: 500,
    evidence: EVIDENCE,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'claim-640',
    title: 'Evidence outage recovery claim',
    description: 'A claim used to exercise evidence outage and retry behavior.',
    claimantAddress: TEST_ACCOUNT,
    status: 'VERIFIED',
    bountyAmount: 80,
    totalStaked: 800,
    evidence: [EVIDENCE[0]],
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
];

function claimDetail(
  status: ClaimStatus,
  settlement: ClaimDetailProjection['settlement'],
): ClaimDetailProjection {
  return {
    id: 'claim-639',
    title: 'Optimism Sepolia claimant journey claim',
    description:
      'A deterministic public claimant journey claim. The projection is not canonical contract state.',
    category: 'Technology',
    claimantAddress: TEST_ACCOUNT,
    status,
    bountyAmount: 100,
    totalStaked: 500,
    evidence: EVIDENCE,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    verifications: [
      {
        id: 'ver-1',
        verifierAddress: '0x1111111111111111111111111111111111111111',
        decision: 'SUPPORT',
        stakeAmount: 150,
        timestamp: UPDATED_AT,
        finalizedAt: settlement.isFinalized ? UPDATED_AT : null,
      },
      {
        id: 'ver-2',
        verifierAddress: '0x2222222222222222222222222222222222222222',
        decision: 'REJECT',
        stakeAmount: 75,
        timestamp: UPDATED_AT,
        finalizedAt: settlement.isFinalized ? UPDATED_AT : null,
      },
    ],
    settlement,
    claimantReputation: 82,
    voteCounts: { support: 2, reject: 1 },
    confidenceScore: 67,
  };
}

const PROVISIONAL_CLAIM = claimDetail('UNDER_REVIEW', {
  settledAt: null,
  settlementTxHash: null,
  isFinalized: false,
  finalizedBlock: null,
});

const FINALIZED_CLAIM = claimDetail('VERIFIED', {
  settledAt: UPDATED_AT,
  settlementTxHash: TX_HASH,
  isFinalized: true,
  finalizedBlock: 14282901,
});

const REORGED_CLAIM = claimDetail('DISPUTED', {
  settledAt: UPDATED_AT,
  settlementTxHash: TX_HASH,
  isFinalized: false,
  finalizedBlock: null,
});

function claimantData(overrides: Partial<ClaimantDashboardData> = {}): ClaimantDashboardData {
  return {
    account: TEST_ACCOUNT,
    isConnected: true,
    isSupportedChain: true,
    chainName: 'OP Sepolia',
    isLoading: false,
    isStale: false,
    isOffline: false,
    isPartialFailure: false,
    ownedClaims: OWNED_CLAIMS,
    phaseCounts: {
      open: 0,
      underReview: 1,
      disputed: 1,
      verified: 1,
      rejected: 0,
      total: 3,
      active: 2,
      resolved: 1,
    },
    nextActions: [
      {
        id: 'dispute-claim-639',
        title: 'Dispute window open for "Reorg settlement claim"',
        consequence:
          'Consensus has been contested. Review the dispute round to protect the bond.',
        actionLabel: 'Inspect Dispute',
        actionHref: '/disputes',
        priority: 'critical',
        deadline: '2026-10-20T23:59:59.000Z',
        badge: 'High Stake Risk',
      },
      {
        id: 'rewards-ready',
        title: 'Claimable rewards ready: 125.00 TBNT',
        consequence: 'Finalized reward allocations are ready for withdrawal.',
        actionLabel: 'View Rewards',
        actionHref: '/rewards',
        priority: 'high',
        badge: 'Funds Available',
      },
    ],
    activity: [
      {
        id: 'act-1',
        title: 'Claim status updated to UNDER_REVIEW',
        description: 'Projection shows the claim is under review.',
        timestamp: UPDATED_AT,
        type: 'status_change',
        linkHref: '/claims/claim-639',
      },
      {
        id: 'act-2',
        title: 'Submitted claim "Optimism Sepolia claimant journey claim"',
        description: 'Bounty staked: 100 TBNT. Initial state: OPEN.',
        timestamp: CREATED_AT,
        type: 'claim_created',
        linkHref: '/claims/claim-639',
      },
    ],
    rewardsSummary: {
      claimableDisplay: '125.00 TBNT',
      pendingCount: 2,
      isLoading: false,
      loadError: null,
      claimAll: async () => undefined,
      status: 'success',
    },
    trustSummary: { reputation: 82, isVerified: true },
    freshness: {
      lastUpdated: Date.parse(CREATED_AT),
      source: 'indexer projection',
      isFresh: true,
    },
    refetch: async () => undefined,
    ...overrides,
  };
}

const DRAFT: ClaimFormData = {
  title: 'Optimism Sepolia claimant evidence claim',
  category: 'Technology',
  impact: 'High',
  source: 'https://evidence.example.test/claim-source',
  description:
    'A deterministic claimant journey draft. Evidence is reviewed before submission.',
};

const VERIFIED_EVIDENCE: EvidenceState = {
  ...createEvidenceState(),
  source: 'file',
  status: 'verified',
  progress: 100,
  fileName: 'claim-evidence.pdf',
  fileSize: 2048,
  fileType: 'application/pdf',
  digest: TX_HASH,
  canProceed: true,
};

const FAILED_EVIDENCE: EvidenceState = {
  ...createEvidenceState(),
  source: 'file',
  status: 'failed',
  progress: 0,
  error: 'Evidence upload could not be verified.',
  fileName: 'claim-evidence.pdf',
  fileSize: 2048,
  fileType: 'application/pdf',
  canProceed: false,
};

const UPLOADING: UploadState = {
  phase: 'uploading',
  progress: 40,
  retryable: false,
  attempt: 1,
};

const OUTAGE: UploadState = {
  phase: 'failed',
  progress: 0,
  failure: 'network',
  retryable: true,
  attempt: 1,
};

const INTEGRITY_MISMATCH: UploadState = {
  phase: 'failed',
  progress: 100,
  failure: 'integrity-mismatch',
  retryable: false,
  attempt: 1,
};

const VERIFIED_UPLOAD: UploadState = {
  phase: 'verified',
  progress: 100,
  retryable: false,
  attempt: 1,
  localDigest: TX_HASH.slice(2),
  verifiedDigest: TX_HASH.slice(2),
};

const TRANSACTION_STATUSES: TransactionStatusValue[] = [
  'submitted',
  'finalized',
  'indexing',
  'rejected',
  'reverted',
  'replaced',
  'reorged',
];

const TRANSACTION_RECORDS = (
  [
    'submitted',
    'confirming',
    'finalized',
    'indexing',
    'replaced',
    'reverted',
    'reorged',
  ] as MachineTransactionStatus[]
).map((status) => transactionFixture(status));

interface ScenarioConfig {
  claimant: ClaimantDashboardData;
  claimDetail: ClaimDetailProjection;
  reviewError: string | null;
  evidence: EvidenceState;
  confirmation: {
    status: 'success' | 'failure';
    claimId: string | null;
    transactionHash: `0x${string}` | null;
    error: string | null;
  };
  focusStatus: TransactionStatusValue;
  focusMessage?: string;
  focusRetry?: boolean;
}

function scenarioConfig(scenario: PublicClaimantScenario): ScenarioConfig {
  switch (scenario) {
    case 'wallet-rejected':
      return {
        claimant: claimantData(),
        claimDetail: PROVISIONAL_CLAIM,
        reviewError: null,
        evidence: VERIFIED_EVIDENCE,
        confirmation: {
          status: 'failure',
          claimId: null,
          transactionHash: null,
          error: 'Wallet rejected the transaction request.',
        },
        focusStatus: 'rejected',
        focusMessage: 'Wallet rejected the transaction request.',
        focusRetry: true,
      };
    case 'reverted':
      return {
        claimant: claimantData(),
        claimDetail: PROVISIONAL_CLAIM,
        reviewError: null,
        evidence: VERIFIED_EVIDENCE,
        confirmation: {
          status: 'failure',
          claimId: null,
          transactionHash: null,
          error: 'Execution reverted by the contract.',
        },
        focusStatus: 'reverted',
        focusMessage: 'Execution reverted by the contract.',
        focusRetry: true,
      };
    case 'replaced':
      return {
        claimant: claimantData(),
        claimDetail: PROVISIONAL_CLAIM,
        reviewError: null,
        evidence: VERIFIED_EVIDENCE,
        confirmation: {
          status: 'failure',
          claimId: null,
          transactionHash: null,
          error: 'The transaction was replaced before inclusion.',
        },
        focusStatus: 'replaced',
        focusMessage: 'Replaced by a higher-fee transaction.',
        focusRetry: true,
      };
    case 'indexing-delay':
      return {
        claimant: claimantData({
          isStale: true,
          freshness: {
            lastUpdated: Date.parse(CREATED_AT),
            source: 'indexer projection',
            isFresh: false,
          },
        }),
        claimDetail: PROVISIONAL_CLAIM,
        reviewError: null,
        evidence: VERIFIED_EVIDENCE,
        confirmation: {
          status: 'success',
          claimId: 'claim-639',
          transactionHash: TX_HASH,
          error: null,
        },
        focusStatus: 'indexing',
      };
    case 'reorg':
      return {
        claimant: claimantData({
          isPartialFailure: true,
          partialFailureMessage:
            'Settlement projection was reorganised and is awaiting canonical state.',
        }),
        claimDetail: REORGED_CLAIM,
        reviewError: null,
        evidence: VERIFIED_EVIDENCE,
        confirmation: {
          status: 'success',
          claimId: 'claim-639',
          transactionHash: TX_HASH,
          error: null,
        },
        focusStatus: 'reorged',
        focusMessage: 'Receipt orphaned by a chain reorganization.',
        focusRetry: true,
      };
    case 'evidence-outage':
      return {
        claimant: claimantData({
          isPartialFailure: true,
          partialFailureMessage:
            'Evidence projection could not be refreshed. Retry the failed query.',
        }),
        claimDetail: PROVISIONAL_CLAIM,
        reviewError:
          'Evidence integrity could not be verified. Re-upload before submitting.',
        evidence: FAILED_EVIDENCE,
        confirmation: {
          status: 'failure',
          claimId: null,
          transactionHash: null,
          error: 'Evidence outage: submission is blocked until evidence is verified.',
        },
        focusStatus: 'rejected',
        focusMessage: 'Evidence outage: submission is blocked until evidence is verified.',
        focusRetry: false,
      };
    case 'reload-recovery':
      return {
        claimant: claimantData(),
        claimDetail: PROVISIONAL_CLAIM,
        reviewError: null,
        evidence: VERIFIED_EVIDENCE,
        confirmation: {
          status: 'success',
          claimId: 'claim-639',
          transactionHash: TX_HASH,
          error: null,
        },
        focusStatus: 'finalized',
      };
    case 'unsupported-chain':
      return {
        claimant: claimantData({
          isSupportedChain: false,
          chainName: 'Ethereum',
        }),
        claimDetail: PROVISIONAL_CLAIM,
        reviewError: null,
        evidence: VERIFIED_EVIDENCE,
        confirmation: {
          status: 'failure',
          claimId: null,
          transactionHash: null,
          error: 'Switch to OP Sepolia before submitting a claim.',
        },
        focusStatus: 'rejected',
        focusMessage: 'Switch to OP Sepolia before submitting a claim.',
        focusRetry: false,
      };
    case 'guest':
      return {
        claimant: claimantData({
          account: null,
          isConnected: false,
        }),
        claimDetail: PROVISIONAL_CLAIM,
        reviewError: null,
        evidence: VERIFIED_EVIDENCE,
        confirmation: {
          status: 'failure',
          claimId: null,
          transactionHash: null,
          error: 'Connect a wallet before submitting a claim.',
        },
        focusStatus: 'rejected',
        focusMessage: 'Connect a wallet before submitting a claim.',
        focusRetry: false,
      };
    case 'happy-path':
    default:
      return {
        claimant: claimantData(),
        claimDetail: FINALIZED_CLAIM,
        reviewError: null,
        evidence: VERIFIED_EVIDENCE,
        confirmation: {
          status: 'success',
          claimId: 'claim-639',
          transactionHash: TX_HASH,
          error: null,
        },
        focusStatus: 'finalized',
      };
  }
}

export function PublicClaimantJourney({
  scenario = 'happy-path',
}: {
  scenario?: PublicClaimantScenario;
}) {
  const config = scenarioConfig(scenario);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 text-foreground">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">
          OP Sepolia public and claimant journey
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Optimism Sepolia public and claimant journey
        </h1>
        <p data-testid="pinned-release" className="text-xs text-muted-foreground">
          Pinned release {PINNED_RELEASE.releaseId} · protocol{' '}
          {PINNED_RELEASE.protocolVersion} · chain {PINNED_RELEASE.chainId} ·
          commit {PINNED_RELEASE.gitCommit}
        </p>
        <p data-testid="test-account" className="text-xs text-muted-foreground">
          Test account: {TEST_ACCOUNT}
        </p>
        <p data-testid="journey-scenario" className="text-xs text-muted-foreground">
          Scenario: {scenario}
        </p>
      </header>

      <section aria-labelledby="landing-heading" className="space-y-3">
        <h2 id="landing-heading" className="text-lg font-semibold">
          Public landing and exploration
        </h2>
        <p className="text-sm text-muted-foreground">
          Public claims require no wallet. The index is a projection; contract
          state remains authoritative.
        </p>
        <ActiveClaimsTable claims={ACTIVE_CLAIMS} />
      </section>

      <section aria-labelledby="claim-detail-heading" className="space-y-3">
        <h2 id="claim-detail-heading" className="text-lg font-semibold">
          Claim detail, evidence, funding, and settlement
        </h2>
        <div className="space-y-4 rounded-xl border p-4">
          <ClaimHeader claim={config.claimDetail} />
          <ClaimContent claim={config.claimDetail} />
          <ClaimVerifications claim={config.claimDetail} />
          <ClaimSettlement claim={config.claimDetail} />
        </div>
      </section>

      <section aria-labelledby="claimant-heading" className="space-y-3">
        <h2 id="claimant-heading" className="text-lg font-semibold">
          Claimant dashboard
        </h2>
        <ClaimantDashboardContent
          data={config.claimant}
          onSwitchChain={() => undefined}
        />
      </section>

      <section aria-labelledby="rewards-heading" className="space-y-3">
        <h2 id="rewards-heading" className="text-lg font-semibold">
          Claimant rewards center
        </h2>
        <RewardsCenter data={rewardsFixture} onRefresh={() => undefined} />
      </section>

      <section aria-labelledby="draft-heading" className="space-y-3">
        <h2 id="draft-heading" className="text-lg font-semibold">
          Claim draft and review
        </h2>
        <div className="rounded-xl border p-4">
          <ClaimDetailsStep
            data={DRAFT}
            errors={{}}
            touched={new Set()}
            onChange={() => undefined}
            onBlur={() => undefined}
            onNext={() => undefined}
            onCancel={() => undefined}
          />
        </div>
        <div className="rounded-xl border p-4">
          <ReviewStep
            claimDetails={DRAFT}
            evidence={config.evidence}
            onEditDetails={() => undefined}
            onEditEvidence={() => undefined}
            onSubmit={() => undefined}
            onCancel={() => undefined}
            validationError={config.reviewError}
          />
        </div>
        <div className="rounded-xl border p-4">
          <ConfirmationStep
            status={config.confirmation.status}
            claimId={config.confirmation.claimId}
            transactionHash={config.confirmation.transactionHash}
            error={config.confirmation.error}
            onViewClaim={() => undefined}
            onCreateAnother={() => undefined}
            onClose={() => undefined}
          />
        </div>
      </section>

      <section aria-labelledby="evidence-heading" className="space-y-3">
        <h2 id="evidence-heading" className="text-lg font-semibold">
          Evidence upload, outage, and recovery
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <EvidenceUploadProgress
            state={UPLOADING}
            onRetry={() => undefined}
            onCancel={() => undefined}
            onChooseAgain={() => undefined}
          />
          <EvidenceUploadProgress
            state={OUTAGE}
            onRetry={() => undefined}
            onCancel={() => undefined}
            onChooseAgain={() => undefined}
          />
          <EvidenceUploadProgress
            state={INTEGRITY_MISMATCH}
            onRetry={() => undefined}
            onCancel={() => undefined}
            onChooseAgain={() => undefined}
          />
          <EvidenceUploadProgress
            state={VERIFIED_UPLOAD}
            onRetry={() => undefined}
            onCancel={() => undefined}
            onChooseAgain={() => undefined}
          />
        </div>
      </section>

      <section aria-labelledby="transaction-heading" className="space-y-3">
        <h2 id="transaction-heading" className="text-lg font-semibold">
          Authorization, transaction confirmation, and recovery
        </h2>
        <div className="space-y-3 rounded-xl border p-4">
          {TRANSACTION_STATUSES.map((status) => (
            <TransactionStatus
              key={status}
              status={status}
              errorMessage={
                status === config.focusStatus ? config.focusMessage : undefined
              }
              onRetry={
                status === config.focusStatus && config.focusRetry
                  ? () => undefined
                  : undefined
              }
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="transaction-center-heading" className="space-y-3">
        <h2 id="transaction-center-heading" className="text-lg font-semibold">
          Transaction center and reload recovery
        </h2>
        <TransactionCenter
          records={TRANSACTION_RECORDS}
          state="ready"
          onRefresh={() => undefined}
        />
      </section>
    </div>
  );
}

export default PublicClaimantJourney;
