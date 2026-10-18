import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import '@/app/globals.css';
import { RewardsCenter } from './RewardsCenter';
import { rewardsFixture, transactionFixture } from './stories/fixtures';

const meta = {
  title: 'Compositions/Rewards center',
  component: RewardsCenter,
  parameters: {
    layout: 'fullscreen',
    chromatic: { viewports: [1440, 768, 390] },
  },
  args: {
    data: rewardsFixture,
    transactions: [transactionFixture('confirming')],
    onRefresh: fn(),
  },
} satisfies Meta<typeof RewardsCenter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AllOutcomes: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Review withdrawal' }),
    ).toBeDisabled();
    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'Outcome' }),
      'slashed',
    );
    await expect(
      canvas.getByRole('heading', { name: 'Slashed stake' }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole('heading', { name: 'Verifier reward' }),
    ).not.toBeInTheDocument();
    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'Outcome' }),
      'all',
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Refresh references' }),
    );
    await expect(args.onRefresh).toHaveBeenCalledOnce();
  },
};
export const Loading: Story = {
  args: {
    data: {
      ...rewardsFixture,
      state: 'loading',
      entries: [],
      receivedAt: null,
    },
  },
};
export const Empty: Story = {
  args: { data: { ...rewardsFixture, state: 'empty', entries: [] } },
};
export const Stale: Story = {
  args: { data: { ...rewardsFixture, state: 'stale' } },
};
export const Offline: Story = {
  args: { data: { ...rewardsFixture, state: 'offline' } },
};
export const Unavailable: Story = {
  args: { data: { ...rewardsFixture, state: 'unavailable', entries: [] } },
};
export const Error: Story = {
  args: { data: { ...rewardsFixture, state: 'error', entries: [] } },
};
export const Denied: Story = {
  args: { data: { ...rewardsFixture, state: 'denied', entries: [] } },
};
export const NotFound: Story = {
  args: { data: { ...rewardsFixture, state: 'not-found', entries: [] } },
};
export const PartialProjection: Story = {
  args: { data: { ...rewardsFixture, rejectedCount: 1 } },
};
export const ProjectionLag: Story = {
  args: {
    data: {
      ...rewardsFixture,
      entries: [
        {
          ...rewardsFixture.entries[0],
          source: {
            kind: 'api-projection',
            receivedAt: rewardsFixture.receivedAt,
            freshness: 'projection-lag',
          },
        },
      ],
    },
  },
};
export const LargeExactAmount: Story = {
  args: {
    data: {
      ...rewardsFixture,
      entries: [
        {
          ...rewardsFixture.entries[1],
          amount: '9007199254740993.123456789012345678',
        },
      ],
    },
  },
};
export const UntrustedClaimableEstimate: Story = {
  args: {
    data: {
      ...rewardsFixture,
      entries: [{ ...rewardsFixture.entries[0], outcome: 'claimable' }],
    },
  },
};
export const Dark: Story = {
  decorators: [
    (Story) => (
      <div className="dark bg-canvas p-4">
        <Story />
      </div>
    ),
  ],
};
