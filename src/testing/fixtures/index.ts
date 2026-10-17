/**
 * UI-FE-088 — deterministic fixture library.
 *
 * Test-only entry point for the typed factory library and the canonical
 * scenario catalogue. Consumers:
 *   - Storybook: `src/testing/fixtures/scenarios.stories.tsx`
 *   - Jest:      `src/testing/fixtures/__tests__/*`
 *   - Playwright:`e2e/support/scenarios.ts` + `e2e/canonical-scenarios.spec.ts`
 *
 * Production code must never import this path (see `docs/TEST_BOUNDARIES.md`);
 * `scripts/verify-production-boundaries.mjs` fails the build if it does.
 */

export * from './deterministic';
export * from './authority';
export * from './factories';
export * from './scenarios';
