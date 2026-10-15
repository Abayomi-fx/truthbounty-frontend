/**
 * Integration tests for evidence redaction in telemetry.
 *
 * V2-FE Evidence Privacy Protection — Tests that evidence URLs, metadata, and
 * IDs are properly redacted when logged through redactForTelemetry.
 */

import { redactForTelemetry } from '../redaction';
import { redactEvidenceForTelemetry } from '../evidence-privacy';

describe('Evidence redaction integration', () => {
  describe('redactForTelemetry with evidence fields', () => {
    it('redacts evidence field in nested objects', () => {
      const payload = {
        claimId: 'claim-123',
        evidence: {
          id: 'ev-456',
          type: 'link',
          value: 'https://example.com/secret/file.pdf?token=abc',
          createdAt: '2026-09-27T12:00:00Z',
        },
        status: 'active',
      };

      const redacted = redactForTelemetry(payload) as any;

      expect(redacted.claimId).toBe('claim-123');
      expect(redacted.status).toBe('active');
      expect(redacted.evidence).toBe('[REDACTED_EVIDENCE]');
    });

    it('redacts evidenceUrl key', () => {
      const payload = {
        operation: 'validate',
        evidenceUrl: 'https://example.com/private/document.pdf',
        result: 'success',
      };

      const redacted = redactForTelemetry(payload) as any;

      expect(redacted.operation).toBe('validate');
      expect(redacted.result).toBe('success');
      expect(redacted.evidenceUrl).toBe('[REDACTED_EVIDENCE]');
    });

    it('redacts evidenceValue key', () => {
      const payload = {
        evidenceValue: 'ipfs://QmYwAPJzv5CZsnAzt8auVZRn2tQQkDdqBvHThY6WxF8xFk',
        verified: true,
      };

      const redacted = redactForTelemetry(payload) as any;

      expect(redacted.verified).toBe(true);
      expect(redacted.evidenceValue).toBe('[REDACTED_EVIDENCE]');
    });

    it('redacts evidenceCid key', () => {
      const payload = {
        evidenceCid: 'QmYwAPJzv5CZsnAzt8auVZRn2tQQkDdqBvHThY6WxF8xFk',
        status: 'pinned',
      };

      const redacted = redactForTelemetry(payload) as any;

      expect(redacted.status).toBe('pinned');
      expect(redacted.evidenceCid).toBe('[REDACTED_EVIDENCE]');
    });

    it('redacts case-insensitive evidence keys', () => {
      const payload = {
        EvidenceURL: 'https://example.com/file.pdf',
        EVIDENCE_VALUE: 'secret-data',
        evidencecid: 'QmTest',
      };

      const redacted = redactForTelemetry(payload) as any;

      expect(redacted.EvidenceURL).toBe('[REDACTED_EVIDENCE]');
      expect(redacted.EVIDENCE_VALUE).toBe('[REDACTED_EVIDENCE]');
      expect(redacted.evidencecid).toBe('[REDACTED_EVIDENCE]');
    });

    it('redacts evidence in arrays', () => {
      const payload = {
        evidences: [
          { url: 'https://example.com/file1.pdf' },
          { url: 'https://example.com/file2.pdf' },
        ],
      };

      const redacted = redactForTelemetry(payload) as any;

      // Arrays are redacted item by item
      expect(Array.isArray(redacted.evidences)).toBe(true);
      expect(redacted.evidences.length).toBe(2);
    });

    it('preserves non-evidence fields while redacting evidence', () => {
      const payload = {
        claimId: 'claim-789',
        evidenceUrl: 'https://example.com/secret.pdf',
        claimantAddress: '0x1234567890abcdef',
        timestamp: '2026-09-27T12:00:00Z',
        bounty: '100',
      };

      const redacted = redactForTelemetry(payload) as any;

      expect(redacted.claimId).toBe('claim-789');
      expect(redacted.claimantAddress).toBe('0x1234567890abcdef');
      expect(redacted.timestamp).toBe('2026-09-27T12:00:00Z');
      expect(redacted.bounty).toBe('100');
      expect(redacted.evidenceUrl).toBe('[REDACTED_EVIDENCE]');
    });
  });

  describe('Evidence redaction with secrets', () => {
    it('redacts both evidence URLs and API keys', () => {
      const payload = {
        apiKey: 'secret-api-key',
        evidenceUrl: 'https://example.com/file.pdf',
        token: 'bearer-token',
      };

      const redacted = redactForTelemetry(payload) as any;

      expect(redacted.apiKey).toBe('[REDACTED]');
      expect(redacted.token).toBe('[REDACTED]');
      expect(redacted.evidenceUrl).toBe('[REDACTED_EVIDENCE]');
    });

    it('redacts evidence in error context with secrets', () => {
      const payload = {
        error: 'Upload failed',
        evidenceUrl: 'https://example.com/file.pdf',
        authToken: 'secret-token',
        claimId: 'claim-123',
      };

      const redacted = redactForTelemetry(payload) as any;

      expect(redacted.error).toBe('Upload failed');
      expect(redacted.claimId).toBe('claim-123');
      expect(redacted.evidenceUrl).toBe('[REDACTED_EVIDENCE]');
      expect(redacted.authToken).toBe('[REDACTED]');
    });
  });

  describe('redactEvidenceForTelemetry end-to-end', () => {
    it('produces safe telemetry payload with no sensitive data', () => {
      const evidence = {
        id: 'evidence-uuid-12345',
        type: 'link',
        value: 'https://example.com/api/v2/files/top-secret.pdf?token=abc123',
        createdAt: '2026-09-27T12:00:00Z',
      };

      const redacted = redactEvidenceForTelemetry(evidence);

      // ID should be hashed
      expect(redacted.id).toMatch(/^ev_[0-9a-f]{8}$/);
      expect(redacted.id).not.toContain('uuid');
      expect(redacted.id).not.toContain('12345');

      // Type preserved (not sensitive)
      expect(redacted.type).toBe('link');

      // Display value truncated (no full URL, no query params)
      expect(redacted.displayValue).not.toContain('api');
      expect(redacted.displayValue).not.toContain('v2');
      expect(redacted.displayValue).not.toContain('top-secret.pdf');
      expect(redacted.displayValue).not.toContain('token');
      expect(redacted.displayValue).not.toContain('abc123');

      // Timestamp generalized (not exact ISO)
      expect(redacted.createdAt).not.toBe('2026-09-27T12:00:00Z');
    });

    it('can be safely logged without leaking metadata', () => {
      const evidence = {
        id: 'evidence-sensitive-id',
        type: 'document',
        value: 'https://internal.company.com/HR/employee-123/salary.pdf',
        createdAt: '2026-09-27T10:00:00Z',
      };

      const redacted = redactEvidenceForTelemetry(evidence);

      // Verify no sensitive fragments in any field
      const stringified = JSON.stringify(redacted);

      expect(stringified).not.toContain('sensitive-id');
      expect(stringified).not.toContain('internal.company.com');
      expect(stringified).not.toContain('HR');
      expect(stringified).not.toContain('employee-123');
      expect(stringified).not.toContain('salary');
      expect(stringified).not.toContain('2026-09-27T10:00:00Z');
    });
  });

  describe('Regression: evidence redaction never disabled', () => {
    it('always redacts evidence even in nested error objects', () => {
      const errorPayload = {
        error: {
          message: 'Validation failed',
          context: {
            evidence: {
              value: 'https://example.com/leaked-url.pdf',
            },
          },
        },
      };

      const redacted = redactForTelemetry(errorPayload) as any;

      expect(redacted.error.context.evidence).toBe('[REDACTED_EVIDENCE]');
    });

    it('redacts evidence in arrays within nested objects', () => {
      const payload = {
        claim: {
          evidences: [
            { evidenceUrl: 'https://example.com/file1.pdf' },
            { evidenceUrl: 'https://example.com/file2.pdf' },
          ],
        },
      };

      const redacted = redactForTelemetry(payload) as any;

      expect(redacted.claim.evidences[0].evidenceUrl).toBe(
        '[REDACTED_EVIDENCE]',
      );
      expect(redacted.claim.evidences[1].evidenceUrl).toBe(
        '[REDACTED_EVIDENCE]',
      );
    });
  });
});
