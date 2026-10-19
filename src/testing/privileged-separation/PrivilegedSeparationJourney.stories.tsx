import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  PrivilegedSeparationJourney,
  type PrivilegedScenario,
} from './PrivilegedSeparationJourney';

const SCENARIOS: PrivilegedScenario[] = [
  'operations-authorized',
  'operation-confirmation',
  'retry',
  'denied',
  'revoked',
  'expired',
  'wrong-chain',
  'governance-authorized',
  'stale-manifest',
  'timelock-not-ready',
  'guardian-authorized',
  'guardian-overreach',
  'emergency-pause',
];

const meta = {
  title: 'Testing/Privileged separation and emergency control journey',
  component: PrivilegedSeparationJourney,
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
    scenario: 'operations-authorized',
  },
} satisfies Meta<typeof PrivilegedSeparationJourney>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OperationsAuthorized: Story = {
  args: { scenario: 'operations-authorized' },
};

export const OperationConfirmation: Story = {
  args: { scenario: 'operation-confirmation' },
};

export const Retry: Story = {
  args: { scenario: 'retry' },
};

export const Denied: Story = {
  args: { scenario: 'denied' },
};

export const Revoked: Story = {
  args: { scenario: 'revoked' },
};

export const Expired: Story = {
  args: { scenario: 'expired' },
};

export const WrongChain: Story = {
  args: { scenario: 'wrong-chain' },
};

export const GovernanceAuthorized: Story = {
  args: { scenario: 'governance-authorized' },
};

export const StaleManifest: Story = {
  args: { scenario: 'stale-manifest' },
};

export const TimelockNotReady: Story = {
  args: { scenario: 'timelock-not-ready' },
};

export const GuardianAuthorized: Story = {
  args: { scenario: 'guardian-authorized' },
};

export const GuardianOverreach: Story = {
  args: { scenario: 'guardian-overreach' },
};

export const EmergencyPause: Story = {
  args: { scenario: 'emergency-pause' },
};
