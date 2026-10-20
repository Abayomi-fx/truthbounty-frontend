import type { Meta, StoryObj } from '@storybook/react';
import { GovernanceProposalsSection } from './GovernanceProposalsSection';
import { createFixtureContext } from '@/testing/fixtures/deterministic';
import {
  makeAllProposalStatesList,
  makeGovernanceProposal,
  makeCanonicalReceiptRecord,
} from '@/testing/fixtures/factories/governance-proposals';

const ctx = createFixtureContext({ now: 1729000000000 });
const allProposals = makeAllProposalStatesList(ctx);

const baseAuthorizedOptions = {
  testProposalsOverride: allProposals,
  overrideIsConnected: true,
  overrideConnectedAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' as const,
  overrideIsAdmin: true,
  overrideIsSupportedChain: true,
  overrideIsOnline: true,
};

const meta: Meta<typeof GovernanceProposalsSection> = {
  title: 'Features/GovernanceProposals',
  component: GovernanceProposalsSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Governance proposal register and detail surface under /admin (Boards 07 & 08). Displays all 7 canonical states: draft, active, succeeded, queued, executable, expired, and cancelled. Enforces fail-closed authority, exact calls inspection, and simulation verification.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof GovernanceProposalsSection>;

/**
 * 1. Proposal Register with all 7 canonical states
 */
export const AllStatesRegister: Story = {
  args: {
    options: {
      ...baseAuthorizedOptions,
      initialSelectedId: null,
    },
  },
};

/**
 * 2. Active Proposal with voting progress and quorum
 */
export const ActiveProposalDetail: Story = {
  args: {
    options: {
      ...baseAuthorizedOptions,
      initialSelectedId: 'TB-PROP-002',
    },
  },
};

/**
 * 3. Queued Proposal with active timelock delay countdown
 */
export const QueuedProposalCountdown: Story = {
  args: {
    options: {
      ...baseAuthorizedOptions,
      initialSelectedId: 'TB-PROP-004',
    },
  },
};

/**
 * 4. Executable Proposal ready for execution (timelock elapsed)
 */
export const ExecutableTimelockElapsed: Story = {
  args: {
    options: {
      ...baseAuthorizedOptions,
      initialSelectedId: 'TB-PROP-005',
    },
  },
};

/**
 * 5. Executed Proposal with Canonical Receipt inspection
 */
export const ExecutedProposalCanonicalReceipt: Story = {
  args: {
    options: {
      ...baseAuthorizedOptions,
      testProposalsOverride: [
        makeGovernanceProposal({
          ctx,
          state: 'active',
          proposalNumber: 8,
          overrides: {
            title: 'Authorize Treasury Settlement Router (Executed)',
            receipt: {
              txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              blockNumber: '12345680',
              confirmations: 64,
              timestamp: ctx.isoAt(-3600_000),
              executedBy: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
              receipt: makeCanonicalReceiptRecord(
                ctx,
                '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              ),
            },
          },
        }),
      ],
      initialSelectedId: 'TB-PROP-008',
    },
  },
};

/**
 * 6. Missing ABI Fail-Closed Blocking Alert
 */
export const MissingAbiUnverifiedBlock: Story = {
  args: {
    options: {
      ...baseAuthorizedOptions,
      testProposalsOverride: [
        makeGovernanceProposal({
          ctx,
          state: 'active',
          proposalNumber: 9,
          overrides: {
            title: 'Unverified Proxy Upgrade (Permanently Blocked)',
            calls: [
              {
                target: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
                contractName: 'UnknownProxyImplementation',
                methodName: 'upgradeToAndCall(address,bytes)',
                selector: '0x4f1f2a3c',
                value: '0',
                parameters: [],
                calldata: '0x4f1f2a3c00000000000000000000000012345678',
                abiVerified: false,
                abiMissingReason: 'Release manifest verification failed: bytecode mismatch at address',
              },
            ],
          },
        }),
      ],
      initialSelectedId: 'TB-PROP-009',
    },
  },
};

/**
 * 7. Simulation Reverted Warning
 */
export const SimulationRevertedWarning: Story = {
  args: {
    options: {
      ...baseAuthorizedOptions,
      testProposalsOverride: [
        makeGovernanceProposal({
          ctx,
          state: 'active',
          proposalNumber: 10,
          overrides: {
            title: 'Parameter Calibration with Out-of-Bounds Bond',
            simulation: {
              status: 'revert',
              simulatedAt: ctx.isoAt(-1800_000),
              gasEstimate: '32,100 gas',
              revertReason: 'Execution reverted: MinBondExceedsCap(2000000000000000000, 1500000000000000000)',
              traceSummary: [
                'CALL TruthBountyWeighted.setMinBond(2000000000000000000)',
                'REVERT MinBondExceedsCap',
              ],
              returnValues: [],
            },
          },
        }),
      ],
      initialSelectedId: 'TB-PROP-010',
    },
  },
};

/**
 * 8. Unauthorized Explicit Denied State
 */
export const UnauthorizedDenied: Story = {
  args: {
    options: {
      ...baseAuthorizedOptions,
      overrideIsConnected: false,
      overrideConnectedAddress: null,
      overrideIsAdmin: false,
    },
  },
};

/**
 * 9. Reassuring Empty Registry State
 */
export const EmptyRegistry: Story = {
  args: {
    options: {
      ...baseAuthorizedOptions,
      testProposalsOverride: [],
      initialSelectedId: null,
    },
  },
};
