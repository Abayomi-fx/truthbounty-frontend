/**
 * UI-FE-079 — Approved external link domains (informational classification only).
 *
 * Presence on this list means the hostname matches a known TruthBounty-related
 * surface (explorer, gateway, docs, etc.). It does NOT attest to the truth or
 * safety of page content at that URL.
 */

export type ApprovedExternalLinkCategory =
  | 'protocol'
  | 'explorer'
  | 'ipfs_gateway'
  | 'documentation'
  | 'support'
  | 'governance';

export interface ApprovedDomainEntry {
  readonly category: ApprovedExternalLinkCategory;
  /** Hostname or registrable suffix (matched with endsWith, lowercase). */
  readonly hostSuffix: string;
}

/**
 * Reviewed hostname suffixes for classifying outbound links. Keep in sync with
 * `DEFAULT_CSP_ALLOWLIST` explorer / IPFS / protocol origins (see drift test).
 */
export const APPROVED_EXTERNAL_LINK_DOMAINS: readonly ApprovedDomainEntry[] = [
  { category: 'protocol', hostSuffix: 'mainnet.optimism.io' },
  { category: 'protocol', hostSuffix: 'sepolia.optimism.io' },
  { category: 'protocol', hostSuffix: 'opt-mainnet.g.alchemy.com' },
  { category: 'protocol', hostSuffix: 'opt-sepolia.g.alchemy.com' },
  { category: 'protocol', hostSuffix: 'rpc.walletconnect.com' },
  { category: 'protocol', hostSuffix: 'relay.walletconnect.com' },
  { category: 'protocol', hostSuffix: 'registry.walletconnect.com' },
  { category: 'explorer', hostSuffix: 'optimistic.etherscan.io' },
  { category: 'explorer', hostSuffix: 'sepolia-optimistic.etherscan.io' },
  { category: 'ipfs_gateway', hostSuffix: 'ipfs.io' },
  { category: 'ipfs_gateway', hostSuffix: 'cloudflare-ipfs.com' },
  { category: 'documentation', hostSuffix: 'docs.truthbounty.io' },
  { category: 'documentation', hostSuffix: 'truthbounty.io' },
  { category: 'support', hostSuffix: 'support.truthbounty.io' },
  { category: 'governance', hostSuffix: 'vote.truthbounty.io' },
  { category: 'governance', hostSuffix: 'snapshot.org' },
] as const;

export function hostnameMatchesApprovedSuffix(hostname: string, suffix: string): boolean {
  const host = hostname.toLowerCase();
  const suf = suffix.toLowerCase();
  return host === suf || host.endsWith(`.${suf}`);
}

export function classifyApprovedDomain(hostname: string): ApprovedExternalLinkCategory | null {
  for (const entry of APPROVED_EXTERNAL_LINK_DOMAINS) {
    if (hostnameMatchesApprovedSuffix(hostname, entry.hostSuffix)) {
      return entry.category;
    }
  }
  return null;
}
