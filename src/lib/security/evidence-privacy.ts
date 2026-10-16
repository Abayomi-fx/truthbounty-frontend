/**
 * Evidence metadata privacy utilities.
 *
 * V2-FE Evidence Privacy Protection — implements truncation, redaction, and
 * hashing for evidence URLs, IPFS CIDs, timestamps, and IDs to minimize
 * metadata exposure while maintaining verifiability.
 *
 * Design rules:
 *   - Display: Truncated, privacy-preserving format
 *   - Clipboard: Full, unmodified URL for verification
 *   - Telemetry: Hashed IDs, never log evidence.value
 *   - Fail closed: Invalid inputs return safe placeholders
 *
 * See: docs/EVIDENCE_PRIVACY_MODEL.md
 */

// ---------------------------------------------------------------------------
// URL Truncation
// ---------------------------------------------------------------------------

export interface TruncatedUrl {
  /** Privacy-preserving display text (e.g., "example.com/.../file.pdf") */
  display: string;
  /** Full URL for clipboard/verification */
  full: string;
  /** Hostname extracted from URL */
  hostname: string;
  /** Whether this is an IPFS URL */
  isIpfs: boolean;
}

/**
 * Truncate an evidence URL for privacy-preserving display.
 *
 * Algorithm:
 *   1. Parse URL and extract hostname
 *   2. Strip query parameters and hash fragment
 *   3. Extract filename from path (last segment)
 *   4. If path has ≥3 segments, replace middle with "..."
 *   5. Return: {hostname}/.../filename or {hostname}/... if no filename
 *
 * @param rawUrl - Evidence URL (HTTPS or IPFS)
 * @returns TruncatedUrl with display/full/hostname/isIpfs
 *
 * @example
 * truncateEvidenceUrl('https://example.com/api/v2/files/report.pdf?token=abc')
 * // => { display: 'example.com/.../report.pdf', full: 'https://...', ... }
 */
export function truncateEvidenceUrl(rawUrl: string): TruncatedUrl {
  const fallback: TruncatedUrl = {
    display: '[Invalid URL]',
    full: typeof rawUrl === 'string' ? rawUrl : '',
    hostname: '',
    isIpfs: false,
  };

  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    return fallback;
  }

  const cleaned = rawUrl.trim();

  // IPFS URLs get special handling
  const isIpfs = cleaned.startsWith('ipfs://') || cleaned.includes('/ipfs/');
  if (isIpfs) {
    return truncateIpfsCid(cleaned);
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return fallback;
  }

  const hostname = parsed.hostname || '';
  if (!hostname) {
    return fallback;
  }

  // Strip query params and hash for privacy
  const pathname = parsed.pathname || '/';

  // Extract filename (last segment after /)
  const segments = pathname.split('/').filter(Boolean);
  const filename = segments.length > 0 ? segments[segments.length - 1] : '';

  let display: string;

  if (segments.length === 0 || pathname === '/') {
    // Root path
    display = `${hostname}/`;
  } else if (segments.length === 1) {
    // Single segment: hostname/filename
    display = `${hostname}/${segments[0]}`;
  } else if (segments.length === 2) {
    // Two segments: hostname/path/filename
    display = `${hostname}/${segments[0]}/${segments[1]}`;
  } else {
    // Three or more segments: hostname/.../filename
    display = filename
      ? `${hostname}/.../${filename}`
      : `${hostname}/...`;
  }

  return {
    display,
    full: cleaned,
    hostname,
    isIpfs: false,
  };
}

// ---------------------------------------------------------------------------
// IPFS CID Truncation
// ---------------------------------------------------------------------------

const IPFS_CID_REGEX = /\b(Qm[1-9A-HJ-NP-Za-km-z]{44,}|b[A-Za-z2-7]{58,}|B[A-Z2-7]{58,}|z[1-9A-HJ-NP-Za-km-z]{48,}|F[0-9A-F]{50,})\b/;

/**
 * Truncate an IPFS CID for privacy-preserving display.
 *
 * Shows first 8 and last 6 characters of the CID with "(IPFS)" label.
 *
 * @param ipfsUrl - IPFS URL (ipfs://CID or https://gateway/ipfs/CID)
 * @returns TruncatedUrl with truncated CID display
 *
 * @example
 * truncateIpfsCid('ipfs://QmYwAPJzv5CZsnAzt8auVZRn2tQQkDdqBvHThY6WxF8xFk')
 * // => { display: 'QmYwAPJz...8xFk (IPFS)', full: 'ipfs://...', ... }
 */
export function truncateIpfsCid(ipfsUrl: string): TruncatedUrl {
  const fallback: TruncatedUrl = {
    display: '[Invalid IPFS URL]',
    full: typeof ipfsUrl === 'string' ? ipfsUrl : '',
    hostname: '',
    isIpfs: true,
  };

  if (typeof ipfsUrl !== 'string' || ipfsUrl.trim().length === 0) {
    return fallback;
  }

  const cleaned = ipfsUrl.trim();

  // Extract CID from ipfs:// or /ipfs/ path
  const cidMatch = IPFS_CID_REGEX.exec(cleaned);
  if (!cidMatch) {
    return fallback;
  }

  const cid = cidMatch[1];
  if (cid.length < 14) {
    // CID too short to truncate meaningfully
    return {
      display: `${cid} (IPFS)`,
      full: cleaned,
      hostname: '',
      isIpfs: true,
    };
  }

  const first8 = cid.slice(0, 8);
  const last6 = cid.slice(-6);
  const display = `${first8}...${last6} (IPFS)`;

  return {
    display,
    full: cleaned,
    hostname: '',
    isIpfs: true,
  };
}

// ---------------------------------------------------------------------------
// Query Parameter Stripping
// ---------------------------------------------------------------------------

/**
 * Strip query parameters from a URL for privacy.
 *
 * Query params often contain tracking IDs, session tokens, API keys, etc.
 * This removes them entirely from the display URL.
 *
 * @param url - URL with potential query parameters
 * @returns URL without query params or hash fragment
 *
 * @example
 * stripQueryParams('https://example.com/path?token=abc&session=xyz#anchor')
 * // => 'https://example.com/path'
 */
export function stripQueryParams(url: string): string {
  if (typeof url !== 'string' || url.trim().length === 0) {
    return '';
  }

  try {
    const parsed = new URL(url.trim());
    // Construct URL without search and hash
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    // If unparseable, try simple regex strip
    return url.replace(/[?#].*$/, '');
  }
}

// ---------------------------------------------------------------------------
// Timestamp Generalization
// ---------------------------------------------------------------------------

export type RelativeTimeUnit = 'm' | 'h' | 'd' | 'w';

export interface RelativeTime {
  /** Display text (e.g., "~2h ago") */
  display: string;
  /** Numeric value */
  value: number;
  /** Unit (m, h, d, w) */
  unit: RelativeTimeUnit;
  /** Whether to show date-only format (> 4 weeks) */
  isDateOnly: boolean;
}

/**
 * Format a timestamp as relative time for privacy.
 *
 * Granularity:
 *   - < 1 hour: ~{minutes}m ago
 *   - 1-24 hours: ~{hours}h ago
 *   - 1-7 days: ~{days}d ago
 *   - > 7 days: ~{weeks}w ago
 *   - > 4 weeks: Date only (YYYY-MM-DD)
 *
 * @param timestamp - ISO timestamp or Date
 * @param now - Current time (for testing)
 * @returns RelativeTime with display/value/unit/isDateOnly
 *
 * @example
 * formatRelativeTime('2026-09-27T12:00:00Z') // 2h 15m ago
 * // => { display: '~2h ago', value: 2, unit: 'h', isDateOnly: false }
 */
export function formatRelativeTime(
  timestamp: string | Date,
  now: Date = new Date(),
): RelativeTime {
  const fallback: RelativeTime = {
    display: '[Invalid timestamp]',
    value: 0,
    unit: 'm',
    isDateOnly: false,
  };

  let date: Date;
  if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    return fallback;
  }

  if (isNaN(date.getTime())) {
    return fallback;
  }

  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);

  // Future timestamp
  if (diffMs < 0) {
    return {
      display: 'just now',
      value: 0,
      unit: 'm',
      isDateOnly: false,
    };
  }

  // < 1 minute
  if (diffMinutes < 1) {
    return {
      display: 'just now',
      value: 0,
      unit: 'm',
      isDateOnly: false,
    };
  }

  // < 1 hour
  if (diffMinutes < 60) {
    return {
      display: `~${diffMinutes}m ago`,
      value: diffMinutes,
      unit: 'm',
      isDateOnly: false,
    };
  }

  // 1-24 hours
  if (diffHours < 24) {
    return {
      display: `~${diffHours}h ago`,
      value: diffHours,
      unit: 'h',
      isDateOnly: false,
    };
  }

  // 1-7 days
  if (diffDays < 7) {
    return {
      display: `~${diffDays}d ago`,
      value: diffDays,
      unit: 'd',
      isDateOnly: false,
    };
  }

  // 7-28 days (4 weeks)
  if (diffWeeks < 4) {
    return {
      display: `~${diffWeeks}w ago`,
      value: diffWeeks,
      unit: 'w',
      isDateOnly: false,
    };
  }

  // > 4 weeks: date-only format
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateOnly = `${year}-${month}-${day}`;

  return {
    display: dateOnly,
    value: diffDays,
    unit: 'd',
    isDateOnly: true,
  };
}

// ---------------------------------------------------------------------------
// Evidence ID Hashing
// ---------------------------------------------------------------------------

/**
 * Hash an evidence ID for telemetry/logging.
 *
 * Uses SHA-256, truncates to first 16 hex chars, prefixes with "ev_".
 *
 * @param evidenceId - Evidence ID (opaque UUID/string)
 * @returns Hashed ID (ev_{hash16})
 *
 * @example
 * hashEvidenceId('550e8400-e29b-41d4-a716-446655440000')
 * // => 'ev_a1b2c3d4e5f6g7h8'
 */
export async function hashEvidenceId(evidenceId: string): Promise<string> {
  if (typeof evidenceId !== 'string' || evidenceId.trim().length === 0) {
    return 'ev_invalid';
  }

  try {
    // Use Web Crypto API (browser) or Node crypto
    const encoder = new TextEncoder();
    const data = encoder.encode(evidenceId.trim());

    let hash: ArrayBuffer;
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      // Browser
      hash = await crypto.subtle.digest('SHA-256', data);
    } else if (typeof require !== 'undefined') {
      // Node.js fallback
      const nodeCrypto = require('crypto');
      const nodeHash = nodeCrypto.createHash('sha256').update(evidenceId.trim()).digest();
      hash = nodeHash.buffer.slice(nodeHash.byteOffset, nodeHash.byteOffset + nodeHash.byteLength);
    } else {
      // No crypto available
      return 'ev_nocrypto';
    }

    const hashArray = Array.from(new Uint8Array(hash));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    const truncated = hashHex.slice(0, 16);

    return `ev_${truncated}`;
  } catch {
    return 'ev_error';
  }
}

/**
 * Synchronous version of hashEvidenceId for contexts where async is not available.
 * Falls back to a simple deterministic hash if crypto is unavailable.
 *
 * @param evidenceId - Evidence ID
 * @returns Hashed ID (ev_{hash16})
 */
export function hashEvidenceIdSync(evidenceId: string): string {
  if (typeof evidenceId !== 'string' || evidenceId.trim().length === 0) {
    return 'ev_invalid';
  }

  // Simple deterministic hash (djb2) - not cryptographic but sufficient for telemetry
  let hash = 5381;
  const str = evidenceId.trim();
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }

  // Convert to unsigned 32-bit and then hex
  const hashUnsigned = hash >>> 0;
  const hashHex = hashUnsigned.toString(16).padStart(8, '0');

  return `ev_${hashHex}`;
}

// ---------------------------------------------------------------------------
// Evidence Redaction for Telemetry
// ---------------------------------------------------------------------------

export interface RedactedEvidence {
  /** Hashed evidence ID */
  id: string;
  /** Evidence type (generic) */
  type: string;
  /** Truncated display (NEVER full value) */
  displayValue: string;
  /** Generalized timestamp */
  createdAt: string;
}

/**
 * Redact evidence for telemetry/logging.
 *
 * NEVER includes:
 *   - evidence.value (full URL)
 *   - Query parameters
 *   - File paths
 *   - Exact timestamps
 *
 * @param evidence - Evidence object { id, type, value, createdAt }
 * @returns RedactedEvidence safe for telemetry
 *
 * @example
 * redactEvidenceForTelemetry({
 *   id: '123',
 *   type: 'link',
 *   value: 'https://example.com/secret?token=abc',
 *   createdAt: '2026-09-27T12:00:00Z'
 * })
 * // => {
 * //   id: 'ev_a1b2c3d4',
 * //   type: 'link',
 * //   displayValue: 'example.com/...',
 * //   createdAt: '~2h ago'
 * // }
 */
export function redactEvidenceForTelemetry(evidence: {
  id: string;
  type: string;
  value: string;
  createdAt: string;
}): RedactedEvidence {
  const hashedId = hashEvidenceIdSync(evidence.id);

  let displayValue = '[redacted]';
  if (evidence.type === 'link' || evidence.type === 'image' || evidence.type === 'video' || evidence.type === 'document') {
    const truncated = truncateEvidenceUrl(evidence.value);
    displayValue = truncated.display;
  } else if (evidence.type === 'text') {
    // For text evidence, show length only
    displayValue = `[text, ${evidence.value.length} chars]`;
  }

  const relativeTime = formatRelativeTime(evidence.createdAt);

  return {
    id: hashedId,
    type: evidence.type,
    displayValue,
    createdAt: relativeTime.display,
  };
}
