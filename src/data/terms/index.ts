/**
 * Terms of Use — Data Index
 *
 * Unified access to testnet and mainnet terms.
 * Testnet and mainnet terms/disclosures remain distinct.
 */

import type { TermsVersion, TermsMetadata, NetworkType } from '@/app/types/terms';
import { TESTNET_TERMS_VERSIONS, TESTNET_TERMS_METADATA, getTestnetTerms, getTestnetTermsMetadata } from './testnet';
import { MAINNET_TERMS_VERSIONS, MAINNET_TERMS_METADATA, getMainnetTerms, getMainnetTermsMetadata } from './mainnet';

export function getTermsVersions(network: NetworkType): TermsVersion[] {
  return network === 'testnet' ? TESTNET_TERMS_VERSIONS : MAINNET_TERMS_VERSIONS;
}

export function getTermsMetadata(network: NetworkType): TermsMetadata {
  return network === 'testnet' ? TESTNET_TERMS_METADATA : MAINNET_TERMS_METADATA;
}

export function getTerms(network: NetworkType, version?: string): TermsVersion {
  return network === 'testnet' ? getTestnetTerms(version) : getMainnetTerms(version);
}

export function getCurrentTerms(network: NetworkType): TermsVersion {
  const metadata = getTermsMetadata(network);
  return getTerms(network, metadata.currentVersion);
}

export { TESTNET_TERMS_VERSIONS, TESTNET_TERMS_METADATA, getTestnetTerms, getTestnetTermsMetadata };
export { MAINNET_TERMS_VERSIONS, MAINNET_TERMS_METADATA, getMainnetTerms, getMainnetTermsMetadata };