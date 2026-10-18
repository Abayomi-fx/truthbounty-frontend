import {
  MAX_EVIDENCE_ENTRIES,
  MAX_EVIDENCE_URI_LENGTH,
  externalEvidenceLinkProps,
  normalizeEvidenceDigest,
  redactSecrets,
  scanForSecrets,
  validateEvidenceDigest,
  validateEvidenceEntry,
  validateEvidenceSet,
  validateEvidenceUri,
} from '@/lib/dispute/evidence';

describe('validateEvidenceUri', () => {
  it('accepts https links', () => {
    expect(validateEvidenceUri('https://example.com/evidence')).toEqual([]);
  });

  it('accepts ipfs links', () => {
    expect(validateEvidenceUri('ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')).toEqual([]);
  });

  it('rejects an empty link', () => {
    expect(validateEvidenceUri('   ')).toEqual([
      expect.objectContaining({ code: 'empty' }),
    ]);
  });

  it('rejects malformed URLs', () => {
    expect(validateEvidenceUri('not a url')).toEqual([
      expect.objectContaining({ code: 'invalid-url' }),
    ]);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'http://insecure.example.com/evidence',
    'vbscript:msgbox(1)',
  ])('rejects the unsupported scheme in %s', (uri) => {
    const problems = validateEvidenceUri(uri);
    expect(problems.some((p) => p.code === 'unsupported-scheme')).toBe(true);
  });

  it('rejects oversized links', () => {
    const uri = `https://example.com/${'a'.repeat(MAX_EVIDENCE_URI_LENGTH)}`;
    expect(validateEvidenceUri(uri).some((p) => p.code === 'oversized')).toBe(true);
  });

  it.each([
    'https://example.com/?password=hunter2',
    'https://example.com/?api_key=abc123',
    'https://example.com/?token=abc123',
    'https://example.com/?private_key=0xdead',
    'https://example.com/?session=abcdef',
    'https://example.com/#mnemonic=word1 word2',
  ])('rejects credential-bearing link %s', (uri) => {
    const problems = validateEvidenceUri(uri);
    expect(problems.some((p) => p.code === 'secret-material')).toBe(true);
  });

  it('rejects links carrying private key material or bearer tokens', () => {
    expect(
      validateEvidenceUri('https://example.com/x?d=-----BEGIN PRIVATE KEY-----').some(
        (p) => p.code === 'secret-material'
      )
    ).toBe(true);
    expect(
      validateEvidenceUri('https://example.com/').length
    ).toBe(0);
  });
});

describe('validateEvidenceDigest', () => {
  it('accepts 64-hex digests with or without 0x', () => {
    const digest = 'a'.repeat(64);
    expect(validateEvidenceDigest(digest)).toEqual([]);
    expect(validateEvidenceDigest(`0x${digest}`)).toEqual([]);
    expect(validateEvidenceDigest(digest.toUpperCase())).toEqual([]);
  });

  it('rejects malformed digests', () => {
    expect(validateEvidenceDigest('zz')).toEqual([
      expect.objectContaining({ code: 'invalid-digest' }),
    ]);
    expect(validateEvidenceDigest('a'.repeat(63))).toEqual([
      expect.objectContaining({ code: 'invalid-digest' }),
    ]);
  });

  it('normalizes to lowercase 0x-prefixed form', () => {
    expect(normalizeEvidenceDigest('A'.repeat(64))).toBe(
      `0x${'a'.repeat(64)}`
    );
  });
});

describe('validateEvidenceEntry / validateEvidenceSet', () => {
  it('validates an entry with uri and digest together', () => {
    expect(
      validateEvidenceEntry({
        uri: 'https://example.com/a',
        digest: 'a'.repeat(64),
      })
    ).toEqual([]);
    expect(
      validateEvidenceEntry({ uri: 'javascript:alert(1)', digest: 'bad' })
    ).toHaveLength(2);
  });

  it('tags problems with their entry index', () => {
    const result = validateEvidenceSet([
      { uri: 'https://example.com/ok' },
      { uri: 'javascript:alert(1)' },
    ]);

    expect(result.isValid).toBe(false);
    expect(result.usable).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.problems[0].entryIndex).toBe(1);
  });

  it('enforces the entry cap as a set-level problem', () => {
    const entries = Array.from({ length: MAX_EVIDENCE_ENTRIES + 1 }, () => ({
      uri: 'https://example.com/ok',
    }));
    const result = validateEvidenceSet(entries);
    expect(result.isValid).toBe(false);
    expect(result.problems.some((p) => p.code === 'too-many-entries')).toBe(true);
  });

  it('accepts an empty set', () => {
    expect(validateEvidenceSet([]).isValid).toBe(true);
  });
});

describe('scanForSecrets / redactSecrets', () => {
  it('detects labeled secrets, JWTs, bearer tokens and PEM blocks', () => {
    expect(scanForSecrets('password: hunter2').hasSecrets).toBe(true);
    expect(
      scanForSecrets('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N').hasSecrets
    ).toBe(true);
    expect(scanForSecrets('Authorization: Bearer abcdef0123456789abcdef').hasSecrets).toBe(true);
    expect(scanForSecrets('a normal dispute reason').hasSecrets).toBe(false);
  });

  it('redacts secrets from free text and counts redactions', () => {
    const { text, redactions } = redactSecrets(
      'My api_key=abc123 and my password: hunter2 plus a token=xyz'
    );

    expect(redactions).toBe(3);
    expect(text).not.toContain('abc123');
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('xyz');
    expect(text).toContain('[redacted]');
  });

  it('redacts PEM private key blocks wholesale', () => {
    const { text, redactions } = redactSecrets(
      'key below:\n-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg\n-----END PRIVATE KEY-----\ndone'
    );
    expect(redactions).toBe(1);
    expect(text).not.toContain('MIIEvQIBADANBg');
    expect(text).toContain('[redacted:private-key]');
  });

  it('leaves ordinary prose untouched', () => {
    const reason =
      'The provisional outcome over-counted stake because the verifier duplicated votes.';
    const { text, redactions } = redactSecrets(reason);
    expect(text).toBe(reason);
    expect(redactions).toBe(0);
  });
});

describe('externalEvidenceLinkProps', () => {
  it('always renders external evidence links without opener or referrer access', () => {
    expect(externalEvidenceLinkProps('https://example.com')).toEqual({
      href: 'https://example.com',
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
    });
  });
});
