# UI-FE-015: rewards and transaction center

Issue: [#585](https://github.com/DigiNodes/truthbounty-frontend/issues/585).
Implementation is ready for review as a draft. The repository-wide checks and the
open foundation dependencies below still prevent a merge-ready claim.

## Authority and scope

The compositions use the existing application shell, semantic tokens, Card,
StatusBadge, TokenAmount, AsyncStatus and shared claim-verification
TransactionStatus rendering boundary. They do not replace the shell or converge
the existing duplicate transaction status implementations; those remain owned by
the dependency issues.

References read on 2026-10-15:

- [Frontend Implementation Matrix](https://github.com/DigiNodes/truthbounty-protocol/blob/main/docs/ux-authority/FRONTEND_IMPLEMENTATION_MATRIX.md)
- [Public/claimant authority](https://github.com/DigiNodes/truthbounty-protocol/blob/main/docs/ux-authority/PUBLIC_CLAIMANT_SCREEN_AUTHORITY.md)
- [Rewards/transactions board](https://github.com/DigiNodes/truthbounty-protocol/blob/main/designs/frontend-v2/public-claimant/boards/11-rewards-transactions.svg)
- [Transaction state board](https://github.com/DigiNodes/truthbounty-protocol/blob/main/designs/frontend-v2/foundation/boards/06-transaction-states.svg)
- [Responsive/accessibility board](https://github.com/DigiNodes/truthbounty-protocol/blob/main/designs/frontend-v2/foundation/boards/08-responsive-accessibility.svg)
- [Route contract](https://github.com/DigiNodes/truthbounty-protocol/blob/main/docs/ux-authority/SITEMAP_AND_ROUTE_CONTRACT.md)

The board's four summary cards precede the reward list and recovery rail.
Unavailable and slashed outcomes have distinct list/filter treatments. At narrow
widths, all content becomes cards; no compressed table is introduced. Existing
theme tokens are inherited. Full approved shell, brand/token and shared-state
conformance must be rechecked when the foundation dependencies merge; these
composition snapshots are not maintainer approval of that foundation.

## Routes and data boundaries

- `/dashboard/rewards`: canonical rewards composition.
- `/dashboard/transactions`: canonical browser recovery references.
- `/rewards`: browser redirect preserving the query string and fragment.
- Navigation and personal-route guards use the canonical destinations.

`ConnectedCenters.tsx` selects the production hooks. The presentational
components accept data, but never import stories or fixtures. Illustrative
balances and hashes live exclusively under `stories/`.

`useRewardsCenterData` uses the existing reward API client and entitlement
validator. Validated API shape is still only a projection. Every API amount
renders as an accrued estimate, including records whose API claimable flag is
true. Response receipt time and chain freshness are separately described; a
recent HTTP response does not establish a fresh chain projection.

Values retain exact decimal strings and asset addresses. No float arithmetic,
cross-asset sum, guessed token symbol, fallback zero balance, or board value
enters the production adapter. Multiple entries are counted rather than combined
into a misleading total. The contract-owned presentation includes block and
finality metadata, but this route does not invent a canonical ownership/read
adapter.

Review withdrawal remains disabled with a visible accessible reason. The new
routes have no write hook, signature callback, transaction retry, speed-up,
cancellation, or submission path. Adding one requires a separately pinned adapter
that validates ownership, amount, eligibility, chain/release, simulation and
receipt evidence.

## Recovery contract

The center reads both existing persistence formats:
`tb-tx-v2:*` and `truthbounty-pending-transactions-v2`. It does not introduce
another competing storage schema or reducer.

- Browser records are always local, unverified recovery references.
- A saved finalized status never produces fresh final-success language.
- Legacy entries have no account/release binding. The UI explicitly says so and
  never assigns them to the active wallet.
- Duplicate hashes are reconciled for display using the latest detailed record;
  a reorg notice wins equal-timestamp ties. Replacement hashes are retained.
- Lightweight registry entries cannot reconstruct receipt/finality evidence.
- Hashless signature requests retain an identifier without fabricating a hash.
- Explorer links require an exact 32-byte hash and an approved Optimism chain;
  unsupported chains never fall back to a default explorer.
- Reload, focus, online/reconnect, cross-tab storage and same-tab persistence
  events reread references. They do not clear, acknowledge or resubmit them.
- Denied storage is displayed as unavailable. Persistence remains browser-local
  and cannot be guaranteed after browser storage is cleared.
- Canonical receipt/release reconciliation remains unavailable until the pinned
  adapter and transaction-state convergence dependency supply it. Opening an
  explorer is an explicit read-only recovery step, not automatic reconciliation.

The pre-existing transaction-machine hook's finalization/reset retention policy
is unchanged. This center can recover references that those producers retain; it
does not promise a permanent transaction history.

## Reproduce scoped validation

Use the repository-pinned pnpm version and install dependencies normally.

```powershell
pnpm test:rewards-center
pnpm test:rewards-center:stories
pnpm build-storybook:rewards-center
pnpm test:rewards-center:visual
pnpm type-check:rewards-center
```

Install Playwright Chromium with `pnpm exec playwright install chromium`, or use
an existing Chrome installation for both browser runners:

```powershell
$env:REWARDS_TEST_BROWSER_CHANNEL = 'chrome'
```

The local pnpm 11 runner attempted to reinstall dependencies before running
scripts; validation used the installed tool binaries directly (or
`pnpm_config_verify_deps_before_run=false`) without changing the dependency
manifest or lockfile.

The scoped Storybook configuration isolates these stories so the existing empty
legacy rewards hook does not prevent reviewing them. The full Storybook
configuration remains unchanged and its failure remains reported.

| Check | Result on 2026-10-15 |
| --- | --- |
| Focused Jest, persistence and affected navigation suites | PASS: 81 tests, 6 suites |
| Storybook browser stories and axe checks | PASS: 31 stories, including light/dark contrast |
| Responsive/reflow/keyboard/forced-colours/reduced-motion checks | PASS: 11 Playwright tests |
| Screenshot comparison after generating/reviewing baselines | PASS: 9 images at 1440, 768 and 390 CSS pixels |
| Scoped Storybook production build | PASS |
| Production source boundary check | PASS; fixtures remain isolated |
| Diff whitespace check | PASS |
| Focused ESLint with incompatible legacy React rules disabled in a temporary config | PASS; not a substitute for the full lint gate |
| Scoped TypeScript | BLOCKED: 2 existing transitive errors in feature-flags.ts |
| Full lint | FAIL: eslint-plugin-react calls removed ESLint 10 context.getFilename API |
| Full typecheck | FAIL: existing JSX syntax errors in ClaimContent.tsx, TimelineOfEvents.tsx and useTelemetry.test.ts |
| Full Jest | FAIL: first failing canonical-claim-lifecycle-e2e suite has 4 failed assertions; bail run completed |
| Full Storybook build | FAIL: useRewards.ts is empty and does not export useRewards |
| Production build | FAIL: existing missing exports, including useRewards and protocol-time/Worldcoin dependencies |

The zoom check covers an effective 200% viewport (1536 physical pixels to 768 CSS
pixels) plus independent 200% root-text enlargement. It checks horizontal
overflow, the outcome filter, focus ring, action availability and reduced
motion. It does not claim manual assistive-technology certification.

Snapshots were generated and compared on Windows with installed Chrome.
Cross-platform baselines need the same browser/font environment; do not blindly
regenerate them to silence differences. Route-level production E2E and final
approved-shell visual approval remain blocked by the full build/dependencies.

## Dependency handoff

GitHub showed #585 assigned to iyiade08 with Stellar Wave on 2026-10-15. No issue
labels, assignments or activation state were changed.

- [#554](https://github.com/DigiNodes/truthbounty-frontend/issues/554) is the open
  tracking epic and includes #585; it is not a separate implementable child.
- [#565](https://github.com/DigiNodes/truthbounty-frontend/issues/565) remains open:
  converge the transaction renderer and canonical state authority.
- [#573 / UI-FE-003](https://github.com/DigiNodes/truthbounty-frontend/issues/573)
  remains open: approved shared system states.
- [#577 / UI-FE-006](https://github.com/DigiNodes/truthbounty-frontend/issues/577)
  remains open: approved authenticated/public/marketing shells.

Keep the PR in draft until maintainers resolve or explicitly approve those
dependency gaps and the required repository-wide gates pass.

