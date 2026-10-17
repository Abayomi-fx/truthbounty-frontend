/**
 * UI-FE-088 — contract-release factory.
 *
 * Contract-derived values only. The default manifest is the *pinned* release
 * from `release/manifest.json` — the same file the app's contract registry
 * loads — so fixtures track the real deployment instead of inventing one and
 * stay visibly distinct from API projections (issue constraint).
 */

import type { ProtocolDiagnostics, ReleaseManifest } from '../../../lib/contracts/types';
import pinnedManifest from '../../../../release/manifest.json';
import { createFixtureContext, type FixtureContext } from '../deterministic';

export interface MakeReleaseManifestOptions {
  overrides?: Partial<ReleaseManifest>;
}

/** Pinned release manifest, optionally overridden for drift tests. */
export function makeReleaseManifest(
  options: MakeReleaseManifestOptions = {},
): ReleaseManifest {
  const manifest = pinnedManifest as ReleaseManifest;
  return { ...manifest, ...options.overrides };
}

export interface MakeProtocolDiagnosticsOptions {
  /** `'development'` mirrors local harness runs; default `'production'`. */
  environment?: ProtocolDiagnostics['environment'];
  overrides?: Partial<ProtocolDiagnostics>;
  ctx?: FixtureContext;
}

/**
 * Release diagnostics as the UI surfaces them. `verifiedAt` comes from the
 * pinned fixture clock, never `new Date()`.
 */
export function makeProtocolDiagnostics(
  options: MakeProtocolDiagnosticsOptions = {},
): ProtocolDiagnostics {
  const { environment = 'production', overrides = {}, ctx = createFixtureContext() } = options;
  const manifest = makeReleaseManifest();

  const diagnostics: ProtocolDiagnostics = {
    protocolVersion: manifest.protocolVersion,
    releaseId: manifest.releaseId,
    chainId: manifest.chainId,
    gitCommit: manifest.gitCommit,
    artifactPath: 'release',
    verifiedAt: ctx.nowIso,
    abiVersion: manifest.abiVersion,
    abiHash: null,
    environment,
    contracts: Object.fromEntries(
      Object.entries(manifest.contracts).map(([name, entry]) => [name, entry.proxy]),
    ),
  };

  return { ...diagnostics, ...overrides };
}
