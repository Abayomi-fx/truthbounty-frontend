import { defineConfig } from '@playwright/test';

// Always build/start this checkout: do not reuse a dev server or a synthetic page.
export default defineConfig({
  testDir: '.',
  testMatch: 'csp-provider-policy.spec.ts',
  workers: 1,
  timeout: 120_000,
  use: {
    baseURL: 'http://127.0.0.1:4317',
    headless: true,
    serviceWorkers: 'block',
    trace: 'off', // Wallet/session and evidence URLs must not be uploaded as traces.
    storageState: process.env.CSP_STORAGE_STATE || undefined,
  },
  webServer: {
    command: 'corepack pnpm build && corepack pnpm exec next start --hostname 127.0.0.1 --port 4317',
    url: 'http://127.0.0.1:4317',
    reuseExistingServer: false,
    timeout: 300_000,
    env: { NODE_ENV: 'production', E2E_HARNESS: '0' },
  },
});
