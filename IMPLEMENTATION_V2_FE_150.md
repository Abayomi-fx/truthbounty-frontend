# V2-FE-150: Production Readiness — Fabricated Protocol State Elimination

## Issue Reference

**V2-FE-150** — Production readiness pass: remove fabricated protocol state from the
TruthBounty Protocol V2 frontend and certify CI-equivalent gates.

## Objective

Every value the UI renders as protocol state (balances, stakes, deadlines, bond locks,
dispute identifiers, transaction hashes, gas) must come from a canonical source: the
release ABI, an RPC read, or a validated API projection. Anything that cannot be sourced
fails closed with an explicit reason instead of being approximated, defaulted, or
predicted.

Canonical release for this work:

| Field | Value |
| --- | --- |
| Chain | Optimism Sepolia (`11155420`) |
| Proxy | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| Implementation | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| Release | `v2.0.0-sepolia` (`2.0.0`) |
| Authority | `release/manifest.json`, `release/abi/TruthBountyWeighted.json` |

## Canonical ABI surface

The pinned `TruthBountyWeighted` ABI exposes exactly:

`balanceOf`, `treasuryBalance`, `withdrawTreasury`, `claimRewards`, `settleProvisional`,
`settleAppeal`, `finalize`.

It exposes **no appeal-context getters** and **no dispute-opening function**. Two
consequences drive the design below:

1. Appeal context cannot be reconstructed on-chain, so it is read from a validated API
   projection instead of being synthesised from balances and local clocks.
2. Dispute opening has no correct calldata to send, so the flow is reported as
   unsupported rather than encoded against a guessed selector.

## Changes

### Appeal context: validated API projection

`src/lib/appeals/projection.ts` defines the read layer. `useAppealContext` no longer
builds a snapshot from contract reads, block heights, or the local clock; it loads a
projection, validates it, and derives eligibility only from validated fields.

- Strict payload validation with canonical error codes: `UNAVAILABLE`, `NOT_FOUND`,
  `UNAUTHORIZED`, `MALFORMED`, `CHAIN_MISMATCH`.
- Cross-field checks: appeal/claim identity, chain, `reopenable` versus deadline state,
  wallet match, numeric formats.
- The transport is injectable (`AppealProjectionFetcher`) for tests and alternate
  deployments. The default fetcher issues `GET /api/appeals/:appealId` with
  `cache: 'no-store'`.
- Configuration validation fails closed on connectivity, chain, address, and identity
  mismatch; the context stays `null` and an error is surfaced.
- The fetcher is read through a ref so an inline function identity cannot restart the
  polling effect. Any failure keeps the last validated context rather than inventing one.

**Deployment dependency:** the hook expects a deployed `/api/appeals/:appealId`
projection. No backend route was added in this work. Until it is deployed, appeal
participation and dispute context fail closed by design.

### Dispute opening: unsupported unless the ABI declares it

`useDisputeSubmission` discovers an entrypoint from the supplied ABI
(`openDispute`, `createDispute`, or `dispute`) and fails closed when none is present.
`isDisputeSupported` exposes that decision to the UI.

- Encoding uses `encodeFunctionData` against the discovered ABI entrypoint. No selector
  constants and no hand-rolled calldata.
- The canonical ABI declares no dispute function, so the production path is unsupported.
- When an ABI does declare one, simulation uses `publicClient.estimateGas` and
  `publicClient.simulateContract`; there is no gas fallback and no always-false pause
  check, so a paused contract is surfaced by its revert.
- Simulation reports the RPC gas figure and the UI-level bond/status projection only.
  **No dispute identifier is predicted** — it is assigned by the contract, so
  `DisputeSimulationResult.projectedState.disputeId` and `DisputeTransaction.disputeId`
  stay absent until a receipt is observed.
- A pending transaction reports `bondLocked: false` until the receipt is reconciled.
- Submission requires a real `writeContractAsync` hash. No synthetic hash is ever
  returned.

`OpenDispute` consumes `isDisputeSupported`, renders an accessible reason
(`#dispute-unavailable-reason`), disables confirm, and guards `handleSubmit` so a direct
form submit cannot bypass the gate.

### Settlement

- Claim IDs must be canonical `bytes32` (`0x` + 64 hex). The previous padding accepted
  opaque identifiers and produced malformed calldata.
- Encoding is ABI-driven; simulation precedes submission; returned hashes must be real
  `0x`-prefixed 32-byte values.
- Lifecycle fixtures keep the opaque projection identifier (`claim-lifecycle-1`) separate
  from the bytes32 settlement argument (`0x2b…2b`).

### Treasury withdrawal

The `'180000'` gas fallback is removed. Simulation requires
`publicClient.estimateGas`; when the RPC cannot estimate, the call fails closed with an
explicit reason instead of assuming a gas limit.

### Appeal participation

- `useWriteContract() ?? {}` no longer crashes during render when no provider is present.
- Submission uses the real write path and fails closed with `UNEXPECTED_ERROR` /
  `unsupported` when no write path exists.
- Chain and address fixtures were corrected from chain `10` to the canonical
  `11155420` and contract address.

### Regression gate

`src/__tests__/utils/no-fabricated-state.test.ts` scans production sources (tests
excluded) and fails on:

- inline 64-hex literals that are not uniform test constants;
- hardcoded gas-limit fallbacks;
- `Date.now()`/local-clock state derivation (API freshness is exempt);
- hardcoded block-time periods used to synthesise deadlines;
- settlement encoding that is not ABI-driven, non-`bytes32` claim IDs, or `padStart`
  padding of claim IDs;
- appeal participation without a real wallet write path;
- appeal context that does not go through the projection read layer or that lacks the
  fetcher ref;
- dispute encoding that is not ABI-driven, hardcoded selectors, hardcoded gas, locally
  generated dispute identifiers, or mock pause checks.

## Verification

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | pass (no output) |
| Lint | `npm run lint` | 0 errors, 53 pre-existing warnings |
| Unit/integration | `npx jest` | 157 suites, 3065 tests pass |
| Artifacts | `npm run verify-artifacts` | pass — `v2.0.0-sepolia` on `11155420` |
| Build | `npm run build` | pass (with the CI placeholder, see below) |
| Performance budgets | postbuild `verify-performance-budgets.mjs` | pass, all routes within budget |
| Staging smoke | `npm run verify:staging-smoke` | pass, all 7 targets resolve |
| Production smoke (unit) | `npm run test:production-smoke:unit` | pass, 2/2 |
| Accessibility | `npm run test:a11y` | pass, 8 suites / 97 tests |
| E2E | `npm run test:e2e` | 29/31 pass — see open items 1 and 2 |

`npm run build` and the E2E run require `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`; the Build
job uses the documented `ci-placeholder-project-id`, which is enough to prerender. The
E2E job runs the production bundle, so the provider guard applies at runtime and rejects
that value — see open item 1.

## Test-infrastructure fixes

- `e2e/support/test.ts` now serves the canonical claims-list envelope
  (`items` / `pagination` / `projection`) for paginated projection requests, mapping
  seeded claims onto validated rows. The stub previously returned the legacy bare
  `Claim[]`, which `assertClaimsListEnvelope` correctly rejects, so the table failed
  closed and rendered zero rows.
- `e2e/protocol-journey.spec.ts` expected an empty-state sentence that the component
  has not rendered since before `3644344`; the constant now matches the real copy.

## Open items (pre-existing, not introduced here)

1. **E2E WalletConnect secret.** `src/lib/wallet-boundary/config-guard.ts` fails closed
   in production when the WalletConnect project id looks like a placeholder or the
   Optimism RPC URLs are absent, so the CI E2E job rendered the configuration error page
   and 17 page-level specs failed. The guard is correct and is unchanged. The E2E job
   now sets the public `https://mainnet.optimism.io` and `https://sepolia.optimism.io`
   endpoints and reads the project id from a repository secret, with a preflight step
   that fails with an actionable message when the secret is absent or placeholder-shaped.
   **A maintainer must add the `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` repository
   secret** or the E2E job will stop at the preflight step.
2. **Visual regression baselines.** Only `*-win32.png` baselines are committed at HEAD.
   On a Linux runner Playwright finds no `*-linux.png` baseline, writes one, and fails
   the two visual specs. The runner is ephemeral, so that baseline is otherwise discarded
   and the specs would fail on every run; the E2E job now uploads the generated
   `*-linux.png` files as the `playwright-linux-baselines` artifact so a maintainer can
   download and commit the runner-rendered baseline. No workstation-rendered baseline was
   committed, because it would not match runner font rendering.
3. **Live production smoke.** `npm run test:production-smoke` requires
   `TRUTHBOUNTY_SMOKE_RPC_URL` and was not run. The credential-free unit variant passes.
4. **Appeal projection endpoint.** As above, `/api/appeals/:appealId` must be deployed.
5. **Dispute entrypoint.** Dispute opening stays unsupported until the deployed contract
   and `release/abi/TruthBountyWeighted.json` expose one.
6. **Reviewer approval.** The pushed SHA requires independent maintainer review because
   settlement, wallet, and security-sensitive behaviour changed.
