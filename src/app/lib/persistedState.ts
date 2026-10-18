/**
 * Versioned browser-persisted state boundary.
 *
 * Every persisted key is registered below with its owner, schema version,
 * retention bound, size limit, and sensitivity classification. Values are
 * treated as untrusted: every read passes through a bounded migration chain
 * and a validator. Corrupt, oversized, expired, partially written, or
 * unsupported-newer state fails closed without boot loops.
 *
 * Sensitive material (secrets, signatures, protected evidence, authoritative
 * protocol state) is never persisted: the write path rejects those classes
 * outright.
 */

export type StorageArena = 'localStorage' | 'sessionStorage';

export type Sensitivity = 'public' | 'internal';

export type Owner =
  | 'analytics'
  | 'ui'
  | 'network'
  | 'auth'
  | 'wallet'
  | 'claims'
  | 'query';

export interface PersistedEntry<T> {
  /** Schema version of the persisted payload. */
  v: number;
  /** Epoch milliseconds when the entry was written. */
  t: number;
  /** Payload body. */
  d: T;
}

export interface PersistedKeyRegistration<T> {
  /** Stable storage key. */
  key: string;
  /** Storage arena. */
  arena: StorageArena;
  /** Owning subsystem. */
  owner: Owner;
  /** Current schema version. */
  version: number;
  /** Oldest supported schema version for migration. */
  minVersion: number;
  /** Retention window in milliseconds. */
  retentionMs: number;
  /** Maximum accepted serialized size in bytes. */
  maxBytes: number;
  /** Sensitivity classification. */
  sensitivity: Sensitivity;
  /** Validate a migrated payload. */
  validate: (value: unknown) => value is T;
  /** Bounded migration from a supported older version. */
  migrate?: (value: unknown, fromVersion: number) => unknown;
}

export type ReadResult<T> =
  | { status: 'ok'; value: T; version: number }
  | { status: 'missing' }
  | { status: 'expired'; version: number }
  | { status: 'corrupt'; reason: string }
  | { status: 'unsupported-newer'; version: number }
  | { status: 'unsupported-older'; version: number }
  | { status: 'unavailable'; reason: string };

export type WriteResult = { ok: true } | { ok: false; reason: string };

/** Keys that must never be persisted by this boundary. */
const FORBIDDEN_KEY =
  /signature|secret|private|mnemonic|seed|nonce|token|jwt|authoritative|evidence|receipt/i;

const DEFAULT_MAX_BYTES = 64 * 1024;

const registry = new Map<string, PersistedKeyRegistration<unknown>>();

function arenaOf(arena: StorageArena): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return arena === 'localStorage' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function registerPersistedKey<T>(reg: PersistedKeyRegistration<T>): void {
  if (FORBIDDEN_KEY.test(reg.key)) {
    throw new Error(`Refusing to register sensitive key: ${reg.key}`);
  }
  if (reg.sensitivity !== 'public' && reg.sensitivity !== 'internal') {
    throw new Error(`Unknown sensitivity classification for ${reg.key}`);
  }
  if (reg.version < reg.minVersion) {
    throw new Error(`Invalid version bounds for ${reg.key}`);
  }
  registry.set(reg.key, reg as PersistedKeyRegistration<unknown>);
}

export function getRegistration(key: string): PersistedKeyRegistration<unknown> | undefined {
  return registry.get(key);
}

export function listRegisteredKeys(): ReadonlyArray<PersistedKeyRegistration<unknown>> {
  return Array.from(registry.values());
}

function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEnvelope(raw: string): PersistedEntry<unknown> | null {
  if (!raw) return null;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(parsed)) return null;
  const envelope = parsed as Record<string, unknown>;
  if (typeof envelope.v !== 'number' || !Number.isFinite(envelope.v)) return null;
  if (typeof envelope.t !== 'number' || !Number.isFinite(envelope.t)) return null;
  if (!('d' in envelope)) return null;
  return { v: envelope.v, t: envelope.t, d: envelope.d };
}

export function readPersisted<T>(key: string, now: number = Date.now()): ReadResult<T> {
  const reg = registry.get(key) as PersistedKeyRegistration<T> | undefined;
  if (!reg) {
    return { status: 'unavailable', reason: `Unregistered key: ${key}` };
  }

  const arena = arenaOf(reg.arena);
  if (!arena) {
    return { status: 'unavailable', reason: 'Storage arena unavailable' };
  }

  let raw: string | null = null;
  try {
    raw = arena.getItem(key);
  } catch {
    return { status: 'unavailable', reason: 'Storage read failed' };
  }

  if (raw === null) {
    return { status: 'missing' };
  }

  if (byteLength(raw) > reg.maxBytes) {
    safelyRemove(reg);
    return { status: 'corrupt', reason: 'oversized' };
  }

  const envelope = parseEnvelope(raw);
  if (!envelope) {
    safelyRemove(reg);
    return { status: 'corrupt', reason: 'malformed envelope' };
  }

  if (envelope.v > reg.version) {
    return { status: 'unsupported-newer', version: envelope.v };
  }

  if (envelope.v < reg.minVersion) {
    safelyRemove(reg);
    return { status: 'unsupported-older', version: envelope.v };
  }

  if (reg.retentionMs > 0 && now - envelope.t > reg.retentionMs) {
    safelyRemove(reg);
    return { status: 'expired', version: envelope.v };
  }

  let value: unknown = envelope.d;
  if (envelope.v < reg.version) {
    if (!reg.migrate) {
      safelyRemove(reg);
      return { status: 'unsupported-older', version: envelope.v };
    }
    try {
      value = reg.migrate(value, envelope.v);
    } catch {
      safelyRemove(reg);
      return { status: 'corrupt', reason: 'migration failed' };
    }
  }

  if (!reg.validate(value)) {
    safelyRemove(reg);
    return { status: 'corrupt', reason: 'validation failed' };
  }

  if (envelope.v < reg.version) {
    // Persist the migrated form so future reads are deterministic.
    writePersisted(key, value as T, now);
  }

  return { status: 'ok', value: value as T, version: reg.version };
}

export function writePersisted<T>(
  key: string,
  value: T,
  now: number = Date.now(),
): WriteResult {
  const reg = registry.get(key) as PersistedKeyRegistration<T> | undefined;
  if (!reg) {
    return { ok: false, reason: `Unregistered key: ${key}` };
  }
  if (FORBIDDEN_KEY.test(key)) {
    return { ok: false, reason: 'sensitive key rejected' };
  }
  if (!reg.validate(value)) {
    return { ok: false, reason: 'validation failed' };
  }

  const arena = arenaOf(reg.arena);
  if (!arena) {
    return { ok: false, reason: 'storage unavailable' };
  }

  const envelope: PersistedEntry<T> = { v: reg.version, t: now, d: value };
  let serialized: string;
  try {
    serialized = JSON.stringify(envelope);
  } catch {
    return { ok: false, reason: 'serialization failed' };
  }

  if (byteLength(serialized) > reg.maxBytes) {
    return { ok: false, reason: 'oversized' };
  }

  try {
    arena.setItem(key, serialized);
  } catch {
    return { ok: false, reason: 'storage write failed' };
  }

  return { ok: true };
}

export function removePersisted(key: string): void {
  const reg = registry.get(key);
  if (!reg) return;
  safelyRemove(reg);
}

/**
 * Remove every registered key owned by the given owners. Used on logout and
 * account switch to ensure no cross-account leakage.
 */
export function clearOwnedState(owners: ReadonlyArray<Owner>): void {
  const ownerSet = new Set(owners);
  for (const reg of registry.values()) {
    if (ownerSet.has(reg.owner)) {
      safelyRemove(reg);
    }
  }
}

export function clearAllPersistedState(): void {
  for (const reg of registry.values()) {
    safelyRemove(reg);
  }
}

function safelyRemove(reg: PersistedKeyRegistration<unknown>): void {
  const arena = arenaOf(reg.arena);
  if (!arena) return;
  try {
    arena.removeItem(reg.key);
  } catch {
    // Best-effort: a failed remove must not crash the app.
  }
}

// -----------------------------------------------------------------------------
// Registered keys: every persisted key in the app must appear here.
// -----------------------------------------------------------------------------

export interface AnalyticsConsentPayload {
  choice: 'granted' | 'denied';
}

export interface LowBandwidthPayload {
  enabled: boolean;
}

export interface UiThemePayload {
  theme: 'light' | 'dark' | 'system';
}

export interface LastRoutePayload {
  pathname: string;
}

export const ANALYTICS_CONSENT_KEY = 'truthbounty.analytics.consent';
export const LOW_BANDWIDTH_KEY = 'truthbounty.network.lowBandwidth';
export const UI_THEME_KEY = 'truthbounty.ui.theme';
export const LAST_ROUTE_KEY = 'truthbounty.ui.lastRoute';

function isAnalyticsConsent(value: unknown): value is AnalyticsConsentPayload {
  if (!isPlainObject(value)) return false;
  const choice = (value as Record<string, unknown>).choice;
  return choice === 'granted' || choice === 'denied';
}

function isLowBandwidth(value: unknown): value is LowBandwidthPayload {
  if (!isPlainObject(value)) return false;
  return typeof (value as Record<string, unknown>).enabled === 'boolean';
}

function isUiTheme(value: unknown): value is UiThemePayload {
  if (!isPlainObject(value)) return false;
  const theme = (value as Record<string, unknown>).theme;
  return theme === 'light' || theme === 'dark' || theme === 'system';
}

function isLastRoute(value: unknown): value is LastRoutePayload {
  if (!isPlainObject(value)) return false;
  const pathname = (value as Record<string, unknown>).pathname;
  return typeof pathname === 'string' && pathname.startsWith('/') && pathname.length <= 512;
}

function migrateAnalyticsConsent(value: unknown, fromVersion: number): unknown {
  if (fromVersion === 1) {
    // V1 stored the bare string 'granted' | 'denied'.
    if (value === 'granted' || value === 'denied') {
      return { choice: value } satisfies AnalyticsConsentPayload;
    }
    throw new Error('Unknown V1 analytics consent value');
  }
  throw new Error(`Unsupported analytics consent migration from v${fromVersion}`);
}

registerPersistedKey<AnalyticsConsentPayload>({
  key: ANALYTICS_CONSENT_KEY,
  arena: 'localStorage',
  owner: 'analytics',
  version: 2,
  minVersion: 1,
  retentionMs: 365 * 24 * 60 * 60 * 1000,
  maxBytes: 256,
  sensitivity: 'public',
  validate: isAnalyticsConsent,
  migrate: migrateAnalyticsConsent,
});

registerPersistedKey<LowBandwidthPayload>({
  key: LOW_BANDWIDTH_KEY,
  arena: 'localStorage',
  owner: 'network',
  version: 1,
  minVersion: 1,
  retentionMs: 30 * 24 * 60 * 60 * 1000,
  maxBytes: 128,
  sensitivity: 'internal',
  validate: isLowBandwidth,
});

registerPersistedKey<UiThemePayload>({
  key: UI_THEME_KEY,
  arena: 'localStorage',
  owner: 'ui',
  version: 1,
  minVersion: 1,
  retentionMs: 365 * 24 * 60 * 60 * 1000,
  maxBytes: 128,
  sensitivity: 'public',
  validate: isUiTheme,
});

registerPersistedKey<LastRoutePayload>({
  key: LAST_ROUTE_KEY,
  arena: 'sessionStorage',
  owner: 'ui',
  version: 1,
  minVersion: 1,
  retentionMs: 24 * 60 * 60 * 1000,
  maxBytes: 512,
  sensitivity: 'internal',
  validate: isLastRoute,
});
