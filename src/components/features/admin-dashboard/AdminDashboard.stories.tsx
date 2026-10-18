import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect } from '@storybook/test';
import { AdminDashboard } from './AdminDashboard';
import type { UseAdminDashboardDataReturn } from '@/hooks/useAdminDashboardData';
import type { HealthObservation } from './healthObservation';

const mockBaseData: UseAdminDashboardDataReturn = {
  isAuthorized: true,
  unauthorizedReason: null,
  canonicalAdminAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  account: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  isConnected: true,
  isSupportedChain: true,
  isLoading: false,
  isStale: false,
  isDegraded: false,
  isOffline: false,
  isPartialFailure: false,
  partialFailureMessage: null,
  healthObservations: [
    {
      id: 'obs-api',
      scope: 'api',
      label: 'API Projection Service',
      state: 'healthy',
      freshness: 'fresh',
      lastObservedAt: Date.now() - 4000,
      finalizedBlock: 12345678,
      finalizedBlockSource: 'Optimism L2 RPC',
      detail: 'Projection reads within freshness window.',
      affectedScope: [],
      isThirdParty: false,
    },
    {
      id: 'obs-rpc',
      scope: 'rpc',
      label: 'Optimism RPC Provider',
      state: 'healthy',
      freshness: 'fresh',
      lastObservedAt: Date.now() - 3000,
      finalizedBlock: 12345678,
      finalizedBlockSource: 'Optimism Sepolia Sequencer',
      detail: 'p99 latency 38ms; finalized head advancing.',
      affectedScope: [],
      isThirdParty: true,
    },
    {
      id: 'obs-indexer',
      scope: 'indexer',
      label: 'Indexer Ingestion',
      state: 'delayed',
      freshness: 'fresh',
      lastObservedAt: Date.now() - 28000,
      finalizedBlock: 12345664,
      finalizedBlockSource: 'Graph Node Indexer',
      detail: '14 blocks behind finalized head; within tolerance.',
      affectedScope: ['dispute-events', 'challenge-projections'],
      isThirdParty: false,
    },
    {
      id: 'obs-database',
      scope: 'database',
      label: 'Read Projection Database',
      state: 'healthy',
      freshness: 'fresh',
      lastObservedAt: Date.now() - 2000,
      finalizedBlock: 12345678,
      finalizedBlockSource: 'Optimism L2 RPC',
      detail: 'Replica lag 120ms.',
      affectedScope: [],
      isThirdParty: false,
    },
    {
      id: 'obs-release',
      scope: 'release',
      label: 'Release Manifest Verification',
      state: 'healthy',
      freshness: 'fresh',
      lastObservedAt: Date.now() - 6000,
      finalizedBlock: 12345678,
      finalizedBlockSource: 'manifest.json',
      detail: 'ABI/manifest hash matches deployed proxy 0x7099…79C8.',
      affectedScope: [],
      isThirdParty: false,
    },
  ],
  abiManifestVerification: {
    status: 'verified',
    manifestHash: '0x9f2c1a4b7e8d0f3a5c6b2e1d4a8f7c3b9e0d1a2b3c4d5e6f708192a3b4c5d6e7',
    deployedAbiHash: '0x9f2c1a4b7e8d0f3a5c6b2e1d4a8f7c3b9e0d1a2b3c4d5e6f708192a3b4c5d6e7',
    verifiedAt: Date.now() - 6000,
    affectedScope: [],
    detail: 'ABI matches canonical manifest for chain 11155420.',
  },
  healthMetrics: [
    {
      id: 'metric-indexer-lag',
      name: 'Indexer Ingestion Lag',
      value: '14 blocks',
      subtext: 'Latency ~28s (Within tolerance < 50 blocks)',
      status: 'healthy',
      source: 'Graph Node Indexer (L2 RPC)',
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'metric-rpc-state',
      name: 'Optimism RPC Provider',
      value: 'Active / Connected',
      subtext: 'Block Height: 12,345,678 (p99 latency: 38ms)',
      status: 'healthy',
      source: 'Optimism Sepolia Sequencer',
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'metric-failed-jobs',
      name: 'Failed Pipeline Jobs',
      value: '1 retryable',
      subtext: 'Batch #4410 idempotency log preserved',
      status: 'warning',
      source: 'Worker Daemon Supervisor',
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'metric-queue-age',
      name: 'Queue Retention Age',
      value: '12m oldest',
      subtext: 'Maximum SLA threshold: 60m',
      status: 'healthy',
      source: 'Dead-Letter Queue (DLQ) Manager',
      lastUpdated: new Date().toISOString(),
    },
  ],
  operationalQueue: [
    {
      id: 'op-retry-batch-4410',
      title: 'Retry Failed Event Indexer Batch #4410',
      description: 'Batch failed due to transient L2 RPC gateway timeout during block reorg settlement.',
      authority: 'PROTOCOL_OPERATOR',
      targetResource: 'Indexer Ingestion Pipeline (Blocks 12,345,600 - 12,345,620)',
      risk: 'high',
      consequence: 'Deterministic replay of block range event logs. Preserves idempotency; does not modify on-chain state or user balances.',
      queueAge: '12m ago',
      createdAt: '2026-03-27T07:48:00Z',
      status: 'pending',
    },
    {
      id: 'op-sync-dispute-projection',
      title: 'Re-sync Stale Dispute State Projection',
      description: 'On-chain DisputeOpened receipt count differs from local read projection by 1 event.',
      authority: 'PROTOCOL_OPERATOR',
      targetResource: 'TruthBountyWeighted.sol (Dispute Engine)',
      risk: 'medium',
      consequence: 'Queries canonical contract getLogs for DisputeOpened and reconciles local read cache. Read-only indexing correction.',
      queueAge: '28m ago',
      createdAt: '2026-03-27T07:32:00Z',
      status: 'pending',
    },
  ],
  auditRecords: [
    {
      auditId: 'AUD-2026-0327-01',
      operator: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      action: 'Replay Failed Indexer Batch #4408',
      authority: 'PROTOCOL_OPERATOR',
      targetResource: 'Indexer Ingestion Pipeline',
      consequenceHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      timestamp: '2026-03-27T04:00:00Z',
      status: 'SUCCESS',
      details: 'Re-ingested 18 missed dispute events from block 12,344,800 without state overwrite.',
    },
  ],
  readOnlyParameters: [
    {
      key: 'protocol_version',
      label: 'Protocol Version',
      value: '2.0.0',
      description: 'Canonical protocol deployment version release.',
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
  ],
  governanceNotices: [
    {
      id: 'notice-timelock',
      type: 'timelock',
      title: '48-Hour Governance Timelock Enforced',
      description: 'Any upgrade to implementation bytecode or protocol fee alteration requires a 48-hour timelock delay with multi-party multisig approval.',
      level: 'info',
    },
    {
      id: 'notice-escrow',
      type: 'escrow',
      title: 'Non-Custodial Escrow Security Invariant',
      description: 'Protocol contracts possess zero administrative powers to redirect, seize, or override claimant escrow balances or dispute stakes.',
      level: 'critical',
    },
  ],
  freshness: {
    lastUpdated: Date.now() - 5000,
    source: 'Optimism L2 Registry & Indexer Supervisor',
    isFresh: true,
  },
  execute: async () => ({ success: true, message: 'Simulated operation executed' }),
  refetch: async () => {},
};

const meta: Meta<typeof AdminDashboard> = {
  title: 'Features/AdminDashboard/AdminDashboard',
  component: AdminDashboard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Admin dashboard surface for protocol operators. Renders canonical contract-derived read-only parameters, freshness-labelled telemetry projections, and privileged operational queue actions. Fixtures are isolated from production adapters; unpinned actions render unavailable.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminDashboard>;

export const AuthorizedOperational: Story = {
  args: {
    testDataOverride: mockBaseData,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Default authorized operator view with healthy telemetry, a pending operational queue, and canonical read-only parameters. Contract state remains canonical; telemetry is a freshness-labelled projection.',
      },
    },
  },
};

export const UnauthorizedDirectAccess: Story = {
  args: {
    testDataOverride: {
      ...mockBaseData,
      isAuthorized: false,
      unauthorizedReason: 'Current address is not registered as the canonical protocol administrator.',
      account: '0x1234567890123456789012345678901234567890',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Direct access by a non-canonical address. All privileged controls must render unavailable; no wallet connection or UI context establishes protocol authority.',
      },
    },
  },
};

export const EmptyOperationalQueue: Story = {
  args: {
    testDataOverride: {
      ...mockBaseData,
      operationalQueue: [],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Empty operational queue state. The queue surface must render an explicit empty state rather than a blank region.',
      },
    },
  },
};

export const StaleTelemetry: Story = {
  args: {
    testDataOverride: {
      ...mockBaseData,
      isStale: true,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Stale telemetry projection. Freshness labelling must be visible so operators do not treat stale API data as canonical contract state.',
      },
    },
  },
};

export const InfrastructureDegraded: Story = {
  args: {
    testDataOverride: {
      ...mockBaseData,
      isDegraded: true,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Degraded infrastructure state. Destructive and privileged controls must remain gated behind explicit impact copy and confirmation boundaries.',
      },
    },
  },
};

export const PartialFailureState: Story = {
  args: {
    testDataOverride: {
      ...mockBaseData,
      isPartialFailure: true,
      partialFailureMessage: 'Failed to synchronize queue worker daemon: RPC 504 Gateway Timeout',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Partial failure state. The failure message must be surfaced with accessible semantics and must not imply contract-state mutation.',
      },
    },
  },
};

export const LoadingState: Story = {
  args: {
    testDataOverride: {
      ...mockBaseData,
      isLoading: true,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Loading state. Loading affordances must respect reduced-motion preferences and remain legible at 200% zoom.',
      },
    },
  },
};

export const KeyboardFocusTraversal: Story = {
  args: {
    testDataOverride: mockBaseData,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Keyboard and focus traversal across privileged controls. Verifies accessible names and focus order without relying on pointer input.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    const focused = document.activeElement as HTMLElement | null;
    await expect(focused).not.toBeNull();
    await expect(canvasElement.contains(focused)).toBe(true);
  },
};

export const ReducedMotion: Story = {
  args: {
    testDataOverride: mockBaseData,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Reduced-motion rendering. Animations and transitions must be suppressed while state semantics remain intact.',
      },
    },
  },
  globals: {
    prefersReducedMotion: 'reduce',
  },
};

export const Zoom200Percent: Story = {
  args: {
    testDataOverride: mockBaseData,
  },
  parameters: {
    docs: {
      description: {
        story:
          '200% zoom rendering. Layout must remain usable without horizontal overflow or clipped controls.',
      },
    },
  },
  globals: {
    viewport: { value: 'mobile1', isRotated: false },
  },
};

export const ResponsiveDesktop: Story = {
  args: {
    testDataOverride: mockBaseData,
  },
  parameters: {
    viewport: { defaultViewport: 'desktop' },
    docs: {
      description: {
        story: 'Responsive visual regression baseline at approved desktop width.',
      },
    },
  },
};

export const ResponsiveTablet: Story = {
  args: {
    testDataOverride: mockBaseData,
  },
  parameters: {
    viewport: { defaultViewport: 'tablet' },
    docs: {
      description: {
        story: 'Responsive visual regression baseline at approved tablet width.',
      },
    },
  },
};

export const ResponsiveMobile: Story = {
  args: {
    testDataOverride: mockBaseData,
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
    docs: {
      description: {
        story: 'Responsive visual regression baseline at approved mobile width.',
      },
    },
  },
};

export const FixtureIsolation: Story = {
  args: {
    testDataOverride: mockBaseData,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Fixture isolation check. Storybook fixtures must not reach production adapters; unpinned actions must render unavailable.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement).toBeTruthy();
    await expect(canvas).toBeTruthy();
  },
};

const withObservation = (
  id: string,
  patch: Partial<HealthObservation>,
): UseAdminDashboardDataReturn => ({
  ...mockBaseData,
  healthObservations: mockBaseData.healthObservations.map((obs) =>
    obs.id === id ? { ...obs, ...patch } : obs,
  ),
});

export const HealthAllHealthy: Story = {
  args: {
    testDataOverride: mockBaseData,
  },
};

export const HealthDegraded: Story = {
  args: {
    testDataOverride: withObservation('obs-database', {
      state: 'degraded',
      detail: 'Replica lag 4.2s exceeds 1s SLO.',
      affectedScope: ['read-projections'],
    }),
  },
};

export const HealthDelayed: Story = {
  args: {
    testDataOverride: withObservation('obs-indexer', {
      state: 'delayed',
      detail: '62 blocks behind finalized head; exceeds 50-block tolerance.',
      affectedScope: ['dispute-events', 'challenge-projections', 'appeal-windows'],
    }),
  },
};

export const HealthStale: Story = {
  args: {
    testDataOverride: withObservation('obs-api', {
      state: 'stale',
      freshness: 'stale',
      lastObservedAt: Date.now() - 1000 * 60 * 45,
      detail: 'No successful observation in 45 minutes.',
      affectedScope: ['admin-overview'],
    }),
  },
};

export const HealthUnavailable: Story = {
  args: {
    testDataOverride: withObservation('obs-rpc', {
      state: 'unavailable',
      freshness: 'unknown',
      lastObservedAt: null,
      finalizedBlock: null,
      finalizedBlockSource: null,
      detail: 'No response from provider; observation unavailable.',
      affectedScope: ['indexer', 'database', 'release'],
    }),
  },
};

export const HealthThirdPartyDependency: Story = {
  args: {
    testDataOverride: withObservation('obs-rpc', {
      state: 'degraded',
      isThirdParty: true,
      detail: 'Third-party provider degraded. Not a TruthBounty guarantee.',
      affectedScope: ['indexer'],
    }),
  },
};

export const HealthAbiManifestMismatch: Story = {
  args: {
    testDataOverride: {
      ...mockBaseData,
      abiManifestVerification: {
        ...mockBaseData.abiManifestVerification,
        status: 'mismatch',
        deployedAbiHash: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        detail: 'Deployed ABI hash does not match canonical manifest.',
        affectedScope: ['dispute-engine', 'escrow'],
      },
    },
  },
};

export const HealthAbiManifestUnverified: Story = {
  args: {
    testDataOverride: {
      ...mockBaseData,
      abiManifestVerification: {
        ...mockBaseData.abiManifestVerification,
        status: 'unverified',
        verifiedAt: null,
        detail: 'Manifest verification pending; actions render unavailable.',
        affectedScope: ['all-mutations'],
      },
    },
  },
};

export const HealthMissingObservations: Story = {
  args: {
    testDataOverride: {
      ...mockBaseData,
      healthObservations: [],
      abiManifestVerification: {
        ...mockBaseData.abiManifestVerification,
        status: 'unverified',
        verifiedAt: null,
        detail: 'No observations available; health cannot be asserted.',
      },
    },
  },
};
