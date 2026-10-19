import type { Meta, StoryObj } from '@storybook/react';
import { StakeEffectiveWeightReview, type StakeEffectiveWeightReviewProps } from './StakeEffectiveWeightReview';

const baseInputs: NonNullable<StakeEffectiveWeightReviewProps['inputs']> = {
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
};

const meta: Meta<typeof StakeEffectiveWeightReview> = {
  title: 'Features/Verification/StakeEffectiveWeightReview',
  component: StakeEffectiveWeightReview,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof StakeEffectiveWeightReview>;

const defaultArgs: StakeEffectiveWeightReviewProps = {
  inputs: baseInputs,
  freshness: 'fresh',
  isPinned: true,
  actionLabel: 'Verify claim',
};

export const Ready: Story = {
  args: defaultArgs,
};

export const Stale: Story = {
  args: { ...defaultArgs, freshness: 'stale' },
};

export const Unavailable: Story = {
  args: { ...defaultArgs, inputs: null, freshness: 'unavailable' },
};

export const Inconsistent: Story = {
  args: {
    ...defaultArgs,
    inputs: { ...baseInputs, effectiveWeightWei: '100000000000000000000' },
  },
};

export const ChangedBeforeAuthorization: Story = {
  args: { ...defaultArgs, isPinned: false },
};

export const Zoom200: Story = {
  args: defaultArgs,
};