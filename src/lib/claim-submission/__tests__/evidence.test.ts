/**
 * Evidence Handling Utilities - Unit Tests
 * 
 * Tests for evidence state management, file hashing, and session storage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createEvidenceState,
  createFileEvidenceState,
  createUrlEvidenceState,
  updateEvidenceStatus,
  updateEvidenceProgress,
  markEvidenceVerified,
  markEvidenceFailed,
  markEvidenceCancelled,
  invalidateEvidence,
  isEvidenceTerminal,
  isEvidenceInProgress,
  canRetryEvidence,
  shouldInvalidateOnWalletChange,
  calculateEvidenceProgress,
  getEvidenceStatusMessage,
  extractFileMetadata,
  getFileExtension,
  isFileApiSupported,
  isWebCryptoSupported,
  validateBrowserSupport,
  formatUploadSpeed,
  estimateRemainingTime,
  formatRemainingTime,
} from '../evidence';

describe('Evidence State Creation', () => {
  describe('createEvidenceState', () => {
    it('creates initial idle state', () => {
      const state = createEvidenceState();
      expect(state.source).toBeNull();
      expect(state.status).toBe('idle');
      expect(state.progress).toBe(0);
      expect(state.error).toBeNull();
      expect(state.digest).toBeNull();
      expect(state.canProceed).toBe(false);
    });
  });

  describe('createFileEvidenceState', () => {
    it('creates state from file', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const state = createFileEvidenceState(file);
      
      expect(state.source).toBe('file');
      expect(state.status).toBe('idle');
      expect(state.fileName).toBe('test.pdf');
      expect(state.fileSize).toBe(file.size);
      expect(state.fileType).toBe('application/pdf');
      expect(state.url).toBeNull();
    });

    it('creates state with digest', () => {
      const file = new File(['content'], 'test.pdf');
      const digest = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const state = createFileEvidenceState(file, digest);
      
      expect(state.digest).toBe(digest);
      expect(state.status).toBe('verified');
      expect(state.canProceed).toBe(true);
    });
  });

  describe('createUrlEvidenceState', () => {
    it('creates state from URL', () => {
      const url = 'https://example.com/evidence.pdf';
      const state = createUrlEvidenceState(url);
      
      expect(state.source).toBe('url');
      expect(state.status).toBe('idle');
      expect(state.url).toBe(url);
      expect(state.fileName).toBeNull();
      expect(state.fileSize).toBeNull();
    });

    it('creates verified state', () => {
      const url = 'https://example.com/evidence.pdf';
      const state = createUrlEvidenceState(url, true);
      
      expect(state.status).toBe('verified');
      expect(state.canProceed).toBe(true);
    });
  });
});

describe('Evidence State Transitions', () => {
  describe('updateEvidenceStatus', () => {
    it('updates status', () => {
      const initial = createEvidenceState();
      const updated = updateEvidenceStatus(initial, 'validating');
      
      expect(updated.status).toBe('validating');
      expect(updated.error).toBeNull();
    });

    it('sets error when provided', () => {
      const initial = createEvidenceState();
      const updated = updateEvidenceStatus(initial, 'failed', 'Upload failed');
      
      expect(updated.status).toBe('failed');
      expect(updated.error).toBe('Upload failed');
      expect(updated.canProceed).toBe(false);
    });

    it('clears digest when invalidated', () => {
      const initial = createFileEvidenceState(
        new File([''], 'test.pdf'),
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      );
      const updated = updateEvidenceStatus(initial, 'invalidated');
      
      expect(updated.status).toBe('invalidated');
      expect(updated.digest).toBeNull();
      expect(updated.canProceed).toBe(false);
    });
  });

  describe('updateEvidenceProgress', () => {
    it('updates progress', () => {
      const initial = createEvidenceState();
      const updated = updateEvidenceProgress(initial, 50);
      
      expect(updated.progress).toBe(50);
    });

    it('caps progress at 99% for non-verified states', () => {
      const initial = updateEvidenceStatus(createEvidenceState(), 'uploading');
      const updated = updateEvidenceProgress(initial, 100);
      
      expect(updated.progress).toBe(99);
    });

    it('allows 100% for verified state', () => {
      const initial = updateEvidenceStatus(createEvidenceState(), 'verified');
      const updated = updateEvidenceProgress(initial, 100);
      
      expect(updated.progress).toBe(100);
    });

    it('clamps progress to 0-100 range', () => {
      const initial = createEvidenceState();
      const negative = updateEvidenceProgress(initial, -10);
      const overflow = updateEvidenceProgress(initial, 150);
      
      expect(negative.progress).toBe(0);
      expect(overflow.progress).toBe(99); // Capped
    });
  });

  describe('markEvidenceVerified', () => {
    it('marks evidence as verified', () => {
      const initial = createEvidenceState();
      const digest = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const updated = markEvidenceVerified(initial, digest);
      
      expect(updated.status).toBe('verified');
      expect(updated.digest).toBe(digest);
      expect(updated.progress).toBe(100);
      expect(updated.canProceed).toBe(true);
      expect(updated.error).toBeNull();
    });
  });

  describe('markEvidenceFailed', () => {
    it('marks evidence as failed', () => {
      const initial = createEvidenceState();
      const updated = markEvidenceFailed(initial, 'Upload error');
      
      expect(updated.status).toBe('failed');
      expect(updated.error).toBe('Upload error');
      expect(updated.canProceed).toBe(false);
      expect(updated.digest).toBeNull();
    });
  });

  describe('markEvidenceCancelled', () => {
    it('marks evidence as cancelled', () => {
      const initial = updateEvidenceStatus(createEvidenceState(), 'uploading');
      const updated = markEvidenceCancelled(initial);
      
      expect(updated.status).toBe('cancelled');
      expect(updated.canProceed).toBe(false);
      expect(updated.error).toBeNull();
    });
  });

  describe('invalidateEvidence', () => {
    it('invalidates evidence and clears digest', () => {
      const initial = markEvidenceVerified(
        createEvidenceState(),
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      );
      const updated = invalidateEvidence(initial);
      
      expect(updated.status).toBe('invalidated');
      expect(updated.digest).toBeNull();
      expect(updated.canProceed).toBe(false);
      expect(updated.error).toContain('invalidated');
    });
  });
});

describe('Evidence State Checks', () => {
  describe('isEvidenceTerminal', () => {
    it('returns true for verified', () => {
      const state = updateEvidenceStatus(createEvidenceState(), 'verified');
      expect(isEvidenceTerminal(state)).toBe(true);
    });

    it('returns true for failed', () => {
      const state = updateEvidenceStatus(createEvidenceState(), 'failed');
      expect(isEvidenceTerminal(state)).toBe(true);
    });

    it('returns true for cancelled', () => {
      const state = updateEvidenceStatus(createEvidenceState(), 'cancelled');
      expect(isEvidenceTerminal(state)).toBe(true);
    });

    it('returns true for invalidated', () => {
      const state = updateEvidenceStatus(createEvidenceState(), 'invalidated');
      expect(isEvidenceTerminal(state)).toBe(true);
    });

    it('returns false for idle', () => {
      const state = createEvidenceState();
      expect(isEvidenceTerminal(state)).toBe(false);
    });

    it('returns false for uploading', () => {
      const state = updateEvidenceStatus(createEvidenceState(), 'uploading');
      expect(isEvidenceTerminal(state)).toBe(false);
    });
  });

  describe('isEvidenceInProgress', () => {
    it('returns true for validating', () => {
      const state = updateEvidenceStatus(createEvidenceState(), 'validating');
      expect(isEvidenceInProgress(state)).toBe(true);
    });

    it('returns true for hashing', () => {
      const state = updateEvidenceStatus(createEvidenceState(), 'hashing');
      expect(isEvidenceInProgress(state)).toBe(true);
    });

    it('returns true for uploading', () => {
      const state = updateEvidenceStatus(createEvidenceState(), 'uploading');
      expect(isEvidenceInProgress(state)).toBe(true);
    });

    it('returns true for verifying', () => {
      const state = updateEvidenceStatus(createEvidenceState(), 'verifying');
      expect(isEvidenceInProgress(state)).toBe(true);
    });

    it('returns false for idle', () => {
      const state = createEvidenceState();
      expect(isEvidenceInProgress(state)).toBe(false);
    });

    it('returns false for verified', () => {
      const state = updateEvidenceStatus(createEvidenceState(), 'verified');
      expect(isEvidenceInProgress(state)).toBe(false);
    });
  });

  describe('canRetryEvidence', () => {
    it('returns true for failed', () => {
      const state = updateEvidenceStatus(createEvidenceState(), 'failed');
      expect(canRetryEvidence(state)).toBe(true);
    });

    it('returns true for cancelled', () => {
      const state = updateEvidenceStatus(createEvidenceState(), 'cancelled');
      expect(canRetryEvidence(state)).toBe(true);
    });

    it('returns false for verified', () => {
      const state = updateEvidenceStatus(createEvidenceState(), 'verified');
      expect(canRetryEvidence(state)).toBe(false);
    });

    it('returns false for uploading', () => {
      const state = updateEvidenceStatus(createEvidenceState(), 'uploading');
      expect(canRetryEvidence(state)).toBe(false);
    });
  });

  describe('shouldInvalidateOnWalletChange', () => {
    it('returns true for verified state', () => {
      const state = updateEvidenceStatus(createEvidenceState(), 'verified');
      expect(shouldInvalidateOnWalletChange(state)).toBe(true);
    });

    it('returns true for in-progress states', () => {
      const uploading = updateEvidenceStatus(createEvidenceState(), 'uploading');
      expect(shouldInvalidateOnWalletChange(uploading)).toBe(true);
    });

    it('returns false for idle', () => {
      const state = createEvidenceState();
      expect(shouldInvalidateOnWalletChange(state)).toBe(false);
    });

    it('returns false for already invalidated', () => {
      const state = updateEvidenceStatus(createEvidenceState(), 'invalidated');
      expect(shouldInvalidateOnWalletChange(state)).toBe(false);
    });
  });
});

describe('Progress Calculation', () => {
  describe('calculateEvidenceProgress', () => {
    it('returns 5% for validating', () => {
      expect(calculateEvidenceProgress('validating')).toBe(5);
    });

    it('returns 25% for hashing', () => {
      expect(calculateEvidenceProgress('hashing')).toBe(25);
    });

    it('returns 50% for uploading without progress', () => {
      expect(calculateEvidenceProgress('uploading')).toBe(50);
    });

    it('scales upload progress', () => {
      expect(calculateEvidenceProgress('uploading', 50)).toBe(70); // 40 + (50 * 0.6)
    });

    it('returns 95% for verifying', () => {
      expect(calculateEvidenceProgress('verifying')).toBe(95);
    });

    it('returns 100% for verified', () => {
      expect(calculateEvidenceProgress('verified')).toBe(100);
    });

    it('returns 0% for idle', () => {
      expect(calculateEvidenceProgress('idle')).toBe(0);
    });

    it('returns 0% for failed', () => {
      expect(calculateEvidenceProgress('failed')).toBe(0);
    });
  });

  describe('getEvidenceStatusMessage', () => {
    it('returns message for each status', () => {
      expect(getEvidenceStatusMessage('idle')).toBe('Ready to upload');
      expect(getEvidenceStatusMessage('validating')).toBe('Validating file...');
      expect(getEvidenceStatusMessage('hashing')).toBe('Calculating hash...');
      expect(getEvidenceStatusMessage('uploading')).toBe('Uploading...');
      expect(getEvidenceStatusMessage('verifying')).toBe('Verifying integrity...');
      expect(getEvidenceStatusMessage('verified')).toBe('Verified ✓');
      expect(getEvidenceStatusMessage('failed')).toBe('Upload failed');
      expect(getEvidenceStatusMessage('cancelled')).toBe('Cancelled');
      expect(getEvidenceStatusMessage('invalidated')).toBe('Invalidated');
    });
  });
});

describe('File Metadata', () => {
  describe('extractFileMetadata', () => {
    it('extracts metadata from file', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const metadata = extractFileMetadata(file);
      
      expect(metadata.name).toBe('test.pdf');
      expect(metadata.size).toBe(file.size);
      expect(metadata.type).toBe('application/pdf');
    });
  });

  describe('getFileExtension', () => {
    it('extracts extension', () => {
      expect(getFileExtension('test.pdf')).toBe('.pdf');
      expect(getFileExtension('image.PNG')).toBe('.png');
    });

    it('handles files without extension', () => {
      expect(getFileExtension('noextension')).toBe('');
    });

    it('handles multiple dots', () => {
      expect(getFileExtension('file.name.pdf')).toBe('.pdf');
    });
  });
});

describe('Browser Support', () => {
  describe('isFileApiSupported', () => {
    it('returns true when File API available', () => {
      expect(isFileApiSupported()).toBe(true);
    });
  });

  describe('isWebCryptoSupported', () => {
    it('returns true when Web Crypto available', () => {
      // In test environment, crypto should be available
      expect(isWebCryptoSupported()).toBe(true);
    });
  });

  describe('validateBrowserSupport', () => {
    it('returns supported when all APIs available', () => {
      const result = validateBrowserSupport();
      expect(result.supported).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });
});

describe('Utility Functions', () => {
  describe('formatUploadSpeed', () => {
    it('formats bytes per second', () => {
      expect(formatUploadSpeed(500)).toBe('500 B/s');
      expect(formatUploadSpeed(1024)).toBe('1.0 KB/s');
      expect(formatUploadSpeed(1024 * 1024)).toBe('1.0 MB/s');
    });
  });

  describe('estimateRemainingTime', () => {
    it('calculates remaining time', () => {
      const remaining = estimateRemainingTime(1024 * 1024, 1024); // 1MB at 1KB/s = 1024s
      expect(remaining).toBe(1024);
    });

    it('returns 0 for zero speed', () => {
      const remaining = estimateRemainingTime(1024, 0);
      expect(remaining).toBe(0);
    });

    it('returns 0 for zero bytes', () => {
      const remaining = estimateRemainingTime(0, 1024);
      expect(remaining).toBe(0);
    });
  });

  describe('formatRemainingTime', () => {
    it('formats seconds', () => {
      expect(formatRemainingTime(45)).toBe('45s remaining');
    });

    it('formats minutes and seconds', () => {
      expect(formatRemainingTime(125)).toBe('2m 5s remaining');
    });

    it('formats hours, minutes, seconds', () => {
      expect(formatRemainingTime(3665)).toBe('1h 1m 5s remaining');
    });

    it('handles zero', () => {
      expect(formatRemainingTime(0)).toBe('0s remaining');
    });
  });
});
