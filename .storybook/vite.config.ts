/**
 * Storybook Vite configuration — alias production hooks to the Storybook
 * mock implementations so that no network, wallet, analytics, or live
 * adapter calls are ever made from a story.
 *
 * These aliases ONLY apply inside the Storybook Vite build, never in the
 * production Next.js build. The production-boundaries check
 * (`verify-production-boundaries.mjs`) enforces that production code never
 * imports from `.storybook/` or any test-only path.
 */

import { defineConfig } from 'vite';
import path from 'node:path';

export const storybookViteConfig = defineConfig({
  resolve: {
    alias: {
      // Remap hooks that touch wagmi / WebSocket / network / Worldcoin
      // to deterministic Storybook fixtures.
      '@/components/hooks/useTrust': path.resolve(
        __dirname,
        'mocks.ts',
      ),
      '@/hooks/useAccount': path.resolve(__dirname, 'mocks.ts'),
      '@/hooks/useNetworkStatus': path.resolve(__dirname, 'mocks.ts'),
      '@/components/hooks/useReducedMotion': path.resolve(__dirname, 'mocks.ts'),
      '@/hooks/useReducedMotion': path.resolve(__dirname, 'mocks.ts'),
      '@/app/queries/user.queries': path.resolve(__dirname, 'mocks.ts'),
      '@/components/providers/WebSocketProvider': path.resolve(
        __dirname,
        'mocks.ts',
      ),
      '@/components/providers/ThemeProvider': path.resolve(__dirname, 'mocks.ts'),
    },
  },
});
