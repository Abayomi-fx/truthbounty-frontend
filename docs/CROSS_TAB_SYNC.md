# UI-FE-059 — Cross-Tab Wallet & Session State Synchronization

> **Rule:** Browser tabs must converge on one wallet/session context, and a tab
> whose context was revoked must fail closed. Cross-tab frames are bounded and
> carry **no** token, signature, or protected payload.

---

## 1. Why

Wallets, sessions, legal consent, and pending transactions are shared by every
tab of the same origin, but the UI state of each tab is independent. Without a
controlled boundary:

- a tab left open can submit a transaction under an account/chain/session that
  was revoked elsewhere;
- a suspended tab can wake up with stale state and act on it;
- naive `storage`/`BroadcastChannel` relay can storm (broadcast loops) or leak
  secrets.

UI-FE-059 defines a single, bounded cross-tab synchronization boundary that the
relevant compositions consume. Contract receipts and reviewed API projections
remain authoritative; nothing here fabricates wallet, transaction, finality,
permission, health, or legal state.

---

## 2. Modules

| Module | Responsibility |
|---|---|
| `src/lib/sync/protocol.ts` | Versioned, bounded event envelope + strict re-validation of untrusted input. |
| `src/lib/sync/channel.ts` | Transport (BroadcastChannel → `storage` fallback) with loop and replay suppression. |
| `src/lib/sync/wallet-context.ts` | Pure wallet-context revocation policy, epoch guard, recovery copy, resume snapshot. |
| `src/hooks/useCrossTabSync.ts` | React binding: publish local transitions, adopt remote revocations, gate mutations. |
| `src/components/providers/CrossTabSyncProvider.tsx` | App-level boundary + explicit, accessible recovery notice. |

### 2.1 Protocol

A frame is a discriminated union on `kind`:

```
{ v: 1, kind, sender, seq, at, ...allow-listed fields }
```

- `wallet-context` — `reason` (`connect`/`disconnect`/`account-change`/`chain-change`), public `account`, `chainId`, monotonic `epoch`.
- `session-state` — terminal `reason` (`expired`/`revoked`/`manual`/`reused`), `epoch`. **Never a token.**
- `consent` — `choice` (`granted`/`denied`/`cleared`).
- `pending-transaction` — `action` (`registered`/`settled`), opaque `id`, `chainId`. **Never a hash.**

`parseCrossTabEvent` re-derives the event from an explicit allow-list, so extra
fields are dropped. Frames that exceed `CROSS_TAB_MAX_BYTES` (4 KiB) or that
match secret-like keys / long hex (signatures, hashes) are rejected outright.

### 2.2 Loop & replay suppression

- A tab never processes a frame whose `sender` is itself.
- A bounded per-sender high-water mark drops replayed or out-of-order frames.
- Adoption never re-broadcasts, so tabs converge without a broadcast storm.

### 2.3 Wallet-context revocation

Every wallet-scope move increments a local monotonic `epoch`. A mutation
captures the epoch before PREPARE and re-checks it before signing; if the epoch
moved, the mutation is rejected with `StaleContextError`. On
`disconnect`/`account-change`/`chain-change`, the tab additionally sets
`requiresRecovery`, which disables `canMutate` and renders explicit recovery
copy until the user acknowledges.

### 2.4 Suspended-tab resume

The latest context is mirrored to a dedicated `localStorage` snapshot
(`truthbounty.cross-tab.wallet-context:v1`). On `visibilitychange` → `visible`,
a woken tab reads the snapshot and, if its epoch is newer, adopts it and
re-enters recovery. A snapshot that is not newer is ignored (no regression).

---

## 3. Acceptance criteria

| Criterion | Implementation |
|---|---|
| A stale tab cannot mutate after context revocation | `ContextGuard` + `canMutate` fail closed on epoch change / recovery. |
| Cross-tab events contain no signature, token, or protected payload | `serializeCrossTabEvent`/`parseCrossTabEvent` reject secret keys and long hex; builders only accept allow-listed fields. |
| User-visible recovery is explicit | `CrossTabRecoveryBanner` with `role="alert"`, `aria-live="assertive"`, and an acknowledgement control. |
| Tabs converge without infinite broadcast loops | Sender self-filter, replay ledger, and no re-broadcast on adoption. |

---

## 4. Tests

| Suite | Coverage |
|---|---|
| `src/lib/sync/__tests__/protocol.test.ts` | Bounded frames, strict validation, **privacy** (token/signature rejection). |
| `src/lib/sync/__tests__/channel.test.ts` | Two-tab connect/disconnect, account/chain switch, loop/replay suppression, bounded ledger, storage fallback. |
| `src/lib/sync/__tests__/wallet-context.test.ts` | Transition classification, mutation gate, stale guard, recovery copy, resume snapshot. |
| `src/hooks/__tests__/useCrossTabSync.test.tsx` | Two-tab connect/disconnect, account/chain revocation, **race convergence**, suspended-tab resume, session expiry, consent update, pending-transaction relay. |
| `src/components/providers/__tests__/CrossTabSyncProvider.test.tsx` | Explicit recovery banner and acknowledgement. |

Run:

```
pnpm exec jest src/lib/sync src/hooks/__tests__/useCrossTabSync.test.tsx \
  src/components/providers/__tests__/CrossTabSyncProvider.test.tsx
```

---

## 5. Consumption

Wrap the app (inside the Web3/Siwe providers) with `CrossTabSyncProvider` and
read it via `useCrossTabSyncContext()`:

```tsx
<CrossTabSyncProvider>
  <App />
</CrossTabSyncProvider>
```

Mutation surfaces should capture a guard token while preparing and assert it
immediately before signing:

```ts
const token = sync.guard.capture();
try {
  sync.guard.assertCurrent(token);
} catch {
  // Stale context — surface recovery, do not sign.
}
if (!sync.canMutate) return; // fail closed
```

Session and consent owners relay their terminal states through
`publishSessionState(...)` / `publishConsent(...)`; transaction owners use
`publishPendingTransaction(...)`.

---

## 6. Non-goals

- No redesign of approved boards.
- No new backend or contract interfaces.
- No transmission of secrets, signatures, sessions, or protected payloads.
