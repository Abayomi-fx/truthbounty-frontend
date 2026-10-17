import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TermsRenderer } from './TermsRenderer';
import type { TermsVersion } from '@/app/types/terms';

const mockVersion: TermsVersion = {
  version: '1.0.0',
  effectiveDate: '2026-01-15',
  materialChanges: 'Initial testnet terms publication.',
  network: 'testnet',
  clauses: [
    {
      id: 'eligibility',
      title: 'Eligibility',
      content: `1.1. To participate in the TruthBounty testnet ("Testnet"), you must be at least 18 years of age and have legal capacity to enter into binding agreements.

1.2. You must not be a resident of, or ordinarily resident in, any jurisdiction where participation in decentralized protocols or testnet activities is prohibited by applicable law.

1.3. You must have a compatible Ethereum wallet (e.g., MetaMask, Rainbow, Coinbase Wallet) configured for the Optimism Sepolia testnet (Chain ID: 11155420).

1.4. Testnet participation does not confer any ownership rights, equity, or financial interest in the TruthBounty protocol or its affiliates.

1.5. Testnet tokens (e.g., Sepolia ETH, test TBNT) have no monetary value and cannot be exchanged for mainnet assets.`,
      status: 'approved',
      lastReviewedAt: '2026-01-15T00:00:00.000Z',
    },
    {
      id: 'wallet-responsibility',
      title: 'Wallet Responsibility',
      content: `2.1. You are solely responsible for the security of your wallet, private keys, seed phrases, and any credentials used to access the Testnet.

2.2. All transactions signed by your wallet are deemed authorized by you. TruthBounty cannot reverse, cancel, or modify confirmed transactions on the Optimism Sepolia network.

2.3. You must verify transaction details (recipient, amount, gas fees, contract interactions) before signing. Blind signing is discouraged.

2.4. If your wallet is compromised, you must immediately revoke approvals and migrate assets. TruthBounty bears no liability for losses due to wallet compromise.

2.5. Use of hardware wallets (Ledger, Trezor) is strongly recommended for any testnet activity involving value.`,
      status: 'approved',
      lastReviewedAt: '2026-01-15T00:00:00.000Z',
    },
    {
      id: 'claims-evidence',
      title: 'Claims & Evidence',
      content: `3.1. Claims submitted on Testnet are for testing purposes only and do not create enforceable rights or obligations.

3.2. Evidence submitted with claims must be accurate, complete, and not misleading. Falsified evidence may result in account restrictions.

3.3. Evidence URLs must use allowed schemes (https:, ipfs:). Other schemes are rejected for security.

3.4. Evidence content is sanitized before rendering. Malicious content is blocked and replaced with a safe placeholder.

3.5. Testnet claim data may be reset, purged, or migrated without notice. Do not rely on Testnet data persistence.`,
      status: 'approved',
      lastReviewedAt: '2026-01-15T00:00:00.000Z',
    },
    {
      id: 'staking-rewards-disputes',
      title: 'Staking, Rewards & Disputes',
      content: `4.1. Testnet staking uses testnet tokens with no monetary value. Rewards are simulated and not redeemable.

4.2. Staking mechanics on Testnet may differ from mainnet for testing purposes. Parameters (APY, lock periods, slashing) are subject to change.

4.3. Disputes on Testnet are resolved by automated or simulated verifiers. Outcomes do not set precedent for mainnet.

4.4. Slashing conditions on Testnet are experimental and may be triggered by test scenarios. No real value is at risk.

4.5. Reward calculations on Testnet use simplified formulas. Mainnet rewards follow the production economic model.`,
      status: 'review',
      reviewerNotes: 'Pending final testnet economic parameters from protocol team.',
    },
    {
      id: 'acceptable-use',
      title: 'Acceptable Use',
      content: `5.1. You agree to use the Testnet only for lawful purposes and in accordance with these Terms.

5.2. Prohibited activities include, but are not limited to:
   - Attempting to exploit, disrupt, or compromise the Testnet infrastructure
   - Submitting spam, duplicate, or frivolous claims
   - Using automated scripts to manipulate testnet metrics
   - Impersonating other users or entities
   - Distributing malware, phishing links, or harmful content

5.3. TruthBounty may suspend or terminate Testnet access for violations without notice.

5.4. Testnet is provided "as is" for development and testing. No uptime or availability guarantees apply.`,
      status: 'approved',
      lastReviewedAt: '2026-01-15T00:00:00.000Z',
    },
  ],
  status: 'published',
  publishedAt: '2026-01-15T00:00:00.000Z',
  source: 'board',
};

const mockAllVersions: TermsVersion[] = [
  mockVersion,
  {
    ...mockVersion,
    version: '0.9.0',
    effectiveDate: '2025-12-01',
    materialChanges: 'Pre-release draft for internal testing.',
    status: 'draft',
    publishedAt: undefined,
    source: 'board',
  },
];

const mainnetVersion: TermsVersion = {
  version: '1.0.0',
  effectiveDate: '2026-06-01',
  materialChanges: 'Initial mainnet terms publication following governance approval.',
  network: 'mainnet',
  clauses: [
    {
      id: 'eligibility',
      title: 'Eligibility',
      content: `1.1. To participate in the TruthBounty mainnet ("Mainnet"), you must be at least 18 years of age and have legal capacity to enter into binding agreements.

1.2. You must not be a resident of, or ordinarily resident in, any jurisdiction where participation in decentralized protocols, staking, or digital asset activities is prohibited by applicable law, including but not limited to jurisdictions subject to comprehensive sanctions (e.g., OFAC SDN list).

1.3. You must have a compatible Ethereum wallet configured for the Optimism mainnet (Chain ID: 10) with sufficient ETH for gas fees.

1.4. Mainnet participation involves real digital assets (ETH, TBNT, staked positions). You acknowledge the financial risk inherent in protocol interactions.

1.5. Institutional participants must ensure compliance with applicable regulatory requirements (AML/KYC, securities laws, tax obligations) before engaging.`,
      status: 'approved',
      lastReviewedAt: '2026-06-01T00:00:00.000Z',
    },
    {
      id: 'wallet-responsibility',
      title: 'Wallet Responsibility',
      content: `2.1. You are solely responsible for the security of your wallet, private keys, seed phrases, and any credentials used to access the Mainnet.

2.2. All transactions signed by your wallet are deemed authorized by you. TruthBounty cannot reverse, cancel, or modify confirmed transactions on the Optimism mainnet.

2.3. You must verify transaction details (recipient, amount, gas fees, contract interactions, function selectors) before signing. Blind signing is prohibited for value-bearing transactions.

2.4. If your wallet is compromised, you must immediately revoke approvals via revoke.cafe or equivalent tools and migrate assets. TruthBounty bears no liability for losses due to wallet compromise.

2.5. Use of hardware wallets (Ledger, Trezor, GridPlus) is strongly required for any mainnet activity involving value exceeding $1,000 USD equivalent.

2.6. You are responsible for tracking and reporting your own tax obligations arising from staking rewards, claim bounties, or token appreciation.`,
      status: 'approved',
      lastReviewedAt: '2026-06-01T00:00:00.000Z',
    },
    {
      id: 'staking-rewards-disputes',
      title: 'Staking, Rewards & Disputes',
      content: `4.1. Staking on Mainnet locks real TBNT/ETH assets. Staked assets are at risk of slashing per protocol rules.

4.2. Reward rates (APY) are determined by protocol governance and subject to change. Current parameters are published on-chain and in the dashboard.

4.3. Disputes are resolved by bonded verifiers. Verifier consensus determines claim validity. Minority verifiers may be slashed.

4.4. Slashing conditions include: attesting to invalid claims, failing to reveal votes, double-signing, and extended downtime.

4.5. Dispute resolution follows a commit-reveal voting scheme with a challenge period. Outcomes are final and binding on-chain.

4.6. Reward distribution occurs per epoch. Unclaimed rewards may be subject to protocol-level recycling after a governance-defined period.`,
      status: 'approved',
      lastReviewedAt: '2026-06-01T00:00:00.000Z',
    },
  ],
  status: 'published',
  publishedAt: '2026-06-01T00:00:00.000Z',
  source: 'governance',
};

const mainnetAllVersions: TermsVersion[] = [
  mainnetVersion,
  {
    ...mainnetVersion,
    version: '1.1.0',
    effectiveDate: '2026-09-01',
    materialChanges: 'Updated reward parameters per governance proposal #42. Adjusted slashing conditions.',
    previousVersion: '1.0.0',
    status: 'published',
    publishedAt: '2026-09-01T00:00:00.000Z',
    source: 'governance',
  },
  {
    ...mainnetVersion,
    version: '2.0.0',
    effectiveDate: '2027-01-01',
    materialChanges: 'Proposed major revision: new staking mechanics, updated governance process.',
    previousVersion: '1.1.0',
    status: 'draft',
    source: 'governance',
  },
];

const meta = {
  title: 'Features/Terms/TermsRenderer',
  component: TermsRenderer,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    network: {
      control: 'select',
      options: ['testnet', 'mainnet'],
      description: 'Network type for the terms',
    },
  },
} satisfies Meta<typeof TermsRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TestnetTerms: Story = {
  args: {
    version: mockVersion,
    allVersions: mockAllVersions,
    network: 'testnet',
    onVersionChange: () => {},
  },
};

export const MainnetTerms: Story = {
  args: {
    version: mainnetVersion,
    allVersions: mainnetAllVersions,
    network: 'mainnet',
    onVersionChange: () => {},
  },
};

export const TestnetWithReviewClause: Story = {
  args: {
    version: mockVersion,
    allVersions: mockAllVersions,
    network: 'testnet',
    onVersionChange: () => {},
  },
};

export const MainnetAllApproved: Story = {
  args: {
    version: mainnetVersion,
    allVersions: mainnetAllVersions,
    network: 'mainnet',
    onVersionChange: () => {},
  },
};

export const ManyVersionsHistory: Story = {
  args: {
    version: mockVersion,
    allVersions: [
      mockVersion,
      { ...mockVersion, version: '0.9.0', effectiveDate: '2025-11-01', materialChanges: 'Alpha release.', status: 'published', publishedAt: '2025-11-01T00:00:00.000Z', source: 'board' },
      { ...mockVersion, version: '0.8.0', effectiveDate: '2025-10-01', materialChanges: 'Pre-alpha.', status: 'published', publishedAt: '2025-10-01T00:00:00.000Z', source: 'board' },
      { ...mockVersion, version: '0.7.0', effectiveDate: '2025-09-01', materialChanges: 'Initial concept.', status: 'published', publishedAt: '2025-09-01T00:00:00.000Z', source: 'board' },
      { ...mockVersion, version: '2.0.0', effectiveDate: '2026-12-01', materialChanges: 'Major revision for mainnet launch.', status: 'draft', source: 'board' },
      { ...mockVersion, version: '2.1.0', effectiveDate: '2027-03-01', materialChanges: 'Post-launch adjustments.', status: 'draft', source: 'board' },
    ],
    network: 'testnet',
    onVersionChange: () => {},
  },
};