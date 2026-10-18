import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  SupportStatusLegalJourney,
  type SupportStatusLegalScenario,
} from './SupportStatusLegalJourney';

const SCENARIOS: SupportStatusLegalScenario[] = [
  'support-valid',
  'support-validation',
  'support-secret',
  'support-duplicate',
  'status-operational',
  'status-degraded',
  'status-stale',
  'status-unavailable',
  'status-maintenance',
  'incident-fresh',
  'incident-stale',
  'legal-current',
  'legal-stale',
  'legal-review',
  'legal-retired',
  'consent',
  'disclosures',
];

const meta = {
  title: 'Testing/Support status security and legal journey',
  component: SupportStatusLegalJourney,
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
    scenario: 'support-valid',
  },
} satisfies Meta<typeof SupportStatusLegalJourney>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SupportValid: Story = {
  args: { scenario: 'support-valid' },
};

export const SupportValidation: Story = {
  args: { scenario: 'support-validation' },
};

export const SupportSecret: Story = {
  args: { scenario: 'support-secret' },
};

export const SupportDuplicate: Story = {
  args: { scenario: 'support-duplicate' },
};

export const StatusOperational: Story = {
  args: { scenario: 'status-operational' },
};

export const StatusDegraded: Story = {
  args: { scenario: 'status-degraded' },
};

export const StatusStale: Story = {
  args: { scenario: 'status-stale' },
};

export const StatusUnavailable: Story = {
  args: { scenario: 'status-unavailable' },
};

export const StatusMaintenance: Story = {
  args: { scenario: 'status-maintenance' },
};

export const IncidentFresh: Story = {
  args: { scenario: 'incident-fresh' },
};

export const IncidentStale: Story = {
  args: { scenario: 'incident-stale' },
};

export const LegalCurrent: Story = {
  args: { scenario: 'legal-current' },
};

export const LegalStale: Story = {
  args: { scenario: 'legal-stale' },
};

export const LegalReview: Story = {
  args: { scenario: 'legal-review' },
};

export const LegalRetired: Story = {
  args: { scenario: 'legal-retired' },
};

export const Consent: Story = {
  args: { scenario: 'consent' },
};

export const Disclosures: Story = {
  args: { scenario: 'disclosures' },
};
