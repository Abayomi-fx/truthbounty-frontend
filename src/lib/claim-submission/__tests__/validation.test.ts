/**
 * Validation Utilities - Unit Tests
 * 
 * Comprehensive tests for all validation functions:
 * - Claim details validation
 * - Evidence validation
 * - Transaction validation
 * - Sanitization utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateTitle,
  validateCategory,
  validateImpact,
  validateSourceUrl,
  validateDescription,
  validateClaimDetails,
  validateFileType,
  validateFileSize,
  validateFileName,
  validateEvidenceUrl,
  verifyEvidenceIntegrity,
  validateWalletConnected,
  validateChainMatch,
  validateArtifactVersion,
  validateContractAddress,
  validateSufficientBalance,
  validateAllowance,
  validateContentDigest,
  validateFrozenConfig,
  sanitizeFileName,
  sanitizeUrl,
  redactDigest,
  stripWhitespace,
  formatFileSize,
  PREDEFINED_CATEGORIES,
  PREDEFINED_IMPACTS,
  TITLE_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  MAX_FILE_SIZE,
} from '../validation';

describe('Claim Details Validation', () => {
  describe('validateTitle', () => {
    it('accepts valid title', () => {
      const result = validateTitle('Valid claim title');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects title too short', () => {
      const result = validateTitle('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least');
    });

    it('rejects title too long', () => {
      const result = validateTitle('a'.repeat(TITLE_MAX_LENGTH + 1));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at most');
    });

    it('rejects empty title', () => {
      const result = validateTitle('');
      expect(result.valid).toBe(false);
    });

    it('rejects title with leading/trailing whitespace', () => {
      const result = validateTitle('  Valid title  ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('whitespace');
    });

    it('rejects title with XSS attempt', () => {
      const result = validateTitle('<script>alert("xss")</script>');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('script');
    });

    it('accepts title at minimum length', () => {
      const result = validateTitle('a'.repeat(TITLE_MIN_LENGTH));
      expect(result.valid).toBe(true);
    });

    it('accepts title at maximum length', () => {
      const result = validateTitle('a'.repeat(TITLE_MAX_LENGTH));
      expect(result.valid).toBe(true);
    });
  });

  describe('validateCategory', () => {
    it('accepts valid category', () => {
      const result = validateCategory('Healthcare');
      expect(result.valid).toBe(true);
    });

    it('accepts all predefined categories', () => {
      PREDEFINED_CATEGORIES.forEach(cat => {
        const result = validateCategory(cat);
        expect(result.valid).toBe(true);
      });
    });

    it('rejects invalid category', () => {
      const result = validateCategory('InvalidCategory');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('rejects empty category', () => {
      const result = validateCategory('');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateImpact', () => {
    it('accepts valid impact', () => {
      const result = validateImpact('High');
      expect(result.valid).toBe(true);
    });

    it('accepts all predefined impacts', () => {
      PREDEFINED_IMPACTS.forEach(impact => {
        const result = validateImpact(impact);
        expect(result.valid).toBe(true);
      });
    });

    it('rejects invalid impact', () => {
      const result = validateImpact('InvalidImpact');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('rejects empty impact', () => {
      const result = validateImpact('');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateSourceUrl', () => {
    it('accepts valid HTTPS URL', () => {
      const result = validateSourceUrl('https://example.com/evidence');
      expect(result.valid).toBe(true);
    });

    it('rejects HTTP URL', () => {
      const result = validateSourceUrl('http://example.com/evidence');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('HTTPS');
    });

    it('rejects invalid URL', () => {
      const result = validateSourceUrl('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('valid URL');
    });

    it('rejects javascript: URL', () => {
      const result = validateSourceUrl('javascript:alert("xss")');
      expect(result.valid).toBe(false);
    });

    it('rejects empty URL', () => {
      const result = validateSourceUrl('');
      expect(result.valid).toBe(false);
    });

    it('accepts URL with query params', () => {
      const result = validateSourceUrl('https://example.com/page?id=123&ref=test');
      expect(result.valid).toBe(true);
    });

    it('accepts URL with hash', () => {
      const result = validateSourceUrl('https://example.com/page#section');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateDescription', () => {
    it('accepts valid description', () => {
      const result = validateDescription('This is a valid description with enough characters.');
      expect(result.valid).toBe(true);
    });

    it('rejects description too short', () => {
      const result = validateDescription('Short');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least');
    });

    it('rejects description too long', () => {
      const result = validateDescription('a'.repeat(DESCRIPTION_MAX_LENGTH + 1));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at most');
    });

    it('rejects empty description', () => {
      const result = validateDescription('');
      expect(result.valid).toBe(false);
    });

    it('rejects description with XSS attempt', () => {
      const result = validateDescription('<script>alert("xss")</script> Some text to make it long enough');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('script');
    });

    it('accepts description at minimum length', () => {
      const result = validateDescription('a'.repeat(DESCRIPTION_MIN_LENGTH));
      expect(result.valid).toBe(true);
    });

    it('accepts description at maximum length', () => {
      const result = validateDescription('a'.repeat(DESCRIPTION_MAX_LENGTH));
      expect(result.valid).toBe(true);
    });
  });

  describe('validateClaimDetails', () => {
    it('validates complete valid claim', () => {
      const result = validateClaimDetails({
        title: 'Valid claim title',
        category: 'Healthcare',
        impact: 'High',
        source: 'https://example.com/evidence',
        description: 'This is a valid description with enough characters to pass validation.',
      });
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('returns all errors for invalid claim', () => {
      const result = validateClaimDetails({
        title: 'abc',
        category: 'Invalid',
        impact: 'Invalid',
        source: 'http://example.com',
        description: 'Short',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.title).toBeDefined();
      expect(result.errors.category).toBeDefined();
      expect(result.errors.impact).toBeDefined();
      expect(result.errors.source).toBeDefined();
      expect(result.errors.description).toBeDefined();
    });
  });
});

describe('Evidence Validation', () => {
  describe('validateFileType', () => {
    it('accepts PDF file', () => {
      const file = new File([''], 'test.pdf', { type: 'application/pdf' });
      const result = validateFileType(file);
      expect(result.valid).toBe(true);
    });

    it('accepts PNG file', () => {
      const file = new File([''], 'test.png', { type: 'image/png' });
      const result = validateFileType(file);
      expect(result.valid).toBe(true);
    });

    it('accepts JPG file', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const result = validateFileType(file);
      expect(result.valid).toBe(true);
    });

    it('accepts MP4 video', () => {
      const file = new File([''], 'test.mp4', { type: 'video/mp4' });
      const result = validateFileType(file);
      expect(result.valid).toBe(true);
    });

    it('rejects unsupported file type', () => {
      const file = new File([''], 'test.exe', { type: 'application/x-msdownload' });
      const result = validateFileType(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });
  });

  describe('validateFileSize', () => {
    it('accepts file within size limit', () => {
      const file = new File(['x'.repeat(1024 * 1024)], 'test.pdf'); // 1MB
      const result = validateFileSize(file);
      expect(result.valid).toBe(true);
    });

    it('rejects file exceeding size limit', () => {
      const file = new File(['x'.repeat(MAX_FILE_SIZE + 1)], 'test.pdf');
      const result = validateFileSize(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('rejects zero-size file', () => {
      const file = new File([''], 'test.pdf');
      const result = validateFileSize(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('accepts file at maximum size', () => {
      const file = new File(['x'.repeat(MAX_FILE_SIZE)], 'test.pdf');
      const result = validateFileSize(file);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateFileName', () => {
    it('accepts valid filename', () => {
      const result = validateFileName('evidence.pdf');
      expect(result.valid).toBe(true);
    });

    it('rejects path traversal attempt', () => {
      const result = validateFileName('../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid');
    });

    it('rejects null byte', () => {
      const result = validateFileName('file\0.pdf');
      expect(result.valid).toBe(false);
    });

    it('rejects filename without extension', () => {
      const result = validateFileName('evidence');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('extension');
    });

    it('accepts filename with multiple dots', () => {
      const result = validateFileName('my.evidence.file.pdf');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateEvidenceUrl', () => {
    it('accepts valid HTTPS URL', () => {
      const result = validateEvidenceUrl('https://example.com/evidence.pdf');
      expect(result.valid).toBe(true);
    });

    it('rejects HTTP URL', () => {
      const result = validateEvidenceUrl('http://example.com/evidence.pdf');
      expect(result.valid).toBe(false);
    });

    it('rejects localhost URL', () => {
      const result = validateEvidenceUrl('https://localhost/file');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('localhost');
    });

    it('rejects 127.0.0.1 URL', () => {
      const result = validateEvidenceUrl('https://127.0.0.1/file');
      expect(result.valid).toBe(false);
    });
  });

  describe('verifyEvidenceIntegrity', () => {
    it('accepts matching hashes', () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = verifyEvidenceIntegrity(hash, hash);
      expect(result.valid).toBe(true);
    });

    it('rejects mismatched hashes', () => {
      const local = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const canonical = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const result = verifyEvidenceIntegrity(local, canonical);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mismatch');
    });
  });
});

describe('Transaction Validation', () => {
  describe('validateWalletConnected', () => {
    it('accepts valid address', () => {
      const result = validateWalletConnected('0x1234567890123456789012345678901234567890');
      expect(result.valid).toBe(true);
    });

    it('rejects undefined address', () => {
      const result = validateWalletConnected(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not connected');
    });

    it('rejects empty address', () => {
      const result = validateWalletConnected('' as any);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateChainMatch', () => {
    it('accepts matching chains', () => {
      const result = validateChainMatch(10, 10);
      expect(result.valid).toBe(true);
    });

    it('rejects mismatched chains', () => {
      const result = validateChainMatch(1, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mismatch');
    });
  });

  describe('validateSufficientBalance', () => {
    it('accepts sufficient balance', () => {
      const result = validateSufficientBalance(1000n, 500n);
      expect(result.valid).toBe(true);
    });

    it('rejects insufficient balance', () => {
      const result = validateSufficientBalance(100n, 500n);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Insufficient');
    });

    it('accepts exact balance', () => {
      const result = validateSufficientBalance(500n, 500n);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateAllowance', () => {
    it('accepts sufficient allowance', () => {
      const result = validateAllowance(1000n, 500n);
      expect(result.valid).toBe(true);
    });

    it('rejects insufficient allowance', () => {
      const result = validateAllowance(100n, 500n);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('allowance');
    });
  });

  describe('validateContentDigest', () => {
    it('accepts valid 32-byte hex digest', () => {
      const result = validateContentDigest('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      expect(result.valid).toBe(true);
    });

    it('rejects digest without 0x prefix', () => {
      const result = validateContentDigest('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      expect(result.valid).toBe(false);
    });

    it('rejects digest with wrong length', () => {
      const result = validateContentDigest('0x1234');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('32 bytes');
    });
  });
});

describe('Sanitization Utilities', () => {
  describe('sanitizeFileName', () => {
    it('returns generic filename for PDF', () => {
      const result = sanitizeFileName('my-secret-document.pdf');
      expect(result).toBe('evidence.pdf');
    });

    it('returns generic filename for PNG', () => {
      const result = sanitizeFileName('screenshot-2024.png');
      expect(result).toBe('evidence.png');
    });

    it('preserves extension', () => {
      const result = sanitizeFileName('document.mp4');
      expect(result).toBe('evidence.mp4');
    });

    it('handles filename without extension', () => {
      const result = sanitizeFileName('document');
      expect(result).toBe('evidence');
    });
  });

  describe('sanitizeUrl', () => {
    it('returns domain-only URL', () => {
      const result = sanitizeUrl('https://example.com/path/to/evidence.pdf');
      expect(result).toBe('evidence from example.com');
    });

    it('handles URL with port', () => {
      const result = sanitizeUrl('https://example.com:8080/file');
      expect(result).toBe('evidence from example.com:8080');
    });

    it('handles invalid URL', () => {
      const result = sanitizeUrl('not-a-url');
      expect(result).toBe('[redacted URL]');
    });
  });

  describe('redactDigest', () => {
    it('returns redacted string', () => {
      const result = redactDigest('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      expect(result).toBe('[redacted]');
    });
  });

  describe('stripWhitespace', () => {
    it('removes leading and trailing whitespace', () => {
      const result = stripWhitespace('  text  ');
      expect(result).toBe('text');
    });

    it('preserves internal whitespace', () => {
      const result = stripWhitespace('  hello world  ');
      expect(result).toBe('hello world');
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
    });

    it('formats gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    });
  });
});
