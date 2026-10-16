/**
 * Unit tests for privacy-aware logging utilities.
 *
 * V2-FE Evidence Privacy Protection — Tests privacy-aware logging functions
 * to ensure sensitive data (evidence URLs, secrets, tokens) are automatically
 * redacted before logging.
 */

import {
  privacyLog,
  privacyInfo,
  privacyWarn,
  privacyError,
  logEvidenceEvent,
  isEvidenceMetadata,
  assertNoUnredactedEvidence,
} from '../privacy-logger';

describe('privacyLog', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('logs message without data', () => {
    privacyLog('Test message');

    expect(consoleLogSpy).toHaveBeenCalledWith('Test message');
  });

  it('redacts sensitive keys in data object', () => {
    privacyLog('User action', {
      userId: '123',
      apiKey: 'secret-key',
      token: 'bearer-token',
    });

    expect(consoleLogSpy).toHaveBeenCalled();
    const loggedData = consoleLogSpy.mock.calls[0][1];

    expect(loggedData.userId).toBe('123');
    expect(loggedData.apiKey).toBe('[REDACTED]');
    expect(loggedData.token).toBe('[REDACTED]');
  });

  it('redacts evidence URLs in data object', () => {
    privacyLog('Evidence loaded', {
      evidenceUrl: 'https://example.com/secret/file.pdf',
      claimId: 'claim-123',
    });

    expect(consoleLogSpy).toHaveBeenCalled();
    const loggedData = consoleLogSpy.mock.calls[0][1];

    expect(loggedData.claimId).toBe('claim-123');
    expect(loggedData.evidenceUrl).toBe('[REDACTED_EVIDENCE]');
  });
});

describe('privacyError', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('logs error message without data', () => {
    privacyError('Error occurred');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error occurred');
  });

  it('redacts Error objects using redactError', () => {
    const error = new Error('Failed to load');
    error.stack = 'Error: Failed to load\n  at apiKey: secret123';

    privacyError('API error', error);

    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedError = consoleErrorSpy.mock.calls[0][1];

    expect(loggedError.message).toBe('Failed to load');
    // Stack should be redacted
    expect(loggedError.stack).not.toContain('secret123');
  });

  it('redacts evidence URLs in error context', () => {
    privacyError('Evidence validation failed', {
      error: 'Invalid format',
      evidenceUrl: 'https://example.com/private/evidence.pdf',
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedData = consoleErrorSpy.mock.calls[0][1];

    expect(loggedData.evidenceUrl).toBe('[REDACTED_EVIDENCE]');
  });
});

describe('logEvidenceEvent', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('redacts evidence using redactEvidenceForTelemetry', () => {
    const evidence = {
      id: 'evidence-123',
      type: 'link',
      value: 'https://example.com/api/secret/file.pdf?token=abc',
      createdAt: '2026-09-27T12:00:00Z',
    };

    logEvidenceEvent('Evidence validated', evidence);

    expect(consoleLogSpy).toHaveBeenCalled();
    const loggedData = consoleLogSpy.mock.calls[0][1];

    // Evidence ID should be hashed
    expect(loggedData.id).toMatch(/^ev_[0-9a-f]{8}$/);
    expect(loggedData.id).not.toBe('evidence-123');

    // Display value should be truncated
    expect(loggedData.displayValue).toContain('example.com');
    expect(loggedData.displayValue).not.toContain('secret');
    expect(loggedData.displayValue).not.toContain('token');

    // Timestamp should be relative
    expect(loggedData.createdAt).not.toBe('2026-09-27T12:00:00Z');
  });

  it('supports custom log level', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const evidence = {
      id: '123',
      type: 'text',
      value: 'evidence text',
      createdAt: '2026-09-27T12:00:00Z',
    };

    logEvidenceEvent('Evidence warning', evidence, 'warn');

    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });
});

describe('isEvidenceMetadata', () => {
  it('detects evidence object', () => {
    const data = {
      evidence: {
        id: '123',
        type: 'link',
        value: 'https://example.com/file.pdf',
      },
    };

    expect(isEvidenceMetadata(data)).toBe(true);
  });

  it('detects evidenceUrl field', () => {
    const data = {
      claimId: '123',
      evidenceUrl: 'https://example.com/evidence.pdf',
    };

    expect(isEvidenceMetadata(data)).toBe(true);
  });

  it('detects evidenceValue field', () => {
    const data = {
      evidenceValue: 'ipfs://QmTest...',
    };

    expect(isEvidenceMetadata(data)).toBe(true);
  });

  it('detects evidenceCid field', () => {
    const data = {
      evidenceCid: 'QmYwAPJzv5CZsnAzt8auVZRn2tQQkDdqBvHThY6WxF8xFk',
    };

    expect(isEvidenceMetadata(data)).toBe(true);
  });

  it('returns false for non-evidence data', () => {
    const data = {
      claimId: '123',
      status: 'active',
      bounty: 100,
    };

    expect(isEvidenceMetadata(data)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isEvidenceMetadata(null)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isEvidenceMetadata('string')).toBe(false);
    expect(isEvidenceMetadata(123)).toBe(false);
    expect(isEvidenceMetadata(true)).toBe(false);
  });
});

describe('assertNoUnredactedEvidence', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('throws in development when evidence metadata detected', () => {
    const data = {
      evidenceUrl: 'https://example.com/secret.pdf',
    };

    expect(() => {
      assertNoUnredactedEvidence(data, 'test context');
    }).toThrow(/Privacy Assertion Failed.*test context.*Evidence metadata/);
  });

  it('does not throw for non-evidence data', () => {
    const data = {
      claimId: '123',
      status: 'active',
    };

    expect(() => {
      assertNoUnredactedEvidence(data, 'test context');
    }).not.toThrow();
  });

  it('does not throw in production even with evidence metadata', () => {
    process.env.NODE_ENV = 'production';

    const data = {
      evidenceUrl: 'https://example.com/secret.pdf',
    };

    expect(() => {
      assertNoUnredactedEvidence(data, 'test context');
    }).not.toThrow();
  });
});
