/**
 * Terms of Use — Versioned Content Schema
 *
 * This schema defines the structure for versioned terms of use content.
 * Draft content is NEVER published as approved (fail-closed).
 * Testnet and mainnet terms/disclosures remain distinct.
 */

export type NetworkType = 'testnet' | 'mainnet';
export type ClauseStatus = 'approved' | 'review' | 'unavailable';

export interface TermsClause {
  id: string;
  title: string;
  content: string;
  status: ClauseStatus;
  lastReviewedAt?: string;
  reviewerNotes?: string;
}

export interface TermsVersion {
  version: string;
  effectiveDate: string;
  materialChanges: string;
  previousVersion?: string;
  network: NetworkType;
  clauses: TermsClause[];
  status: 'draft' | 'published';
  publishedAt?: string;
  source: 'board' | 'governance' | 'legal';
}

export interface TermsMetadata {
  currentVersion: string;
  versions: TermsVersion[];
  lastUpdated: string;
  network: NetworkType;
}

export interface TermsRenderProps {
  network: NetworkType;
  version?: string;
}

export const TERMS_SECTIONS = [
  'eligibility',
  'wallet-responsibility',
  'claims-evidence',
  'staking-rewards-disputes',
  'acceptable-use',
  'dependencies',
  'availability',
  'liability',
  'governing-law',
  'revision',
] as const;

export type TermsSectionId = (typeof TERMS_SECTIONS)[number];

export const SECTION_TITLES: Record<TermsSectionId, string> = {
  eligibility: 'Eligibility',
  'wallet-responsibility': 'Wallet Responsibility',
  'claims-evidence': 'Claims & Evidence',
  'staking-rewards-disputes': 'Staking, Rewards & Disputes',
  'acceptable-use': 'Acceptable Use',
  dependencies: 'Dependencies',
  availability: 'Availability',
  liability: 'Liability',
  'governing-law': 'Governing Law',
  revision: 'Revision & Amendments',
};

export const SECTION_DESCRIPTIONS: Record<TermsSectionId, string> = {
  eligibility: 'Who may participate in the protocol and under what conditions.',
  'wallet-responsibility': 'User responsibilities for wallet security and transaction authorization.',
  'claims-evidence': 'Rules for submitting claims and providing supporting evidence.',
  'staking-rewards-disputes': 'Staking mechanics, reward distribution, and dispute resolution.',
  'acceptable-use': 'Permitted and prohibited activities on the platform.',
  dependencies: 'Third-party dependencies and external service requirements.',
  availability: 'Service availability commitments and maintenance windows.',
  liability: 'Limitation of liability and disclaimers.',
  'governing-law': 'Applicable law and jurisdiction for disputes.',
  revision: 'Process for amending these terms and version history.',
};