import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
  plugins: [storybookTest({ configDir: '.storybook/rewards-center' })],
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        launchOptions: process.env.REWARDS_TEST_BROWSER_CHANNEL
          ? { channel: process.env.REWARDS_TEST_BROWSER_CHANNEL }
          : {},
      }),
      instances: [{ browser: 'chromium' }],
    },
  },
});
