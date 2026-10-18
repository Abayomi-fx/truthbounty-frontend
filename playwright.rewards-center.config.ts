import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  expect: { timeout: 15000 },
  testMatch: 'rewards-center.spec.ts',
  snapshotPathTemplate: '{testDir}/rewards-center-snapshots/{arg}{ext}',
  use: {
    baseURL: 'http://localhost:6007',
    headless: true,
    ...(process.env.REWARDS_TEST_BROWSER_CHANNEL
      ? { channel: process.env.REWARDS_TEST_BROWSER_CHANNEL }
      : {}),
  },
  webServer: {
    command:
      'node node_modules/storybook/dist/bin/dispatcher.js dev --ci --disable-telemetry --config-dir .storybook/rewards-center --port 6007',
    url: 'http://localhost:6007',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
