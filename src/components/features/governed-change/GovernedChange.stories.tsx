import type { Meta, StoryObj } from '@storybook/react';

import { makeGovernedChangeSnapshot } from '@/testing/fixtures';

import { GovernedChangePreparation } from './GovernedChangePreparation';
import { TimelockExecutionReview } from './TimelockExecutionReview';

/**
 * UI-FE-029 — Governed change preparation and timelock execution review.
 *
 * Every story is driven by the deterministic governed-change fixture so the
 * Storybook and Jest surfaces stay interchangeable.
 */
const meta: Meta<typeof GovernedChangePreparation> = {
  title: 'Features/GovernedChange',
  component: GovernedChangePreparation,
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof GovernedChangePreparation>;

export const PreparationReady: Story = {
  args: {
    snapshot: makeGovernedChangeSnapshot(),
  },
};

export const PreparationBlockedRollback: Story = {
  args: {
    snapshot: makeGovernedChangeSnapshot({
      input: {
        rollback: {
          steps: ['Restore the previous threshold via a new timelock proposal.'],
          verified: false,
          evidence: null,
        },
      },
    }),
  },
};

export const PreparationUnavailable: Story = {
  args: {
    snapshot: makeGovernedChangeSnapshot({
      input: { surfaceState: 'unavailable' },
    }),
  },
};

export const ExecutionReady: StoryObj<typeof TimelockExecutionReview> = {
  render: () => <TimelockExecutionReview snapshot={makeGovernedChangeSnapshot()} />,
};

export const ExecutionPendingDelay: StoryObj<typeof TimelockExecutionReview> = {
  render: () => (
    <TimelockExecutionReview
      snapshot={makeGovernedChangeSnapshot({
        input: {
          proposal: {
            id: '0x8f2c1a5b6d4e3f20112233445566778899aabbccddeeff001122334455667788',
            earliestExecution: new Date(
              Date.parse(
                makeGovernedChangeSnapshot().timelock.earliestExecution as string,
              ) + 3_600_000,
            ).toISOString(),
            delaySeconds: 172_800,
            blockNumber: 6_188_421,
          },
        },
      })}
    />
  ),
};

export const ExecutionNotQueued: StoryObj<typeof TimelockExecutionReview> = {
  render: () => (
    <TimelockExecutionReview
      snapshot={makeGovernedChangeSnapshot({ input: { proposal: null } })}
    />
  ),
};

export const ExecutionWrongChain: StoryObj<typeof TimelockExecutionReview> = {
  render: () => (
    <TimelockExecutionReview
      snapshot={makeGovernedChangeSnapshot({ input: { currentChainId: 1 } })}
    />
  ),
};

export const ExecutionReorged: StoryObj<typeof TimelockExecutionReview> = {
  render: () => (
    <TimelockExecutionReview
      snapshot={makeGovernedChangeSnapshot({
        input: {
          execution: {
            status: 'reorged',
            txHash: '0xdead00000000000000000000000000000000000000000000000000000000beef',
          },
        },
      })}
    />
  ),
};

export const ExecutionAuthorityRevoked: StoryObj<typeof TimelockExecutionReview> = {
  render: () => (
    <TimelockExecutionReview
      snapshot={makeGovernedChangeSnapshot()}
      revalidatedAuthority={{
        account: '0x0000000000000000000000000000000000000001',
        chainId: 11155420,
        authorized: true,
      }}
    />
  ),
};
