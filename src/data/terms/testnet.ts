/**
 * Terms of Use — Testnet Configuration
 *
 * Testnet terms are distinct from mainnet terms.
 * Draft content is NEVER published as approved.
 */

import type { TermsVersion, TermsMetadata, NetworkType } from '@/app/types/terms';

const testnetClauses = [
  {
    id: 'eligibility',
    title: 'Eligibility',
    content: `1.1. To participate in the TruthBounty testnet ("Testnet"), you must be at least 18 years of age and have legal capacity to enter into binding agreements.

1.2. You must not be a resident of, or ordinarily resident in, any jurisdiction where participation in decentralized protocols or testnet activities is prohibited by applicable law.

1.3. You must have a compatible Ethereum wallet (e.g., MetaMask, Rainbow, Coinbase Wallet) configured for the Optimism Sepolia testnet (Chain ID: 11155420).

1.4. Testnet participation does not confer any ownership rights, equity, or financial interest in the TruthBounty protocol or its affiliates.

1.5. Testnet tokens (e.g., Sepolia ETH, test TBNT) have no monetary value and cannot be exchanged for mainnet assets.`,
    status: 'approved' as const,
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
    status: 'approved' as const,
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
    status: 'approved' as const,
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
    status: 'review' as const,
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
    status: 'approved' as const,
    lastReviewedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'dependencies',
    title: 'Dependencies',
    content: `6.1. The Testnet relies on third-party infrastructure including:
   - Optimism Sepolia (L2 testnet)
   - RPC providers (Alchemy, Infura, public endpoints)
   - IPFS gateways for evidence storage
   - Worldcoin Orb verification (simulated on testnet)
   - Wallet connectors (RainbowKit, wagmi)

6.2. TruthBounty does not control, warrant, or guarantee the availability of third-party services.

6.3. Changes to third-party APIs, rate limits, or terms may affect Testnet functionality without notice.

6.4. You acknowledge that Testnet operation is dependent on the continued availability of these dependencies.`,
    status: 'approved' as const,
    lastReviewedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'availability',
    title: 'Availability',
    content: `7.1. Testnet is provided on a best-effort basis. No service level agreements (SLAs) apply.

7.2. Scheduled maintenance windows will be announced via official channels (Discord, GitHub) when possible.

7.3. Unscheduled downtime may occur due to network issues, smart contract upgrades, or infrastructure failures.

7.4. Testnet data (claims, stakes, rewards) may be reset at any time for protocol upgrades or testing.

7.5. TruthBounty reserves the right to discontinue the Testnet with reasonable notice.`,
    status: 'approved' as const,
    lastReviewedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'liability',
    title: 'Liability',
    content: `8.1. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, TRUTHBOUNTY AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AND CONTRACTORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING FROM OR RELATED TO YOUR USE OF THE TESTNET.

8.2. TESTNET TOKENS HAVE NO MONETARY VALUE. TRUTHBOUNTY SHALL NOT BE LIABLE FOR ANY PERCEIVED LOSS OF VALUE RELATED TO TESTNET ASSETS.

8.3. TOTAL LIABILITY FOR ANY CLAIM ARISING FROM TESTNET USE SHALL NOT EXCEED THE AMOUNT PAID BY YOU TO ACCESS THE TESTNET (WHICH IS ZERO).

8.4. SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OF CERTAIN WARRANTIES OR LIMITATION OF LIABILITY. THE ABOVE LIMITATIONS APPLY TO THE FULLEST EXTENT PERMITTED BY LAW.`,
    status: 'approved' as const,
    lastReviewedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'governing-law',
    title: 'Governing Law',
    content: `9.1. These Testnet Terms are governed by the laws of the Cayman Islands, without regard to conflict of laws principles.

9.2. Any dispute arising from Testnet use shall be resolved exclusively by the courts of the Cayman Islands.

9.3. Testnet participation does not create a joint venture, partnership, employment, or agency relationship.

9.4. If any provision is found unenforceable, the remaining provisions remain in full force and effect.`,
    status: 'approved' as const,
    lastReviewedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'revision',
    title: 'Revision & Amendments',
    content: `10.1. TruthBounty may amend these Testnet Terms at any time by publishing a new version.

10.2. Material changes will be highlighted in the version history with a summary of modifications.

10.3. Continued use of the Testnet after a new version is published constitutes acceptance of the revised Terms.

10.4. Prior versions remain accessible via the version history for reference and comparison.

10.5. The effective date of each version is displayed alongside the version identifier.`,
    status: 'approved' as const,
    lastReviewedAt: '2026-01-15T00:00:00.000Z',
  },
];

export const TESTNET_TERMS_VERSIONS: TermsVersion[] = [
  {
    version: '1.0.0',
    effectiveDate: '2026-01-15',
    materialChanges: 'Initial testnet terms publication.',
    network: 'testnet',
    clauses: testnetClauses,
    status: 'published',
    publishedAt: '2026-01-15T00:00:00.000Z',
    source: 'board',
  },
];

export const TESTNET_TERMS_METADATA: TermsMetadata = {
  currentVersion: '1.0.0',
  versions: TESTNET_TERMS_VERSIONS,
  lastUpdated: '2026-01-15T00:00:00.000Z',
  network: 'testnet',
};

export function getTestnetTerms(version?: string): TermsVersion {
  if (version) {
    const found = TESTNET_TERMS_VERSIONS.find((v) => v.version === version);
    if (found) return found;
  }
  return TESTNET_TERMS_VERSIONS.find((v) => v.version === TESTNET_TERMS_METADATA.currentVersion)!;
}

export function getTestnetTermsMetadata(): TermsMetadata {
  return TESTNET_TERMS_METADATA;
}