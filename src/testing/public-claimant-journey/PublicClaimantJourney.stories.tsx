import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  PublicClaimantJourney,
  type PublicClaimantScenario,
} from './PublicClaimantJourney';

const SCENARIOS: PublicClaimantScenario[] = [
  'happy-path',
  'wallet-rejected',
  'reverted',
  'replaced',
  'indexing-delay',
  'reorg',
  'evidence-outage',
  'reload-recovery',
  'unsupported-chain',
  'guest',
];

const meta = {
  title: 'Testing/Public and claimant journey',
  component: PublicClaimantJourney,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    scenario: {
      control: 'select',
      options: SCENARIOS,
    },
  },
  args: {
    scenario: 'happy-path',
  },
} satisfies Meta<typeof PublicClaimantJourney>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HappyPath: Story = {
  args: { scenario: 'happy-path' },
};

export const WalletRejected: Story = {
  args: { scenario: 'wallet-rejected' },
};

export const Reverted: Story = {
  args: { scenario: 'reverted' },
};

export const Replaced: Story = {
  args: { scenario: 'replaced' },
};

export const IndexingDelay: Story = {
  args: { scenario: 'indexing-delay' },
};

export const Reorg: Story = {
  args: { scenario: 'reorg' },
};

export const EvidenceOutage: Story = {
  args: { scenario: 'evidence-outage' },
};

export const ReloadRecovery: Story = {
  args: { scenario: 'reload-recovery' },
};

export const UnsupportedChain: Story = {
  args: { scenario: 'unsupported-chain' },
};

export const Guest: Story = {
  args: { scenario: 'guest' },
};
