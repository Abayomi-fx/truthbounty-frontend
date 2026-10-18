# Optimistic UI Allowlist (UI-FE-086)

Optimistic UI is **opt-in by operation**. The boundary lives in
[`src/lib/optimistic-updates`](../src/lib/optimistic-updates) and is adapted to
TanStack Query by [`useOptimisticUpdate`](../src/hooks/useOptimisticUpdate.ts).

The canonical authority model is unchanged: pinned contracts and reviewed API
projections are authoritative. Optimistic updates may only change **reversible
presentation state**; they may never invent settlement, finality, permissions,
rewards, receipts, or dispute outcomes.

## Inventory

| Code path | Behaviour | Classification |
|---|---|---|
| `useOptimisticClaimUpdate` (`src/hooks/useRealtimeClaims.ts`) | Applies a short-lived `UNDER_REVIEW` overlay to a claim detail cache entry through the allowlisted boundary | Optimistic — restricted by this policy |
| `useRealtimeData` WebSocket handlers | Write server-provided projection payloads with `setQueryData` | Authoritative projection — **not** optimistic |
| `useFinalityLevel`, `useProjectionInvalidation` | Receipt-driven finality and invalidation | Authoritative — **not** optimistic |
| React Query mutations (`claims`, `disputes`, `evidence`) | Invalidate scoped projections after success | No optimistic writes |

## Allowlist

| Operation id | Entity | Allowed field | Allowed value | Guard |
|---|---|---|---|---|
| `claim.status.under_review` | Claim | `status` | `UNDER_REVIEW` | Current status must be `OPEN` or `UNDER_REVIEW` |

Everything else is rejected. In particular, the following can **never** be
optimistic:

- settlement or finality (`finalized`, `settled`, `finality`, confirmations);
- rewards, balances, stakes, payouts, or claimable amounts;
- permissions, roles, authority, or authorization;
- dispute/verification outcomes (`VERIFIED`, `REJECTED`, `DISPUTED`, verdicts);
- transaction hashes, receipts, or block numbers.

The implementation also rejects any path matching the semantic prohibited-path
guard (`isProhibitedOptimisticPath`) even if a future operation mistakenly tries
to allow it.

## Rollback contract

An optimistic record stores the **exact prior snapshot object** in memory.
Canonical failure restores that object, not a reconstructed approximation.

| Trigger | Action |
|---|---|
| Wallet rejection (`rejected`) | Roll back to prior snapshot |
| On-chain revert (`reverted`) | Roll back to prior snapshot |
| Replacement (`replaced`) | Roll back to prior snapshot |
| Dropped transaction (`dropped`) | Roll back to prior snapshot |
| Reorg (`reorged`) | Roll back to prior snapshot |
| Projection contradiction | Roll back to prior snapshot |
| Canonical projection missing/opaque | Fail closed; roll back |
| Refresh / remount with a pending journal entry | Restore prior presentation values, then refetch canonical |
| Concurrent tab resolves the operation | Withdraw the local overlay, then refetch canonical |
| Finalized transaction | Clear the overlay and refetch; finality is **not** displayed optimistically |

`reconcileOptimisticUpdate` compares the canonical projection with the previous
and optimistic values:

- canonical matches the optimistic value → commit (remove overlay);
- canonical still matches the previous value → keep waiting;
- canonical matches neither → projection contradiction → rollback;
- canonical missing → fail closed → rollback.

After any rollback or commit, the adapter calls
`queryClient.invalidateQueries(...)` so the cache and visible UI converge on the
canonical projection.

## Cross-tab and refresh journal

Pending overlays are journaled under
`truthbounty.optimistic-updates.v1` in `localStorage`. The journal contains
**metadata only**:

- operation id, query key, changed field names;
- the previous/optimistic primitive values for those fields;
- a timestamp and a fixed schema version.

It never persists the claim payload, evidence, wallet data, receipts, or
secrets. Reads fail closed: malformed, unknown-operation, oversized, expired
(> 5 minutes), or unsupported records are dropped.

A `storage` event causes the adapter to re-read the journal. If the local
overlay is no longer pending (another tab committed or rolled back), the adapter
restores its exact prior snapshot and invalidates the query. A refresh or
remount treats any pending journal entry as unconfirmed and rolls it back.

## Accessibility (WCAG 2.2 AA)

- Pending presentation must be announced with `role="status"` /
  `aria-live="polite"` and must not imply success.
- Failure rollback uses the existing `role="alert"` / assertive lifecycle copy.
- Status meaning must never depend on colour alone.
- Final or economic outcomes only appear after canonical data arrives.

## Tests

- `src/lib/optimistic-updates/__tests__/allowlist.test.ts` — allowlist,
  prohibited statuses/fields, missing snapshot, no-op patch.
- `src/lib/optimistic-updates/__tests__/optimistic-update.test.ts` — exact
  rollback, commit/reconcile semantics, projection contradiction, every
  transaction terminal state.
- `src/lib/optimistic-updates/__tests__/journal.test.ts` — metadata-only
  persistence, corruption/expiry handling, prior-value restoration.
- `src/hooks/__tests__/useOptimisticUpdate.test.tsx` — cache application,
  terminal-state rollback, refresh recovery, concurrent-tab recovery, and
  projection contradictions.

## Adding an operation

1. Add the literal id and guard to `OPTIMISTIC_UPDATE_ALLOWLIST`.
2. Limit `allowedFields` to reversible presentation fields.
3. Add explicit `allowedValues` (no free-form domain values).
4. Extend the allowlist, lifecycle, journal, and hook tests.
5. Update the inventory table above.
6. Obtain maintainer review; this boundary is security-sensitive.
