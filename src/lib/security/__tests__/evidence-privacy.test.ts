/**
 * Unit tests for evidence privacy utilities.
 *
 * V2-FE Evidence Privacy Protection — Tests URL truncation, IPFS CID
 * truncation, timestamp generalization, evidence ID hashing, and telemetry
 * redaction.
 *
 * Coverage:
 *   - truncateEvidenceUrl (HTTPS, IPFS, edge cases)
 *   - truncateIpfsCid (various CID formats)
 *   - stripQueryParams (query strings, hash fragments)
 *   - formatRelativeTime (all granularity levels)
 *   - hashEvidenceId (async + sync versions)
 *   - redactEvidenceForTelemetry (complete redaction)
 */

import {
  truncateEvidenceUrl,
  truncateIpfsCid,
  stripQueryParams,
  formatRelativeTime,
  hashEvidenceId,
  hashEvidenceIdSync,
  redactEvidenceForTelemetry,
} from '../evidence-privacy';

describe('truncateEvidenceUrl', () => {
  it('truncates HTTPS URL with deep path to domain/.../filename', () => {
    const url = 'https://example.com/api/v2/files/evidence/report.pdf';
    const result = truncateEvidenceUrl(url);

    expect(result.display).toBe('example.com/.../report.pdf');
    expect(result.full).toBe(url);
    expect(result.hostname).toBe('example.com');
    expect(result.isIpfs).toBe(false);
  });

  it('truncates URL with query parameters (strips from display)', () => {
    const url = 'https://example.com/path/to/file.pdf?token=abc123&session=xyz';
    const result = truncateEvidenceUrl(url);

    expect(result.display).toBe('example.com/.../file.pdf');
    expect(result.full).toBe(url);
    expect(result.display).not.toContain('token');
    expect(result.display).not.toContain('session');
  });

  it('handles URLs with hash fragments', () => {
    const url = 'https://example.com/docs/guide.html#section-2';
    const result = truncateEvidenceUrl(url);

    expect(result.display).toBe('example.com/docs/guide.html');
    expect(result.full).toBe(url);
    expect(result.display).not.toContain('#');
  });

  it('handles short paths (1 segment) without truncation', () => {
    const url = 'https://example.com/file.pdf';
    const result = truncateEvidenceUrl(url);

    expect(result.display).toBe('example.com/file.pdf');
  });

  it('handles medium paths (2 segments) without truncation', () => {
    const url = 'https://example.com/docs/file.pdf';
    const result = truncateEvidenceUrl(url);

    expect(result.display).toBe('example.com/docs/file.pdf');
  });

  it('handles root path', () => {
    const url = 'https://example.com/';
    const result = truncateEvidenceUrl(url);

    expect(result.display).toBe('example.com/');
  });

  it('handles path without filename', () => {
    const url = 'https://example.com/api/v2/endpoint';
    const result = truncateEvidenceUrl(url);

    expect(result.display).toBe('example.com/.../endpoint');
  });

  it('fails closed on invalid URL', () => {
    const result = truncateEvidenceUrl('not-a-url');

    expect(result.display).toBe('[Invalid URL]');
    expect(result.full).toBe('not-a-url');
    expect(result.hostname).toBe('');
  });

  it('fails closed on empty string', () => {
    const result = truncateEvidenceUrl('');

    expect(result.display).toBe('[Invalid URL]');
    expect(result.full).toBe('');
  });

  it('fails closed on non-string input', () => {
    const result = truncateEvidenceUrl(null as any);

    expect(result.display).toBe('[Invalid URL]');
  });

  it('delegates to truncateIpfsCid for IPFS URLs', () => {
    const url = 'ipfs://QmYwAPJzv5CZsnAzt8auVZRn2tQQkDdqBvHThY6WxF8xFk';
    const result = truncateEvidenceUrl(url);

    expect(result.isIpfs).toBe(true);
    expect(result.display).toContain('(IPFS)');
    expect(result.display).toContain('...');
  });
});

describe('truncateIpfsCid', () => {
  it('truncates CIDv0 (Qm...) to first 8 + last 6 chars', () => {
    const cid = 'QmYwAPJzv5CZsnAzt8auVZRn2tQQkDdqBvHThY6WxF8xFk';
    const url = `ipfs://${cid}`;
    const result = truncateIpfsCid(url);

    expect(result.display).toBe('QmYwAPJz...F8xFk (IPFS)');
    expect(result.full).toBe(url);
    expect(result.isIpfs).toBe(true);
  });

  it('truncates IPFS gateway URL with /ipfs/ path', () => {
    const cid = 'QmYwAPJzv5CZsnAzt8auVZRn2tQQkDdqBvHThY6WxF8xFk';
    const url = `https://ipfs.io/ipfs/${cid}`;
    const result = truncateIpfsCid(url);

    expect(result.display).toBe('QmYwAPJz...F8xFk (IPFS)');
    expect(result.isIpfs).toBe(true);
  });

  it('truncates CIDv1 (bafy...) correctly', () => {
    const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
    const url = `ipfs://${cid}`;
    const result = truncateIpfsCid(url);

    expect(result.display).toContain('bafybeig');
    expect(result.display).toContain('...');
    expect(result.display).toContain('55fbzdi');
    expect(result.display).toContain('(IPFS)');
  });

  it('handles short CID without truncation', () => {
    const shortCid = 'QmShort123';
    const url = `ipfs://${shortCid}`;
    const result = truncateIpfsCid(url);

    expect(result.display).toBe(`${shortCid} (IPFS)`);
  });

  it('fails closed on invalid IPFS URL', () => {
    const result = truncateIpfsCid('ipfs://not-a-valid-cid');

    expect(result.display).toBe('[Invalid IPFS URL]');
    expect(result.isIpfs).toBe(true);
  });

  it('fails closed on empty string', () => {
    const result = truncateIpfsCid('');

    expect(result.display).toBe('[Invalid IPFS URL]');
  });
});

describe('stripQueryParams', () => {
  it('removes query parameters from URL', () => {
    const url = 'https://example.com/path?key=value&token=abc';
    const result = stripQueryParams(url);

    expect(result).toBe('https://example.com/path');
    expect(result).not.toContain('?');
    expect(result).not.toContain('key');
  });

  it('removes hash fragment from URL', () => {
    const url = 'https://example.com/path#anchor';
    const result = stripQueryParams(url);

    expect(result).toBe('https://example.com/path');
    expect(result).not.toContain('#');
  });

  it('removes both query params and hash', () => {
    const url = 'https://example.com/path?token=xyz#section';
    const result = stripQueryParams(url);

    expect(result).toBe('https://example.com/path');
  });

  it('preserves URL without query params', () => {
    const url = 'https://example.com/path/file.pdf';
    const result = stripQueryParams(url);

    expect(result).toBe(url);
  });

  it('fails closed on invalid URL', () => {
    const result = stripQueryParams('not-a-url?param=value');

    // Regex fallback strips everything after ?
    expect(result).toBe('not-a-url');
  });

  it('returns empty string for empty input', () => {
    const result = stripQueryParams('');

    expect(result).toBe('');
  });
});

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-09-27T14:00:00Z');

  it('formats time < 1 minute as "just now"', () => {
    const timestamp = new Date('2026-09-27T13:59:30Z'); // 30s ago
    const result = formatRelativeTime(timestamp, NOW);

    expect(result.display).toBe('just now');
    expect(result.value).toBe(0);
    expect(result.unit).toBe('m');
  });

  it('formats time in minutes (~5m ago)', () => {
    const timestamp = new Date('2026-09-27T13:55:00Z'); // 5m ago
    const result = formatRelativeTime(timestamp, NOW);

    expect(result.display).toBe('~5m ago');
    expect(result.value).toBe(5);
    expect(result.unit).toBe('m');
  });

  it('formats time in hours (~2h ago)', () => {
    const timestamp = new Date('2026-09-27T12:00:00Z'); // 2h ago
    const result = formatRelativeTime(timestamp, NOW);

    expect(result.display).toBe('~2h ago');
    expect(result.value).toBe(2);
    expect(result.unit).toBe('h');
  });

  it('formats time in days (~3d ago)', () => {
    const timestamp = new Date('2026-09-24T14:00:00Z'); // 3d ago
    const result = formatRelativeTime(timestamp, NOW);

    expect(result.display).toBe('~3d ago');
    expect(result.value).toBe(3);
    expect(result.unit).toBe('d');
  });

  it('formats time in weeks (~2w ago)', () => {
    const timestamp = new Date('2026-09-13T14:00:00Z'); // 2w ago
    const result = formatRelativeTime(timestamp, NOW);

    expect(result.display).toBe('~2w ago');
    expect(result.value).toBe(2);
    expect(result.unit).toBe('w');
  });

  it('formats time > 4 weeks as date-only (YYYY-MM-DD)', () => {
    const timestamp = new Date('2026-08-01T14:00:00Z'); // ~8w ago
    const result = formatRelativeTime(timestamp, NOW);

    expect(result.display).toBe('2026-08-01');
    expect(result.isDateOnly).toBe(true);
  });

  it('handles ISO string input', () => {
    const result = formatRelativeTime('2026-09-27T12:00:00Z', NOW);

    expect(result.display).toBe('~2h ago');
  });

  it('handles future timestamps as "just now"', () => {
    const future = new Date('2026-09-27T15:00:00Z'); // 1h in future
    const result = formatRelativeTime(future, NOW);

    expect(result.display).toBe('just now');
  });

  it('fails closed on invalid timestamp', () => {
    const result = formatRelativeTime('not-a-date', NOW);

    expect(result.display).toBe('[Invalid timestamp]');
  });
});

describe('hashEvidenceId', () => {
  it('hashes evidence ID with SHA-256 and returns ev_ prefix', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const hash = await hashEvidenceId(id);

    expect(hash).toMatch(/^ev_[0-9a-f]{16}$/);
    expect(hash.length).toBe(19); // 'ev_' + 16 hex chars
  });

  it('produces consistent hashes for same input', async () => {
    const id = 'test-evidence-123';
    const hash1 = await hashEvidenceId(id);
    const hash2 = await hashEvidenceId(id);

    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different inputs', async () => {
    const hash1 = await hashEvidenceId('evidence-1');
    const hash2 = await hashEvidenceId('evidence-2');

    expect(hash1).not.toBe(hash2);
  });

  it('fails closed on empty string', async () => {
    const hash = await hashEvidenceId('');

    expect(hash).toBe('ev_invalid');
  });

  it('fails closed on non-string input', async () => {
    const hash = await hashEvidenceId(null as any);

    expect(hash).toBe('ev_invalid');
  });
});

describe('hashEvidenceIdSync', () => {
  it('hashes evidence ID synchronously with ev_ prefix', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const hash = hashEvidenceIdSync(id);

    expect(hash).toMatch(/^ev_[0-9a-f]{8}$/);
    expect(hash.length).toBe(11); // 'ev_' + 8 hex chars
  });

  it('produces consistent hashes for same input', () => {
    const id = 'test-evidence-123';
    const hash1 = hashEvidenceIdSync(id);
    const hash2 = hashEvidenceIdSync(id);

    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = hashEvidenceIdSync('evidence-1');
    const hash2 = hashEvidenceIdSync('evidence-2');

    expect(hash1).not.toBe(hash2);
  });

  it('fails closed on empty string', () => {
    const hash = hashEvidenceIdSync('');

    expect(hash).toBe('ev_invalid');
  });
});

describe('redactEvidenceForTelemetry', () => {
  it('redacts evidence URL to truncated display', () => {
    const evidence = {
      id: '123',
      type: 'link',
      value: 'https://example.com/api/v2/files/secret.pdf?token=abc',
      createdAt: '2026-09-27T12:00:00Z',
    };

    const result = redactEvidenceForTelemetry(evidence);

    expect(result.displayValue).toBe('example.com/.../secret.pdf');
    expect(result.displayValue).not.toContain('token');
    expect(result.displayValue).not.toContain('api');
    expect(result.displayValue).not.toContain('v2');
  });

  it('hashes evidence ID', () => {
    const evidence = {
      id: 'evidence-123',
      type: 'link',
      value: 'https://example.com/file.pdf',
      createdAt: '2026-09-27T12:00:00Z',
    };

    const result = redactEvidenceForTelemetry(evidence);

    expect(result.id).toMatch(/^ev_[0-9a-f]{8}$/);
    expect(result.id).not.toBe('evidence-123');
  });

  it('generalizes timestamp to relative time', () => {
    const evidence = {
      id: '123',
      type: 'link',
      value: 'https://example.com/file.pdf',
      createdAt: '2026-09-27T12:00:00Z',
    };

    const result = redactEvidenceForTelemetry(evidence);

    // Should be relative time, not ISO string
    expect(result.createdAt).not.toBe('2026-09-27T12:00:00Z');
    expect(result.createdAt).toMatch(/ago|just now|^\d{4}-\d{2}-\d{2}$/);
  });

  it('redacts text evidence by showing length only', () => {
    const evidence = {
      id: '123',
      type: 'text',
      value: 'This is secret evidence text that should not be logged',
      createdAt: '2026-09-27T12:00:00Z',
    };

    const result = redactEvidenceForTelemetry(evidence);

    expect(result.displayValue).toContain('text');
    expect(result.displayValue).toContain('55 chars');
    expect(result.displayValue).not.toContain('secret');
  });

  it('redacts IPFS evidence to truncated CID', () => {
    const evidence = {
      id: '123',
      type: 'image',
      value: 'ipfs://QmYwAPJzv5CZsnAzt8auVZRn2tQQkDdqBvHThY6WxF8xFk',
      createdAt: '2026-09-27T12:00:00Z',
    };

    const result = redactEvidenceForTelemetry(evidence);

    expect(result.displayValue).toContain('...');
    expect(result.displayValue).toContain('(IPFS)');
    expect(result.displayValue).not.toContain('QmYwAPJzv5CZsnAzt8auVZRn2tQQkDdqBvHThY6WxF8xFk');
  });

  it('preserves evidence type', () => {
    const types = ['link', 'text', 'image', 'video', 'document'];

    types.forEach((type) => {
      const evidence = {
        id: '123',
        type,
        value: 'https://example.com/file',
        createdAt: '2026-09-27T12:00:00Z',
      };

      const result = redactEvidenceForTelemetry(evidence);
      expect(result.type).toBe(type);
    });
  });
});
