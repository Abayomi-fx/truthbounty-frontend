/**
 * UI-FE-088 — typed factory library barrel.
 *
 * Every export is a pure function of (seed, key): same input, same output, in
 * Storybook, Jest, and Playwright alike. Import from `src/testing/fixtures`
 * in tests and stories; production code must never import this path.
 */

export * from './capabilities';
export * from './claims';
export * from './disputes';
export * from './evidence';
export * from './freshness';
export * from './governed-change';
export * from './incidents';
export * from './legal-content';
export * from './releases';
export * from './transactions';
export * from './verifications';
