import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { TermsSection } from './TermsSection';
import type { TermsClause } from '@/app/types/terms';

const mockApprovedClause: TermsClause = {
  id: 'eligibility',
  title: 'Eligibility',
  content: `1.1. To participate in the TruthBounty testnet ("Testnet"), you must be at least 18 years of age and have legal capacity to enter into binding agreements.

1.2. You must not be a resident of, or ordinarily resident in, any jurisdiction where participation in decentralized protocols or testnet activities is prohibited by applicable law.

1.3. You must have a compatible Ethereum wallet (e.g., MetaMask, Rainbow, Coinbase Wallet) configured for the Optimism Sepolia testnet (Chain ID: 11155420).

1.4. Testnet participation does not confer any ownership rights, equity, or financial interest in the TruthBounty protocol or its affiliates.

1.5. Testnet tokens (e.g., Sepolia ETH, test TBNT) have no monetary value and cannot be exchanged for mainnet assets.`,
  status: 'approved',
  lastReviewedAt: '2026-01-15T00:00:00.000Z',
};

const mockReviewClause: TermsClause = {
  id: 'staking-rewards-disputes',
  title: 'Staking, Rewards & Disputes',
  content: `4.1. Testnet staking uses testnet tokens with no monetary value. Rewards are simulated and not redeemable.

4.2. Staking mechanics on Testnet may differ from mainnet for testing purposes. Parameters (APY, lock periods, slashing) are subject to change.

4.3. Disputes on Testnet are resolved by automated or simulated verifiers. Outcomes do not set precedent for mainnet.

4.4. Slashing conditions on Testnet are experimental and may be triggered by test scenarios. No real value is at risk.

4.5. Reward calculations on Testnet use simplified formulas. Mainnet rewards follow the production economic model.`,
  status: 'review',
  reviewerNotes: 'Pending final testnet economic parameters from protocol team.',
};

const mockUnavailableClause: TermsClause = {
  id: 'governing-law',
  title: 'Governing Law',
  content: `9.1. These Testnet Terms are governed by the laws of the Cayman Islands, without regard to conflict of laws principles.

9.2. Any dispute arising from Testnet use shall be resolved exclusively by the courts of the Cayman Islands.`,
  status: 'unavailable',
};

const meta = {
  title: 'Features/Terms/TermsSection',
  component: TermsSection,
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
    sectionId: {
      control: 'text',
      description: 'Section identifier from TERMS_SECTIONS',
    },
  },
} satisfies Meta<typeof TermsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ApprovedTestnet: Story = {
  args: {
    clause: mockApprovedClause,
    sectionId: 'eligibility',
    network: 'testnet',
  },
};

export const ApprovedMainnet: Story = {
  args: {
    clause: mockApprovedClause,
    sectionId: 'eligibility',
    network: 'mainnet',
  },
};

export const UnderReview: Story = {
  args: {
    clause: mockReviewClause,
    sectionId: 'staking-rewards-disputes',
    network: 'mainnet',
  },
};

export const Unavailable: Story = {
  args: {
    clause: mockUnavailableClause,
    sectionId: 'governing-law',
    network: 'testnet',
  },
};

export const WithReviewerNotes: Story = {
  args: {
    clause: {
      ...mockReviewClause,
      reviewerNotes: 'Legal team reviewing staking slashing conditions. Expected completion: 2026-02-15.',
    },
    sectionId: 'staking-rewards-disputes',
    network: 'mainnet',
  },
};

export const LongContent: Story = {
  args: {
    clause: {
      ...mockApprovedClause,
      content: Array(20).fill(mockApprovedClause.content).join('\n\n'),
    },
    sectionId: 'eligibility',
    network: 'testnet',
  },
};