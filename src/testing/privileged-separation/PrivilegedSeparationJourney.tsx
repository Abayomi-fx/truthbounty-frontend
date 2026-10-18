'use client';

import { Card, StatusBadge } from '@/components/ui/primitives';
import { AdminAuditTrail } from '@/components/features/admin-dashboard/AdminAuditTrail';
import { AdminUnauthorizedState } from '@/components/features/admin-dashboard/AdminUnauthorizedState';
import { OperationConfirmModal } from '@/components/features/admin-dashboard/OperationConfirmModal';
import { OperationalQueueTable } from '@/components/features/admin-dashboard/OperationalQueueTable';
import { ReadOnlyConfigSummary } from '@/components/features/admin-dashboard/ReadOnlyConfigSummary';
import { SecurityGovernanceNotices } from '@/components/features/admin-dashboard/SecurityGovernanceNotices';
import { SystemHealthSummary } from '@/components/features/admin-dashboard/SystemHealthSummary';
import { UpgradeReview } from '@/components/features/upgrade-review/UpgradeReview';
import { UpgradeReviewBlockedState } from '@/components/features/upgrade-review/UpgradeReviewBlockedState';
import type {
  AdminAuditRecord,
  AdminDashboardOverview,
  OperationalQueueItem,
  ReadOnlyProtocolParameter,
  SystemHealthMetric,
} from '@/app/types/admin';
import type {
  CurrentReleaseReview,
  UpgradeCandidateDescriptor,
  UpgradeReviewSnapshot,
} from '@/lib/upgrade-review/types';

export const PINNED_RELEASE = {
  chainId: 11155420,
  releaseId: 'v2.0.0-sepolia',
  protocolVersion: '2.0.0',
  gitCommit: '5333c0acb9ccfb8a6a37ae76b3397d06781f0119',
} as const;

export const OPERATIONS_ACCOUNT = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
export const GOVERNANCE_ACCOUNT = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
export const GUARDIAN_ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

export type PrivilegedScenario =
  | 'operations-authorized'
  | 'operation-confirmation'
  | 'retry'
  | 'denied'
  | 'revoked'
  | 'expired'
  | 'wrong-chain'
  | 'governance-authorized'
  | 'stale-manifest'
  | 'timelock-not-ready'
  | 'guardian-authorized'
  | 'guardian-overreach'
  | 'emergency-pause';

const HEALTH: SystemHealthMetric[] = [
  {
    id: 'metric-indexer-lag',
    name: 'Indexer Ingestion Lag',
    value: '14 blocks',
    subtext: 'Latency ~28s (Within tolerance < 50 blocks)',
    status: 'healthy',
    source: 'Graph Node Indexer (L2 RPC)',
    lastUpdated: '2026-10-14T00:00:00.000Z',
  },
  {
    id: 'metric-rpc-state',
    name: 'Optimism RPC Provider',
    value: 'Active / Connected',
    subtext: 'Block Height: 12,345,678 (p99 latency: 38ms)',
    status: 'healthy',
    source: 'Optimism Sepolia Sequencer',
    lastUpdated: '2026-10-14T00:00:00.000Z',
  },
  {
    id: 'metric-failed-jobs',
    name: 'Failed Pipeline Jobs',
    value: '1 retryable',
    subtext: 'Batch #4410 idempotency log preserved',
    status: 'warning',
    source: 'Worker Daemon Supervisor',
    lastUpdated: '2026-10-14T00:00:00.000Z',
  },
  {
    id: 'metric-queue-age',
    name: 'Queue Retention Age',
    value: '12m oldest',
    subtext: 'Maximum SLA threshold: 60m',
    status: 'healthy',
    source: 'Dead-Letter Queue (DLQ) Manager',
    lastUpdated: '2026-10-14T00:00:00.000Z',
  },
];

const QUEUE: OperationalQueueItem[] = [
  {
    id: 'op-retry-batch-4410',
    title: 'Retry Failed Event Indexer Batch #4410',
    description:
      'Batch failed due to a transient L2 RPC gateway timeout during block reorg settlement.',
    authority: 'PROTOCOL_OPERATOR',
    targetResource: 'Indexer Ingestion Pipeline (Blocks 12,345,600 - 12,345,620)',
    risk: 'high',
    consequence:
      'Deterministic replay of block range event logs. Preserves idempotency; does not modify on-chain state or user balances.',
    queueAge: '12m ago',
    createdAt: '2026-10-14T00:00:00.000Z',
    status: 'failed',
    queueState: 'failed',
    retryEligibility: {
      eligible: true,
      permissionMapped: true,
      idempotencyProofRef: 'idempotency-proof-4410',
    },
  },
  {
    id: 'op-sync-dispute-projection',
    title: 'Re-sync Stale Dispute State Projection',
    description:
      'On-chain DisputeOpened receipt count differs from the local read projection by one event.',
    authority: 'PROTOCOL_OPERATOR',
    targetResource: 'TruthBountyWeighted.sol (Dispute Engine)',
    risk: 'medium',
    consequence:
      'Queries canonical contract logs for DisputeOpened and reconciles the local read cache. Read-only indexing correction.',
    queueAge: '28m ago',
    createdAt: '2026-10-14T00:00:00.000Z',
    status: 'pending',
  },
];

const AUDIT: AdminAuditRecord[] = [
  {
    auditId: 'AUD-2026-1014-01',
    operator: OPERATIONS_ACCOUNT,
    action: 'Replay Failed Indexer Batch #4408',
    authority: 'PROTOCOL_OPERATOR',
    targetResource: 'Indexer Ingestion Pipeline',
    consequenceHash: `0x${'ab'.repeat(32)}`,
    timestamp: '2026-10-14T00:00:00.000Z',
    status: 'SUCCESS',
    details:
      'Re-ingested 18 missed dispute events from a prior block range without state overwrite.',
  },
];

const PARAMETERS: ReadOnlyProtocolParameter[] = [
  {
    key: 'protocol_version',
    label: 'Protocol Version',
    value: '2.0.0',
    description: 'Canonical protocol deployment version.',
    contractSource: 'manifest.json',
  },
  {
    key: 'contract_proxy',
    label: 'TruthBountyWeighted (Proxy)',
    value: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    description: 'ERC-1967 UUPS upgradeable contract entry point.',
    contractSource: 'addresses/11155420.json',
  },
  {
    key: 'min_bond',
    label: 'Minimum Bond Amount',
    value: '1.00 ETH (10^18 wei)',
    description: 'Baseline stake required to open a dispute challenge.',
    contractSource: 'parameters/11155420.json',
  },
  {
    key: 'appeal_window',
    label: 'Appeal Window Duration',
    value: '7 Days (604,800 seconds)',
    description: 'Period allowed for community dispute rounds before finalization.',
    contractSource: 'parameters/11155420.json',
  },
];

const NOTICES: AdminDashboardOverview['governanceNotices'] = [
  {
    id: 'notice-timelock',
    type: 'timelock',
    title: '48-Hour Governance Timelock Enforced',
    description:
      'Any upgrade to implementation bytecode or protocol fee alteration requires a 48-hour timelock delay with multi-party multisig approval.',
    level: 'info',
  },
  {
    id: 'notice-escrow',
    type: 'escrow',
    title: 'Non-Custodial Escrow Security Invariant',
    description:
      'Protocol contracts possess zero administrative powers to redirect, seize, or override claimant escrow balances or dispute stakes.',
    level: 'critical',
  },
  {
    id: 'notice-sybil',
    type: 'sybil',
    title: 'Guardian Cannot Unpause Or Upgrade',
    description:
      'Emergency controls are not exposed to the guardian context. Governed unpause requires the timelock executor and multisig approval.',
    level: 'info',
  },
];

const baseCurrentRelease: CurrentReleaseReview = {
  protocolVersion: '2.0.0',
  releaseId: 'v2.0.0-sepolia',
  gitCommit: '5333c0acb9ccfb8a6a37ae76b3397d06781f0119',
  chainId: 11155420,
  abiVersion: '2.0.0',
  eventSchemaVersion: '2.0.0',
  parameterSetVersion: '2.0.0',
  abiHash:
    '6865824782c1df1cf5f16465d9a4e028e8ac7385c6506fea957116a09a1d8385',
  currentReleaseVerified: true,
  compatibilityIssues: [],
  blockedReasons: [],
};

const baseCandidate: UpgradeCandidateDescriptor = {
  candidateId: 'v-next',
  releaseId: 'v2.1.0-sepolia',
  protocolVersion: '2.1.0',
  summary: 'Candidate release upgrading TruthBountyWeighted.',
  compatibility: {
    abiVersion: '2.1.0',
    eventSchemaVersion: '2.1.0',
    parameterSetVersion: '2.1.0',
    chainCompatibility: ['Compatible with Optimism Sepolia (chain 11155420).'],
  },
  affectedOperations: ['op-retry-batch-4410'],
  rollbackPlan: {
    steps: ['Queue rollback proposal', 'Execute rollback after timelock'],
    verified: false,
  },
  verification: 'unverified',
  verifiedBy: null,
  verifiedAt: null,
};

const baseSnapshot: UpgradeReviewSnapshot = {
  currentRelease: baseCurrentRelease,
  candidate: baseCandidate,
  currentLifecycle: {
    state: 'empty',
    label: 'No protocol transaction',
    blockingReasons: [],
  },
  governedCalls: [
    {
      actionType: 'governance',
      targetResource: 'TimelockController#executeProposal',
      summary:
        'Execute the queued upgrade proposal after the 48-hour timelock delay and multi-party multisig approval.',
    },
  ],
  affectedOperations: [
    {
      operationId: 'op-retry-batch-4410',
      queued: true,
      queueAge: '12m ago',
      reason: 'queued operation; queue age 12m ago',
    },
  ],
  rollback: {
    steps: ['Queue rollback proposal', 'Execute rollback after timelock'],
    verified: false,
    blockedReasons: ['candidate rollback plan is not verified'],
  },
  blockedReasons: [
    'candidate manifest is not verified by a maintainer',
    'candidate rollback plan is not verified',
  ],
  isFullyVerified: false,
  currentLifecycleBlocksMutation: false,
};

const VERIFIED_SNAPSHOT: UpgradeReviewSnapshot = {
  ...baseSnapshot,
  candidate: {
    ...baseCandidate,
    verification: 'verified',
    verifiedBy: GOVERNANCE_ACCOUNT,
    verifiedAt: '2026-10-14T00:00:00.000Z',
  },
  rollback: {
    ...baseSnapshot.rollback,
    verified: true,
    blockedReasons: [],
  },
  blockedReasons: [],
  isFullyVerified: true,
};

const TIMELOCK_SNAPSHOT: UpgradeReviewSnapshot = {
  ...VERIFIED_SNAPSHOT,
  currentLifecycle: {
    state: 'empty',
    label: 'Timelock not ready',
    blockingReasons: [
      '48-hour timelock delay has not elapsed',
      'multi-party multisig approval is missing',
    ],
  },
  blockedReasons: [
    'governed execution is blocked until the timelock and multisig gates pass',
  ],
  currentLifecycleBlocksMutation: true,
  isFullyVerified: false,
};

const GUARDIAN_BOUNDARIES = [
  {
    id: 'emergency-pause',
    label: 'Emergency pause',
    detail:
      'Not exposed. Only governed timelock execution can unpause; the guardian cannot pause or unpause.',
  },
  {
    id: 'upgrade',
    label: 'Upgrade / governed unpause',
    detail:
      'Governance-only. The guardian cannot queue, execute, or approve upgrades or unpause operations.',
  },
  {
    id: 'treasury',
    label: 'Treasury',
    detail:
      'Canonical treasury admin only. The guardian cannot move treasury funds or settle claims.',
  },
  {
    id: 'roles',
    label: 'Roles and settlement',
    detail:
      'The guardian cannot administer roles, grant or revoke authority, or settle disputes.',
  },
];

function isOperationsScenario(scenario: PrivilegedScenario) {
  return (
    scenario === 'operations-authorized' ||
    scenario === 'operation-confirmation' ||
    scenario === 'retry' ||
    scenario === 'denied' ||
    scenario === 'revoked' ||
    scenario === 'expired' ||
    scenario === 'wrong-chain'
  );
}

function isGovernanceScenario(scenario: PrivilegedScenario) {
  return (
    scenario === 'governance-authorized' ||
    scenario === 'stale-manifest' ||
    scenario === 'timelock-not-ready'
  );
}

function isGuardianScenario(scenario: PrivilegedScenario) {
  return (
    scenario === 'guardian-authorized' ||
    scenario === 'guardian-overreach' ||
    scenario === 'emergency-pause'
  );
}

function principalFor(scenario: PrivilegedScenario) {
  if (isGovernanceScenario(scenario)) return 'governance';
  if (isGuardianScenario(scenario)) return 'guardian';
  return 'operations';
}

function unauthorizedReason(scenario: PrivilegedScenario) {
  switch (scenario) {
    case 'revoked':
      return 'Operator authority was revoked by governance.';
    case 'expired':
      return 'Operator authorization expired. Reconnect and revalidate the canonical role.';
    case 'wrong-chain':
      return 'Connected chain is not the pinned Optimism Sepolia release.';
    case 'denied':
    default:
      return 'Current address is not registered as the canonical protocol administrator.';
  }
}

function governanceSnapshot(scenario: PrivilegedScenario) {
  if (scenario === 'stale-manifest') return baseSnapshot;
  if (scenario === 'timelock-not-ready') return TIMELOCK_SNAPSHOT;
  return VERIFIED_SNAPSHOT;
}

export function PrivilegedSeparationJourney({
  scenario = 'operations-authorized',
}: {
  scenario?: PrivilegedScenario;
}) {
  const principal = principalFor(scenario);
  const account =
    principal === 'governance'
      ? GOVERNANCE_ACCOUNT
      : principal === 'guardian'
        ? GUARDIAN_ACCOUNT
        : OPERATIONS_ACCOUNT;
  const unauthorized = isOperationsScenario(scenario) &&
    ['denied', 'revoked', 'expired', 'wrong-chain'].includes(scenario);
  const showOperationModal = scenario === 'operation-confirmation';

  return (
    <div className="mx-auto max-w-6xl space-y-8 overflow-x-hidden p-4 text-foreground">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">
          OP Sepolia privileged separation and emergency control
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Optimism Sepolia privileged separation and emergency control journey
        </h1>
        <p data-testid="pinned-release" className="text-xs text-muted-foreground">
          Pinned release {PINNED_RELEASE.releaseId} · protocol{' '}
          {PINNED_RELEASE.protocolVersion} · chain {PINNED_RELEASE.chainId} ·
          commit {PINNED_RELEASE.gitCommit}
        </p>
        <p data-testid="active-principal" className="text-xs text-muted-foreground">
          Principal: {principal} · account {account}
        </p>
        <p data-testid="journey-scenario" className="text-xs text-muted-foreground">
          Scenario: {scenario}
        </p>
      </header>

      {isOperationsScenario(scenario) && (
        <section
          data-testid="operations-context"
          aria-labelledby="operations-heading"
          className="space-y-4"
        >
          <h2 id="operations-heading" className="text-lg font-semibold">
            Operations principal
          </h2>

          {unauthorized ? (
            <AdminUnauthorizedState
              reason={unauthorizedReason(scenario)}
              canonicalAdminAddress={OPERATIONS_ACCOUNT}
              connectedAddress={account}
            />
          ) : (
            <>
              <SystemHealthSummary metrics={HEALTH} />
              <SecurityGovernanceNotices notices={NOTICES} />
              <OperationalQueueTable
                queue={QUEUE}
                onSelectOperation={() => undefined}
              />
              <ReadOnlyConfigSummary parameters={PARAMETERS} />
              <AdminAuditTrail records={AUDIT} />
            </>
          )}
        </section>
      )}

      {isGovernanceScenario(scenario) && (
        <section
          data-testid="governance-context"
          aria-labelledby="governance-heading"
          className="space-y-4"
        >
          <h2 id="governance-heading" className="text-lg font-semibold">
            Governance principal
          </h2>
          <UpgradeReview
            snapshot={governanceSnapshot(scenario)}
            authorized
          />
        </section>
      )}

      {isGuardianScenario(scenario) && (
        <section
          data-testid="guardian-context"
          aria-labelledby="guardian-heading"
          className="space-y-4"
        >
          <h2 id="guardian-heading" className="text-lg font-semibold">
            Guardian principal
          </h2>

          <Card className="p-4 sm:p-6">
            <h3 className="text-base font-semibold">Guardian authority boundaries</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              UI context selection never grants authority. Contract and API
              authorization remain authoritative and fail closed.
            </p>
            <ul className="mt-4 space-y-3" aria-label="Guardian authority boundaries">
              {GUARDIAN_BOUNDARIES.map((boundary) => (
                <li
                  key={boundary.id}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-3 sm:flex-row sm:items-start"
                >
                  <StatusBadge label={boundary.label} tone="warning" />
                  <p className="text-xs text-muted-foreground">{boundary.detail}</p>
                </li>
              ))}
            </ul>
          </Card>

          {scenario === 'guardian-overreach' && (
            <UpgradeReviewBlockedState
              unauthorizedReason="Guardian authority cannot unpause, upgrade, settle, move treasury, or administer roles."
              blockingReasons={[
                'guardian authority is limited to the canonical treasury admin flow',
                'governed unpause requires the timelock executor and multisig approval',
              ]}
            />
          )}

          {scenario === 'emergency-pause' && (
            <UpgradeReviewBlockedState
              unauthorizedReason="Emergency pause is not exposed to the guardian context."
              blockingReasons={[
                'governed unpause requires the timelock executor and multisig approval',
                'guardian actions cannot bypass the canonical pause lifecycle',
              ]}
            />
          )}
        </section>
      )}

      {showOperationModal && (
        <OperationConfirmModal
          operation={QUEUE[1]}
          isOpen
          onClose={() => undefined}
          onConfirm={async () => undefined}
        />
      )}
    </div>
  );
}

export default PrivilegedSeparationJourney;
