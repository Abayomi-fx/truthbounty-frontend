import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import '@/app/globals.css';
import { TransactionCenter } from './TransactionCenter';
import { transactionFixture } from './stories/fixtures';

const meta = {
  title: 'Compositions/Transaction center',
  component: TransactionCenter,
  parameters: {
    layout: 'fullscreen',
    chromatic: { viewports: [1440, 768, 390] },
  },
  args: { records: [transactionFixture()], onRefresh: fn() },
} satisfies Meta<typeof TransactionCenter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Submitted: Story = {};
export const Idle: Story = { args: { records: [transactionFixture('idle')] } };
export const Validating: Story = {
  args: { records: [transactionFixture('preparing')] },
};
export const AwaitingSignature: Story = {
  args: { records: [transactionFixture('signature-requested')] },
};
export const Confirming: Story = {
  args: { records: [transactionFixture('confirming')] },
};
export const Confirmed: Story = {
  args: { records: [transactionFixture('safe')] },
};
export const Finalized: Story = {
  args: { records: [transactionFixture('finalized')] },
};
export const ProjectionLag: Story = {
  args: { records: [transactionFixture('indexing')] },
};
export const Reverted: Story = {
  args: { records: [transactionFixture('reverted')] },
};
export const Dropped: Story = {
  args: { records: [transactionFixture('dropped')] },
};
export const Reorged: Story = {
  args: { records: [transactionFixture('reorged')] },
};
export const Unavailable: Story = {
  args: { records: [], state: 'unavailable' },
};
export const Offline: Story = {
  args: {
    records: [transactionFixture('submitted', 'local-reference')],
    state: 'offline',
  },
};
export const Rejected: Story = {
  args: {
    records: [
      {
        ...transactionFixture('idle'),
        authorization: 'rejected',
        label:
          'Authorization rejected. No transaction submitted; recoverable input preserved.',
      },
    ],
  },
};
export const Replaced: Story = {
  args: { records: [transactionFixture('replaced')] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByText('Recovery details for Withdraw 12.00 USDC'),
    );
    await expect(
      canvas.getByRole('link', { name: /Follow replacement transaction/ }),
    ).toHaveAttribute('href', expect.stringContaining('cd'.repeat(32)));
  },
};
export const ReloadRecovery: Story = {
  args: { records: [transactionFixture('finalized', 'local-reference')] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Reconciliation required')).toBeVisible();
    await expect(
      canvas.queryByText('Transaction finalized.'),
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByText('Recovery details for Withdraw 12.00 USDC'),
    );
    await expect(
      canvas.getByRole('link', { name: /View transaction receipt/ }),
    ).toBeVisible();
  },
};

export const Dark: Story = {
  args: {
    records: [
      transactionFixture('finalized'),
      {
        ...transactionFixture('reorged'),
        id: 'reorg',
        label: 'Reorged withdrawal',
      },
    ],
  },
  decorators: [
    (Story) => (
      <div className="dark bg-canvas p-4">
        <Story />
      </div>
    ),
  ],
};
