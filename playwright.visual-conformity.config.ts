import { defineConfig } from '@playwright/test';
import fs from 'node:fs';

/**
 * Playwright Visual Conformity & Evidence Capture Configuration
 * UI-FE-093 (#664)
 *
 * Runs deterministic visual comparisons and produces screenshots mapped
 * back to the approved protocol board authorities.
 *
 * Enforces:
 *   - Reduced motion ('reduce') to prevent animation-timing flakiness
 *   - Frozen clocks and deterministic mock data
 *   - Pixel thresholding capped at 0.2% maxDiffPixelRatio
 *   - Zero horizontal overflow across desktop, tablet, mobile, and 200% zoom
 */

function needsChromeChannel(): boolean {
  if (process.env.CI) return true;
  try {
    const paths = [
      '/opt/google/chrome/chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
    ];
    return paths.some((p) => fs.existsSync(p));
  } catch {
    return false;
  }
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'board-conformity.spec.ts',
  timeout: 60000,
  expect: {
    timeout: 15000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.002,
      animations: 'disabled',
    },
  },
  snapshotDir: './e2e/visual-conformity-snapshots',
  outputDir: './reports/visual-evidence/playwright-artifacts',
  use: {
    baseURL: process.env.VISUAL_CONFORMITY_BASE_URL || 'http://localhost:3000',
    headless: true,
    ...(needsChromeChannel() ? { channel: 'chrome' } : {}),
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm start',
    port: 3000,
    reuseExistingServer: true,
    timeout: 60000,
    env: {
      E2E_HARNESS: '1',
      NODE_ENV: 'production',
    },
  },
});
