/**
 * V2-FE Evidence Handling Utilities
 *
 * Pure functions and state management for evidence upload and validation.
 * Implements privacy-preserving file handling with SHA-256 integrity verification.
 *
 * Security/Privacy invariants:
 * - Never log file names, contents, or digests
 * - All hashing done client-side with Web Crypto API
 * - Wallet change invalidates upload state
 * - Fail closed on hash mismatch
 */

import type { Hex } from 'viem';
import { bytesToHex } from 'viem';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EvidenceSource = 'file' | 'url';

export type EvidenceStatus =
  | 'idle'
  | 'validating'
  | 'hashing'
  | 'uploading'
  | 'verifying'
  | 'verified'
  | 'failed'
  | 'cancelled'
  | 'invalidated';

export interface EvidenceState {
  source: EvidenceSource | null;
  status: EvidenceStatus;
  progress: number; // 0-100
  error: string | null;
  
  // File metadata (sanitized for display)
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  
  // URL metadata
  url: string | null;
  
  // Hash (never logged)
  digest: Hex | null;
  
  // Validation
  canProceed: boolean; // status === 'verified'
}

export interface EvidenceUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// ---------------------------------------------------------------------------
// State Creators
// ---------------------------------------------------------------------------

/**
 * Create initial evidence state.
 */
export function createEvidenceState(): EvidenceState {
  return {
    source: null,
    status: 'idle',
    progress: 0,
    error: null,
    fileName: null,
    fileSize: null,
    fileType: null,
    url: null,
    digest: null,
    canProceed: false,
  };
}

/**
 * Create evidence state for file source.
 */
export function createFileEvidenceState(
  file: File,
  digest: Hex | null = null
): EvidenceState {
  return {
    source: 'file',
    status: digest ? 'verified' : 'idle',
    progress: digest ? 100 : 0,
    error: null,
    fileName: file.name, // Will be sanitized for display
    fileSize: file.size,
    fileType: file.type,
    url: null,
    digest,
    canProceed: digest !== null,
  };
}

/**
 * Create evidence state for URL source.
 */
export function createUrlEvidenceState(
  url: string,
  verified: boolean = false
): EvidenceState {
  return {
    source: 'url',
    status: verified ? 'verified' : 'idle',
    progress: verified ? 100 : 0,
    error: null,
    fileName: null,
    fileSize: null,
    fileType: null,
    url,
    digest: null,
    canProceed: verified,
  };
}

// ---------------------------------------------------------------------------
// State Transitions
// ---------------------------------------------------------------------------

/**
 * Update evidence state with new status.
 */
export function updateEvidenceStatus(
  state: EvidenceState,
  status: EvidenceStatus,
  error: string | null = null
): EvidenceState {
  return {
    ...state,
    status,
    error,
    canProceed: status === 'verified',
  };
}

/**
 * Update evidence upload progress.
 */
export function updateEvidenceProgress(
  state: EvidenceState,
  progress: number
): EvidenceState {
  // Cap at 99% until verified
  const cappedProgress = state.status === 'verified' ? 100 : Math.min(progress, 99);
  
  return {
    ...state,
    progress: cappedProgress,
  };
}

/**
 * Mark evidence as verified with digest.
 */
export function markEvidenceVerified(
  state: EvidenceState,
  digest: Hex
): EvidenceState {
  return {
    ...state,
    status: 'verified',
    progress: 100,
    error: null,
    digest,
    canProceed: true,
  };
}

/**
 * Mark evidence as failed with error.
 */
export function markEvidenceFailed(
  state: EvidenceState,
  error: string
): EvidenceState {
  return {
    ...state,
    status: 'failed',
    error,
    canProceed: false,
  };
}

/**
 * Mark evidence as cancelled.
 */
export function markEvidenceCancelled(state: EvidenceState): EvidenceState {
  return {
    ...state,
    status: 'cancelled',
    error: null,
    canProceed: false,
  };
}

/**
 * Invalidate evidence state (wallet change).
 */
export function invalidateEvidence(state: EvidenceState): EvidenceState {
  return {
    ...state,
    status: 'invalidated',
    error: 'Evidence invalidated due to wallet change. Please re-upload.',
    digest: null, // Clear digest on invalidation
    canProceed: false,
  };
}

// ---------------------------------------------------------------------------
// File Hashing (Web Crypto API)
// ---------------------------------------------------------------------------

/**
 * Calculate SHA-256 hash of file using Web Crypto API.
 * Privacy: File contents never logged, only hashed.
 * 
 * Returns: 0x-prefixed hex string (32 bytes = 66 chars).
 */
export async function calculateFileHash(file: File): Promise<Hex> {
  if (!(file instanceof File)) {
    throw new Error('Invalid file object');
  }

  if (file.size === 0) {
    throw new Error('Cannot hash empty file');
  }

  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Calculate SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);

  // Convert to Uint8Array
  const hashArray = new Uint8Array(hashBuffer);

  // Convert to hex with 0x prefix
  const hashHex = bytesToHex(hashArray);

  return hashHex;
}

/**
 * Calculate SHA-256 hash with progress callback.
 * Note: Web Crypto API doesn't support streaming, so progress is simulated.
 */
export async function calculateFileHashWithProgress(
  file: File,
  onProgress: (progress: number) => void
): Promise<Hex> {
  if (!(file instanceof File)) {
    throw new Error('Invalid file object');
  }

  if (file.size === 0) {
    throw new Error('Cannot hash empty file');
  }

  // Simulate progress (Web Crypto API is atomic, no real progress tracking)
  onProgress(0);

  // Small delay to show progress UI
  await new Promise(resolve => setTimeout(resolve, 100));
  onProgress(50);

  // Calculate hash
  const hash = await calculateFileHash(file);

  onProgress(100);

  return hash;
}

// ---------------------------------------------------------------------------
// Evidence State Checks
// ---------------------------------------------------------------------------

/**
 * Check if evidence is in terminal state (success or failure).
 */
export function isEvidenceTerminal(state: EvidenceState): boolean {
  return (
    state.status === 'verified' ||
    state.status === 'failed' ||
    state.status === 'cancelled' ||
    state.status === 'invalidated'
  );
}

/**
 * Check if evidence upload is in progress.
 */
export function isEvidenceInProgress(state: EvidenceState): boolean {
  return (
    state.status === 'validating' ||
    state.status === 'hashing' ||
    state.status === 'uploading' ||
    state.status === 'verifying'
  );
}

/**
 * Check if evidence can be retried.
 */
export function canRetryEvidence(state: EvidenceState): boolean {
  return (
    state.status === 'failed' ||
    state.status === 'cancelled'
  );
}

/**
 * Check if evidence requires invalidation on wallet change.
 */
export function shouldInvalidateOnWalletChange(state: EvidenceState): boolean {
  // Invalidate if upload is in progress or verified
  return (
    state.status !== 'idle' &&
    state.status !== 'failed' &&
    state.status !== 'cancelled' &&
    state.status !== 'invalidated'
  );
}

// ---------------------------------------------------------------------------
// Progress Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate overall progress for evidence upload flow.
 * 
 * Flow stages with weights:
 * - Validating: 0-10%
 * - Hashing: 10-40%
 * - Uploading: 40-90%
 * - Verifying: 90-99%
 * - Verified: 100%
 */
export function calculateEvidenceProgress(
  status: EvidenceStatus,
  uploadProgress: number = 0
): number {
  switch (status) {
    case 'idle':
      return 0;
    case 'validating':
      return 5;
    case 'hashing':
      return 25;
    case 'uploading':
      // Map upload progress (0-100) to 40-90%
      return 40 + (uploadProgress * 0.5);
    case 'verifying':
      return 95;
    case 'verified':
      return 100;
    case 'failed':
    case 'cancelled':
    case 'invalidated':
      return 0;
    default:
      return 0;
  }
}

/**
 * Get human-readable status message for evidence state.
 */
export function getEvidenceStatusMessage(state: EvidenceState): string {
  switch (state.status) {
    case 'idle':
      return 'Ready to upload evidence';
    case 'validating':
      return 'Validating file...';
    case 'hashing':
      return 'Calculating file hash...';
    case 'uploading':
      return `Uploading... ${state.progress}%`;
    case 'verifying':
      return 'Verifying integrity...';
    case 'verified':
      return 'Evidence verified ✓';
    case 'failed':
      return state.error || 'Upload failed';
    case 'cancelled':
      return 'Upload cancelled';
    case 'invalidated':
      return 'Evidence invalidated (wallet changed)';
    default:
      return 'Unknown status';
  }
}

// ---------------------------------------------------------------------------
// Evidence Metadata
// ---------------------------------------------------------------------------

/**
 * Extract metadata from file for display.
 * Privacy: File name will be sanitized before display.
 */
export function extractFileMetadata(file: File): {
  name: string;
  size: number;
  type: string;
} {
  if (!(file instanceof File)) {
    throw new Error('Invalid file object');
  }

  return {
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
  };
}

/**
 * Get file extension from file name.
 */
export function getFileExtension(fileName: string): string {
  if (typeof fileName !== 'string' || fileName.length === 0) {
    return '';
  }

  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) {
    return '';
  }

  return fileName.slice(lastDot).toLowerCase();
}

/**
 * Get MIME type description for display.
 */
export function getMimeTypeDescription(mimeType: string): string {
  const descriptions: Record<string, string> = {
    'application/pdf': 'PDF Document',
    'image/png': 'PNG Image',
    'image/jpeg': 'JPEG Image',
    'video/mp4': 'MP4 Video',
    'video/webm': 'WebM Video',
  };

  return descriptions[mimeType.toLowerCase()] || 'File';
}

// ---------------------------------------------------------------------------
// Evidence Storage (Session Storage for page refresh recovery)
// ---------------------------------------------------------------------------

export interface StoredEvidenceState {
  source: EvidenceSource | null;
  status: EvidenceStatus;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  url: string | null;
  // Note: digest is NOT stored for privacy
  timestamp: number;
}

const EVIDENCE_STORAGE_KEY = 'truthbounty_wizard_evidence';
const EVIDENCE_STORAGE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Save evidence state to session storage (without digest).
 * Privacy: Digest is never persisted.
 */
export function saveEvidenceToStorage(state: EvidenceState): void {
  const stored: StoredEvidenceState = {
    source: state.source,
    status: state.status,
    fileName: state.fileName,
    fileSize: state.fileSize,
    fileType: state.fileType,
    url: state.url,
    timestamp: Date.now(),
  };

  try {
    sessionStorage.setItem(EVIDENCE_STORAGE_KEY, JSON.stringify(stored));
  } catch (err) {
    // Silently fail if session storage is unavailable
    console.warn('Failed to save evidence state to session storage');
  }
}

/**
 * Load evidence state from session storage.
 * Returns null if not found or expired.
 * Privacy: Digest is never loaded from storage.
 */
export function loadEvidenceFromStorage(): Partial<EvidenceState> | null {
  try {
    const item = sessionStorage.getItem(EVIDENCE_STORAGE_KEY);
    if (!item) {
      return null;
    }

    const stored: StoredEvidenceState = JSON.parse(item);

    // Check if expired
    if (Date.now() - stored.timestamp > EVIDENCE_STORAGE_TTL) {
      clearEvidenceStorage();
      return null;
    }

    // Return partial state (digest will be null, user must re-verify)
    return {
      source: stored.source,
      status: 'invalidated', // Force re-verification on restore
      fileName: stored.fileName,
      fileSize: stored.fileSize,
      fileType: stored.fileType,
      url: stored.url,
      digest: null, // Never restored
    };
  } catch (err) {
    console.warn('Failed to load evidence state from session storage');
    return null;
  }
}

/**
 * Clear evidence state from session storage.
 */
export function clearEvidenceStorage(): void {
  try {
    sessionStorage.removeItem(EVIDENCE_STORAGE_KEY);
  } catch (err) {
    // Silently fail
  }
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/**
 * Abort controller for cancellable uploads.
 */
export function createUploadAbortController(): AbortController {
  return new AbortController();
}

/**
 * Check if File API is supported.
 */
export function isFileApiSupported(): boolean {
  return typeof File !== 'undefined' && typeof FileReader !== 'undefined';
}

/**
 * Check if Web Crypto API is supported.
 */
export function isWebCryptoSupported(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.subtle.digest === 'function'
  );
}

/**
 * Validate browser support for evidence upload.
 */
export function validateBrowserSupport(): { supported: boolean; reason?: string } {
  if (!isFileApiSupported()) {
    return {
      supported: false,
      reason: 'Your browser does not support file uploads. Please use a modern browser.',
    };
  }

  if (!isWebCryptoSupported()) {
    return {
      supported: false,
      reason: 'Your browser does not support secure hashing. Please use a modern browser.',
    };
  }

  return { supported: true };
}

/**
 * Format upload speed for display (bytes/sec → human readable).
 */
export function formatUploadSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) {
    return `${bytesPerSecond.toFixed(0)} B/s`;
  }
  if (bytesPerSecond < 1024 * 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  }
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

/**
 * Estimate remaining time for upload.
 */
export function estimateRemainingTime(
  loaded: number,
  total: number,
  bytesPerSecond: number
): number | null {
  if (bytesPerSecond <= 0 || loaded >= total) {
    return null;
  }

  const remaining = total - loaded;
  return Math.ceil(remaining / bytesPerSecond);
}

/**
 * Format remaining time for display.
 */
export function formatRemainingTime(seconds: number | null): string {
  if (seconds === null || seconds <= 0) {
    return '';
  }

  if (seconds < 60) {
    return `${seconds}s remaining`;
  }

  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s remaining`;
}
