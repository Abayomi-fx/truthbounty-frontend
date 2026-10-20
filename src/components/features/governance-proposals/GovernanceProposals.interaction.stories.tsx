import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect, waitFor } from '@storybook/test';
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
  title: 'Features/GovernanceProposals/Interactions',
  component: GovernanceProposalsSection,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof GovernanceProposalsSection>;

/**
 * 1. Filter selection interaction: user clicks 'Active' tab
 */
export const FilterSelectionInteraction: Story = {
  args: {
    options: {
      ...baseAuthorizedOptions,
      initialSelectedId: null,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify all filter tabs exist
    const activeTab = canvas.getByRole('tab', { name: /Active/i });
    expect(activeTab).toBeInTheDocument();
    expect(activeTab).toHaveAttribute('aria-selected', 'false');

    // Click 'Active' tab
    await userEvent.click(activeTab);

    // Verify tab is selected
    expect(activeTab).toHaveAttribute('aria-selected', 'true');
  },
};

/**
 * 2. Search query interaction: user searches for proposal
 */
export const SearchFilterInteraction: Story = {
  args: {
    options: {
      ...baseAuthorizedOptions,
      initialSelectedId: null,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const searchInput = canvas.getByPlaceholderText(/Search title, target, ID/i);
    expect(searchInput).toBeInTheDocument();

    await userEvent.type(searchInput, 'TB-PROP-002');
    expect(searchInput).toHaveValue('TB-PROP-002');

    // Check clear button appears
    const clearBtn = canvas.getByRole('button', { name: /Clear search input/i });
    expect(clearBtn).toBeInTheDocument();

    await userEvent.click(clearBtn);
    expect(searchInput).toHaveValue('');
  },
};

/**
 * 3. Select proposal from register to show detail
 */
export const SelectProposalInteraction: Story = {
  args: {
    options: {
      ...baseAuthorizedOptions,
      initialSelectedId: null,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Initial register view
    const proposalCard = canvas.getByTestId('proposal-item-TB-PROP-002');
    expect(proposalCard).toBeInTheDocument();

    // Click to select
    await userEvent.click(proposalCard);

    // Detail card should be rendered
    await waitFor(() => {
      expect(canvas.getByTestId('proposal-detail-card')).toBeInTheDocument();
      expect(canvas.getByRole('heading', { level: 1, name: /Adjust Dispute Minimum Bond Parameters/i })).toBeInTheDocument();
    });
  },
};

/**
 * 4. Calldata copy button interaction
 */
export const CalldataCopyInteraction: Story = {
  args: {
    options: {
      ...baseAuthorizedOptions,
      initialSelectedId: 'TB-PROP-002',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const copyBtn = canvas.getByRole('button', { name: /Copy calldata for call #1/i });
    expect(copyBtn).toBeInTheDocument();

    await userEvent.click(copyBtn);
  },
};

/**
 * 5. Canonical receipt modal trigger interaction
 */
export const CanonicalReceiptModalInteraction: Story = {
  args: {
    options: {
      ...baseAuthorizedOptions,
      testProposalsOverride: [
        makeGovernanceProposal({
          ctx,
          state: 'active',
          proposalNumber: 8,
          overrides: {
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const inspectBtn = canvas.getByRole('button', { name: /Inspect Canonical Receipt/i });
    expect(inspectBtn).toBeInTheDocument();

    await userEvent.click(inspectBtn);

    // Modal dialog opens
    const dialog = within(document.body).getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Cryptographic Action Receipt/i)).toBeInTheDocument();

    // Close button dismisses modal
    const closeBtn = within(dialog).getByRole('button', { name: /Close receipt dialog/i });
    await userEvent.click(closeBtn);
  },
};

/**
 * 6. Action execution interaction: user executes proposal
 */
export const ActionExecutionInteraction: Story = {
  args: {
    options: {
      ...baseAuthorizedOptions,
      initialSelectedId: 'TB-PROP-005', // Executable proposal
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const executeBtn = canvas.getByTestId('execute-proposal-button');
    expect(executeBtn).toBeInTheDocument();
    expect(executeBtn).not.toBeDisabled();

    await userEvent.click(executeBtn);

    // Success feedback alert appears
    await waitFor(() => {
      expect(canvas.getByTestId('proposal-feedback-alert')).toBeInTheDocument();
    });
  },
};
