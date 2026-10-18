import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { userEvent } from '@storybook/testing-library';
import { StakeEffectiveWeightReview, type StakeEffectiveWeightReviewProps } from './StakeEffectiveWeightReview';

const baseInputs = {
  rawStakeWei: '100000000000000000000',
  reputationAdjustmentWei: '25000000000000000000',
  effectiveWeightWei: '125000000000000000000',
  rewardMinWei: '5000000000000000000',
  rewardMaxWei: '20000000000000000000',
  slashingExposureWei: '100000000000000000000',
  chainId: 10,
  contractAddress: '0x1234567890123456789012345678901234567890',
  blockNumber: BigInt(12345678),
  blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
} as const;

const meta: Meta<typeof StakeEffectiveWeightReview> = {
  title: 'Features/Verification/StakeEffectiveWeightReview/Interaction',
  component: StakeEffectiveWeightReview,
};

export default meta;

type Story = StoryObj<typeof StakeEffectiveWeightReview>;

const defaultArgs: StakeEffectiveWeightReviewProps = {
  inputs: baseInputs,
  freshness: 'fresh',
  isPinned: true,
  actionLabel: 'Verify claim',
};

export const RendersLosslessValuesAndUnits: Story = {
  args: defaultArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('100 EBT')).toBeInTheDocument();
    await expect(await canvas.findByText('25 EBT')).toBeInTheDocument();
    await expect(await canvas.findByText('125 EBT')).toBeInTheDocument();
    await expect(await canvas.findByText('5 – 20 EBT')).toBeInTheDocument();
  },
};

export const AcknowledgeReview: Story = {
  args: { ...defaultArgs, onAcknowledge: jest.fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();
    const button = canvas.getByRole('button', { name: /acknowledge review/i });
    await expect(button).toBeEnabled();
    await user.click(button);
    await expect(args.onAcknowledge).toHaveBeenCalled();
    await expect(canvas.getByText('Review acknowledged')).toBeInTheDocument();
  },
};

export const StaleDisablesAcknowledge: Story = {
  args: { ...defaultArgs, freshness: 'stale' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /acknowledge review/i });
    await expect(button).toBeDisabled();
    await expect(canvas.getByText('Contract projection is stale.')).toBeInTheDocument();
  },
};

export const UnavailableDisabledAcknowledge: Story = {
  args: { ...defaultArgs, inputs: null, freshness: 'unavailable' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /acknowledge review/i });
    await expect(button).toBeDisabled();
  },
};

export const InconsistentDisablesAcknowledge: Story = {
  args: {
    ...defaultArgs,
    inputs: { ...baseInputs, effectiveWeightWei: '100000000000000000000' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /acknowledge review/i });
    await expect(button).toBeDisabled();
    await expect(
      canvas.getByText('Effective weight does not match raw stake plus adjustment.'),
    ).toBeInTheDocument();
  },
};

export const ChangedInvalidatesReview: Story = {
  args: { ...defaultArgs, isPinned: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /acknowledge review/i });
    await expect(button).toBeDisabled();
    await expect(
      canvas.getByText('Contract inputs changed before authorization.'),
    ).toBeInTheDocument();
  },
};

export const KeyboardAcknowledge: Story = {
  args: { ...defaultArgs, onAcknowledge: jest.fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();
    const button = canvas.getByRole('button', { name: /acknowledge review/i });
    button.focus();
    await expect(button).toHaveFocus();
    await user.keyboard('{ }');
    await expect(args.onAcknowledge).toHaveBeenCalled();
  },
};
