/**
 * Privacy-aware logging utility.
 *
 * V2-FE Evidence Privacy Protection — Ensures evidence URLs, metadata, and
 * sensitive data are automatically redacted before logging to console or
 * telemetry systems.
 *
 * Usage:
 *   import { privacyLog, privacyError, privacyWarn } from '@/lib/security/privacy-logger';
 *
 *   // Automatically redacts evidence, secrets, tokens, etc.
 *   privacyLog('Evidence validation passed', { evidence });
 *   privacyError('Failed to load claim', { error, claimId });
 *
 * See: docs/EVIDENCE_PRIVACY_MODEL.md §5
 */

import { redactForTelemetry, redactError } from './redaction';
import { redactEvidenceForTelemetry } from './evidence-privacy';

/**
 * Log level for privacy-aware logging.
 */
export type PrivacyLogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

/**
 * Privacy-aware log function — automatically redacts sensitive data.
 *
 * @param level - Log level (log, info, warn, error, debug)
 * @param message - Log message (not redacted)
 * @param data - Data object to redact before logging
 */
function privacyLogInternal(
  level: PrivacyLogLevel,
  message: string,
  data?: unknown,
): void {
  if (typeof data === 'undefined') {
    console[level](message);
    return;
  }

  // Redact sensitive data before logging
  const redacted = redactForTelemetry(data);
  console[level](message, redacted);
}

/**
 * Privacy-aware console.log — redacts evidence URLs, secrets, tokens, etc.
 *
 * @param message - Log message
 * @param data - Optional data object (automatically redacted)
 *
 * @example
 * privacyLog('Claim loaded', { claim, evidence });
 * // Evidence URLs will be redacted automatically
 */
export function privacyLog(message: string, data?: unknown): void {
  privacyLogInternal('log', message, data);
}

/**
 * Privacy-aware console.info — redacts sensitive data.
 *
 * @param message - Info message
 * @param data - Optional data object (automatically redacted)
 */
export function privacyInfo(message: string, data?: unknown): void {
  privacyLogInternal('info', message, data);
}

/**
 * Privacy-aware console.warn — redacts sensitive data.
 *
 * @param message - Warning message
 * @param data - Optional data object (automatically redacted)
 */
export function privacyWarn(message: string, data?: unknown): void {
  privacyLogInternal('warn', message, data);
}

/**
 * Privacy-aware console.error — redacts sensitive data.
 *
 * Errors are redacted using redactError() which preserves error structure
 * while removing secrets, tokens, and evidence URLs.
 *
 * @param message - Error message
 * @param data - Optional error or data object (automatically redacted)
 *
 * @example
 * privacyError('Evidence validation failed', { error, evidenceId });
 * // Error stack traces are preserved, but evidence URLs redacted
 */
export function privacyError(message: string, data?: unknown): void {
  if (!data) {
    console.error(message);
    return;
  }

  // If data is an Error, use redactError for better structure preservation
  if (data instanceof Error || (data && typeof data === 'object' && 'message' in data)) {
    const redacted = redactError(data);
    console.error(message, redacted);
    return;
  }

  privacyLogInternal('error', message, data);
}

/**
 * Privacy-aware console.debug — redacts sensitive data.
 *
 * @param message - Debug message
 * @param data - Optional data object (automatically redacted)
 */
export function privacyDebug(message: string, data?: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    privacyLogInternal('debug', message, data);
  }
}

/**
 * Log evidence-specific events with automatic privacy redaction.
 *
 * This is a specialized logger for evidence-related events that ensures
 * evidence URLs, IDs, and metadata are properly redacted.
 *
 * @param message - Log message
 * @param evidence - Evidence object (will be redacted)
 * @param level - Log level (default: 'log')
 *
 * @example
 * logEvidenceEvent('Evidence validated', evidence, 'info');
 * // Outputs: { id: 'ev_hash', type: 'link', displayValue: 'example.com/...' }
 */
export function logEvidenceEvent(
  message: string,
  evidence: {
    id: string;
    type: string;
    value: string;
    createdAt: string;
  },
  level: PrivacyLogLevel = 'log',
): void {
  const redacted = redactEvidenceForTelemetry(evidence);
  privacyLogInternal(level, message, redacted);
}

/**
 * Check if a value might contain evidence metadata that should not be logged.
 *
 * @param value - Value to check
 * @returns True if value looks like evidence metadata
 */
export function isEvidenceMetadata(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Check for evidence structure
  return (
    ('evidence' in obj && typeof obj.evidence === 'object') ||
    ('evidenceUrl' in obj && typeof obj.evidenceUrl === 'string') ||
    ('evidenceValue' in obj && typeof obj.evidenceValue === 'string') ||
    ('evidenceCid' in obj && typeof obj.evidenceCid === 'string')
  );
}

/**
 * Development-only assertion that evidence metadata is not logged unredacted.
 *
 * Throws in development if evidence-like data is found in the payload.
 *
 * @param data - Data to check
 * @param context - Context string for error message
 */
export function assertNoUnredactedEvidence(data: unknown, context: string): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  if (isEvidenceMetadata(data)) {
    throw new Error(
      `[Privacy Assertion Failed] ${context}: Evidence metadata found in unredacted log payload. Use privacyLog/privacyError or redactEvidenceForTelemetry().`,
    );
  }
}
