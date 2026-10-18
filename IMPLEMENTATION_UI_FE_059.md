# UI-FE-059 — Synchronize Wallet and Session State Across Browser Tabs

**Issue:** [#632](https://github.com/DigiNodes/truthbounty-frontend/issues/632)
**Branch:** `feat-sync-wallet-tabs-632`
**Base:** upstream `main`

## Overview

Defines and implements a single, bounded cross-tab boundary for wallet, session,
consent, and pending-transaction state. Every tab converges on one
account/chain/session context; a tab whose context was revoked by a sibling
fails closed until the user explicitly recovers. Frames are versioned, size
bounded, strictly re-validated, and carry no token, signature, or protected
payload.

## Files

### Cross-tab boundary

- **[ADD]** `src/lib/sync/protocol.ts`
  - Versioned (`v: 1`) discriminated event union: `wallet-context`,
    `session-state`, `consent`, `pending-transaction`.
  - 4 KiB size bound; `serializeCrossTabEvent`/`parseCrossTabEvent` fail closed
    on oversized frames, secret-like keys, and long hex (signatures/hashes).
  - Parsing rebuilds events from an explicit allow-list, dropping extra fields.

- **[ADD]** `src/lib/sync/channel.ts`
  - BroadcastChannel transport with `localStorage` `storage`-event fallback.
  - Loop suppression (own `sender`) and replay suppression (bounded per-sender
    high-water ledger).

- **[ADD]** `src/lib/sync/wallet-context.ts`
  - Pure transition classification (reuses `@/lib/wallet/identity`).
  - Monotonic context `epoch`, `ContextGuard`/`StaleContextError`.
  - `contextAllowsMutation`, explicit recovery copy, and a validated
    `localStorage` resume snapshot for suspended tabs.

- **[ADD]** `src/lib/sync/index.ts`

### React consumption

- **[ADD]** `src/hooks/useCrossTabSync.ts`
  - Publishes local connect/disconnect/account/chain transitions.
  - Adopts remote revocations authoritatively; gates mutation via `canMutate`
    and a captured context epoch.
  - Reconciles from the shared snapshot on `visibilitychange` resume.
  - Relays terminal session state, consent choices, and pending-transaction
    lifecycle without secrets.

- **[ADD]** `src/components/providers/CrossTabSyncProvider.tsx`
  - App-level context + explicit, accessible (`role="alert"`) recovery banner.
- **[MODIFY]** `src/components/providers/index.ts` — export the provider/hook.

### Tests

- **[ADD]** `src/lib/sync/__tests__/protocol.test.ts`
- **[ADD]** `src/lib/sync/__tests__/channel.test.ts`
- **[ADD]** `src/lib/sync/__tests__/wallet-context.test.ts`
- **[ADD]** `src/hooks/__tests__/useCrossTabSync.test.tsx`
- **[ADD]** `src/components/providers/__tests__/CrossTabSyncProvider.test.tsx`

### Documentation

- **[ADD]** `docs/CROSS_TAB_SYNC.md`

## Acceptance Criteria

| Criterion | Evidence |
|---|---|
| A stale tab cannot mutate after context revocation | `ContextGuard.assertCurrent` throws `StaleContextError`; `canMutate` is false on epoch change/recovery; covered in `useCrossTabSync.test.tsx` and `wallet-context.test.ts`. |
| Cross-tab events contain no signature, token, or protected payload | Secret-key/long-hex scanner rejects tainted frames in `protocol.test.ts`; pending/session frames never include hashes or tokens. |
| User-visible recovery is explicit | `CrossTabSyncProvider` renders an assertive `role="alert"` with acknowledgement; asserted in `CrossTabSyncProvider.test.tsx`. |
| Tabs converge without infinite broadcast loops | Own-sender filter + replay ledger + no re-broadcast on adoption; two-tab and race convergence tests. |

## Required Tests Covered

- Two-tab connect/disconnect — `channel.test.ts`, `useCrossTabSync.test.tsx`.
- Account switch / chain switch — `useCrossTabSync.test.tsx`.
- Token/session expiry — `useCrossTabSync.test.tsx` (`publishSessionState('expired')`).
- Consent update — `useCrossTabSync.test.tsx`.
- Race test — `useCrossTabSync.test.tsx` deterministic convergence.
- Suspended-tab resume — `useCrossTabSync.test.tsx`.
- Broadcast payload privacy — `protocol.test.ts`, `channel.test.ts`.

## Verification

```text
Test Suites: 7 passed, 7 total
Tests:       63 passed, 63 total
```

Command:

```text
pnpm exec jest src/lib/sync src/hooks/__tests__/useCrossTabSync.test.tsx \
  src/components/providers/__tests__/CrossTabSyncProvider.test.tsx \
  src/lib/auth/__tests__/session-sync.test.ts \
  src/hooks/__tests__/useSessionLifecycle.test.tsx
```

Targeted `tsc` over the new modules reports 0 errors. Full-repo `tsc`/ESLint
remain blocked by pre-existing `main` failures unrelated to this change (broken
`src/app/queries/queryKeys.ts` syntax, stray control characters in unrelated
components, and the `eslint-plugin-react@7.37.5` / ESLint 10 incompatibility).

## Non-Goals

- No board redesign.
- No backend or contract interfaces invented.
- No secrets, signatures, or session tokens transmitted across tabs.
- No `Stellar Wave` activation.
