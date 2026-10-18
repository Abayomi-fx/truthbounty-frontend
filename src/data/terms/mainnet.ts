/**
 * Terms of Use — Mainnet Configuration
 *
 * Mainnet terms are distinct from testnet terms.
 * Draft content is NEVER published as approved.
 * These terms govern actual value-bearing protocol interactions.
 */

import type { TermsVersion, TermsMetadata, NetworkType } from '@/app/types/terms';

const mainnetClauses = [
  {
    id: 'eligibility',
    title: 'Eligibility',
    content: `1.1. To participate in the TruthBounty mainnet ("Mainnet"), you must be at least 18 years of age and have legal capacity to enter into binding agreements.

1.2. You must not be a resident of, or ordinarily resident in, any jurisdiction where participation in decentralized protocols, staking, or digital asset activities is prohibited by applicable law, including but not limited to jurisdictions subject to comprehensive sanctions (e.g., OFAC SDN list).

1.3. You must have a compatible Ethereum wallet configured for the Optimism mainnet (Chain ID: 10) with sufficient ETH for gas fees.

1.4. Mainnet participation involves real digital assets (ETH, TBNT, staked positions). You acknowledge the financial risk inherent in protocol interactions.

1.5. Institutional participants must ensure compliance with applicable regulatory requirements (AML/KYC, securities laws, tax obligations) before engaging.`,
    status: 'approved' as const,
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
    status: 'approved' as const,
    lastReviewedAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'claims-evidence',
    title: 'Claims & Evidence',
    content: `3.1. Claims submitted on Mainnet create binding protocol state. False or misleading claims may result in slashing of staked assets.

3.2. Evidence submitted with claims must be accurate, complete, verifiable, and not misleading. Falsified evidence triggers dispute proceedings and potential penalties.

3.3. Evidence URLs must use allowed schemes (https:, ipfs:). Other schemes are rejected for security. IPFS content must be pinned for the dispute resolution period.

3.4. Evidence content is sanitized before rendering. Malicious content is blocked and replaced with a safe placeholder. Original content is preserved for verifier review.

3.5. Claim and evidence data is immutable once submitted on-chain. Off-chain metadata (IPFS) must remain available for the dispute window.

3.6. You grant TruthBounty a non-exclusive, royalty-free license to display, index, and verify submitted evidence for protocol operations.`,
    status: 'approved' as const,
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
    status: 'approved' as const,
    lastReviewedAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable Use',
    content: `5.1. You agree to use the Mainnet only for lawful purposes and in accordance with these Terms and applicable law.

5.2. Prohibited activities include, but are not limited to:
   - Money laundering, sanctions evasion, or terrorist financing
   - Market manipulation, wash trading, or coordinated exploitation
   - Attempting to exploit, disrupt, or compromise the protocol smart contracts
   - Submitting fraudulent claims or fabricated evidence
   - Using automated systems to circumvent rate limits or fair access
   - Impersonating verifiers, protocol team members, or other users
   - Distributing malware, phishing links, or harmful content via evidence

5.3. TruthBounty may restrict protocol access (frontend only) for addresses associated with prohibited activity, per on-chain governance.

5.4. Smart contract functionality is permissionless and cannot be unilaterally restricted by TruthBounty. Frontend access restrictions do not affect on-chain rights.`,
    status: 'approved' as const,
    lastReviewedAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'dependencies',
    title: 'Dependencies',
    content: `6.1. The Mainnet relies on third-party infrastructure including:
   - Optimism Mainnet (L2)
   - RPC providers (Alchemy, Infura, Chainstack, public endpoints)
   - IPFS gateways and pinning services for evidence storage
   - Worldcoin Orb verification for identity attestation
   - Wallet connectors (RainbowKit, wagmi, WalletConnect)
   - Price oracles (Chainlink, Pyth) for reward valuation
   - Block explorers (Optimism Explorer, Etherscan) for transaction verification

6.2. TruthBounty does not control, warrant, or guarantee the availability of third-party services.

6.3. Changes to third-party APIs, rate limits, pricing, or terms may affect Mainnet functionality. TruthBounty will use commercially reasonable efforts to migrate dependencies.

6.4. You acknowledge that Mainnet operation is dependent on the continued availability of these dependencies.

6.5. Worldcoin identity verification is optional but may be required for certain claim categories or reward tiers.`,
    status: 'approved' as const,
    lastReviewedAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'availability',
    title: 'Availability',
    content: `7.1. The TruthBounty frontend is provided on a commercially reasonable efforts basis. No service level agreements (SLAs) apply to frontend availability.

7.2. The underlying smart contracts operate on Optimism Mainnet, which targets 99.9%+ uptime but is subject to Ethereum L1 finality and L2 sequencer availability.

7.3. Scheduled frontend maintenance windows will be announced via official channels (Discord, GitHub, Twitter) at least 48 hours in advance when possible.

7.4. Unscheduled downtime may occur due to network issues, smart contract upgrades, infrastructure failures, or security incidents.

7.5. On-chain protocol state (claims, stakes, rewards, disputes) is immutable and persists regardless of frontend availability. You can interact directly with contracts via block explorers.

7.6. TruthBounty reserves the right to discontinue the frontend with 90 days' notice. Smart contract functionality would remain accessible.`,
    status: 'approved' as const,
    lastReviewedAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'liability',
    title: 'Liability',
    content: `8.1. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, TRUTHBOUNTY AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AND CONTRACTORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING FROM OR RELATED TO YOUR USE OF THE MAINNET.

8.2. TRUTHBOUNTY SHALL NOT BE LIABLE FOR: (A) SMART CONTRACT BUGS, EXPLOITS, OR VULNERABILITIES; (B) NETWORK CONGESTION, GAS PRICE SPIKES, OR TRANSACTION FAILURES; (C) THIRD-PARTY SERVICE FAILURES (RPC, IPFS, ORACLES); (D) USER ERROR INCLUDING INCORRECT TRANSACTION PARAMETERS; (E) REGULATORY ACTIONS AFFECTING TOKEN VALUE OR PROTOCOL OPERATION.

8.3. TOTAL AGGREGATE LIABILITY FOR ANY CLAIMS ARISING FROM MAINNET USE SHALL NOT EXCEED THE GREATER OF: (A) THE VALUE OF YOUR STAKED ASSETS AT THE TIME OF THE CLAIM; OR (B) $10,000 USD.

8.4. THE FOREGOING LIMITATIONS DO NOT APPLY TO: (A) GROSS NEGLIGENCE OR WILLFUL MISCONDUCT BY TRUTHBOUNTY; (B) DEATH OR PERSONAL INJURY CAUSED BY TRUTHBOUNTY'S NEGLIGENCE; (C) FRAUD OR FRAUDULENT MISREPRESENTATION; (D) ANY LIABILITY THAT CANNOT BE LIMITED BY APPLICABLE LAW.

8.5. SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OF CERTAIN WARRANTIES OR LIMITATION OF LIABILITY. THE ABOVE LIMITATIONS APPLY TO THE FULLEST EXTENT PERMITTED BY LAW.`,
    status: 'approved' as const,
    lastReviewedAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'governing-law',
    title: 'Governing Law',
    content: `9.1. These Mainnet Terms are governed by the laws of the Cayman Islands, without regard to conflict of laws principles.

9.2. Any dispute arising from Mainnet use shall be resolved exclusively by the courts of the Cayman Islands, except that:
   - On-chain protocol disputes are resolved by the protocol's dispute resolution mechanism (verifier voting)
   - Smart contract execution is governed by the EVM and Optimism consensus rules

9.3. Mainnet participation does not create a joint venture, partnership, employment, or agency relationship between you and TruthBounty.

9.4. If any provision is found unenforceable, the remaining provisions remain in full force and effect.

9.5. These Terms do not limit any rights you may have under mandatory consumer protection laws in your jurisdiction.`,
    status: 'approved' as const,
    lastReviewedAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'revision',
    title: 'Revision & Amendments',
    content: `10.1. TruthBounty may amend these Mainnet Terms at any time by publishing a new version following the protocol's governance process.

10.2. Material changes require a governance proposal and on-chain vote. The effective date will be no earlier than the vote conclusion + 7-day timelock.

10.3. Non-material changes (clarifications, typo fixes, updated contact info) may be published without a governance vote but will be clearly marked.

10.4. Continued use of the Mainnet after a new version's effective date constitutes acceptance of the revised Terms.

10.5. Prior versions remain accessible via the version history for reference and comparison. The effective date of each version is displayed alongside the version identifier.

10.6. You are responsible for reviewing version changes. Significant changes will be announced via official channels.`,
    status: 'approved' as const,
    lastReviewedAt: '2026-06-01T00:00:00.000Z',
  },
];

export const MAINNET_TERMS_VERSIONS: TermsVersion[] = [
  {
    version: '1.0.0',
    effectiveDate: '2026-06-01',
    materialChanges: 'Initial mainnet terms publication following governance approval.',
    network: 'mainnet',
    clauses: mainnetClauses,
    status: 'published',
    publishedAt: '2026-06-01T00:00:00.000Z',
    source: 'governance',
  },
];

export const MAINNET_TERMS_METADATA: TermsMetadata = {
  currentVersion: '1.0.0',
  versions: MAINNET_TERMS_VERSIONS,
  lastUpdated: '2026-06-01T00:00:00.000Z',
  network: 'mainnet',
};

export function getMainnetTerms(version?: string): TermsVersion {
  if (version) {
    const found = MAINNET_TERMS_VERSIONS.find((v) => v.version === version);
    if (found) return found;
  }
  return MAINNET_TERMS_VERSIONS.find((v) => v.version === MAINNET_TERMS_METADATA.currentVersion)!;
}

export function getMainnetTermsMetadata(): TermsMetadata {
  return MAINNET_TERMS_METADATA;
}