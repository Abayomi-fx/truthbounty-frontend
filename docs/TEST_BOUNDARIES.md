# Test and Wallet-Mock Boundaries

Test fixtures, mock providers, deterministic transaction hashes, and simulated
wallet clients must stay in test-only paths. Production code must never import
from `__tests__`, `__mocks__`, `mocks`, `fixtures`, Storybook stories, or files
named `*.test.*`, `*.spec.*`, or `*.stories.*`.

The boundary is enforced in three places:

1. ESLint reports restricted imports while code is being authored.
2. `pnpm verify-production-boundaries` walks every production source import
   before a build and fails closed on test-only modules or packages.
3. `pnpm verify-production-bundle` scans the completed `.next` output for
   test-only wallet and provider canaries. It runs automatically as `postbuild`.

Keep wallet mocks under `src/__tests__/mocks/wagmi`. Add new fixture factories
under a test-only path, use deterministic values, and import them only from test
files. The shared UI-FE-088 factory library and canonical scenario catalogue live
under `src/testing/fixtures` — see [`docs/TEST_FIXTURES.md`](./TEST_FIXTURES.md)
for usage and for the determinism contract enforced by
`pnpm verify:fixture-determinism` (CI fails on nondeterministic clocks or random
identifiers in fixture builders). Viem `simulateContract` is a canonical RPC
preflight and is not a mock; client-generated receipts, transaction hashes, gas,
rewards, or finality are.
