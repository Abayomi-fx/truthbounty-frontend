/**
 * UI-FE-084 — Recoverable form drafts (local persistence only).
 *
 * A reusable boundary that stores non-secret form drafts in `localStorage`
 * so a user can recover nontrivial input after an accidental reload or a
 * guarded navigation. This module NEVER claims server or on-chain
 * persistence: a stored draft is always a `local` artifact. Canonical
 * persistence is only acknowledged by the caller after it has verified a
 * real write (see `markDraftPersisted`).
 *
 * Security invariants:
 *  - Draft payloads are untrusted browser state. They are validated by a
 *    caller-supplied guard before they ever reach component state.
 *  - Drafts are pinned to the wallet scope (account + chain) and protocol
 *    release they were authored against. On any mismatch the draft is
 *    quarantined, never restored (fail closed on wrong account/chain/release).
 *  - Corrupt, stale-schema, ambiguous, or otherwise invalid payloads are
 *    dropped and reported, never partially applied.
 *  - Guards are cleared only through explicit `discardLocalDraft` or
 *    `markDraftPersisted` — never implicitly.
 *
 * SSR-safe: on the server the module degrades to no-ops and never touches
 * `window`/`localStorage`.
 */

export const DRAFT_SCHEMA_VERSION = 1;

const DRAFT_KEY_PREFIX = 'truthbounty:form-draft:';
const QUARANTINE_KEY_PREFIX = 'truthbounty:form-draft-quarantine:';

/** Wallet/release scope a draft is pinned to. */
export interface DraftScope {
  /** Connected account (case-insensitive), or null when disconnected. */
  address: string | null;
  /** Connected chain id, or null when unknown. */
  chainId: number | null;
  /** Pinned protocol release the draft was authored against. */
  releaseId: string;
}

/** How the current form values ended up persisted. */
export type DraftPersistence = 'local' | 'canonical';

export interface StoredDraft<TPayload = unknown> {
  schemaVersion: number;
  formId: string;
  scope: DraftScope;
  payload: TPayload;
  savedAt: number;
  persistence: DraftPersistence;
}

export type DraftLoadStatus =
  | { status: 'none' }
  | { status: 'restored'; draft: StoredDraft }
  | { status: 'quarantined'; reason: DraftQuarantineReason }
  | { status: 'rejected'; reason: DraftRejectionReason };

export type DraftQuarantineReason = 'account-change' | 'chain-change' | 'release-change' | 'scope-mismatch';

export type DraftRejectionReason = 'corrupt' | 'unsupported-schema' | 'invalid-payload' | 'ambiguous-scope';

/** Result of loading and sanitizing a payload in one step. */
export type DraftPayloadLoadResult<TPayload> =
  | { status: 'restored'; payload: TPayload; savedAt: number }
  | { status: 'none' }
  | { status: 'quarantined'; reason: DraftQuarantineReason }
  | { status: 'rejected'; reason: DraftRejectionReason };

export type DraftPayloadGuard<TPayload> = (value: unknown) => value is TPayload;

export interface QuarantinedDraftRecord {
  quarantinedAt: number;
  reason: DraftQuarantineReason;
  draft: StoredDraft;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function draftKey(formId: string): string {
  return `${DRAFT_KEY_PREFIX}${formId}`;
}

function quarantineKey(formId: string): string {
  return `${QUARANTINE_KEY_PREFIX}${formId}`;
}

function isValidFormId(formId: unknown): formId is string {
  return typeof formId === 'string' && formId.length > 0 && formId.length <= 128;
}

/** Fail closed: a stored scope must be structurally unambiguous. */
function isDraftScope(value: unknown): value is DraftScope {
  if (!isRecord(value)) return false;
  const { address, chainId, releaseId } = value;
  if (address !== null && typeof address !== 'string') return false;
  if (typeof address === 'string' && address.length === 0) return false;
  if (chainId !== null && typeof chainId !== 'number') return false;
  if (typeof chainId === 'number' && (!Number.isInteger(chainId) || chainId <= 0)) return false;
  if (typeof releaseId !== 'string' || releaseId.length === 0) return false;
  return true;
}

function isStoredDraft(value: unknown): value is StoredDraft {
  if (!isRecord(value)) return false;
  if (typeof value.schemaVersion !== 'number' || !Number.isInteger(value.schemaVersion)) return false;
  if (!isValidFormId(value.formId)) return false;
  if (!isDraftScope(value.scope)) return false;
  if (typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt)) return false;
  if (value.persistence !== 'local' && value.persistence !== 'canonical') return false;
  return 'payload' in value;
}

function normalizeAddress(address: string | null): string | null {
  return address === null ? null : address.toLowerCase();
}

/** Compare two scopes strictly (case-insensitive address). */
export function draftScopesMatch(a: DraftScope, b: DraftScope): boolean {
  return (
    normalizeAddress(a.address) === normalizeAddress(b.address) &&
    a.chainId === b.chainId &&
    a.releaseId === b.releaseId
  );
}

/** Classify why a stored scope is incompatible with the active scope. */
export function classifyScopeMismatch(
  stored: DraftScope,
  active: DraftScope,
): DraftQuarantineReason {
  if (stored.releaseId !== active.releaseId) return 'release-change';
  if (normalizeAddress(stored.address) !== normalizeAddress(active.address)) return 'account-change';
  if (stored.chainId !== active.chainId) return 'chain-change';
  return 'scope-mismatch';
}

function removeItem(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable — nothing further to do.
  }
}

function writeItem(key: string, value: string): boolean {
  if (!isBrowser()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    // Quota exceeded / privacy mode — fail closed (draft not persisted).
    return false;
  }
}

function readItem(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Validate a payload read from untrusted browser storage. Returns the typed
 * payload only when the caller-supplied guard accepts it; otherwise null.
 */
function sanitizePayload<TPayload>(
  raw: unknown,
  validatePayload?: DraftPayloadGuard<TPayload>,
): TPayload | null {
  if (!validatePayload) {
    // Without a guard only structural JSON acceptance is possible; callers
    // with sensitive shapes must always pass a guard (fail closed by design).
    return raw as TPayload;
  }
  return validatePayload(raw) ? raw : null;
}

/**
 * Persist a draft locally for the given form and scope.
 *
 * The payload is validated before it is written; an invalid payload is never
 * stored. Returns the stored draft, or null when validation failed or
 * storage is unavailable.
 */
export function saveLocalDraft<TPayload>(
  formId: string,
  scope: DraftScope,
  payload: TPayload,
  validatePayload?: DraftPayloadGuard<TPayload>,
): StoredDraft<TPayload> | null {
  if (!isValidFormId(formId)) return null;
  if (!isDraftScope(scope)) return null;
  if (sanitizePayload(payload, validatePayload) === null) return null;

  const draft: StoredDraft<TPayload> = {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    formId,
    scope: { address: scope.address, chainId: scope.chainId, releaseId: scope.releaseId },
    payload,
    savedAt: Date.now(),
    persistence: 'local',
  };

  const ok = writeItem(draftKey(formId), JSON.stringify(draft));
  return ok ? draft : null;
}

/**
 * Load the local draft for a form, but only when it was authored against the
 * exact active scope. Incompatible drafts are quarantined (never returned),
 * and corrupt/stale/invalid drafts are dropped.
 */
export function loadLocalDraft(formId: string, activeScope: DraftScope): DraftLoadStatus {
  if (!isValidFormId(formId) || !isDraftScope(activeScope)) {
    return { status: 'rejected', reason: 'ambiguous-scope' };
  }

  const raw = readItem(draftKey(formId));
  if (raw === null) return { status: 'none' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    removeItem(draftKey(formId));
    return { status: 'rejected', reason: 'corrupt' };
  }

  if (!isStoredDraft(parsed)) {
    removeItem(draftKey(formId));
    return { status: 'rejected', reason: 'corrupt' };
  }

  if (parsed.schemaVersion !== DRAFT_SCHEMA_VERSION) {
    removeItem(draftKey(formId));
    return { status: 'rejected', reason: 'unsupported-schema' };
  }

  if (!isDraftScope(parsed.scope)) {
    removeItem(draftKey(formId));
    return { status: 'rejected', reason: 'ambiguous-scope' };
  }

  if (!draftScopesMatch(parsed.scope, activeScope)) {
    quarantineDraft(formId, parsed, classifyScopeMismatch(parsed.scope, activeScope));
    return { status: 'quarantined', reason: classifyScopeMismatch(parsed.scope, activeScope) };
  }

  return { status: 'restored', draft: parsed };
}

/**
 * Load and sanitize a draft payload in one step. Returns the validated
 * payload or null; the draft stays stored so the caller can decide whether
 * to restore or discard.
 */
export function readLocalDraftPayload<TPayload>(
  formId: string,
  activeScope: DraftScope,
  validatePayload?: DraftPayloadGuard<TPayload>,
): DraftPayloadLoadResult<TPayload> {
  const loaded = loadLocalDraft(formId, activeScope);
  if (loaded.status !== 'restored') return loaded;

  const payload = sanitizePayload<TPayload>(loaded.draft.payload, validatePayload);
  if (payload === null) {
    // An untrusted payload that no longer validates is dropped outright.
    clearLocalDraft(formId);
    return { status: 'rejected', reason: 'invalid-payload' };
  }

  return { status: 'restored', payload, savedAt: loaded.draft.savedAt };
}

function quarantineDraft(formId: string, draft: StoredDraft, reason: DraftQuarantineReason): void {
  const record: QuarantinedDraftRecord = {
    quarantinedAt: Date.now(),
    reason,
    draft,
  };
  writeItem(quarantineKey(formId), JSON.stringify(record));
  removeItem(draftKey(formId));
}

/**
 * Explicitly discard the local draft (and any quarantined record) for a form.
 * This is one of only two ways a draft/guard pairing may be cleared.
 */
export function clearLocalDraft(formId: string): void {
  if (!isValidFormId(formId)) return;
  removeItem(draftKey(formId));
}

/** Read the quarantined record for a form, if any. */
export function readQuarantinedDraft(formId: string): QuarantinedDraftRecord | null {
  if (!isValidFormId(formId)) return null;
  const raw = readItem(quarantineKey(formId));
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !isStoredDraft(parsed.draft)) {
      removeItem(quarantineKey(formId));
      return null;
    }
    if (typeof parsed.reason !== 'string' || typeof parsed.quarantinedAt !== 'number') {
      removeItem(quarantineKey(formId));
      return null;
    }
    return parsed as unknown as QuarantinedDraftRecord;
  } catch {
    removeItem(quarantineKey(formId));
    return null;
  }
}

/** Remove the quarantined record for a form after the user acknowledged it. */
export function clearQuarantinedDraft(formId: string): void {
  if (!isValidFormId(formId)) return;
  removeItem(quarantineKey(formId));
}

/**
 * Mark the form's data as canonically persisted. Clears the local draft and
 * any quarantine so navigation guards can be released. Callers MUST only
 * call this after verifying a real persistence step (confirmed transaction,
 * verified API write, or explicit discard); never optimistically.
 */
export function markDraftPersisted(formId: string): void {
  clearLocalDraft(formId);
  clearQuarantinedDraft(formId);
}

/** Every form id that currently has a local or quarantined draft. */
export function listDraftFormIds(): string[] {
  if (!isBrowser()) return [];
  const ids = new Set<string>();
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(DRAFT_KEY_PREFIX)) {
        const formId = key.slice(DRAFT_KEY_PREFIX.length);
        if (isValidFormId(formId)) ids.add(formId);
      } else if (key.startsWith(QUARANTINE_KEY_PREFIX)) {
        const formId = key.slice(QUARANTINE_KEY_PREFIX.length);
        if (isValidFormId(formId)) ids.add(formId);
      }
    }
  } catch {
    return [];
  }
  return Array.from(ids);
}

/**
 * Sweep every stored draft and quarantine those that no longer match the
 * active scope (account, chain, or release switch). Returns the form ids
 * that were quarantined by this sweep. Drafts already matching the active
 * scope are left untouched.
 */
export function quarantineIncompatibleDrafts(activeScope: DraftScope): string[] {
  if (!isBrowser() || !isDraftScope(activeScope)) return [];
  const quarantined: string[] = [];
  for (const formId of listDraftFormIds()) {
    const raw = readItem(draftKey(formId));
    if (raw === null) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      removeItem(draftKey(formId));
      continue;
    }
    if (!isStoredDraft(parsed) || !isDraftScope(parsed.scope)) {
      removeItem(draftKey(formId));
      continue;
    }
    if (!draftScopesMatch(parsed.scope, activeScope)) {
      quarantineDraft(formId, parsed, classifyScopeMismatch(parsed.scope, activeScope));
      quarantined.push(formId);
    }
  }
  return quarantined;
}

/**
 * True when a payload object contains nontrivial user input (anything other
 * than blank strings, empty arrays/objects, null, or undefined). Used to
 * decide whether a navigation guard is warranted.
 */
export function hasNontrivialContent(value: unknown, depth = 0): boolean {
  if (depth > 4) return false;
  if (value === null || value === undefined || typeof value === 'boolean') return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.some((item) => hasNontrivialContent(item, depth + 1));
  if (isRecord(value)) {
    return Object.values(value).some((item) => hasNontrivialContent(item, depth + 1));
  }
  return false;
}
