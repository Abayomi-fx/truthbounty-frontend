/**
 * UI-FE-079 / SEC-FE-007 — External link trust, classification, and navigation hardening.
 *
 * Untrusted URLs flow through `safeUrl` first (scheme allowlist, fail closed).
 * This module adds hostname deception checks, domain disclosure, and category
 * labels for UI. Approved-domain membership is informational only.
 */

import {
  classifyApprovedDomain,
  type ApprovedExternalLinkCategory,
} from './approved-external-link-domains';
import {
  SAFE_EXTERNAL_REL,
  isHardenedRel,
  safeUrl,
  type SafeUrlCheck,
  type SafeUrlResult,
} from './evidence-sanitizer';

export type ExternalLinkCategory = ApprovedExternalLinkCategory | 'evidence' | 'arbitrary_external';

export interface ExternalNavigationAttributes {
  target: '_blank';
  rel: typeof SAFE_EXTERNAL_REL;
  referrerPolicy: 'no-referrer';
}

export const EXTERNAL_NAVIGATION_ATTRIBUTES: ExternalNavigationAttributes = {
  target: '_blank',
  rel: SAFE_EXTERNAL_REL,
  referrerPolicy: 'no-referrer',
};

export interface LinkTrustPresentation {
  href: string;
  /** Punycode / ASCII hostname from the URL parser. */
  asciiHostname: string;
  /** Unicode hostname for display when IDN is used. */
  displayHostname: string;
  category: ExternalLinkCategory;
  /** True when hostname matches the reviewed allowlist (not a truth claim). */
  isOnApprovedDomainList: boolean;
  /** Short line for assistive tech and visible disclosure. */
  disclosureLabel: string;
  navigation: ExternalNavigationAttributes;
}

export type ExternalLinkTrustResult =
  | { ok: true; presentation: LinkTrustPresentation; url: URL }
  | { ok: false; check: SafeUrlCheck };

const BIDI_AND_FORMAT = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
const CYRILLIC = /[\u0400-\u04FF]/;
const GREEK = /[\u0370-\u03FF]/;
const LATIN = /[A-Za-z]/;

/**
 * Reject hostnames that try to disguise the destination (IDN homographs, bidi).
 */
export function isDeceptiveHostname(hostname: string): boolean {
  if (!hostname || BIDI_AND_FORMAT.test(hostname)) return true;

  const hasLatin = LATIN.test(hostname);
  const hasCyrillic = CYRILLIC.test(hostname);
  const hasGreek = GREEK.test(hostname);
  const scriptCount = [hasLatin, hasCyrillic, hasGreek].filter(Boolean).length;
  if (scriptCount > 1) return true;

  if (hostname.includes('..')) return true;
  if (hostname.startsWith('.') || hostname.endsWith('.')) return true;

  return false;
}

function domainToUnicodeSafe(hostname: string): string {
  try {
    if (typeof process !== 'undefined' && process.versions?.node) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { domainToUnicode } = require('node:url') as {
        domainToUnicode: (host: string) => string;
      };
      return domainToUnicode(hostname);
    }
  } catch {
    /* fall through */
  }
  return hostname;
}

export function hostnameForUserDisplay(hostname: string): {
  asciiHostname: string;
  displayHostname: string;
} {
  const asciiHostname = hostname.toLowerCase();
  const displayHostname = domainToUnicodeSafe(asciiHostname);
  return { asciiHostname, displayHostname };
}

export function classifyExternalLink(url: URL): ExternalLinkCategory {
  if (url.protocol === 'ipfs:') return 'evidence';

  const approved = classifyApprovedDomain(url.hostname);
  if (approved) return approved;

  return 'arbitrary_external';
}

export function buildDisclosureLabel(presentation: {
  displayHostname: string;
  asciiHostname: string;
  category: ExternalLinkCategory;
}): string {
  const host =
    presentation.displayHostname !== presentation.asciiHostname
      ? `${presentation.displayHostname} (${presentation.asciiHostname})`
      : presentation.displayHostname;

  const categoryHint =
    presentation.category === 'arbitrary_external' || presentation.category === 'evidence'
      ? 'External site'
      : `External ${presentation.category.replace('_', ' ')}`;

  return `${categoryHint}: opens ${host} in a new tab`;
}

/**
 * Resolve an untrusted href for safe navigation and visible domain disclosure.
 */
export function resolveExternalLinkTrust(rawHref: unknown): ExternalLinkTrustResult {
  const check = safeUrl(rawHref);
  if (!check.ok) {
    return { ok: false, check };
  }

  const { url, href } = check as SafeUrlResult;

  const { asciiHostname, displayHostname } = hostnameForUserDisplay(url.hostname);

  if (
    url.protocol === 'https:' &&
    (isDeceptiveHostname(url.hostname) || isDeceptiveHostname(displayHostname))
  ) {
    return {
      ok: false,
      check: {
        ok: false,
        reason: 'unsafe_hostname',
        message: 'This link was blocked for security reasons.',
      },
    };
  }
  const category = classifyExternalLink(url);
  const isOnApprovedDomainList = classifyApprovedDomain(url.hostname) !== null;

  const presentation: LinkTrustPresentation = {
    href,
    asciiHostname,
    displayHostname,
    category,
    isOnApprovedDomainList,
    disclosureLabel: buildDisclosureLabel({
      displayHostname,
      asciiHostname,
      category,
    }),
    navigation: EXTERNAL_NAVIGATION_ATTRIBUTES,
  };

  return { ok: true, presentation, url };
}

export function externalNavigationRel(override?: string | null): typeof SAFE_EXTERNAL_REL {
  return isHardenedRel(override) ? (override as typeof SAFE_EXTERNAL_REL) : SAFE_EXTERNAL_REL;
}
