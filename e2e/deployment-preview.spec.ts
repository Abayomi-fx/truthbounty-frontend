/**
 * V2-FE-064 — Deployment Preview Verification E2E Tests
 *
 * These tests exercise the preview verification surface end-to-end:
 *
 *   1. PR preview smoke test — a valid preview build shows the banner with
 *      correct provenance metadata.
 *   2. Wrong-chain test — a preview targeting mainnet (chain 10) renders the
 *      blocked banner, no mutations permitted.
 *   3. Missing manifest test — absent env vars → blocked banner, no mutations.
 *   4. Stale ABI test — checksum mismatch → blocked, fail closed.
 *   5. Production endpoint test — apiUrl points to production origin → blocked.
 *   6. Mixed-release test — protocolVersion mismatch between manifest and
 *      bundled registry → blocked.
 *   7. Metadata exposure test — reviewers can verify artifact provenance in
 *      the UI; no secrets appear in the DOM.
 *
 * Tests run against the E2E harness routes (E2E_HARNESS=1). The harness
 * renders a standalone preview-verification page that accepts query-string
 * overrides for the manifest fields so tests can inject any scenario without
 * modifying production code.
 *
 * Architecture: the harness page at /e2e/deployment-preview simply calls
 * verifyPreviewDeployment() with the manifest built from the query string,
 * then renders <DeploymentPreviewBanner> and <DeploymentPreviewGuard>.
 * This lets the E2E suite cover every failure scenario deterministically.
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const HARNESS = `${BASE}/e2e/deployment-preview`;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Build a harness URL with a fully-valid preview manifest encoded in the QS. */
function validPreviewUrl(overrides: Record<string, string | number> = {}): string {
  const params = new URLSearchParams({
    gitCommit: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    releaseId: 'v2.0.0-sepolia-preview-42',
    protocolVersion: '2.0.0',
    chainId: '11155420',
    // artifactChecksum is set to match the bundled registry checksum (all 'a's in test fixtures)
    artifactChecksum: 'a'.repeat(64),
    apiUrl: 'https://api-preview-42.staging.example.com',
    apiVersion: 'v2',
    environment: 'preview',
    builtAt: '2026-10-15T10:00:00.000Z',
    prNumber: '42',
    buildId: 'build-ci-e2e',
    ...Object.fromEntries(
      Object.entries(overrides).map(([k, v]) => [k, String(v)]),
    ),
  });
  return `${HARNESS}?${params.toString()}`;
}

/** URL with no manifest params at all (simulates a non-preview / misconfigured build). */
function noManifestUrl(): string {
  return HARNESS;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. PR Preview Smoke Test
// ────────────────────────────────────────────────────────────────────────────

test.describe('PR preview smoke test', () => {
  test('valid preview build shows verified banner with provenance metadata', async ({ page }) => {
    await page.goto(validPreviewUrl());

    const banner = page.getByTestId('deployment-preview-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('data-preview-status', 'verified');

    // Commit
    await expect(banner).toContainText('a1b2c3d');
    // Release ID
    await expect(banner).toContainText('v2.0.0-sepolia-preview-42');
    // Chain
    await expect(banner).toContainText('Optimism Sepolia');
    // API version
    await expect(banner).toContainText('v2');
    // Environment
    await expect(banner).toContainText('preview');
    // PR number
    await expect(banner).toContainText('PR #42');
  });

  test('verified banner has role="status" live region', async ({ page }) => {
    await page.goto(validPreviewUrl());
    await expect(page.getByRole('status')).toBeVisible();
  });

  test('guard allows mutation content when preview is verified', async ({ page }) => {
    await page.goto(validPreviewUrl());
    // Harness renders a sentinel mutation-action element inside the guard
    await expect(page.getByTestId('mutation-action-sentinel')).toBeVisible();
  });

  test('reviewer can verify artifact provenance — checksum displayed', async ({ page }) => {
    await page.goto(validPreviewUrl());
    // Short checksum (first 12 chars) is present in the banner
    await expect(page.getByTestId('deployment-preview-banner')).toContainText('aaaaaaaaaaaa');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Wrong-chain test
// ────────────────────────────────────────────────────────────────────────────

test.describe('wrong chain', () => {
  test('mainnet chain (10) produces blocked banner', async ({ page }) => {
    await page.goto(validPreviewUrl({ chainId: 10 }));

    const banner = page.getByTestId('deployment-preview-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('data-preview-status', 'blocked');
    await expect(banner).toContainText(/production chain/i);
  });

  test('mainnet chain blocks role="alert" lives region', async ({ page }) => {
    await page.goto(validPreviewUrl({ chainId: 10 }));
    await expect(page.getByRole('alert').first()).toBeVisible();
  });

  test('guard blocks mutation content on wrong chain', async ({ page }) => {
    await page.goto(validPreviewUrl({ chainId: 10 }));
    await expect(page.getByTestId('mutation-action-sentinel')).not.toBeVisible();
  });

  test('unsupported chain ID (8453) also produces blocked banner', async ({ page }) => {
    await page.goto(validPreviewUrl({ chainId: 8453 }));
    await expect(page.getByTestId('deployment-preview-banner')).toHaveAttribute(
      'data-preview-status',
      'blocked',
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. Missing manifest test
// ────────────────────────────────────────────────────────────────────────────

test.describe('missing manifest', () => {
  test('absent manifest produces blocked banner (incomplete configuration)', async ({
    page,
  }) => {
    await page.goto(noManifestUrl());
    const banner = page.getByTestId('deployment-preview-banner');
    // Harness renders a "missing" manifest scenario — blocked or not_preview
    // depending on harness mode. Without any params the harness passes
    // an empty object to trigger the incomplete_manifest path.
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('data-preview-status', 'blocked');
  });

  test('blocked banner cannot be dismissed when manifest is missing', async ({ page }) => {
    await page.goto(noManifestUrl());
    // No dismiss button on blocked banners
    await expect(page.getByRole('button', { name: /dismiss/i })).not.toBeVisible();
    await expect(page.getByTestId('deployment-preview-banner')).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. Stale ABI test
// ────────────────────────────────────────────────────────────────────────────

test.describe('stale ABI / checksum mismatch', () => {
  test('non-matching checksum produces blocked banner', async ({ page }) => {
    await page.goto(validPreviewUrl({ artifactChecksum: 'b'.repeat(64) }));
    await expect(page.getByTestId('deployment-preview-banner')).toHaveAttribute(
      'data-preview-status',
      'blocked',
    );
  });

  test('checksum mismatch failure detail is visible', async ({ page }) => {
    await page.goto(validPreviewUrl({ artifactChecksum: 'b'.repeat(64) }));
    await expect(page.getByTestId('deployment-preview-banner')).toContainText(/checksum/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. Production endpoint test
// ────────────────────────────────────────────────────────────────────────────

test.describe('production endpoint', () => {
  test('apiUrl pointing to truthbounty.io is blocked', async ({ page }) => {
    await page.goto(
      validPreviewUrl({ apiUrl: 'https://api.truthbounty.io/v2' }),
    );
    await expect(page.getByTestId('deployment-preview-banner')).toHaveAttribute(
      'data-preview-status',
      'blocked',
    );
    await expect(page.getByTestId('deployment-preview-banner')).toContainText(
      /production/i,
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. Mixed-release test
// ────────────────────────────────────────────────────────────────────────────

test.describe('mixed release', () => {
  test('manifest protocolVersion mismatch with bundled registry is blocked', async ({
    page,
  }) => {
    await page.goto(validPreviewUrl({ protocolVersion: '1.9.0' }));
    await expect(page.getByTestId('deployment-preview-banner')).toHaveAttribute(
      'data-preview-status',
      'blocked',
    );
    await expect(page.getByTestId('deployment-preview-banner')).toContainText(/release/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. Metadata exposure test
// ────────────────────────────────────────────────────────────────────────────

test.describe('metadata exposure — reviewer provenance', () => {
  test('verified banner exposes commit, release, chain, artifact, API, env to reviewer', async ({
    page,
  }) => {
    await page.goto(validPreviewUrl());
    const banner = page.getByTestId('deployment-preview-banner');

    // All provenance fields are visible to the reviewer
    await expect(banner).toContainText('a1b2c3d');           // commit
    await expect(banner).toContainText('v2.0.0-sepolia-preview-42'); // release
    await expect(banner).toContainText('11155420');           // chain ID
    await expect(banner).toContainText('v2');                 // API version
    await expect(banner).toContainText('preview');            // environment
    await expect(banner).toContainText('aaaaaaaaaaaa');       // artifact checksum short
  });

  test('no production secrets appear in the page DOM', async ({ page }) => {
    await page.goto(validPreviewUrl());
    const bodyText = await page.textContent('body') ?? '';
    expect(bodyText).not.toMatch(/password/i);
    expect(bodyText).not.toMatch(/PRIVATE/);
    expect(bodyText).not.toMatch(/secret/i);
    // Zero address — never a real contract address
    expect(bodyText).not.toContain('0x0000000000000000000000000000000000000000');
  });

  test('chain-id data attribute matches the manifest chain', async ({ page }) => {
    await page.goto(validPreviewUrl());
    await expect(page.getByTestId('deployment-preview-banner')).toHaveAttribute(
      'data-preview-chain-id',
      '11155420',
    );
  });

  test('blocked banner exposes failure reasons without leaking secrets', async ({ page }) => {
    await page.goto(validPreviewUrl({ chainId: 10, environment: 'production' }));
    const banner = page.getByTestId('deployment-preview-banner');
    await expect(banner).toHaveAttribute('data-preview-status', 'blocked');
    const bannerText = await banner.textContent() ?? '';
    expect(bannerText).not.toMatch(/password/i);
    expect(bannerText).not.toMatch(/secret/i);
    expect(bannerText).not.toMatch(/PRIVATE/);
  });
});
