import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  VerifierDisputeJourney,
  type JourneyScenario,
} from './VerifierDisputeJourney';

const SCENARIOS: JourneyScenario[] = [
  'eligible-commit',
  'ineligible',
  'reveal-open',
  'missed-reveal',
  'wrong-salt',
  'replaced',
  'slashed',
  'tie-refund',
  'expired-dispute',
  'indexing-delay',
  'reorg',
  'appeal-open',
  'appeal-resolved',
];

const meta = {
  title: 'Testing/Verifier and dispute journey',
  component: VerifierDisputeJourney,
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
    scenario: 'eligible-commit',
  },
} satisfies Meta<typeof VerifierDisputeJourney>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EligibleCommit: Story = {
  args: { scenario: 'eligible-commit' },
};

export const Ineligible: Story = {
  args: { scenario: 'ineligible' },
};

export const RevealOpen: Story = {
  args: { scenario: 'reveal-open' },
};

export const MissedReveal: Story = {
  args: { scenario: 'missed-reveal' },
};

export const WrongSalt: Story = {
  args: { scenario: 'wrong-salt' },
};

export const Replaced: Story = {
  args: { scenario: 'replaced' },
};

export const Slashed: Story = {
  args: { scenario: 'slashed' },
};

export const TieRefund: Story = {
  args: { scenario: 'tie-refund' },
};

export const ExpiredDispute: Story = {
  args: { scenario: 'expired-dispute' },
};

export const IndexingDelay: Story = {
  args: { scenario: 'indexing-delay' },
};

export const Reorg: Story = {
  args: { scenario: 'reorg' },
};

export const AppealOpen: Story = {
  args: { scenario: 'appeal-open' },
};

export const AppealResolved: Story = {
  args: { scenario: 'appeal-resolved' },
};
