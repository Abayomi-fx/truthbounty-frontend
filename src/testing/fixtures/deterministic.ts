/**
 * UI-FE-088 — Deterministic primitives for the fixture library.
 *
 * Every value produced by the fixture factories is a pure function of
 * (seed, key). There is no hidden stream state: calling a factory twice with
 * the same arguments always yields the same object, which is what makes the
 * Storybook, Jest, and Playwright consumers interchangeable.
 *
 * Deliberately banned in this directory (CI enforces it via
 * `scripts/verify-fixture-determinism.mjs`):
 *   - `Date.now()` / `new Date()` — the fixture clock is pinned to FIXTURE_EPOCH.
 *   - `Math.random()` / `crypto.randomUUID()` — identifiers come from FNV-1a.
 *   - `performance.now()` / `process.hrtime()` — no wall-clock sampling.
 *
 * This module is test-only. Production code must never import it (see
 * `docs/TEST_BOUNDARIES.md`); `scripts/verify-production-boundaries.mjs`
 * fails the build when it does.
 */

/**
 * Canary string. It is scanned for in the production bundle by
 * `verify-production-boundaries.mjs`, so if a fixture module ever leaks into
 * `.next`, the postbuild gate fails instead of shipping mock data.
 */
export const FIXTURE_BUNDLE_MARKER = 'TRUTHBOUNTY_TEST_ONLY_FIXTURE_FACTORY_UI_FE_088';

/** Pinned fixture clock. All fixture timestamps derive from this value. */
export const FIXTURE_EPOCH_ISO = '2026-10-14T00:00:00.000Z';

/** `Date.parse` of a literal — deterministic, unlike `Date.now()`. */
export const FIXTURE_EPOCH_MS = Date.parse(FIXTURE_EPOCH_ISO);

/** Seed for every generated identifier, address, and hash. */
export const FIXTURE_SEED = 'ui-fe-088';

/**
 * Canonical network context for fixtures — the pinned release chain
 * (`release/manifest.json` → `chainId: 11155420`).
 */
export const FIXTURE_NETWORK = {
  chainId: 11155420,
  chainName: 'Optimism Sepolia',
  currencySymbol: 'ETH',
  explorerBaseUrl: 'https://sepolia-optimism.etherscan.io',
} as const;

export type FixtureNetwork = typeof FIXTURE_NETWORK;

/**
 * FNV-1a, 32-bit. Pure: the same string always produces the same number.
 * Used instead of `Math.random()` so fixtures are reproducible across runs,
 * machines, and runners.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Deterministic hex string of `bytes` bytes for `key` under `seed`. */
export function fixtureHex(seed: string, bytes: number): string {
  let out = '';
  let counter = 0;
  while (out.length < bytes * 2) {
    out += fnv1a(`${seed}#${counter}`).toString(16).padStart(8, '0');
    counter += 1;
  }
  return out.slice(0, bytes * 2);
}

/** Deterministic integer in [min, max] for `key` under `seed`. */
export function fixtureInt(seed: string, min: number, max: number): number {
  if (max < min) {
    throw new Error(`fixtureInt: max (${max}) must be >= min (${min})`);
  }
  const span = max - min + 1;
  return min + (fnv1a(seed) % span);
}

/**
 * Stateless fixture context. Methods take an explicit key so two entities
 * get two different values while one entity always gets the same value.
 */
export interface FixtureContext {
  /** Seed every derived value is built from. */
  readonly seed: string;
  /** Pinned "now" in ms — never a wall-clock read. */
  readonly nowMs: number;
  /** Pinned "now" as an ISO-8601 string. */
  readonly nowIso: string;
  /** ISO timestamp at `now + offsetMs` (offset may be negative). */
  isoAt(offsetMs: number): string;
  /** Deterministic `0x`-prefixed address for `key`. */
  address(key: string): `0x${string}`;
  /** Deterministic `0x`-prefixed N-byte value (hashes, digests). */
  hex(key: string, bytes: number): `0x${string}`;
  /** Deterministic integer in [min, max] for `key`. */
  int(key: string, min: number, max: number): number;
  /** Deterministic id such as `claim-0003`. */
  id(prefix: string, index: number): string;
  /** Deterministic member of `values`. */
  pick<T>(key: string, values: readonly T[]): T;
}

/**
 * Build a fixture context. Different seeds produce different but equally
 * deterministic values, which is how a test can ask for an isolated universe
 * without giving up reproducibility.
 */
export function createFixtureContext(seed: string = FIXTURE_SEED): FixtureContext {
  return {
    seed,
    nowMs: FIXTURE_EPOCH_MS,
    nowIso: FIXTURE_EPOCH_ISO,
    isoAt(offsetMs: number): string {
      return new Date(FIXTURE_EPOCH_MS + offsetMs).toISOString();
    },
    address(key: string): `0x${string}` {
      return `0x${fixtureHex(`${seed}:address:${key}`, 20)}`;
    },
    hex(key: string, bytes: number): `0x${string}` {
      return `0x${fixtureHex(`${seed}:hex:${key}`, bytes)}`;
    },
    int(key: string, min: number, max: number): number {
      return fixtureInt(`${seed}:int:${key}`, min, max);
    },
    id(prefix: string, index: number): string {
      return `${prefix}-${String(index + 1).padStart(4, '0')}`;
    },
    pick<T>(key: string, values: readonly T[]): T {
      if (values.length === 0) {
        throw new Error(`fixture.pick("${key}") called with an empty list`);
      }
      return values[fixtureInt(`${seed}:pick:${key}`, 0, values.length - 1)];
    },
  };
}
