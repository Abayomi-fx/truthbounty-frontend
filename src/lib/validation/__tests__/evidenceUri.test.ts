import {
  validateEvidenceUri,
  getSafeEvidenceHref,
  SUPPORTED_EVIDENCE_SCHEMES,
  MAX_EVIDENCE_URI_LENGTH,
} from '../evidenceUri';

const VALID_CID_V0 = 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco';
const VALID_CID_V1 = 'bafybeic56ifauv44vqp64qm2tfp4ll752a7nduhq44wz77kfxz22a36pwi';

describe('validateEvidenceUri', () => {
  it('defines supported schemes to strictly https: and ipfs:', () => {
    expect(SUPPORTED_EVIDENCE_SCHEMES).toEqual(['https:', 'ipfs:']);
  });

  describe('valid URIs', () => {
    it('accepts valid HTTPS URLs', () => {
      const result = validateEvidenceUri('https://example.com/evidence/123');
      expect(result.isValid).toBe(true);
      expect(result.scheme).toBe('https:');
      expect(result.error).toBeNull();
    });

    it('accepts valid IPFS URIs with CIDv0', () => {
      const result = validateEvidenceUri(`ipfs://${VALID_CID_V0}`);
      expect(result.isValid).toBe(true);
      expect(result.scheme).toBe('ipfs:');
      expect(result.error).toBeNull();
    });

    it('accepts valid IPFS URIs with CIDv1', () => {
      const result = validateEvidenceUri(`ipfs://${VALID_CID_V1}/path/file.txt`);
      expect(result.isValid).toBe(true);
      expect(result.scheme).toBe('ipfs:');
      expect(result.error).toBeNull();
    });

    it('does not reject harmless parameter names like monkey or turkey', () => {
      const result = validateEvidenceUri('https://example.com/turkey?monkey=1');
      expect(result.isValid).toBe(true);
    });
  });

  describe('empty / missing inputs', () => {
    it('rejects empty string', () => {
      const result = validateEvidenceUri('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Evidence URI is required');
    });

    it('rejects null or undefined', () => {
      expect(validateEvidenceUri(null).isValid).toBe(false);
      expect(validateEvidenceUri(undefined).isValid).toBe(false);
    });

    it('rejects whitespace-only string', () => {
      const result = validateEvidenceUri('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Evidence URI is required');
    });
  });

  describe('unsupported schemes', () => {
    it('rejects http: scheme (must be https)', () => {
      const result = validateEvidenceUri('http://insecure.example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unsupported scheme: only https and ipfs are allowed');
    });

    it('rejects ftp: scheme', () => {
      const result = validateEvidenceUri('ftp://ftp.example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unsupported scheme: only https and ipfs are allowed');
    });

    it('fails closed against javascript: XSS vectors', () => {
      const result = validateEvidenceUri('javascript:alert(1)');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unsupported scheme: only https and ipfs are allowed');
    });

    it('fails closed against data: schemes', () => {
      const result = validateEvidenceUri('data:text/html,<script>alert(1)</script>');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unsupported scheme: only https and ipfs are allowed');
    });

    it('fails closed against file: schemes', () => {
      const result = validateEvidenceUri('file:///etc/passwd');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unsupported scheme: only https and ipfs are allowed');
    });
  });

  describe('oversized input boundary', () => {
    it('accepts URIs at exactly 1024 characters', () => {
      const base = 'https://example.com/';
      const exactUri = base + 'a'.repeat(MAX_EVIDENCE_URI_LENGTH - base.length);
      expect(exactUri.length).toBe(MAX_EVIDENCE_URI_LENGTH);

      const result = validateEvidenceUri(exactUri);
      expect(result.isValid).toBe(true);
    });

    it('accepts 1024 characters with surrounding whitespace after trimming', () => {
      const base = 'https://example.com/';
      const exactUri = '  ' + base + 'a'.repeat(MAX_EVIDENCE_URI_LENGTH - base.length) + '  ';
      const result = validateEvidenceUri(exactUri);
      expect(result.isValid).toBe(true);
    });

    it('rejects URIs exceeding 1024 characters by 1 character (1025)', () => {
      const base = 'https://example.com/';
      const overUri = base + 'a'.repeat(MAX_EVIDENCE_URI_LENGTH - base.length + 1);
      expect(overUri.length).toBe(1025);

      const result = validateEvidenceUri(overUri);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Oversized input: evidence URI must be at most 1024 characters');
    });
  });

  describe('raw secret detection', () => {
    it('rejects URIs with embedded query secrets (password=)', () => {
      const result = validateEvidenceUri('https://example.com/api?password=supersecret');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Raw secrets detected in URI. Please remove sensitive information.');
    });

    it('rejects URIs with embedded query secrets (token=)', () => {
      const result = validateEvidenceUri('https://example.com/api?token=abc12345');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Raw secrets detected in URI. Please remove sensitive information.');
    });

    it('rejects presigned storage signatures (X-Amz-Signature, sig, authorization, credential)', () => {
      expect(validateEvidenceUri('https://s3.amazonaws.com/bucket/doc?X-Amz-Signature=abc').isValid).toBe(false);
      expect(validateEvidenceUri('https://blob.core.windows.net/evidence?sig=abc').isValid).toBe(false);
      expect(validateEvidenceUri('https://storage.googleapis.com/evidence?X-Goog-Signature=abc').isValid).toBe(false);
      expect(validateEvidenceUri('https://example.com/evidence?authorization=bearer123').isValid).toBe(false);
      expect(validateEvidenceUri('https://example.com/evidence?credential=mycred').isValid).toBe(false);
    });

    it('rejects URIs with embedded basic auth credentials', () => {
      const result = validateEvidenceUri('https://user:password123@example.com/evidence');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Raw secrets detected in URI. Please remove sensitive information.');
    });
  });

  describe('malformed URIs and invalid IPFS CIDs', () => {
    it('rejects completely invalid strings', () => {
      const result = validateEvidenceUri('not-a-valid-uri');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid Evidence URI');
    });

    it('rejects invalid IPFS host that is not a valid CID', () => {
      const result = validateEvidenceUri('ipfs://not-a-valid-cid');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid IPFS CID in evidence URI');
    });
  });
});

describe('getSafeEvidenceHref', () => {
  it('returns valid https URL unmodified', () => {
    expect(getSafeEvidenceHref('https://truthbounty.io/evidence/1')).toBe(
      'https://truthbounty.io/evidence/1'
    );
  });

  it('resolves ipfs:// to safe origin-isolated dweb.link gateway URL', () => {
    expect(getSafeEvidenceHref(`ipfs://${VALID_CID_V0}`)).toBe(
      `https://dweb.link/ipfs/${VALID_CID_V0}`
    );
    expect(getSafeEvidenceHref(`ipfs://${VALID_CID_V1}/file.png`)).toBe(
      `https://dweb.link/ipfs/${VALID_CID_V1}/file.png`
    );
  });

  it('returns null for unsupported or invalid scheme', () => {
    expect(getSafeEvidenceHref('javascript:alert(1)')).toBeNull();
    expect(getSafeEvidenceHref('http://unencrypted.com')).toBeNull();
    expect(getSafeEvidenceHref('invalid-uri')).toBeNull();
  });
});
