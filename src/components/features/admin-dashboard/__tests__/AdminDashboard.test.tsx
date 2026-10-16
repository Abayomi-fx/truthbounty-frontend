import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AdminDashboard } from '../AdminDashboard';
import { AdminUnauthorizedState } from '../AdminUnauthorizedState';
import { SystemHealthSummary } from '../SystemHealthSummary';
import { OperationalQueueTable } from '../OperationalQueueTable';
import { OperationConfirmModal } from '../OperationConfirmModal';
import { SecurityGovernanceNotices } from '../SecurityGovernanceNotices';
import { ReadOnlyConfigSummary } from '../ReadOnlyConfigSummary';
import { AdminAuditTrail } from '../AdminAuditTrail';
import type { UseAdminDashboardDataReturn } from '@/hooks/useAdminDashboardData';
import { APP_ROUTES } from '@/config/navigation';

const mockRefetch = jest.fn();
const mockExecute = jest.fn();

const defaultMockData: UseAdminDashboardDataReturn = {
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
      lastUpdated: '2026-03-27T08:00:00Z',
    },
    {
      id: 'metric-rpc-state',
      name: 'Optimism RPC Provider',
      value: 'Active / Connected',
      subtext: 'Block Height: 12,345,678 (p99 latency: 38ms)',
      status: 'healthy',
      source: 'Optimism Sepolia Sequencer',
      lastUpdated: '2026-03-27T08:00:00Z',
    },
    {
      id: 'metric-failed-jobs',
      name: 'Failed Pipeline Jobs',
      value: '1 retryable',
      subtext: 'Batch #4410 idempotency log preserved',
      status: 'warning',
      source: 'Worker Daemon Supervisor',
      lastUpdated: '2026-03-27T08:00:00Z',
    },
    {
      id: 'metric-queue-age',
      name: 'Queue Retention Age',
      value: '12m oldest',
      subtext: 'Maximum SLA threshold: 60m',
      status: 'healthy',
      source: 'Dead-Letter Queue (DLQ) Manager',
      lastUpdated: '2026-03-27T08:00:00Z',
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
      consequenceHash: '0x8f2a991e23c01bf8a892b1a5e1289c0d381b162f4091a1829cb910291e0a8112',
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
      key: 'canonical_admin',
      label: 'Protocol Administrator',
      value: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      description: 'Authorized operational controller for pause and maintenance tasks.',
      contractSource: 'roles/11155420.json',
    },
    {
      key: 'min_bond',
      label: 'Minimum Bond Amount',
      value: '1.00 ETH (10^18 wei)',
      description: 'Baseline stake required to open a dispute challenge.',
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
  execute: mockExecute,
  refetch: mockRefetch,
};

describe('Issue #439 V2-FE-154 — Bounded Admin Operations Dashboard', () => {
  beforeEach(() => {
    mockRefetch.mockClear();
    mockExecute.mockClear();
  });

  describe('1. Authorization & Explicit Denied State', () => {
    it('renders explicit denied state when user is unauthorized', () => {
      const unauthorizedData: UseAdminDashboardDataReturn = {
        ...defaultMockData,
        isAuthorized: false,
        unauthorizedReason: 'Current address is not registered as the canonical protocol administrator.',
        account: '0x9999999999999999999999999999999999999999',
      };

      render(<AdminDashboard testDataOverride={unauthorizedData} />);

      expect(screen.getByTestId('admin-unauthorized-notice')).toBeInTheDocument();
      expect(
        screen.getByText(/Current address is not registered as the canonical protocol administrator/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /return to public dashboard/i })).toHaveAttribute(
        'href',
        APP_ROUTES.DASHBOARD
      );
      expect(screen.getByRole('link', { name: /connect operator wallet/i })).toHaveAttribute(
        'href',
        APP_ROUTES.IDENTITY
      );

      // Verify no operational actions are accessible in unauthorized state
      expect(screen.queryByTestId('operational-queue-section')).not.toBeInTheDocument();
    });
  });

  describe('2. Security Invariants (No Claim-Outcome Override or Fund Movement)', () => {
    it('confirms dashboard exposes zero controls for claim override, fund transfer, or settlement bypass', () => {
      render(<AdminDashboard testDataOverride={defaultMockData} />);

      // Assert non-existence of dangerous administrator powers
      expect(screen.queryByRole('button', { name: /override/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /settle claim/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /withdraw user/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /force payout/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /bypass/i })).not.toBeInTheDocument();

      // Assert explicit non-custodial escrow invariant notice is displayed
      expect(screen.getByText(/Non-Custodial Escrow Security Invariant/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Protocol contracts possess zero administrative powers to redirect, seize, or override/i)
      ).toBeInTheDocument();
    });
  });

  describe('3. System Health Summary with Source and Freshness', () => {
    it('displays indexer lag, RPC state, failed jobs, and queue age with provenance metadata', () => {
      render(<SystemHealthSummary metrics={defaultMockData.healthMetrics} />);

      expect(screen.getByLabelText(/Indexer Ingestion Lag: 14 blocks/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Optimism RPC Provider: Active \/ Connected/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Failed Pipeline Jobs: 1 retryable/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Queue Retention Age: 12m oldest/i)).toBeInTheDocument();

      // Assert source metadata presence
      expect(screen.getByText('Graph Node Indexer (L2 RPC)')).toBeInTheDocument();
      expect(screen.getByText('Optimism Sepolia Sequencer')).toBeInTheDocument();
      expect(screen.getByText('Worker Daemon Supervisor')).toBeInTheDocument();
      expect(screen.getByText('Dead-Letter Queue (DLQ) Manager')).toBeInTheDocument();
    });
  });

  describe('4. Bounded Operational Queues & Mobile Card Alternatives', () => {
    it('renders operational queue in both desktop table and mobile card alternative', () => {
      const handleSelect = jest.fn();
      render(
        <OperationalQueueTable
          queue={defaultMockData.operationalQueue}
          onSelectOperation={handleSelect}
        />
      );

      // Desktop table and mobile card items
      expect(
        screen.getAllByText('Retry Failed Event Indexer Batch #4410').length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText('Re-sync Stale Dispute State Projection').length
      ).toBeGreaterThanOrEqual(1);

      // Mobile card alternative exists in DOM
      expect(screen.getByTestId('operational-queue-mobile-cards')).toBeInTheDocument();

      // Clicking action triggers selection callback
      const reviewButtons = screen.getAllByRole('button', {
        name: /authorize retry failed event indexer batch #4410/i,
      });
      fireEvent.click(reviewButtons[0]);
      expect(handleSelect).toHaveBeenCalledWith(defaultMockData.operationalQueue[0]);
    });

    it('renders reassuring empty state when operational queue is clear', () => {
      render(<OperationalQueueTable queue={[]} onSelectOperation={jest.fn()} />);

      expect(screen.getByTestId('operational-queue-empty')).toBeInTheDocument();
      expect(screen.getByText(/operational queues clear/i)).toBeInTheDocument();
    });
  });

  describe('5. High-Impact Operation Confirmation Modal', () => {
    it('requires explicit "CONFIRM" string before allowing execution', async () => {
      const handleConfirm = jest.fn().mockResolvedValue(undefined);
      const handleClose = jest.fn();

      render(
        <OperationConfirmModal
          operation={defaultMockData.operationalQueue[0]}
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
        />
      );

      expect(screen.getByTestId('operation-confirm-modal')).toBeInTheDocument();
      expect(screen.getByText(/Required Authority:/i)).toBeInTheDocument();
      expect(screen.getByText('PROTOCOL_OPERATOR')).toBeInTheDocument();
      expect(
        screen.getByText(/Deterministic replay of block range event logs/i)
      ).toBeInTheDocument();

      const executeBtn = screen.getByRole('button', { name: /authorize & execute/i });
      expect(executeBtn).toBeDisabled();

      // Typing anything else keeps it disabled
      const input = screen.getByLabelText(/type confirm to execute/i);
      fireEvent.change(input, { target: { value: 'yes' } });
      expect(executeBtn).toBeDisabled();

      // Typing CONFIRM enables button
      fireEvent.change(input, { target: { value: 'CONFIRM' } });
      expect(executeBtn).not.toBeDisabled();

      fireEvent.click(executeBtn);
      await waitFor(() => {
        expect(handleConfirm).toHaveBeenCalledWith('op-retry-batch-4410', 'CONFIRM');
      });
    });

    it('closes modal on Escape key press', () => {
      const handleClose = jest.fn();
      render(
        <OperationConfirmModal
          operation={defaultMockData.operationalQueue[0]}
          isOpen={true}
          onClose={handleClose}
          onConfirm={jest.fn()}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe('6. Read-Only Configuration Summary', () => {
    it('renders read-only parameters from release artifacts with copyable contract addresses', () => {
      render(<ReadOnlyConfigSummary parameters={defaultMockData.readOnlyParameters} />);

      expect(screen.getByText('Protocol Version')).toBeInTheDocument();
      expect(screen.getByText('TruthBountyWeighted (Proxy)')).toBeInTheDocument();
      expect(screen.getByText('Protocol Administrator')).toBeInTheDocument();
      expect(screen.getByText('Minimum Bond Amount')).toBeInTheDocument();
      expect(screen.getByText('manifest.json')).toBeInTheDocument();
      expect(screen.getByText('addresses/11155420.json')).toBeInTheDocument();

      expect(screen.getByLabelText(/copy truthbountyweighted \(proxy\)/i)).toBeInTheDocument();
    });
  });

  describe('7. Immutable Admin Audit References', () => {
    it('displays audit reference IDs and consequence hashes with mobile card alternative', () => {
      render(<AdminAuditTrail records={defaultMockData.auditRecords} />);

      expect(screen.getAllByText('AUD-2026-0327-01').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Replay Failed Indexer Batch #4408').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByLabelText(/copy audit id aud-2026-0327-01/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByTestId('admin-audit-mobile-cards')).toBeInTheDocument();
    });
  });

  describe('8. Resilient State Banners (Stale, Degraded, Partial Failure)', () => {
    it('renders stale notice when telemetry is stale', () => {
      const staleData: UseAdminDashboardDataReturn = {
        ...defaultMockData,
        isStale: true,
      };

      render(<AdminDashboard testDataOverride={staleData} />);
      expect(screen.getByTestId('admin-stale-notice')).toBeInTheDocument();
      expect(screen.getByText(/Administrative Telemetry Stale/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /refresh telemetry/i }));
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('renders degraded notice when infrastructure degradation is detected', () => {
      const degradedData: UseAdminDashboardDataReturn = {
        ...defaultMockData,
        isDegraded: true,
      };

      render(<AdminDashboard testDataOverride={degradedData} />);
      expect(screen.getByTestId('admin-degraded-notice')).toBeInTheDocument();
      expect(screen.getByText(/Infrastructure Degradation Detected/i)).toBeInTheDocument();
    });

    it('renders partial failure notice with retry action', () => {
      const partialData: UseAdminDashboardDataReturn = {
        ...defaultMockData,
        isPartialFailure: true,
        partialFailureMessage: 'Queue supervisor API timed out after 3 retries',
      };

      render(<AdminDashboard testDataOverride={partialData} />);
      expect(screen.getByTestId('admin-partial-failure-notice')).toBeInTheDocument();
      expect(screen.getByText(/Queue supervisor API timed out/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /retry sync/i }));
      expect(mockRefetch).toHaveBeenCalled();
    });
  });
});
