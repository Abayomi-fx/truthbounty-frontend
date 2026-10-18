import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { TermsVersionSelector } from './TermsVersionSelector';
import type { TermsVersion } from '@/app/types/terms';

const mockVersions: TermsVersion[] = [
  {
    version: '1.0.0',
    effectiveDate: '2026-01-15',
    materialChanges: 'Initial testnet terms publication.',
    network: 'testnet',
    clauses: [],
    status: 'published',
    publishedAt: '2026-01-15T00:00:00.000Z',
    source: 'board',
  },
  {
    version: '1.1.0',
    effectiveDate: '2026-06-01',
    materialChanges: 'Updated staking parameters and dispute resolution process.',
    previousVersion: '1.0.0',
    network: 'testnet',
    clauses: [],
    status: 'published',
    publishedAt: '2026-06-01T00:00:00.000Z',
    source: 'board',
  },
  {
    version: '2.0.0',
    effectiveDate: '2026-12-01',
    materialChanges: 'Major revision for mainnet launch. New governance process, updated liability limits, revised dispute resolution.',
    previousVersion: '1.1.0',
    network: 'testnet',
    clauses: [],
    status: 'draft',
    source: 'board',
  },
];

const mainnetVersions: TermsVersion[] = [
  {
    version: '1.0.0',
    effectiveDate: '2026-06-01',
    materialChanges: 'Initial mainnet terms publication following governance approval.',
    network: 'mainnet',
    clauses: [],
    status: 'published',
    publishedAt: '2026-06-01T00:00:00.000Z',
    source: 'governance',
  },
  {
    version: '1.1.0',
    effectiveDate: '2026-09-01',
    materialChanges: 'Updated reward parameters per governance proposal #42. Adjusted slashing conditions.',
    previousVersion: '1.0.0',
    network: 'mainnet',
    clauses: [],
    status: 'published',
    publishedAt: '2026-09-01T00:00:00.000Z',
    source: 'governance',
  },
  {
    version: '2.0.0',
    effectiveDate: '2027-01-01',
    materialChanges: 'Proposed major revision: new staking mechanics, updated governance process.',
    previousVersion: '1.1.0',
    network: 'mainnet',
    clauses: [],
    status: 'draft',
    source: 'governance',
  },
];

const meta = {
  title: 'Features/Terms/TermsVersionSelector',
  component: TermsVersionSelector,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    network: {
      control: 'select',
      options: ['testnet', 'mainnet'],
      description: 'Network type for the terms',
    },
    currentVersion: {
      control: 'text',
      description: 'Currently selected version',
    },
  },
} satisfies Meta<typeof TermsVersionSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TestnetVersions: Story = {
  args: {
    versions: mockVersions,
    currentVersion: '1.1.0',
    network: 'testnet',
    onVersionChange: fn(),
  },
};

export const MainnetVersions: Story = {
  args: {
    versions: mainnetVersions,
    currentVersion: '1.0.0',
    network: 'mainnet',
    onVersionChange: fn(),
  },
};

export const SingleVersion: Story = {
  args: {
    versions: [mockVersions[0]],
    currentVersion: '1.0.0',
    network: 'testnet',
    onVersionChange: fn(),
  },
};

export const ManyVersions: Story = {
  args: {
    versions: [
      ...mockVersions,
      { ...mockVersions[0], version: '0.9.0', effectiveDate: '2025-11-01', materialChanges: 'Alpha release.', status: 'published', publishedAt: '2025-11-01T00:00:00.000Z', source: 'board' },
      { ...mockVersions[0], version: '0.8.0', effectiveDate: '2025-10-01', materialChanges: 'Pre-alpha.', status: 'published', publishedAt: '2025-10-01T00:00:00.000Z', source: 'board' },
      { ...mockVersions[2], version: '2.1.0', effectiveDate: '2027-03-01', materialChanges: 'Post-launch adjustments.', status: 'draft', source: 'board' },
    ],
    currentVersion: '1.1.0',
    network: 'testnet',
    onVersionChange: fn(),
  },
};

export const AllDrafts: Story = {
  args: {
    versions: [
      { ...mockVersions[2], version: '2.0.0' },
      { ...mockVersions[2], version: '2.1.0', materialChanges: 'Another draft.' },
    ],
    currentVersion: '2.0.0',
    network: 'testnet',
    onVersionChange: fn(),
  },
};