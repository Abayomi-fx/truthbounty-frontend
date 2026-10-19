import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120000,
  expect: { timeout: 60000 },
  testMatch: 'public-claimant-journey.spec.ts',
  use: {
    baseURL: 'http://localhost:6007',
    headless: true,
    ...(process.env.PUBLIC_CLAIMANT_TEST_BROWSER_CHANNEL
      ? { channel: process.env.PUBLIC_CLAIMANT_TEST_BROWSER_CHANNEL }
      : {}),
  },
  webServer: {
    command:
      'node node_modules/storybook/dist/bin/dispatcher.js dev --ci --disable-telemetry --config-dir .storybook/public-claimant --port 6007',
    url: 'http://localhost:6007',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
