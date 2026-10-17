/**
 * @jest-environment node
 */
import {
  buildDisclosureLabel,
  classifyExternalLink,
  isDeceptiveHostname,
  hostnameForUserDisplay,
  resolveExternalLinkTrust,
  EXTERNAL_NAVIGATION_ATTRIBUTES,
} from '../external-link-trust';

describe('resolveExternalLinkTrust — dangerous schemes', () => {
  it('never returns navigable https for javascript: payloads', () => {
    const result = resolveExternalLinkTrust('javascript:alert(1)');
    expect(result.ok).toBe(false);
  });

  it('accepts https URLs with hardened navigation attributes', () => {
    const result = resolveExternalLinkTrust('https://example.com/path');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.presentation.navigation).toEqual(EXTERNAL_NAVIGATION_ATTRIBUTES);
      expect(result.presentation.href).toBe('https://example.com/path');
    }
  });
});

describe('isDeceptiveHostname — punycode and confusables', () => {
  it('rejects mixed Latin and Cyrillic homographs', () => {
    expect(isDeceptiveHostname('раypal.com')).toBe(true);
  });

  it('allows plain ASCII hostnames', () => {
    expect(isDeceptiveHostname('optimistic.etherscan.io')).toBe(false);
  });

  it('rejects bidi override characters in the hostname', () => {
    expect(isDeceptiveHostname('exa\u202emple.com')).toBe(true);
  });
});

describe('hostnameForUserDisplay', () => {
  it('decodes punycode labels for disclosure', () => {
    const { asciiHostname, displayHostname } = hostnameForUserDisplay('xn--maana-pta.com');
    expect(asciiHostname).toBe('xn--maana-pta.com');
    expect(displayHostname).toBe('mañana.com');
  });
});

describe('classifyExternalLink', () => {
  it('classifies explorer hosts from the approved list', () => {
    const url = new URL('https://optimistic.etherscan.io/tx/0xabc');
    expect(classifyExternalLink(url)).toBe('explorer');
  });

  it('treats unknown https hosts as arbitrary_external', () => {
    const url = new URL('https://random-example.org/doc');
    expect(classifyExternalLink(url)).toBe('arbitrary_external');
  });

  it('classifies ipfs protocol as evidence', () => {
    const url = new URL('ipfs://QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o');
    expect(classifyExternalLink(url)).toBe('evidence');
  });
});

describe('buildDisclosureLabel', () => {
  it('does not imply allowlisted domains are truthful', () => {
    const label = buildDisclosureLabel({
      displayHostname: 'optimistic.etherscan.io',
      asciiHostname: 'optimistic.etherscan.io',
      category: 'explorer',
    });
    expect(label).toContain('opens optimistic.etherscan.io');
    expect(label.toLowerCase()).not.toContain('verified');
    expect(label.toLowerCase()).not.toContain('trusted content');
  });
});

describe('redirect and deceptive hosts (fail closed)', () => {
  it('does not treat redirect query params as a navigable scheme', () => {
    const result = resolveExternalLinkTrust(
      'https://example.com/login?next=https%3A%2F%2Fevil.test',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.presentation.asciiHostname).toBe('example.com');
    }
  });

  it('blocks https URLs with mixed-script deceptive hostnames', () => {
    const result = resolveExternalLinkTrust('https://раypal.com/');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.check.ok).toBe(false);
      if (!result.check.ok) {
        expect(result.check.reason).toBe('unsafe_hostname');
      }
    }
  });
});

describe('opener and referrer hardening', () => {
  it('uses noopener noreferrer and no-referrer so the opener is not exposed', () => {
    const result = resolveExternalLinkTrust('https://example.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const rel = result.presentation.navigation.rel;
      expect(rel).toMatch(/noopener/);
      expect(rel).toMatch(/noreferrer/);
      expect(result.presentation.navigation.referrerPolicy).toBe('no-referrer');
      expect(result.presentation.navigation.target).toBe('_blank');
    }
  });
});
