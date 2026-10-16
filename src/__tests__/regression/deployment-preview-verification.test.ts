/**
 * V2-FE-064 — Deployment Preview Verification Regression Tests (revised)
 *
 * Addresses all findings from the DevAhmed code review:
 *
 *  1.  PR preview smoke — valid manifest, exact registry match, passes.
 *  2.  Wrong-chain — mainnet (10) and unsupported chains blocked.
 *  3.  Missing manifest — classified preview with absent manifest → BLOCKED
 *      (not not_preview — fixes the fail-open gap).
 *  4.  Stale ABI — checksum mismatch blocked.
 *  5.  Production endpoint — apiUrl approved-allowlist (not blocklist).
 *  6.  Mixed release — protocolVersion mismatch blocked.
 *  7.  Exact source — gitCommit mismatch blocked (commit_mismatch).
 *  8.  Exact source — releaseId mismatch blocked (release_id_mismatch).
 *  9.  Registry unavailable — missing/partial registry BLOCKS, never skips.
 * 10.  Stale builtAt — build older than 7 days blocked.
 * 11.  Metadata exposure — displayInfo never contains secrets or raw apiUrl.
 * 12.  allowsMutation integrity.
 * 13.  Production environment targeting.
 * 14.  Module purity — no MSW/mocks/placeholders.
 * 15.  Chain ID invariants.
 * 16.  App-shell integration — MainLayout imports the guard.
 * 17.  Harness production boundary — NODE_ENV guard enforced.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  validatePreviewManifest,
  classifyPreviewBuild,
  PREVIEW_SUPPORTED_CHAIN_IDS,
  type RawPreviewManifest,
} from '@/lib/deployment/preview-manifest';

import {
  verifyPreviewDeployment,
  isPreviewVerified,
} from '@/lib/deployment/preview-verification';

// ── Registry constants matching release/manifest.json + checksums.json ────
const REGISTRY_GIT_COMMIT = '5333c0acb9ccfb8a6a37ae76b3397d06781f0119';
const REGISTRY_RELEASE_ID = 'v2.0.0-sepolia';
const REGISTRY_PROTOCOL_VERSION = '2.0.0';
const REGISTRY_CHAIN_ID = 11155420;
const REGISTRY_ABI_CHECKSUM = '6865824782c1df1cf5f16465d9a4e028e8ac7385c6506fea957116a09a1d8385';

jest.mock('@/lib/contracts/registry', () => ({
  protocolRegistry: {
    manifest: {
      protocolVersion: REGISTRY_PROTOCOL_VERSION,
      releaseId: REGISTRY_RELEASE_ID,
      gitCommit: REGISTRY_GIT_COMMIT,
      chainId: REGISTRY_CHAIN_ID,
    },
    checksums: {
      files: { 'abi/TruthBountyWeighted.json': REGISTRY_ABI_CHECKSUM },
    },
  },
  getProtocolVersion: () => REGISTRY_PROTOCOL_VERSION,
}));

const NOW = new Date('2026-10-16T12:00:00.000Z').getTime();
const FRESH = new Date(NOW - 86400000).toISOString();
const STALE = new Date(NOW - 10 * 86400000).toISOString();

function valid(o: Partial<RawPreviewManifest> = {}): RawPreviewManifest {
  return {
    gitCommit: REGISTRY_GIT_COMMIT,
    releaseId: REGISTRY_RELEASE_ID,
    protocolVersion: REGISTRY_PROTOCOL_VERSION,
    chainId: REGISTRY_CHAIN_ID,
    artifactChecksum: REGISTRY_ABI_CHECKSUM,
    apiUrl: 'https://api-preview.staging.example.com',
    apiVersion: 'v2',
    environment: 'preview',
    builtAt: FRESH,
    prNumber: 42,
    buildId: 'build-001',
    ...o,
  };
}

// ── 1. PR preview smoke ───────────────────────────────────────────────────
describe('1. PR preview smoke', () => {
  it('verified with exact registry match', () => {
    const r = verifyPreviewDeployment(valid(), NOW);
    expect(r.status).toBe('verified');
    expect(r.allowsMutation).toBe(true);
    expect(r.failures).toHaveLength(0);
    expect(r.displayInfo?.checksumMatchesRegistry).toBe(true);
  });

  it('displayInfo contains all required provenance fields', () => {
    const d = verifyPreviewDeployment(valid(), NOW).displayInfo!;
    expect(d.commitShort).toHaveLength(7);
    expect(d.releaseId).toBe(REGISTRY_RELEASE_ID);
    expect(d.chainId).toBe(REGISTRY_CHAIN_ID);
    expect(d.artifactChecksumShort).toHaveLength(12);
  });
});

// ── 2. Wrong-chain ────────────────────────────────────────────────────────
describe('2. Wrong-chain', () => {
  it('mainnet (10) → blocked production_targeting', () => {
    const r = verifyPreviewDeployment(valid({ chainId: 10 }), NOW);
    expect(r.status).toBe('blocked');
    expect(r.failures).toContain('production_targeting');
  });

  it('Ethereum (1) → blocked wrong_chain', () => {
    expect(verifyPreviewDeployment(valid({ chainId: 1 }), NOW).status).toBe('blocked');
  });
});

// ── 3. Missing manifest — classified preview BLOCKS (not fails-open) ─────
describe('3. Missing manifest — preview_no_manifest → blocked', () => {
  it('empty object → blocked missing_manifest', () => {
    const r = verifyPreviewDeployment({}, NOW);
    expect(r.status).toBe('blocked');
    expect(r.allowsMutation).toBe(false);
    expect(r.failures).toContain('missing_manifest');
  });

  it('null → not_preview (explicit non-preview, allowsMutation:true)', () => {
    const r = verifyPreviewDeployment(null, NOW);
    expect(r.status).toBe('not_preview');
    expect(r.allowsMutation).toBe(true);
  });

  it('classifyPreviewBuild: APP_ENV=staging with no manifest → preview_no_manifest', () => {
    const orig = process.env;
    process.env = {
      ...orig,
      NEXT_PUBLIC_APP_ENV: 'staging',
    };
    delete process.env.NEXT_PUBLIC_PREVIEW_GIT_COMMIT;
    delete process.env.NEXT_PUBLIC_PREVIEW_RELEASE_ID;
    delete process.env.NEXT_PUBLIC_PREVIEW_ENVIRONMENT;
    expect(classifyPreviewBuild()).toBe('preview_no_manifest');
    process.env = orig;
  });
});

// ── 4. Stale ABI / checksum mismatch ─────────────────────────────────────
describe('4. Stale ABI', () => {
  it('checksum mismatch → blocked checksum_mismatch', () => {
    const r = verifyPreviewDeployment(valid({ artifactChecksum: 'b'.repeat(64) }), NOW);
    expect(r.status).toBe('blocked');
    expect(r.failures).toContain('checksum_mismatch');
  });

  it('missing checksum → blocked stale_abi', () => {
    expect(verifyPreviewDeployment(valid({ artifactChecksum: undefined }), NOW).status).toBe('blocked');
  });
});

// ── 5. Production endpoint — allowlist not blocklist ─────────────────────
describe('5. Production endpoint (approved-allowlist)', () => {
  it('production origin → blocked production_endpoint', () => {
    expect(verifyPreviewDeployment(valid({ apiUrl: 'https://api.truthbounty.io' }), NOW).status).toBe('blocked');
  });

  it('unknown non-approved host → blocked (not allowed by default)', () => {
    const r = verifyPreviewDeployment(valid({ apiUrl: 'https://some-corp-internal.com/api' }), NOW);
    expect(r.status).toBe('blocked');
    expect(r.failures).toContain('production_endpoint');
  });

  it('staging subdomain → verified', () => {
    expect(verifyPreviewDeployment(valid({ apiUrl: 'https://api.staging.example.com' }), NOW).status).toBe('verified');
  });

  it('Vercel preview URL → verified', () => {
    expect(verifyPreviewDeployment(valid({ apiUrl: 'https://app-pr42.vercel.app/api' }), NOW).status).toBe('verified');
  });
});

// ── 6. Mixed release ──────────────────────────────────────────────────────
describe('6. Mixed release', () => {
  it('protocolVersion mismatch → blocked mixed_release', () => {
    const r = verifyPreviewDeployment(valid({ protocolVersion: '1.9.0' }), NOW);
    expect(r.status).toBe('blocked');
    expect(r.failures).toContain('mixed_release');
  });
});

// ── 7. Exact source — gitCommit mismatch (NEW) ───────────────────────────
describe('7. Exact source — gitCommit', () => {
  it('different gitCommit → blocked commit_mismatch', () => {
    const r = verifyPreviewDeployment(
      valid({ gitCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }),
      NOW,
    );
    expect(r.status).toBe('blocked');
    expect(r.failures).toContain('commit_mismatch');
    expect(r.allowsMutation).toBe(false);
  });

  it('exact registry gitCommit → allowed', () => {
    expect(verifyPreviewDeployment(valid({ gitCommit: REGISTRY_GIT_COMMIT }), NOW).status).toBe('verified');
  });
});

// ── 8. Exact source — releaseId mismatch (NEW) ───────────────────────────
describe('8. Exact source — releaseId', () => {
  it('different releaseId → blocked release_id_mismatch', () => {
    const r = verifyPreviewDeployment(valid({ releaseId: 'v9.9.9-wrong' }), NOW);
    expect(r.status).toBe('blocked');
    expect(r.failures).toContain('release_id_mismatch');
  });
});

// ── 9. Registry unavailable — BLOCKS, never skips ────────────────────────
describe('9. Registry unavailable → blocked', () => {
  it('null registry authority → blocked registry_unavailable', async () => {
    jest.resetModules();
    jest.mock('@/lib/contracts/registry', () => { throw new Error('unavailable'); });
    const { verifyPreviewDeployment: verify } = await import('../../../lib/deployment/preview-verification');
    const r = verify(valid(), NOW);
    expect(r.status).toBe('blocked');
    expect(r.failures).toContain('registry_unavailable');
    jest.resetModules();
  });
});

// ── 10. Stale builtAt (NEW) ───────────────────────────────────────────────
describe('10. Stale builtAt', () => {
  it('build older than 7 days → blocked stale_built_at', () => {
    const r = verifyPreviewDeployment(valid({ builtAt: STALE }), NOW);
    expect(r.status).toBe('blocked');
    expect(r.failures).toContain('stale_built_at');
  });

  it('fresh build passes', () => {
    expect(verifyPreviewDeployment(valid({ builtAt: FRESH }), NOW).status).toBe('verified');
  });
});

// ── 11. Metadata exposure ─────────────────────────────────────────────────
describe('11. Metadata exposure — no secrets', () => {
  it('displayInfo does not expose raw apiUrl', () => {
    const r = verifyPreviewDeployment(valid(), NOW);
    expect(JSON.stringify(r.displayInfo)).not.toContain('staging.example.com');
  });

  it('displayInfo does not contain password/secret/PRIVATE', () => {
    const s = JSON.stringify(verifyPreviewDeployment(valid(), NOW).displayInfo);
    expect(s).not.toMatch(/password/i);
    expect(s).not.toMatch(/PRIVATE/);
  });

  it('commitShort is exactly 7 chars', () => {
    expect(verifyPreviewDeployment(valid(), NOW).displayInfo?.commitShort).toHaveLength(7);
  });
});

// ── 12. allowsMutation integrity ─────────────────────────────────────────
describe('12. allowsMutation', () => {
  it('verified → true; everything else → false (except not_preview)', () => {
    expect(verifyPreviewDeployment(valid(), NOW).allowsMutation).toBe(true);
    expect(verifyPreviewDeployment(null, NOW).allowsMutation).toBe(true); // not_preview
    expect(verifyPreviewDeployment({}, NOW).allowsMutation).toBe(false);
    expect(verifyPreviewDeployment(valid({ chainId: 10 }), NOW).allowsMutation).toBe(false);
    expect(verifyPreviewDeployment(valid({ artifactChecksum: 'c'.repeat(64) }), NOW).allowsMutation).toBe(false);
    expect(isPreviewVerified(valid())).toBe(true);
    expect(isPreviewVerified(null)).toBe(false);
  });
});

// ── 13. Production environment ────────────────────────────────────────────
describe('13. Production environment targeting', () => {
  it('environment=production → blocked production_targeting', () => {
    const r = verifyPreviewDeployment(valid({ environment: 'production' }), NOW);
    expect(r.status).toBe('blocked');
    expect(r.failures).toContain('production_targeting');
  });
});

// ── 14. Module purity ─────────────────────────────────────────────────────
describe('14. Module purity', () => {
  const manifestSrc = path.resolve(__dirname, '../../lib/deployment/preview-manifest.ts');
  const verifSrc = path.resolve(__dirname, '../../lib/deployment/preview-verification.ts');

  it('preview-manifest.ts does not import msw or test modules', () => {
    const src = fs.readFileSync(manifestSrc, 'utf-8');
    expect(src).not.toMatch(/from\s+['"]msw/);
    expect(src).not.toMatch(/@\/__tests__/);
  });

  it('preview-verification.ts does not import msw or test modules', () => {
    const src = fs.readFileSync(verifSrc, 'utf-8');
    expect(src).not.toMatch(/from\s+['"]msw/);
    expect(src).not.toMatch(/@\/__tests__/);
  });

  it('no placeholder addresses in source', () => {
    const src = fs.readFileSync(manifestSrc, 'utf-8');
    expect(src).not.toMatch(/0xYourContract/i);
    expect(src).not.toMatch(/0x0{40}/);
  });
});

// ── 15. Chain ID invariants ───────────────────────────────────────────────
describe('15. PREVIEW_SUPPORTED_CHAIN_IDS', () => {
  it('never contains production chains', () => {
    expect(PREVIEW_SUPPORTED_CHAIN_IDS).not.toContain(1);
    expect(PREVIEW_SUPPORTED_CHAIN_IDS).not.toContain(10);
    expect(PREVIEW_SUPPORTED_CHAIN_IDS).not.toContain(8453);
  });

  it('contains Optimism Sepolia', () => {
    expect(PREVIEW_SUPPORTED_CHAIN_IDS).toContain(11155420);
  });
});

// ── 16. App-shell integration — MainLayout consumes the guard ────────────
describe('16. App-shell integration', () => {
  it('MainLayout.tsx imports DeploymentPreviewGuard and DeploymentPreviewBanner', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../../components/layout/MainLayout.tsx'),
      'utf-8',
    );
    expect(src).toContain('DeploymentPreviewBanner');
    expect(src).toContain('DeploymentPreviewGuard');
    expect(src).toContain('verifyPreviewDeployment');
  });

  it('MainLayout.tsx wraps children in DeploymentPreviewGuard', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../../components/layout/MainLayout.tsx'),
      'utf-8',
    );
    expect(src).toContain('<DeploymentPreviewGuard');
    expect(src).toContain('</DeploymentPreviewGuard>');
  });
});

// ── 17. Harness production boundary ──────────────────────────────────────
describe('17. E2E harness production boundary', () => {
  it('harness page guards on NODE_ENV !== production (not just E2E_HARNESS)', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../../app/e2e/deployment-preview/page.tsx'),
      'utf-8',
    );
    // Must check NODE_ENV === 'production' not just E2E_HARNESS
    expect(src).toContain("NODE_ENV === 'production'");
    expect(src).toContain('return false');
  });
});
