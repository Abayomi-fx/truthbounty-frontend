/**
 * UI-FE-022 / SEC-FE-007 — Evidence-link security & privacy semantics.
 *
 * Evidence links are untrusted input. This module enforces one set of
 * semantics for every surface that accepts them:
 *   - Only `https:` and `ipfs:` schemes are accepted. `http:`, `javascript:`,
 *     `data:`, `file:`, and friends are rejected.
 *   - URIs carrying secret material (passwords, tokens, API keys, session
 *     identifiers, bearer credentials…) are rejected outright so drafts and
 *     calldata never persist prohibited secrets.
 *   - URIs and digests are size-capped; digests must be well-formed
 *     SHA-256 hex.
 *
 * Deterministic and side-effect free; unit tested in isolation.
 */

import {
  DisputeEvidenceEntry,
  EvidenceProblem,
  EvidenceSetValidation,
} from '@/app/types/dispute-entry';

export const MAX_EVIDENCE_URI_LENGTH = 2048;
export const MAX_EVIDENCE_ENTRIES = 10;
export const MAX_REASON_LENGTH = 4000;

const SHA256_HEX_RE = /^(0x)?[0-9a-fA-F]{64}$/;

/** Only these schemes may appear in an evidence link. */
export const ALLOWED_EVIDENCE_SCHEMES = ['https:', 'ipfs:'] as const;

/**
 * Secret-material detectors applied to the whole URI. A match means the link
 * carries (or claims to carry) credentials and must not be stored, drafted,
 * or submitted.
 */
const SECRET_MATERIAL_PATTERNS: Array<{
  re: RegExp;
  label: string;
}> = [
  {
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
    label: 'private key material',
  },
  {
    re: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/,
    label: 'bearer credential',
  },
  {
    re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
    label: 'JSON web token',
  },
  {
    re: new RegExp(
      String.raw`\b(password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|seed[_-]?phrase|mnemonic|authorization|auth|session|cookie|signature)\b` +
        String.raw`(\s*[=:]\s*)`,
      'i'
    ),
    label: 'credential query parameter',
  },
];

export interface SecretScanResult {
  hasSecrets: boolean;
  labels: string[];
}

/** Scan free text for prohibited secret material. */
export function scanForSecrets(text: string): SecretScanResult {
  const labels: string[] = [];
  for (const { re, label } of SECRET_MATERIAL_PATTERNS) {
    if (re.test(text) && !labels.includes(label)) {
      labels.push(label);
    }
    re.lastIndex = 0;
  }
  return { hasSecrets: labels.length > 0, labels };
}

/** Validate a single evidence URI. Returns every problem found. */
export function validateEvidenceUri(uri: string): EvidenceProblem[] {
  const problems: EvidenceProblem[] = [];
  const trimmed = uri.trim();

  if (trimmed === '') {
    problems.push({ code: 'empty', message: 'Evidence link is required.', entryIndex: null });
    return problems;
  }

  if (trimmed.length > MAX_EVIDENCE_URI_LENGTH) {
    problems.push({
      code: 'oversized',
      message: `Evidence link must be at most ${MAX_EVIDENCE_URI_LENGTH} characters.`,
      entryIndex: null,
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    problems.push({
      code: 'invalid-url',
      message: 'Evidence link is not a valid URL.',
      entryIndex: null,
    });
    return problems;
  }

  if (!(ALLOWED_EVIDENCE_SCHEMES as readonly string[]).includes(parsed.protocol)) {
    problems.push({
      code: 'unsupported-scheme',
      message: `Unsupported scheme "${parsed.protocol}". Only https and ipfs links are allowed.`,
      entryIndex: null,
    });
  }

  const secretScan = scanForSecrets(trimmed);
  if (secretScan.hasSecrets) {
    problems.push({
      code: 'secret-material',
      message: `Evidence link contains prohibited secret material (${secretScan.labels.join(', ')}). Remove credentials before saving.`,
      entryIndex: null,
    });
  }

  return problems;
}

/** Validate an optional SHA-256 content digest. */
export function validateEvidenceDigest(digest: string): EvidenceProblem[] {
  if (!SHA256_HEX_RE.test(digest.trim())) {
    return [
      {
        code: 'invalid-digest',
        message: 'Digest must be a SHA-256 hex value (64 hex characters, 0x optional).',
        entryIndex: null,
      },
    ];
  }
  return [];
}

/** Normalize a digest to its lowercase, 0x-prefixed form. */
export function normalizeEvidenceDigest(digest: string): string {
  const trimmed = digest.trim().toLowerCase();
  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
}

/** Validate one evidence entry (URI + optional digest). */
export function validateEvidenceEntry(entry: DisputeEvidenceEntry): EvidenceProblem[] {
  const problems = validateEvidenceUri(entry.uri);
  if (entry.digest !== undefined && entry.digest.trim() !== '') {
    problems.push(...validateEvidenceDigest(entry.digest));
  }
  return problems;
}

/**
 * Validate a full evidence set. Enforces the entry cap and reports per-entry
 * problems with their indexes so the UI can point at the offending row.
 */
export function validateEvidenceSet(entries: DisputeEvidenceEntry[]): EvidenceSetValidation {
  const problems: EvidenceProblem[] = [];
  const usable: DisputeEvidenceEntry[] = [];
  const rejected: DisputeEvidenceEntry[] = [];

  if (entries.length > MAX_EVIDENCE_ENTRIES) {
    problems.push({
      code: 'too-many-entries',
      message: `At most ${MAX_EVIDENCE_ENTRIES} evidence links can be attached.`,
      entryIndex: null,
    });
  }

  entries.forEach((entry, index) => {
    const entryProblems = validateEvidenceEntry(entry).map((problem) => ({
      ...problem,
      entryIndex: index,
    }));
    if (entryProblems.length > 0 || entries.length > MAX_EVIDENCE_ENTRIES) {
      problems.push(...entryProblems);
      rejected.push(entry);
    } else {
      usable.push(entry);
    }
  });

  return {
    isValid: problems.length === 0,
    problems,
    usable,
    rejected,
  };
}

/**
 * Sanitize free text (e.g. a dispute reason) for persistence by redacting
 * prohibited secret material. Returns the redacted text and how many
 * occurrences were replaced.
 */
export function redactSecrets(text: string): { text: string; redactions: number } {
  let redactions = 0;
  let result = text;

  result = result.replace(
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    () => {
      redactions += 1;
      return '[redacted:private-key]';
    }
  );
  result = result.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g, () => {
    redactions += 1;
    return 'Bearer [redacted]';
  });
  result = result.replace(
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    () => {
      redactions += 1;
      return '[redacted:jwt]';
    }
  );
  result = result.replace(
    new RegExp(
      String.raw`\b(password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|seed[_-]?phrase|mnemonic)\b` +
        String.raw`(\s*[=:]\s*)(\S+)`,
      'gi'
    ),
    (_match, key: string, sep: string) => {
      redactions += 1;
      return `${key}${sep}[redacted]`;
    }
  );

  return { text: result, redactions };
}

/**
 * Presentation-safe attributes for rendering an evidence link as an external
 * anchor (SEC-FE-007: no opener access, no referrer leakage).
 */
export function externalEvidenceLinkProps(uri: string): {
  href: string;
  target: '_blank';
  rel: 'noopener noreferrer nofollow';
} {
  return {
    href: uri,
    target: '_blank',
    rel: 'noopener noreferrer nofollow',
  };
}
