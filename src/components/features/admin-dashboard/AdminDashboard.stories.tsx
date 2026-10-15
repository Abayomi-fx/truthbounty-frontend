import type { Meta, StoryObj } from '@storybook/react';
import { AdminDashboard } from './AdminDashboard';
import type { UseAdminDashboardDataReturn } from '@/hooks/useAdminDashboardData';

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
  },
};

export default meta;
type Story = StoryObj<typeof AdminDashboard>;

export const AuthorizedOperational: Story = {
  args: {
    testDataOverride: mockBaseData,
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
};

export const EmptyOperationalQueue: Story = {
  args: {
    testDataOverride: {
      ...mockBaseData,
      operationalQueue: [],
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
};

export const InfrastructureDegraded: Story = {
  args: {
    testDataOverride: {
      ...mockBaseData,
      isDegraded: true,
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
};

export const LoadingState: Story = {
  args: {
    testDataOverride: {
      ...mockBaseData,
      isLoading: true,
    },
  },
};
