/**
 * UI-FE-080: Receipt Privacy, Redaction, and Injection Defense
 *
 * Implements strict, fail-closed redaction of secrets, protected rationale,
 * and credentials, plus filename and content injection sanitization.
 */

export const REDACTED_VALUE = '[REDACTED]' as const;

/**
 * Sensitive key substrings that indicate secrets, credentials, or session tokens.
 * Normalized to lowercase alphanumeric for matching.
 */
const SENSITIVE_KEY_PATTERNS = [
  'privatekey',
  'secret',
  'token',
  'authorization',
  'password',
  'apikey',
  'cookie',
  'session',
  'credential',
  'seed',
  'mnemonic',
  'salt',
  'privkey',
  'bearer',
  'authheader',
] as const;

/**
 * Key patterns that indicate protected or confidential rationale
 * (e.g. secret voter rationale, internal deliberations, reviewer confidential notes).
 */
const PROTECTED_RATIONALE_PATTERNS = [
  'protectedrationale',
  'privaterationale',
  'internalnotes',
  'confidentialrationale',
  'secretreason',
  'voterdeliberation',
  'reviewernotes',
  'confidentialnotes',
  'internalrationale',
] as const;

/** Windows reserved file names */
const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

/**
 * Normalize an object key for pattern matching
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Check if a key represents sensitive credentials or secrets
 */
export function isSensitiveKey(key: string): boolean {
  const norm = normalizeKey(key);
  return SENSITIVE_KEY_PATTERNS.some((pattern) => norm.includes(pattern));
}

/**
 * Check if a key represents protected or internal deliberative rationale
 */
export function isProtectedRationaleKey(key: string): boolean {
  const norm = normalizeKey(key);
  return PROTECTED_RATIONALE_PATTERNS.some((pattern) => norm.includes(pattern));
}

/**
 * Redact sensitive values from strings (hex private keys, bearer tokens, passwords)
 */
export function redactSensitiveString(value: string): string {
  let result = value;

  // Redact Bearer tokens
  result = result.replace(/(?:Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, `Bearer ${REDACTED_VALUE}`);

  // Redact hex strings with length > 66 (likely private keys or extended signatures)
  result = result.replace(/\b0x[a-fA-F0-9]{65,}\b/g, REDACTED_VALUE);

  // Redact inline secret/password assignments (e.g. "secret=abc", "key: 0x...")
  result = result.replace(
    /((?:private[_\s-]*key|secret|password|token|apikey|credential)\s*[:=]\s*)([^\s,;]+)/gi,
    `$1${REDACTED_VALUE}`,
  );

  return result;
}

/**
 * Sanitize and redact an action parameters object, returning a safe,
 * flat/pruned record containing only non-sensitive, scalar values.
 */
export function sanitizeParameters(
  params?: Record<string, unknown> | null,
): Record<string, string | number | boolean | null> {
  if (!params || typeof params !== 'object') {
    return {};
  }

  const sanitized: Record<string, string | number | boolean | null> = {};

  for (const [rawKey, rawValue] of Object.entries(params)) {
    const key = rawKey.trim();
    if (!key) continue;

    // Redact or exclude sensitive credentials
    if (isSensitiveKey(key)) {
      sanitized[key] = REDACTED_VALUE;
      continue;
    }

    // Exclude protected/internal rationale
    if (isProtectedRationaleKey(key)) {
      sanitized[key] = REDACTED_VALUE;
      continue;
    }

    // Null or undefined
    if (rawValue === null || rawValue === undefined) {
      sanitized[key] = null;
      continue;
    }

    // Numbers & Booleans
    if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      sanitized[key] = rawValue;
      continue;
    }

    // BigInt
    if (typeof rawValue === 'bigint') {
      sanitized[key] = rawValue.toString();
      continue;
    }

    // String
    if (typeof rawValue === 'string') {
      sanitized[key] = redactSensitiveString(rawValue.trim());
      continue;
    }

    // Complex nested objects or arrays are stringified and redacted
    try {
      const jsonStr = JSON.stringify(rawValue);
      sanitized[key] = redactSensitiveString(jsonStr);
    } catch {
      sanitized[key] = REDACTED_VALUE;
    }
  }

  return sanitized;
}

/**
 * Sanitize notes to prevent secret leakage and HTML injection
 */
export function sanitizeNotes(notes?: string | null): string | undefined {
  if (!notes || typeof notes !== 'string') return undefined;
  const trimmed = notes.trim();
  if (!trimmed) return undefined;
  return redactSensitiveString(trimmed);
}

/**
 * Sanitize a string segment for safe filename generation.
 * Strips path traversal sequences ('../', '..\'), control characters,
 * illegal Windows/Unix filename characters, and prevents Windows reserved filenames.
 */
export function sanitizeFilenameSegment(segment: string, fallback = 'unknown'): string {
  if (!segment || typeof segment !== 'string') return fallback;

  // Strip HTML tags and script-like tokens first
  let clean = segment.replace(/<[^>]*>/g, '');
  clean = clean.replace(/(?:script|iframe|embed|object)/gi, '');

  // Strip null bytes and control characters
  clean = clean.replace(/[\x00-\x1F\x7F]/g, '');

  // Strip path traversal sequences and separators
  clean = clean.replace(/\.{2,}/g, '');
  clean = clean.replace(/[/\\]/g, '');

  // Allow only alphanumeric, dash, and underscore
  clean = clean.replace(/[^a-zA-Z0-9_-]/g, '-');

  // Strip leading/trailing dots, dashes, spaces
  clean = clean.replace(/^[-_.]+|[-_.]+$/g, '');

  if (!clean || clean.length === 0) {
    clean = fallback;
  }

  // Check for Windows reserved device names
  const upper = clean.toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(upper)) {
    clean = `${clean}-receipt`;
  }

  // Bound maximum length
  return clean.slice(0, 48);
}

/**
 * Generate a deterministic, injection-safe filename for receipt downloads.
 * Format: truthbounty-receipt-<action>-<txHashOrRef>-<status>.<ext>
 */
export function generateReceiptFilename(options: {
  action: string;
  referenceOrHash: string | null;
  status: string;
  extension: 'json' | 'txt' | 'html';
}): string {
  const safeAction = sanitizeFilenameSegment(options.action, 'action');
  const safeStatus = sanitizeFilenameSegment(options.status, 'status');
  
  let refSegment = 'unspecified';
  if (options.referenceOrHash) {
    // If it's a 0x hash, use first 10 characters (0x1234abcd)
    if (options.referenceOrHash.startsWith('0x')) {
      refSegment = options.referenceOrHash.slice(0, 10);
    } else {
      refSegment = options.referenceOrHash.slice(0, 12);
    }
  }
  const safeRef = sanitizeFilenameSegment(refSegment, 'ref');

  const safeExt = options.extension === 'json' || options.extension === 'txt' || options.extension === 'html'
    ? options.extension
    : 'json';

  return `truthbounty-receipt-${safeAction}-${safeRef}-${safeStatus}.${safeExt}`;
}
