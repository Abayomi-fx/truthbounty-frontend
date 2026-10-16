import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '.', testMatch: 'csp-provider-policy.spec.ts', use: { headless: true } });
