# V2-FE-008 — Reconcile Wallet, Chain, and Auth Session Changes

## Pull Request Summary

### Issue Reference
**V2-FE-008** — Reconcile Wallet, Chain, and Auth Session Changes for TruthBounty Protocol V2

Closes #242

---

## Overview

This PR implements clean-slate V2 frontend infrastructure that keeps
authentication coherent with the connected wallet scope (account address +
chain id) on the canonical Optimism/EVM runtime. The previous frontend had mock
wallet/auth hooks (`useWallet`, `useAuth`), a stale Freighter-era `useAccount`
test, and no mechanism to invalidate auth or cached data when the connected
account or required chain changed. This change introduces:

- A **wallet-scoped auth session store** — a token is only ever presented for
  the exact `(address, chainId)` scope it was issued for.
- A **session reconciliation hook** — invalidates auth and clears query/storage
  caches whenever the account changes, the required chain changes, or the
  wallet disconnects, and coordinates reconnect / re-authentication / logout.
- A **consumer auth hook** replacing the removed mock `useAuth`.
- **Provider wiring** (`QueryProvider` + `SessionReconciler`) and a **guarded
  WebSocket stream** so stale sessions can never issue authenticated requests
  (no `AUTHENTICATE` frame, no `Authorization` header on HTTP catch-up).
- **44 new tests** (unit + integration) covering success, stale, wrong-network,
  rejected, and disconnected paths.

---

## Audit of Overlapping Current Code

| Path | Status | Disposition |
|------|--------|-------------|
| `src/hooks/useWallet.ts` + `src/hooks/tests/useWallet.test.tsx` | **Deleted** | Mock numeric-balance wallet hook that fabricated synthetic state; unused outside its own tests. |
| `src/hooks/useAuth.ts` + `src/hooks/tests/useAuth.test.tsx` | **Deleted** | Mock username/password auth that fabricated an authenticated session; unused outside its own tests. Replaced by `useAuthSession`. |
| `src/hooks/__tests__/useAccount.test.ts` | **Deleted** | Stale Stellar/Freighter-era test for a wagmi-based hook; did not compile (JSX in `.ts`) and tested a deleted implementation. |
| `src/hooks/useWalletNetwork.ts` | **Reused** (small refactor) | `clearChainScopedStorage()` extracted as a standalone export; `clearChainScopedCaches` behavior unchanged. |
| `src/hooks/useAccount.ts`, `wagmi.tsx` | **Reused** | Unchanged; consumed by the new reconciliation hook. |
| `src/hooks/useWebSocket.ts` | **Extended** | Auth frames + catch-up headers now gated on session scope; socket re-established when the wallet scope changes. |
| `src/components/providers/QueryProvider.tsx` | **Extended** | Renders `SessionReconciler`; passes the wallet scope into `WebSocketProvider`. |
| `src/app/(dashboard)/identity/page.tsx` | **Identified, not modified** | Page-level demo wallet connect (random address). UI is maintainer-owned and out of scope; it issues no authenticated requests. |

---

## State Transitions

```
wallet disconnected
   │ connect (scope = address:chainId)
   ▼
authenticated session bound to scope
   │ account changes ──────────► session invalidated + query cache cleared
   │ chain changes   ──────────► session invalidated + chain caches + cursor cleared
   │ disconnect      ──────────► session invalidated + query cache cleared
   │ reauthenticate() ─────────► stale token dropped, auth-dependent queries refetch
   │ logout()         ─────────► wagmi disconnect + session + query cache cleared
   ▼
reconnect (same scope) ────────► stored session preserved
reconnect (different scope) ───► stale session dropped
```

Reconnect is deliberately non-destructive: during `connecting`/`reconnecting`
the reconciler holds the previous scope, so a page reload never wipes a still-
valid session. If reconnect lands on a different account or chain, the session
is invalidated because it no longer matches the scope.

---

## Acceptance Criteria Mapping

### ✅ 1. Invalidate authentication when the connected account or required chain changes
**Evidence:**
- `useSessionReconciliation` watches `useAccount().address` + `useChainId()` and
  clears the stored session on any scope change
  (`src/hooks/useSessionReconciliation.ts`).
- `session-store.isAuthSessionValidFor(scope)` returns false on any address or
  chain mismatch (case-insensitive address compare).
- Tests: `src/hooks/__tests__/useSessionReconciliation.test.tsx::invalidates
  auth and clears the query cache when the account changes` / `::...when the
  required chain changes`; `src/hooks/__tests__/useAuthSession.test.tsx::flips
  to unauthenticated when the connected account changes` / `::...required
  chain changes`.

### ✅ 2. Prevent stale wallet sessions from issuing authenticated API requests
**Evidence:**
- `session-store.getAuthSessionHeaders(scope)` returns the `Authorization`
  header only while the stored session is valid for the current scope —
  otherwise `{}`.
- `useWebSocket` uses those headers for the `AUTHENTICATE` frame and the HTTP
  catch-up fetch, and re-establishes the socket when the wallet scope changes
  so a previous session cannot keep a live authenticated stream.
- Tests: `src/__tests__/integration/session-reconciliation.test.tsx::invalidates
  auth, clears the query cache and drops auth from the stream on chain change`
  (asserts no `AUTHENTICATE` frame and `headers: {}` on catch-up after the
  change); `src/lib/__tests__/session-store.test.ts::getAuthSessionHeaders`.

### ✅ 3. Coordinate reconnect, re-authentication, logout, and query-cache clearing
**Evidence:**
- `useSessionReconciliation` exposes `reconnect` (wagmi `useReconnect`),
  `reauthenticate` (drops stale token + invalidates auth-dependent queries),
  and `logout` (wagmi `disconnect` + clear session + clear query cache +
  chain-scoped storage + persisted WS cursor).
- Account change / chain change / disconnect each clear the query cache
  (`queryClient.clear()`), chain-scoped storage, and the resumable WS cursor.
- Tests: `useSessionReconciliation.test.tsx::logout disconnects...`, `::reauthenticate
  drops the stale token...`, `::reconnect() delegates to the wagmi reconnect action`,
  `::preserves a still-valid session across a wagmi reconnect (page reload)`.

### ✅ 4. No visual redesign or unapproved layout assumption is introduced
**Evidence:**
- All changes are logic/infrastructure only: hooks, a store, provider wiring.
- No page, layout, or component styling was modified
  (`git diff --stat` lists only `src/lib`, `src/hooks`, `src/app/types`,
  `src/components/providers`, docs, and tests).

### ✅ 5. No synthetic production transaction or protocol state remains in the affected path
**Evidence:**
- The mock `useWallet` (fabricated balances) and mock `useAuth` (fabricated
  user sessions) hooks are deleted.
- No balances, hashes, verdicts, rewards, or confirmations are fabricated:
  `authenticate()` only stores a backend-issued token; nothing in the new code
  invents protocol state.
- The stale Freighter-era `useAccount.test.ts` (a deleted implementation) is
  removed.

### ✅ 6. Documentation and generated artifacts affected by the change are current
**Evidence:**
- `docs/ARCHITECTURE.md` — new "Wallet-Scoped Auth Sessions (V2-FE-008)"
  section.
- `IMPLEMENTATION_V2_FE_008.md` (this document) maps evidence to every
  criterion.

### ✅ 7. The pull request maps evidence to every acceptance criterion
**Evidence:** this document.

---

## Security & Validation

- **No secrets or credentials**: no API keys, private keys, or production
  credentials added; tokens are stored as provided by the backend, never
  fabricated.
- **Scope validation**: auth validity requires an exact (case-insensitive
  address, exact chain id) match; `localStorage` payloads are shape-validated
  and corrupt payloads are dropped on read.
- **SSR-safe**: the session store degrades to in-memory on the server and never
  touches `window`/`localStorage` when unavailable; storage access is wrapped
  in try/catch (privacy mode, quota).
- **No new runtime dependencies**: `@stellar/freighter-api` /
  `@stellar/stellar-sdk` usage is untouched; zero new packages.
- **Deterministic invalidation**: cache clearing happens only on settled scope
  changes (never during `connecting`/`reconnecting`), so reloads are safe and
  retries are idempotent.
- **Accessibility preserved**: no UI changes; new components render `null`.

## Integration Impact

| Surface | Impact |
|---------|--------|
| Wallet (Wagmi/RainbowKit) | Watched via `useAccount`/`useChainId`; reconnect exposed. |
| API / HTTP catch-up | `Authorization` header only when session valid for scope. |
| WebSocket | Re-authenticated (or de-authenticated) on wallet scope change. |
| TanStack Query | Cache cleared on scope change; invalidated on re-auth. |
| localStorage/sessionStorage | Chain-scoped keys + resumable cursor cleared on chain change. |

## Test Coverage (44 new cases)

- `src/lib/__tests__/session-store.test.ts` — 16 cases: set/get/clear,
  persistence, corrupt payload rejection, validity across address/chain,
  header gating, scope keys.
- `src/hooks/__tests__/useSessionReconciliation.test.tsx` — 13 cases: baseline
  no-op, account/chain/disconnect invalidation, reconnect preservation and
  stale-session clearing, logout, reauthenticate, reconnect, scope stability.
- `src/hooks/__tests__/useAuthSession.test.tsx` — 11 cases: authenticate,
  refused without wallet / empty token, invalidation on account/chain/disconnect
  changes, restore, logout.
- `src/__tests__/integration/session-reconciliation.test.tsx` — 4 cases at the
  real `QueryProvider` + WebSocket boundary: authenticated stream, chain-change
  invalidation + de-auth, account-change invalidation + de-auth, disconnect
  cleanup.

**Regression coverage for removed mocks:** the mock `useWallet`/`useAuth`
behavior (fabricated balances/sessions) is superseded by tests proving the new
store refuses synthetic state (`session-store.test.ts` header gating, empty
token rejection) and that nothing else references the deleted hooks.

## Commands Run & Results

```bash
pnpm install                     # Done in 56s (deps were missing)
pnpm type-check                  # 6 pre-existing errors ONLY in
                                 #   src/__tests__/integration/claim-submission.test.tsx (baseline)
                                 #   — the 25 stale useAccount.test.ts errors are removed with the file
pnpm test                        # 227 passed / 14 failed
                                 #   (14 failed = pre-existing baseline; see below)
pnpm test -- <new test files>    # 44 passed / 44 (all new tests green)
pnpm lint                        # BLOCKED by pre-existing ESLint config error
                                 #   "Cannot redefine plugin jsx-a11y" (affects all files, baseline)
pnpm build                       # ✓ Compiled successfully — exit 0
                                 #   (non-fatal WalletConnect indexedDB SSR warning, pre-existing)
```

### Baseline failures (pre-existing, unrelated to this PR)
- ESLint cannot start: `eslint.config.mjs` — `Cannot redefine plugin
  "jsx-a11y"` (documented in the V2-FE-016 implementation notes).
- `src/__tests__/integration/claim-submission.test.tsx` — 6 TS syntax errors.
- 19 jest suites fail for environment/peer reasons (e.g. missing `jest-axe`,
  `TextEncoder is not defined`, Worldcoin `VerificationLevel` import, settlement
  hook test env issues): `claim-submission`, `claim-lifecycle`,
  `verification-flow`, `settlement-finalization`, `useSettlementDetection`,
  `useSettlementSubmission`, `useFinalizationDetection`,
  `useStateReconciliation`, `useReputation`, `EvidenceViewer`,
  `ClaimSubmissionForm.wallet`, `env.validation.spec`, `axe`, `test-utils`,
  `mocks/server`, `mocks/handlers`, `accessibility/components`,
  `accessibility/modals`, `e2e/happy-path`. None of these touch the new code.

## Residual Risks & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Backend auth interface not yet frozen (V2-FE-006/007 deps) | Medium | Store accepts any backend-issued token string; no protocol authority assumed. Swap-in when the auth API merges. |
| Full query-cache clear on scope change is conservative | Low | Deterministic and safe; refetch-on-mount repopulates. Can be narrowed to key-scoped invalidation later. |
| WS de-auth relies on client reconnect | Low | Server-side session revocation is a backend concern; client stops sending the token immediately. |

## Non-Goals (Out of Scope)

- No UI/layout/visual changes (maintainer-owned).
- No Stellar/Soroban/Freighter runtime support added (a stale Freighter test
  was removed; Stellar deps untouched).
- No GitHub admin actions on historical issues; no label changes.
- No fabrication of contracts, indexed projections, hashes, balances,
  verdicts, rewards, or confirmations.

---

**Ready for review — closes #242.**
