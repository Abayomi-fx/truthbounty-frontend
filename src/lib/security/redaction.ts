/**
 * Telemetry / error-reporting payload redaction.
 *
 * Intent: before any error or diagnostic payload is sent to telemetry,
 * logged to console in production, or rendered into a DOM fallback, pass
 * it through this module so that secrets, private keys, signatures,
 * long calldata, and bearer tokens are not exfiltrated.
 *
 * Fail-closed: if the structure cannot be safely cloned or we are unsure
 * about a value, the value is replaced with `[REDACTED]` rather than
 * passed through. This module is NOT a cryptographic sanitizer and must
 * not be relied upon for untrusted-user-content HTML safety (see
 * `evidence-sanitizer.ts` for that). It is specifically targeted at the
 * UI / telemetry surface.
 */

export const REDACTED = '[REDACTED]' as const;

export type RedactedPayload = unknown;

const SENSITIVE_KEY_TOKENS = [
  'token',
  'secret',
  'authorization',
  'password',
  'privatekey',
  'apikey',
  'cookie',
  'session',
] as const;

const HEX_64_PLUS_RE = /\b0x[a-fA-F0-9]{64,}\b/g;
const BEARER_TOKEN_RE = /(?:^|\s)Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const SENSITIVE_CONTEXT_HEX_RE =
  /((?:(?:private|secret)[_\s-]*key|secret|password|credential|token|api[_\s-]*key)\s*(?:is|[:=])?\s*)(0x[a-fA-F0-9]{64,})\b/gi;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSensitiveKey(key: string): boolean {
  const norm = normalizeKey(key);
  return SENSITIVE_KEY_TOKENS.some((token) => norm.includes(token));
}

function isSignatureKey(key: string): boolean {
  return key.toLowerCase().includes('signature');
}

function isCalldataLikeKey(key: string): boolean {
  const k = key.toLowerCase();
  return k === 'calldata' || k === 'data' || k === 'input';
}

function isLong0xHexString(value: string, minCharsAfter0x = 64): boolean {
  if (!value.startsWith('0x') && !value.startsWith('0X')) return false;
  const rest = value.slice(2);
  if (rest.length <= minCharsAfter0x) return false;
  return /^[a-fA-F0-9]+$/.test(rest);
}

function redactStringValue(str: string): string {
  let result = str;
  result = result.replace(SENSITIVE_CONTEXT_HEX_RE, (_match, prefix) => {
    return `${prefix}${REDACTED}`;
  });
  result = result.replace(HEX_64_PLUS_RE, (match) => {
    if (match.length > 66) {
      return REDACTED;
    }
    return match;
  });
  return result;
}

function cloneAndRedact(value: unknown, depth: number): unknown {
  if (depth > 50) {
    return REDACTED;
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return redactStringValue(value);
  }

  const type = typeof value;

  if (type === 'number' || type === 'boolean' || type === 'bigint') {
    return value;
  }

  if (type === 'function' || type === 'symbol') {
    return undefined;
  }

  if (type !== 'object') {
    return REDACTED;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof RegExp) {
    return REDACTED;
  }

  if (value instanceof Map) {
    try {
      const arr: Array<[unknown, unknown]> = [];
      for (const [k, v] of value.entries()) {
        const clonedK = cloneAndRedact(k, depth + 1);
        let clonedV = cloneAndRedact(v, depth + 1);
        if (typeof k === 'string' && isSensitiveKey(k)) {
          clonedV = REDACTED;
        }
        arr.push([clonedK, clonedV]);
      }
      return arr;
    } catch {
      return REDACTED;
    }
  }

  if (value instanceof Set) {
    try {
      const arr: unknown[] = [];
      for (const v of value.values()) {
        arr.push(cloneAndRedact(v, depth + 1));
      }
      return arr;
    } catch {
      return REDACTED;
    }
  }

  if (Array.isArray(value)) {
    const result: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      result.push(cloneAndRedact(value[i], depth + 1));
    }
    return result;
  }

  if (!isPlainObject(value)) {
    return REDACTED;
  }

  const result: Record<string, unknown> = Object.create(null);
  const keys = Object.keys(value);
  for (const key of keys) {
    if (!Object.prototype.propertyIsEnumerable.call(value, key)) {
      continue;
    }
    const rawVal = (value as Record<string, unknown>)[key];
    let redactedVal = cloneAndRedact(rawVal, depth + 1);

    if (isSensitiveKey(key)) {
      redactedVal = REDACTED;
    } else if (
      isSignatureKey(key) &&
      typeof redactedVal === 'string' &&
      redactedVal.length > 10
    ) {
      redactedVal = REDACTED;
    } else if (
      isCalldataLikeKey(key) &&
      typeof redactedVal === 'string' &&
      isLong0xHexString(redactedVal, 20)
    ) {
      redactedVal = REDACTED;
    } else if (isEvidenceKey(key)) {
      // Redact evidence URLs, values, CIDs
      redactedVal = redactEvidenceValue(redactedVal, key);
    }

    result[key] = redactedVal;
  }
  return result;
}

function isPlainObject(value: object): boolean {
  if (value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function redactForTelemetry(value: unknown): unknown {
  return cloneAndRedact(value, 0);
}

export function redactError(error: unknown): {
  name: string;
  message: string;
  stack: string | null;
  cause: unknown;
} {
  let name = 'Error';
  let message = '';
  let stack: string | null = null;
  let cause: unknown = undefined;

  if (error instanceof Error) {
    name = error.name || 'Error';
    message = error.message || '';
    stack = error.stack || null;
    cause = (error as { cause?: unknown }).cause;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e.name === 'string') name = e.name;
    if (typeof e.message === 'string') message = e.message;
    if (typeof e.stack === 'string') stack = e.stack;
    if ('cause' in e) cause = e.cause;
  }

  const sanitize = (s: string): string => {
    let out = s;
    out = out.replace(SENSITIVE_CONTEXT_HEX_RE, (_match, prefix) => {
      return `${prefix}${REDACTED}`;
    });
    out = out.replace(HEX_64_PLUS_RE, (match) => {
      if (match.length > 66) return REDACTED;
      return match;
    });
    out = out.replace(BEARER_TOKEN_RE, (match) => {
      const prefixMatch = /^(\s*)/.exec(match);
      const prefix = prefixMatch ? prefixMatch[1] : '';
      return `${prefix}Bearer ${REDACTED}`;
    });
    return out;
  };

  const sanitizedMessage = sanitize(message);
  const sanitizedStack = stack !== null ? sanitize(stack) : null;

  if (error instanceof Error) {
    try {
      error.message = sanitizedMessage;
      if (sanitizedStack !== null) {
        error.stack = sanitizedStack;
      }
    } catch {
      // In case error properties are non-writable
    }
  }

  return {
    name,
    message: sanitizedMessage,
    stack: sanitizedStack,
    cause: redactForTelemetry(cause),
  };
}

export function redactForErrorReporter<T>(payload: T): unknown {
  return redactForTelemetry(payload);
}

// ---------------------------------------------------------------------------
// Evidence-specific redaction
// ---------------------------------------------------------------------------

/**
 * Check if a key likely contains evidence metadata that should be redacted.
 */
function isEvidenceKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k === 'evidence' ||
    k === 'evidenceurl' ||
    k === 'evidencevalue' ||
    k === 'evidencecid' ||
    k.includes('evidence') && (k.includes('url') || k.includes('value') || k.includes('cid'))
  );
}

/**
 * Redact evidence-specific fields from telemetry payloads.
 *
 * Evidence URLs, values, and CIDs are replaced with [REDACTED_EVIDENCE] to
 * prevent metadata leakage. Evidence IDs should be hashed before logging
 * (see evidence-privacy.ts).
 *
 * @param value - Value to check for evidence data
 * @param key - Object key name (if available)
 * @returns Redacted value if evidence-related, original value otherwise
 */
export function redactEvidenceValue(value: unknown, key?: string): unknown {
  if (key && isEvidenceKey(key)) {
    if (typeof value === 'string' && value.length > 0) {
      return '[REDACTED_EVIDENCE]';
    }
    if (typeof value === 'object' && value !== null) {
      return '[REDACTED_EVIDENCE]';
    }
  }
  return value;
}
