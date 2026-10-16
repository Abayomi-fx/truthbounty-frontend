/**
 * @jest-environment node
 */
import { DEFAULT_CSP_ALLOWLIST } from '../csp-allowlist';
import {
  APPROVED_EXTERNAL_LINK_DOMAINS,
  classifyApprovedDomain,
  hostnameMatchesApprovedSuffix,
} from '../approved-external-link-domains';

function hostFromOrigin(origin: string): string | null {
  if (origin.startsWith('wss://')) return origin.slice('wss://'.length);
  if (origin.startsWith('https://')) return origin.slice('https://'.length);
  return null;
}

describe('approved external link domains — CSP drift guard', () => {
  const explorerAndProtocolHosts = DEFAULT_CSP_ALLOWLIST.connectSrc
    .map(hostFromOrigin)
    .filter((h): h is string => h !== null);

  const ipfsHosts = DEFAULT_CSP_ALLOWLIST.imgSrc.map(hostFromOrigin).filter((h): h is string => h !== null);

  it('lists every CSP explorer/protocol connect host in the approved link domain table', () => {
    for (const host of explorerAndProtocolHosts) {
      if (host.includes('worldcoin')) continue;
      expect(classifyApprovedDomain(host)).not.toBeNull();
    }
  });

  it('lists every CSP IPFS img host as an ipfs_gateway category', () => {
    for (const host of ipfsHosts) {
      expect(classifyApprovedDomain(host)).toBe('ipfs_gateway');
    }
  });

  it('keeps approved entries as lowercase suffixes without wildcards', () => {
    for (const entry of APPROVED_EXTERNAL_LINK_DOMAINS) {
      expect(entry.hostSuffix).toBe(entry.hostSuffix.toLowerCase());
      expect(entry.hostSuffix).not.toContain('*');
      expect(hostnameMatchesApprovedSuffix(entry.hostSuffix, entry.hostSuffix)).toBe(true);
    }
  });
});
