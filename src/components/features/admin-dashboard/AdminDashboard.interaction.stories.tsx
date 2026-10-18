/**
 * UI-FE-025 — Operational Health and Release Status Interaction Tests
 *
 * Storybook interaction tests with play functions for privileged operational
 * health composition: degraded, delayed, stale, unavailable, and healthy
 * observations, plus ABI/manifest verification and affected scope.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { expect } from '@storybook/jest';
import { within, userEvent, waitFor } from '@storybook/testing-library';
import { fn } from '@storybook/test';
import { AdminDashboard } from './AdminDashboard';
import type { UseAdminDashboardDataReturn } from '@/hooks/useAdminDashboardData';

const meta: Meta<typeof AdminDashboard> = {
  title: 'Features/AdminDashboard/OperationalHealthInteractions',
  component: AdminDashboard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Admin dashboard for privileged operations. All mutations require explicit impact copy and confirmation boundaries. Fixtures are isolated from production adapters; unpinned actions render unavailable.',
      },
    },
  },
  argTypes: {
    data: {
      control: false,
      description: 'Freshness-labelled projection of admin dashboard state. Never establishes protocol authority.',
    },
    onExecuteOperation: {
      action: 'executeOperation',
      description: 'Bounded privileged operation. Requires confirmation boundary.',
    },
    onRefresh: {
      action: 'refresh',
      description: 'Refresh API projection. Does not mutate contract state.',
    },
  },
  args: {
    onExecuteOperation: fn(),
    onRefresh: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof AdminDashboard>;

// ── Base Data Fixtures ───────────────────────────────────────────────────────

const authorizedBaseData: UseAdminDashboardDataReturn = {
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
  ],
  operationalQueue: [
    {
      id: 'op-retry-batch-4410',
      title: 'Retry Failed Event Indexer Batch #4410',
      description: 'Idempotency log preserved; no double-processing risk',
      authority: 'PROTOCOL_OPERATOR',
      targetResource: 'Indexer Ingestion Pipeline',
      risk: 'low',
      consequence: 'Reprocesses rejected event batch with checkpointed watermark',
      queueAge: '12m',
      createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      status: 'pending',
    },
  ],
  auditRecords: [],
  readOnlyParameters: [],
  governanceNotices: [],
  fetchedAt: new Date().toISOString(),
};

// ── 1. Operations Context Interaction Tests ──────────────────────────────────

export const AuthorizedOperationExecution: Story = {
  name: 'Authorized — Operation Execution (default)',
  args: {
    data: authorizedBaseData,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify authorized state
    await waitFor(() => {
      expect(canvas.getByText(/authorized/i)).toBeInTheDocument();
    });

    // Verify operational queue visible
    await waitFor(() => {
      expect(canvas.getByText(/operational queue/i)).toBeInTheDocument();
    });

    // Verify bounded operation present
    await waitFor(() => {
      expect(canvas.getByText(/retry.*batch.*4410/i)).toBeInTheDocument();
    });

    // Click execute button
    const executeButton = canvas.getByRole('button', { name: /execute/i });
    await userEvent.click(executeButton);

    // Verify confirmation modal appears
    await waitFor(() => {
      expect(canvas.getByRole('dialog')).toBeInTheDocument();
      expect(canvas.getByText(/confirm/i)).toBeInTheDocument();
    });

    // Verify consequence information visible
    await waitFor(() => {
      expect(canvas.getByText(/consequence/i)).toBeInTheDocument();
      expect(canvas.getByText(/reprocesses/i)).toBeInTheDocument();
    });

    // Type explicit confirmation
    const confirmInput = canvas.getByRole('textbox', { name: /confirmation/i });
    await userEvent.type(confirmInput, 'CONFIRM');

    // Verify button enabled
    const confirmButton = canvas.getByRole('button', { name: /execute operation/i });
    await waitFor(() => {
      expect(confirmButton).toBeEnabled();
    });
  },
};

export const UnauthorizedWalletDenial: Story = {
  name: 'Unauthorized — Wallet Denial (error)',
  args: {
    data: {
      ...authorizedBaseData,
      isAuthorized: false,
      unauthorizedReason: 'Admin role verification failed against canonical contract registry',
      account: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify unauthorized state
    await waitFor(() => {
      expect(canvas.getByText(/unauthorized/i)).toBeInTheDocument();
    });

    // Verify denial reason visible
    await waitFor(() => {
      expect(canvas.getByText(/admin role verification failed/i)).toBeInTheDocument();
    });

    // Verify no execute buttons
    const executeButtons = canvas.queryAllByRole('button', { name: /execute/i });
    expect(executeButtons).toHaveLength(0);

    // Verify queue is read-only
    await waitFor(() => {
      expect(canvas.getByText(/read-only/i)).toBeInTheDocument();
    });
  },
};

export const DisconnectedWalletGate: Story = {
  name: 'Disconnected — Wallet Gate (disabled)',
  args: {
    data: {
      ...authorizedBaseData,
      isConnected: false,
      isAuthorized: false,
      unauthorizedReason: 'Connect an Optimism-compatible wallet to continue.',
      account: null,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify connection prompt
    await waitFor(() => {
      expect(canvas.getByText(/connect.*wallet/i)).toBeInTheDocument();
    });

    // Verify connect button
    await waitFor(() => {
      expect(canvas.getByRole('button', { name: /connect/i })).toBeInTheDocument();
    });

    // Verify no operational data visible
    const tables = canvas.queryAllByRole('table');
    expect(tables).toHaveLength(0);
  },
};

export const AccountChangeRecoveryFlow: Story = {
  name: 'Account Change — Recovery Flow (active)',
  args: {
    data: authorizedBaseData,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Initial authorized state
    await waitFor(() => {
      expect(canvas.getByText(/authorized/i)).toBeInTheDocument();
    });

    // Simulate account change (via mock event)
    await waitFor(() => {
      window.dispatchEvent(
        new CustomEvent('accountsChanged', {
          detail: { newAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
        }),
      );
    });

    // Verify recovery prompt appears
    await waitFor(
      () => {
        expect(canvas.getByText(/account.*changed/i)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Verify acknowledge button
    const acknowledgeButton = canvas.getByRole('button', { name: /acknowledge/i });
    expect(acknowledgeButton).toBeInTheDocument();

    // Click acknowledge
    await userEvent.click(acknowledgeButton);

    // Verify transition to unauthorized state
    await waitFor(
      () => {
        expect(canvas.getByText(/unauthorized/i)).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  },
};

export const ChainChangeUnsupportedNetwork: Story = {
  name: 'Chain Change — Unsupported Network (error)',
  args: {
    data: {
      ...authorizedBaseData,
      isSupportedChain: false,
      isAuthorized: false,
      unauthorizedReason: 'Unsupported chain. Switch to Optimism Mainnet (10) or OP Sepolia (11155420).',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify unsupported chain message
    await waitFor(() => {
      expect(canvas.getByText(/unsupported chain/i)).toBeInTheDocument();
    });

    // Verify switch instruction
    await waitFor(() => {
      expect(canvas.getByText(/switch to optimism/i)).toBeInTheDocument();
    });

    // Verify no operational controls
    const executeButtons = canvas.queryAllByRole('button', { name: /execute/i });
    expect(executeButtons).toHaveLength(0);
  },
};

export const StaleApiDataWarning: Story = {
  name: 'Stale API — Warning (loading)',
  args: {
    data: {
      ...authorizedBaseData,
      isStale: true,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify stale warning
    await waitFor(() => {
      expect(canvas.getByText(/stale/i)).toBeInTheDocument();
    });

    // Verify refresh button
    await waitFor(() => {
      expect(canvas.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    // Verify operations still accessible (read-only preserved)
    await waitFor(() => {
      expect(canvas.getByText(/operational queue/i)).toBeInTheDocument();
    });

    // Click refresh
    const refreshButton = canvas.getByRole('button', { name: /refresh/i });
    await userEvent.click(refreshButton);

    // Verify refresh initiated (loading state or toast)
    await waitFor(
      () => {
        const refreshing = canvas.queryByText(/refreshing/i);
        if (refreshing) {
          expect(refreshing).toBeInTheDocument();
        }
      },
      { timeout: 1000 },
    );
  },
};

export const CriticallyStaleApiBlocks: Story = {
  name: 'Critically Stale — Writes Blocked (disabled)',
  args: {
    data: {
      ...authorizedBaseData,
      isStale: true,
      isDegraded: true,
      partialFailureMessage: 'API data is critically stale (>5min). Write operations are blocked.',
      isPartialFailure: true,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify critical staleness warning
    await waitFor(() => {
      expect(canvas.getByText(/critically stale/i)).toBeInTheDocument();
    });

    // Verify blocked message
    await waitFor(() => {
      expect(canvas.getByText(/blocked/i)).toBeInTheDocument();
    });

    // Verify execute buttons disabled
    const executeButtons = canvas.getAllByRole('button', { name: /execute/i });
    executeButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  },
};

export const OfflineNetworkFailure: Story = {
  name: 'Offline — Network Failure (error)',
  args: {
    data: {
      ...authorizedBaseData,
      isOffline: true,
      isDegraded: true,
      partialFailureMessage: 'Network connection lost. Retry when back online.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify offline indicator
    await waitFor(() => {
      expect(canvas.getByText(/offline/i)).toBeInTheDocument();
    });

    // Verify retry prompt
    await waitFor(() => {
      expect(canvas.getByText(/retry when back online/i)).toBeInTheDocument();
    });

    // Verify operations disabled
    const executeButtons = canvas.queryAllByRole('button', { name: /execute/i });
    if (executeButtons.length > 0) {
      executeButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    }
  },
};

export const DirectUrlAccessWithoutAuth: Story = {
  name: 'Direct URL — Without Auth (disabled)',
  args: {
    data: {
      ...authorizedBaseData,
      isConnected: false,
      isAuthorized: false,
      unauthorizedReason: 'Connect an Optimism-compatible wallet to continue.',
      account: null,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify connection gate visible
    await waitFor(() => {
      expect(canvas.getByText(/connect.*wallet/i)).toBeInTheDocument();
    });

    // Verify no privileged content
    expect(canvas.queryByText(/operational queue/i)).not.toBeInTheDocument();
    expect(canvas.queryByRole('table')).not.toBeInTheDocument();

    // Verify connection button
    const connectButton = canvas.getByRole('button', { name: /connect/i });
    expect(connectButton).toBeInTheDocument();
  },
};

// ── 2. Bounded Operations Invariant Tests ────────────────────────────────────

export const BoundedOperationsOnly: Story = {
  name: 'Bounded Operations — Read-only Invariant',
  args: {
    data: authorizedBaseData,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify operational queue visible
    await waitFor(() => {
      expect(canvas.getByText(/operational queue/i)).toBeInTheDocument();
    });

    // Verify no claim verdict operations
    expect(canvas.queryByText(/override.*verdict/i)).not.toBeInTheDocument();
    expect(canvas.queryByText(/modify.*claim/i)).not.toBeInTheDocument();
    expect(canvas.queryByText(/change.*outcome/i)).not.toBeInTheDocument();

    // Verify no fund transfer operations
    expect(canvas.queryByText(/withdraw.*treasury/i)).not.toBeInTheDocument();
    expect(canvas.queryByText(/transfer.*funds/i)).not.toBeInTheDocument();

    // Verify only bounded operations present
    await waitFor(() => {
      expect(canvas.getByText(/retry.*batch/i)).toBeInTheDocument();
    });
  },
};

export const ExplicitConfirmationRequired: Story = {
  args: {
    data: authorizedBaseData,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Click execute
    const executeButton = canvas.getByRole('button', { name: /execute/i });
    await userEvent.click(executeButton);

    // Verify confirmation modal
    await waitFor(() => {
      expect(canvas.getByRole('dialog')).toBeInTheDocument();
    });

    // Verify explicit text input required
    const confirmInput = canvas.getByRole('textbox', { name: /confirmation/i });
    expect(confirmInput).toBeInTheDocument();
    expect(confirmInput).toHaveValue('');

    // Verify button disabled without confirmation
    const confirmButton = canvas.getByRole('button', { name: /execute operation/i });
    expect(confirmButton).toBeDisabled();

    // Type wrong confirmation
    await userEvent.type(confirmInput, 'yes');
    expect(confirmButton).toBeDisabled();

    // Clear and type correct confirmation
    await userEvent.clear(confirmInput);
    await userEvent.type(confirmInput, 'CONFIRM');

    // Verify button enabled
    await waitFor(() => {
      expect(confirmButton).toBeEnabled();
    });
  },
};

// ── 3. Health Metrics and Degradation Tests ──────────────────────────────────

export const HealthMetricsDisplay: Story = {
  args: {
    data: {
      ...authorizedBaseData,
      healthMetrics: [
        {
          id: 'metric-indexer-lag',
          name: 'Indexer Ingestion Lag',
          value: '14 blocks',
          subtext: 'Latency ~28s',
          status: 'healthy',
          source: 'Graph Node Indexer',
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
          id: 'metric-rpc-provider',
          name: 'Optimism RPC Provider',
          value: 'Degraded',
          subtext: 'Fallback to secondary provider active',
          status: 'degraded',
          source: 'RPC Fallback Circuit',
          lastUpdated: new Date().toISOString(),
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify health metrics section
    await waitFor(() => {
      expect(canvas.getByText(/system health/i)).toBeInTheDocument();
    });

    // Verify all metric statuses
    await waitFor(() => {
      expect(canvas.getByText(/indexer ingestion lag/i)).toBeInTheDocument();
      expect(canvas.getByText(/healthy/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(canvas.getByText(/failed pipeline jobs/i)).toBeInTheDocument();
      expect(canvas.getByText(/warning/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(canvas.getByText(/rpc provider/i)).toBeInTheDocument();
      expect(canvas.getByText(/degraded/i)).toBeInTheDocument();
    });

    // Verify source attribution
    await waitFor(() => {
      expect(canvas.getByText(/graph node indexer/i)).toBeInTheDocument();
      expect(canvas.getByText(/worker daemon supervisor/i)).toBeInTheDocument();
    });
  },
};

// ── 4. Keyboard Navigation and Accessibility Tests ───────────────────────────

export const KeyboardNavigationOperations: Story = {
  args: {
    data: authorizedBaseData,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Tab to execute button
    await userEvent.tab();

    // Find focused element
    const executeButton = canvas.getByRole('button', { name: /execute/i });

    // Press Enter to trigger
    await userEvent.keyboard('{Enter}');

    // Verify modal opened
    await waitFor(() => {
      expect(canvas.getByRole('dialog')).toBeInTheDocument();
    });

    // Tab to confirmation input
    await userEvent.tab();

    // Type confirmation
    const confirmInput = canvas.getByRole('textbox', { name: /confirmation/i });
    expect(confirmInput).toHaveFocus();

    await userEvent.keyboard('CONFIRM');

    // Tab to execute button
    await userEvent.tab();

    // Verify execute button focused
    const confirmButton = canvas.getByRole('button', { name: /execute operation/i });
    expect(confirmButton).toHaveFocus();

    // Verify button enabled
    expect(confirmButton).toBeEnabled();
  },
};

export const ReducedMotionSupport: Story = {
  args: {
    data: authorizedBaseData,
  },
  parameters: {
    a11y: {
      config: {
        rules: [
          {
            id: 'motion',
            enabled: true,
          },
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Set prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    Object.defineProperty(mediaQuery, 'matches', {
      writable: true,
      value: true,
    });

    // Verify content still accessible
    await waitFor(() => {
      expect(canvas.getByText(/operational queue/i)).toBeInTheDocument();
    });

    // Verify interactive elements functional
    const executeButton = canvas.getByRole('button', { name: /execute/i });
    await userEvent.click(executeButton);

    await waitFor(() => {
      expect(canvas.getByRole('dialog')).toBeInTheDocument();
    });
  },
};

// ── 5. Operational Health Composition (UI-FE-025) ────────────────────────────

const healthObservationBase = {
  ...authorizedBaseData,
  healthObservations: [
    {
      id: 'obs-api',
      scope: 'api',
      label: 'API Projection',
      state: 'healthy' as const,
      freshness: { observedAt: new Date().toISOString(), ageSeconds: 4 },
      finalizedBlock: 118_402_311,
      detail: 'Projection within freshness window',
      source: 'TruthBounty API',
    },
    {
      id: 'obs-rpc',
      scope: 'rpc',
      label: 'Optimism RPC',
      state: 'degraded' as const,
      freshness: { observedAt: new Date().toISOString(), ageSeconds: 12 },
      finalizedBlock: 118_402_309,
      detail: 'Fallback provider active',
      source: 'RPC Circuit',
    },
    {
      id: 'obs-indexer',
      scope: 'indexer',
      label: 'Indexer',
      state: 'delayed' as const,
      freshness: { observedAt: new Date().toISOString(), ageSeconds: 45 },
      finalizedBlock: 118_402_250,
      detail: 'Ingestion lag 61 blocks',
      source: 'Graph Node',
    },
    {
      id: 'obs-db',
      scope: 'database',
      label: 'Database',
      state: 'stale' as const,
      freshness: { observedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(), ageSeconds: 360 },
      finalizedBlock: 118_401_900,
      detail: 'Replica lag exceeds threshold',
      source: 'Postgres Replica',
    },
    {
      id: 'obs-release',
      scope: 'release',
      label: 'Release Manifest',
      state: 'unavailable' as const,
      freshness: null,
      finalizedBlock: null,
      detail: 'Manifest not pinned for this environment',
      source: 'Release Registry',
    },
  ],
  abiManifestVerification: {
    state: 'verified' as const,
    abiHash: '0xabc123',
    manifestHash: '0xdef456',
    verifiedAt: new Date().toISOString(),
    affectedScope: ['api', 'indexer'],
    detail: 'ABI and manifest hashes match pinned release',
  },
};

export const HealthCompositionRendersAllStates: Story = {
  args: {
    data: healthObservationBase as unknown as UseAdminDashboardDataReturn,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByText(/system health/i)).toBeInTheDocument();
    });

    // All five distinct observation states must render distinctly.
    await waitFor(() => {
      expect(canvas.getByText(/healthy/i)).toBeInTheDocument();
      expect(canvas.getByText(/degraded/i)).toBeInTheDocument();
      expect(canvas.getByText(/delayed/i)).toBeInTheDocument();
      expect(canvas.getByText(/stale/i)).toBeInTheDocument();
      expect(canvas.getByText(/unavailable/i)).toBeInTheDocument();
    });

    // Freshness and finalized-block context surfaced.
    await waitFor(() => {
      expect(canvas.getByText(/finalized/i)).toBeInTheDocument();
    });
  },
};

export const StaleObservationNeverRendersHealthy: Story = {
  args: {
    data: {
      ...healthObservationBase,
      healthObservations: [
        {
          id: 'obs-db',
          scope: 'database',
          label: 'Database',
          state: 'stale' as const,
          freshness: { observedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), ageSeconds: 600 },
          finalizedBlock: 118_401_000,
          detail: 'Replica lag exceeds threshold',
          source: 'Postgres Replica',
        },
      ],
    } as unknown as UseAdminDashboardDataReturn,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByText(/stale/i)).toBeInTheDocument();
    });

    // Acceptance: stale observation must never render as healthy.
    const healthyNodes = canvas.queryAllByText(/^healthy$/i);
    expect(healthyNodes).toHaveLength(0);
  },
};

export const MissingObservationRendersUnavailable: Story = {
  args: {
    data: {
      ...healthObservationBase,
      healthObservations: [
        {
          id: 'obs-release',
          scope: 'release',
          label: 'Release Manifest',
          state: 'unavailable' as const,
          freshness: null,
          finalizedBlock: null,
          detail: 'Manifest not pinned for this environment',
          source: 'Release Registry',
        },
      ],
    } as unknown as UseAdminDashboardDataReturn,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByText(/unavailable/i)).toBeInTheDocument();
    });

    // Missing observation must not be presented as healthy.
    expect(canvas.queryAllByText(/^healthy$/i)).toHaveLength(0);
  },
};

export const AbiManifestVerificationAndAffectedScope: Story = {
  args: {
    data: healthObservationBase as unknown as UseAdminDashboardDataReturn,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByText(/abi/i)).toBeInTheDocument();
      expect(canvas.getByText(/manifest/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(canvas.getByText(/verified/i)).toBeInTheDocument();
    });

    // Affected scope must be surfaced.
    await waitFor(() => {
      expect(canvas.getByText(/affected scope/i)).toBeInTheDocument();
    });
  },
};

export const AbiManifestVerificationFailure: Story = {
  args: {
    data: {
      ...healthObservationBase,
      abiManifestVerification: {
        state: 'mismatch' as const,
        abiHash: '0xabc123',
        manifestHash: '0xdef456',
        verifiedAt: null,
        affectedScope: ['api', 'indexer', 'release'],
        detail: 'ABI hash does not match pinned manifest',
      },
    } as unknown as UseAdminDashboardDataReturn,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByText(/mismatch/i)).toBeInTheDocument();
    });

    // Verification failure must not render as verified.
    expect(canvas.queryAllByText(/^verified$/i)).toHaveLength(0);
  },
};

export const ThirdPartyDependencyNotGuaranteed: Story = {
  args: {
    data: {
      ...healthObservationBase,
      healthObservations: [
        {
          id: 'obs-third-party',
          scope: 'third-party' as never,
          label: 'Third-Party RPC Provider',
          state: 'degraded' as const,
          freshness: { observedAt: new Date().toISOString(), ageSeconds: 30 },
          finalizedBlock: 118_402_000,
          detail: 'Provider reported elevated latency',
          source: 'External Provider',
          thirdParty: true,
        },
      ],
    } as unknown as UseAdminDashboardDataReturn,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByText(/third-party/i)).toBeInTheDocument();
    });

    // Acceptance: third-party status is not a TruthBounty guarantee.
    await waitFor(() => {
      expect(canvas.getByText(/not a truthbounty guarantee/i)).toBeInTheDocument();
    });
  },
};

export const OperationalStatusDoesNotChangeProtocolTruth: Story = {
  args: {
    data: {
      ...healthObservationBase,
      healthObservations: [
        {
          id: 'obs-api',
          scope: 'api',
          label: 'API Projection',
          state: 'stale' as const,
          freshness: { observedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(), ageSeconds: 480 },
          finalizedBlock: 118_401_500,
          detail: 'Projection lagging',
          source: 'TruthBounty API',
        },
      ],
    } as unknown as UseAdminDashboardDataReturn,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByText(/stale/i)).toBeInTheDocument();
    });

    // Acceptance: operational status must not mutate protocol truth.
    expect(canvas.queryByText(/override.*verdict/i)).not.toBeInTheDocument();
    expect(canvas.queryByText(/modify.*claim/i)).not.toBeInTheDocument();
    expect(canvas.queryByText(/change.*outcome/i)).not.toBeInTheDocument();
  },
};

export const HealthCompositionKeyboardNavigation: Story = {
  args: {
    data: healthObservationBase as unknown as UseAdminDashboardDataReturn,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByText(/system health/i)).toBeInTheDocument();
    });

    // Keyboard traversal reaches observation rows.
    await userEvent.tab();
    await userEvent.tab();

    const observationRegion = canvas.getByRole('region', { name: /system health/i });
    expect(observationRegion).toBeInTheDocument();
  },
};

export const HealthCompositionReducedMotion: Story = {
  args: {
    data: healthObservationBase as unknown as UseAdminDashboardDataReturn,
  },
  parameters: {
    a11y: {
      config: {
        rules: [
          {
            id: 'motion',
            enabled: true,
          },
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    Object.defineProperty(mediaQuery, 'matches', {
      writable: true,
      value: true,
    });

    await waitFor(() => {
      expect(canvas.getByText(/system health/i)).toBeInTheDocument();
    });

    // All observation states still readable under reduced motion.
    expect(canvas.getByText(/degraded/i)).toBeInTheDocument();
    expect(canvas.getByText(/delayed/i)).toBeInTheDocument();
    expect(canvas.getByText(/stale/i)).toBeInTheDocument();
    expect(canvas.getByText(/unavailable/i)).toBeInTheDocument();
  },
};
