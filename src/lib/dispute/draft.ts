/**
 * UI-FE-022 — Dispute draft model.
 *
 * Drafts are a user convenience only: they never grant authority, and they
 * must never contain prohibited secrets. Every draft is sanitized before it
 * is written to storage:
 *   - The reason text is scanned and secret material is redacted.
 *   - Evidence entries failing the SEC-FE-007 integrity checks (unsupported
 *     schemes, credential-bearing URIs, malformed digests…) are dropped.
 *   - Only the current schema version is accepted on read; anything else
 *     fails closed to "no draft".
 *
 * The storage dependency is injectable so tests never touch real
 * `localStorage`, and the module is safe to import on the server (it never
 * touches globals at module scope).
 */

import {
  DISPUTE_DRAFT_VERSION,
  DisputeDraftInput,
  DisputeDraftV1,
  DisputeEvidenceEntry,
  SanitizedDisputeDraft,
} from '@/app/types/dispute-entry';
import {
  MAX_EVIDENCE_ENTRIES,
  MAX_REASON_LENGTH,
  normalizeEvidenceDigest,
  redactSecrets,
  validateEvidenceEntry,
} from './evidence';

export const DISPUTE_DRAFT_STORAGE_PREFIX = 'truthbounty.dispute-draft.v1.';

/** Minimal storage surface (matches `Storage` for the methods we use). */
export interface DisputeDraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function disputeDraftStorageKey(claimId: string): string {
  return `${DISPUTE_DRAFT_STORAGE_PREFIX}${claimId}`;
}

/**
 * Sanitize a draft input: redact secrets from the reason, drop evidence
 * entries that fail the integrity checks, cap the reason length, and pin the
 * bond (when provided) as the bond this draft was created against.
 */
export function sanitizeDisputeDraft(
  input: DisputeDraftInput
): SanitizedDisputeDraft {
  const { text: redactedReason, redactions } = redactSecrets(
    input.reason.slice(0, MAX_REASON_LENGTH)
  );

  const droppedEvidence: DisputeEvidenceEntry[] = [];
  const evidence = input.evidence.slice(0, MAX_EVIDENCE_ENTRIES).filter((entry) => {
    const problems = validateEvidenceEntry(entry);
    if (problems.length > 0) {
      droppedEvidence.push(entry);
      return false;
    }
    return true;
  });

  const normalizedEvidence = evidence.map((entry) => ({
    uri: entry.uri.trim(),
    ...(entry.digest !== undefined && entry.digest.trim() !== ''
      ? { digest: normalizeEvidenceDigest(entry.digest) }
      : {}),
  }));

  const bondAtDraft =
    input.bondAtDraft === null ? null : String(input.bondAtDraft);

  const draft: DisputeDraftV1 = {
    version: DISPUTE_DRAFT_VERSION,
    claimId: input.claimId,
    reason: redactedReason,
    evidence: normalizedEvidence,
    bondAtDraft,
    updatedAt: input.updatedAt,
  };

  return { draft, redactions, droppedEvidence };
}

/** Serialize a draft to storage JSON. Always sanitized on the way out. */
export function serializeDisputeDraft(input: DisputeDraftInput): string {
  return JSON.stringify(sanitizeDisputeDraft(input).draft);
}

/**
 * Parse a stored draft. Fails closed: malformed JSON, unknown versions, or
 * mismatched claim ids all return `null` (i.e. "no draft").
 */
export function parseDisputeDraft(
  raw: string | null,
  claimId?: string
): DisputeDraftV1 | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as Partial<DisputeDraftV1>;

  if (candidate.version !== DISPUTE_DRAFT_VERSION) return null;
  if (typeof candidate.claimId !== 'string' || candidate.claimId === '') {
    return null;
  }
  if (claimId !== undefined && candidate.claimId !== claimId) return null;
  if (typeof candidate.reason !== 'string') return null;
  if (!Array.isArray(candidate.evidence)) return null;
  if (
    candidate.evidence.some(
      (entry: unknown) =>
        typeof entry !== 'object' ||
        entry === null ||
        typeof (entry as DisputeEvidenceEntry).uri !== 'string'
    )
  ) {
    return null;
  }
  if (typeof candidate.updatedAt !== 'string') return null;
  if (
    candidate.bondAtDraft !== null &&
    candidate.bondAtDraft !== undefined &&
    typeof candidate.bondAtDraft !== 'string'
  ) {
    return null;
  }

  return {
    version: DISPUTE_DRAFT_VERSION,
    claimId: candidate.claimId,
    reason: candidate.reason,
    evidence: candidate.evidence as DisputeEvidenceEntry[],
    bondAtDraft: candidate.bondAtDraft ?? null,
    updatedAt: candidate.updatedAt,
  };
}

export interface DisputeDraftStore {
  /** Load the stored draft for a claim (re-validated on read). */
  load(claimId: string): DisputeDraftV1 | null;
  /** Sanitize and persist a draft; returns what was actually stored. */
  save(input: DisputeDraftInput): SanitizedDisputeDraft;
  /** Remove the stored draft for a claim. */
  discard(claimId: string): void;
}

/**
 * Build a draft store over any `Storage`-like backend. The same sanitization
 * runs on every save, so no code path can persist an unsanitized draft.
 */
export function createDisputeDraftStore(
  storage: DisputeDraftStorage
): DisputeDraftStore {
  return {
    load(claimId: string): DisputeDraftV1 | null {
      try {
        const raw = storage.getItem(disputeDraftStorageKey(claimId));
        return parseDisputeDraft(raw, claimId);
      } catch {
        return null;
      }
    },
    save(input: DisputeDraftInput): SanitizedDisputeDraft {
      const sanitized = sanitizeDisputeDraft(input);
      try {
        storage.setItem(
          disputeDraftStorageKey(input.claimId),
          JSON.stringify(sanitized.draft)
        );
      } catch {
        // Quota/serialization failures must never break the composition.
      }
      return sanitized;
    },
    discard(claimId: string): void {
      try {
        storage.removeItem(disputeDraftStorageKey(claimId));
      } catch {
        // Ignore storage failures on removal.
      }
    },
  };
}

/**
 * In-memory store used by tests and Storybook stories. Also used as the
 * no-op fallback when `localStorage` is unavailable (SSR / privacy modes).
 */
export function createMemoryDisputeDraftStore(
  seed?: Record<string, string>
): DisputeDraftStore & { backing: Map<string, string> } {
  const backing = new Map<string, string>(Object.entries(seed ?? {}));
  const store = createDisputeDraftStore({
    getItem: (key) => backing.get(key) ?? null,
    setItem: (key, value) => {
      backing.set(key, value);
    },
    removeItem: (key) => {
      backing.delete(key);
    },
  });
  return { ...store, backing };
}

/**
 * Resolve a browser draft store. Falls back to an in-memory store when
 * `localStorage` is unavailable (SSR, private browsing restrictions).
 */
export function resolveBrowserDraftStore(): DisputeDraftStore {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createMemoryDisputeDraftStore();
  }
  try {
    // Probe: storage can exist but throw on write (privacy modes).
    const probeKey = `${DISPUTE_DRAFT_STORAGE_PREFIX}__probe__`;
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return createDisputeDraftStore(window.localStorage);
  } catch {
    return createMemoryDisputeDraftStore();
  }
}
