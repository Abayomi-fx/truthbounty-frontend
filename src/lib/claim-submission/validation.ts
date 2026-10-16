/**
 * V2-FE Claim Submission Validation Utilities
 *
 * Pure validation functions for claim submission wizard.
 * All validators follow fail-closed principles: explicit validation,
 * no assumptions, clear error messages.
 *
 * Security invariants:
 * - Never fabricate validation results
 * - Fail closed on uncertain inputs
 * - Privacy-preserving (never log sensitive data)
 * - XSS/injection prevention
 */

import type { Address, Hex } from 'viem';
import { isAddress, isHex } from 'viem';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidationResult = 
  | { valid: true }
  | { valid: false; error: string };

export interface ClaimFormData {
  title: string;
  category: string;
  impact: string;
  source: string;
  description: string;
}

export type ClaimFormErrors = Partial<Record<keyof ClaimFormData, string>>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PREDEFINED_CATEGORIES = [
  'Healthcare',
  'Environment',
  'Finance',
  'Technology',
  'Politics',
  'Education',
  'Other',
] as const;

export const PREDEFINED_IMPACTS = [
  'Low',
  'Medium',
  'High',
  'Critical',
] as const;

export const TITLE_MIN_LENGTH = 5;
export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MIN_LENGTH = 10;
export const DESCRIPTION_MAX_LENGTH = 5000;

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'video/mp4',
  'video/webm',
] as const;

export const ALLOWED_FILE_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.mp4',
  '.webm',
] as const;

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ---------------------------------------------------------------------------
// Claim Details Validation
// ---------------------------------------------------------------------------

/**
 * Validate claim title.
 * Requirements: 5-200 chars, no leading/trailing whitespace.
 */
export function validateTitle(title: string): ValidationResult {
  if (typeof title !== 'string') {
    return { valid: false, error: 'Title must be a string' };
  }

  if (title.length === 0) {
    return { valid: false, error: 'Title is required' };
  }

  if (title.trim().length === 0) {
    return { valid: false, error: 'Title cannot be only whitespace' };
  }

  if (title !== title.trim()) {
    return { valid: false, error: 'Title cannot start or end with whitespace' };
  }

  if (title.length < TITLE_MIN_LENGTH) {
    return { valid: false, error: `Title must be at least ${TITLE_MIN_LENGTH} characters` };
  }

  if (title.length > TITLE_MAX_LENGTH) {
    return { valid: false, error: `Title must be at most ${TITLE_MAX_LENGTH} characters` };
  }

  // Check for dangerous characters (XSS prevention)
  if (/<script|<iframe|javascript:/i.test(title)) {
    return { valid: false, error: 'Title contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Validate claim category.
 * Requirements: Must be in predefined list.
 */
export function validateCategory(category: string): ValidationResult {
  if (typeof category !== 'string') {
    return { valid: false, error: 'Category must be a string' };
  }

  if (category.trim().length === 0) {
    return { valid: false, error: 'Category is required' };
  }

  if (!PREDEFINED_CATEGORIES.includes(category as any)) {
    return { valid: false, error: 'Invalid category selected' };
  }

  return { valid: true };
}

/**
 * Validate claim impact.
 * Requirements: Must be in predefined list.
 */
export function validateImpact(impact: string): ValidationResult {
  if (typeof impact !== 'string') {
    return { valid: false, error: 'Impact must be a string' };
  }

  if (impact.trim().length === 0) {
    return { valid: false, error: 'Impact is required' };
  }

  if (!PREDEFINED_IMPACTS.includes(impact as any)) {
    return { valid: false, error: 'Invalid impact selected' };
  }

  return { valid: true };
}

/**
 * Validate source URL.
 * Requirements: Valid URL, HTTPS only.
 */
export function validateSourceUrl(url: string): ValidationResult {
  if (typeof url !== 'string') {
    return { valid: false, error: 'Source URL must be a string' };
  }

  if (url.trim().length === 0) {
    return { valid: false, error: 'Source URL is required' };
  }

  // Try to parse as URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim());
  } catch {
    return { valid: false, error: 'Source must be a valid URL (https://example.com)' };
  }

  // Require HTTPS
  if (parsedUrl.protocol !== 'https:') {
    return { valid: false, error: 'Source must use HTTPS' };
  }

  // Validate hostname exists
  if (!parsedUrl.hostname || parsedUrl.hostname.length === 0) {
    return { valid: false, error: 'Source URL must have a valid hostname' };
  }

  return { valid: true };
}

/**
 * Validate claim description.
 * Requirements: 10-5000 chars.
 */
export function validateDescription(description: string): ValidationResult {
  if (typeof description !== 'string') {
    return { valid: false, error: 'Description must be a string' };
  }

  if (description.length === 0) {
    return { valid: false, error: 'Description is required' };
  }

  if (description.trim().length === 0) {
    return { valid: false, error: 'Description cannot be only whitespace' };
  }

  if (description.trim().length < DESCRIPTION_MIN_LENGTH) {
    return { valid: false, error: `Description must be at least ${DESCRIPTION_MIN_LENGTH} characters` };
  }

  if (description.length > DESCRIPTION_MAX_LENGTH) {
    return { valid: false, error: `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters` };
  }

  // Check for dangerous characters (XSS prevention)
  if (/<script|<iframe|javascript:/i.test(description)) {
    return { valid: false, error: 'Description contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Validate all claim form fields at once.
 * Returns map of field name → error message.
 */
export function validateClaimDetails(data: ClaimFormData): {
  valid: boolean;
  errors: ClaimFormErrors;
} {
  const errors: ClaimFormErrors = {};

  const titleResult = validateTitle(data.title);
  if (!titleResult.valid) errors.title = titleResult.error;

  const categoryResult = validateCategory(data.category);
  if (!categoryResult.valid) errors.category = categoryResult.error;

  const impactResult = validateImpact(data.impact);
  if (!impactResult.valid) errors.impact = impactResult.error;

  const sourceResult = validateSourceUrl(data.source);
  if (!sourceResult.valid) errors.source = sourceResult.error;

  const descriptionResult = validateDescription(data.description);
  if (!descriptionResult.valid) errors.description = descriptionResult.error;

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Evidence Validation
// ---------------------------------------------------------------------------

/**
 * Validate file type.
 * Requirements: Must be in allowed types list.
 */
export function validateFileType(file: File): ValidationResult {
  if (!(file instanceof File)) {
    return { valid: false, error: 'Invalid file object' };
  }

  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();

  // Check MIME type
  if (!ALLOWED_FILE_TYPES.includes(fileType as any)) {
    // Also check file extension as fallback
    const hasValidExtension = ALLOWED_FILE_EXTENSIONS.some(ext => 
      fileName.endsWith(ext)
    );

    if (!hasValidExtension) {
      return { 
        valid: false, 
        error: 'Unsupported file type. Please upload PDF, PNG, JPG, MP4, or WEBM.' 
      };
    }
  }

  return { valid: true };
}

/**
 * Validate file size.
 * Requirements: Max 50MB.
 */
export function validateFileSize(file: File): ValidationResult {
  if (!(file instanceof File)) {
    return { valid: false, error: 'Invalid file object' };
  }

  if (file.size > MAX_FILE_SIZE) {
    const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
    return { valid: false, error: `File is too large. Maximum size is ${maxSizeMB}MB.` };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }

  return { valid: true };
}

/**
 * Validate file name.
 * Requirements: No path traversal, no dangerous characters.
 */
export function validateFileName(fileName: string): ValidationResult {
  if (typeof fileName !== 'string' || fileName.length === 0) {
    return { valid: false, error: 'File name is required' };
  }

  // Check for path traversal attempts
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return { valid: false, error: 'Invalid file name' };
  }

  // Check for null bytes
  if (fileName.includes('\0')) {
    return { valid: false, error: 'Invalid file name' };
  }

  // Must have an extension
  if (!fileName.includes('.')) {
    return { valid: false, error: 'File must have an extension' };
  }

  return { valid: true };
}

/**
 * Validate evidence URL.
 * Requirements: Valid URL, HTTPS, must point to evidence file.
 */
export function validateEvidenceUrl(url: string): ValidationResult {
  if (typeof url !== 'string') {
    return { valid: false, error: 'Evidence URL must be a string' };
  }

  if (url.trim().length === 0) {
    return { valid: false, error: 'Evidence URL is required' };
  }

  // Try to parse as URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim());
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Require HTTPS
  if (parsedUrl.protocol !== 'https:') {
    return { valid: false, error: 'URL must use HTTPS' };
  }

  // Validate hostname
  if (!parsedUrl.hostname || parsedUrl.hostname.length === 0) {
    return { valid: false, error: 'URL must have a valid hostname' };
  }

  // Check for suspicious patterns
  if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname.startsWith('127.')) {
    return { valid: false, error: 'Local URLs are not allowed' };
  }

  return { valid: true };
}

/**
 * Verify evidence integrity.
 * Compare local hash with canonical hash (must match exactly).
 */
export function verifyEvidenceIntegrity(
  localHash: Hex,
  canonicalHash: Hex
): ValidationResult {
  if (!isHex(localHash) || localHash.length !== 66) {
    return { valid: false, error: 'Invalid local hash format' };
  }

  if (!isHex(canonicalHash) || canonicalHash.length !== 66) {
    return { valid: false, error: 'Invalid canonical hash format' };
  }

  if (localHash.toLowerCase() !== canonicalHash.toLowerCase()) {
    return { 
      valid: false, 
      error: 'Evidence integrity check failed. Please re-upload the file.' 
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Transaction Validation
// ---------------------------------------------------------------------------

/**
 * Validate wallet is connected.
 */
export function validateWalletConnected(address?: Address): ValidationResult {
  if (!address) {
    return { valid: false, error: 'Wallet not connected' };
  }

  if (!isAddress(address)) {
    return { valid: false, error: 'Invalid wallet address' };
  }

  return { valid: true };
}

/**
 * Validate chain matches expected.
 */
export function validateChainMatch(
  connectedChainId: number | undefined,
  expectedChainId: number
): ValidationResult {
  if (connectedChainId === undefined) {
    return { valid: false, error: 'Chain ID not detected' };
  }

  if (connectedChainId !== expectedChainId) {
    return { 
      valid: false, 
      error: `Wrong network. Please switch to chain ${expectedChainId}` 
    };
  }

  return { valid: true };
}

/**
 * Validate artifact version matches.
 */
export function validateArtifactVersion(
  version: string,
  expectedVersion: string
): ValidationResult {
  if (typeof version !== 'string' || version.length === 0) {
    return { valid: false, error: 'Artifact version not found' };
  }

  if (version !== expectedVersion) {
    return { 
      valid: false, 
      error: `Artifact version mismatch. Expected ${expectedVersion}, got ${version}` 
    };
  }

  return { valid: true };
}

/**
 * Validate contract address matches expected checksum.
 */
export function validateContractAddress(
  address: Address,
  expectedChecksum: string
): ValidationResult {
  if (!isAddress(address)) {
    return { valid: false, error: 'Invalid contract address' };
  }

  // Normalize both addresses for comparison
  const normalizedAddress = address.toLowerCase();
  const normalizedExpected = expectedChecksum.toLowerCase();

  if (normalizedAddress !== normalizedExpected) {
    return { 
      valid: false, 
      error: 'Contract address does not match expected checksum' 
    };
  }

  return { valid: true };
}

/**
 * Validate sufficient balance for transaction.
 */
export function validateSufficientBalance(
  balance: bigint,
  required: bigint
): ValidationResult {
  if (typeof balance !== 'bigint') {
    return { valid: false, error: 'Invalid balance value' };
  }

  if (typeof required !== 'bigint') {
    return { valid: false, error: 'Invalid required amount' };
  }

  if (balance < required) {
    return { 
      valid: false, 
      error: 'Insufficient balance' 
    };
  }

  return { valid: true };
}

/**
 * Validate sufficient token allowance.
 */
export function validateAllowance(
  allowance: bigint,
  required: bigint
): ValidationResult {
  if (typeof allowance !== 'bigint') {
    return { valid: false, error: 'Invalid allowance value' };
  }

  if (typeof required !== 'bigint') {
    return { valid: false, error: 'Invalid required amount' };
  }

  if (allowance < required) {
    return { 
      valid: false, 
      error: 'Token approval required' 
    };
  }

  return { valid: true };
}

/**
 * Validate content digest format (32 bytes hex).
 */
export function validateContentDigest(digest: Hex): ValidationResult {
  if (!isHex(digest)) {
    return { valid: false, error: 'Content digest must be hex string' };
  }

  // Must be 32 bytes (66 chars including 0x prefix)
  if (digest.length !== 66) {
    return { valid: false, error: 'Content digest must be 32 bytes' };
  }

  return { valid: true };
}

/**
 * Validate frozen config format (hex bytes, max 1024 bytes).
 */
export function validateFrozenConfig(config: Hex): ValidationResult {
  if (!isHex(config)) {
    return { valid: false, error: 'Frozen config must be hex string' };
  }

  // Max 1024 bytes (2050 chars including 0x prefix)
  const maxLength = 2 + (1024 * 2);
  if (config.length > maxLength) {
    return { valid: false, error: 'Frozen config exceeds maximum length' };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Sanitization Utilities (Privacy-Preserving)
// ---------------------------------------------------------------------------

/**
 * Sanitize file name for display.
 * Returns generic name with extension.
 * Privacy: Never logs or displays actual file name.
 */
export function sanitizeFileName(fileName: string): string {
  if (typeof fileName !== 'string' || fileName.length === 0) {
    return 'evidence';
  }

  // Extract extension only
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) {
    return 'evidence';
  }

  const extension = fileName.slice(lastDot);
  return `evidence${extension}`;
}

/**
 * Sanitize URL for display.
 * Returns domain only, no path or query params.
 * Privacy: Never logs or displays full URL.
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string' || url.length === 0) {
    return 'evidence source';
  }

  try {
    const parsed = new URL(url);
    return `evidence from ${parsed.hostname}`;
  } catch {
    return 'evidence source';
  }
}

/**
 * Redact digest for logging.
 * Privacy: Never logs actual digest.
 */
export function redactDigest(_digest: Hex): string {
  return '[redacted]';
}

/**
 * Strip leading/trailing whitespace from string.
 */
export function stripWhitespace(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }
  return text.trim();
}

/**
 * Normalize line endings to LF.
 */
export function normalizeLineEndings(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Truncate text to max length with ellipsis.
 */
export function truncateText(text: string, maxLength: number): string {
  if (typeof text !== 'string') {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format file size to human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (typeof bytes !== 'number' || bytes < 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
