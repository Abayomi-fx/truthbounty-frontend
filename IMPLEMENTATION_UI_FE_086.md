# UI-FE-086 — Restrict Optimistic UI to an Explicit Safe Allowlist

**Issue:** [#658](https://github.com/DigiNodes/truthbounty-frontend/issues/658)
**Branch:** `fix/ui-fe-086-optimistic-safe-allowlist`
**Base:** `origin/main` at `3e8a5d9`

## What changed

### Explicit allowlist

`src/lib/optimistic-updates/allowlist.ts` is the single source of truth for
optimistic operations. Today it permits exactly one operation:

| Operation | Allowed field | Allowed value | Guard |
|---|---|---|---|
| `claim.status.under_review` | `status` | `UNDER_REVIEW` | Current status is `OPEN` or `UNDER_REVIEW` |

Unknown operations, fields outside the operation, final/economic/dispute/
permission semantics, missing snapshots, and no-op patches fail closed with a
typed `OptimisticUpdateError`.

### Reversible lifecycle

`src/lib/optimistic-updates/optimistic-update.ts` stores the exact prior
snapshot object and provides:

- `beginOptimisticUpdate` — allowlist validation and overlay creation;
- `rollbackOptimisticUpdate` — restores `record.previous` exactly;
- `commitOptimisticUpdate` — clears only after canonical observation;
- `reconcileOptimisticUpdate` — commit / keep / contradiction-rollback;
- `resolveOptimisticTransactionDecision` — terminal-state mapping.

| Transaction state | Action |
|---|---|
| `rejected`, `reverted`, `replaced`, `dropped`, `reorged` | Roll back |
| `finalized` | Clear overlay and refetch; never optimistic finality |
| Non-terminal states | No action |

### React Query adapter

`src/hooks/useOptimisticUpdate.ts` applies overlays through the boundary,
journals pending metadata, restores prior values after a refresh/remount,
withdraws overlays when a concurrent tab resolves the operation, and
invalidates the query after rollback/commit so cache and UI converge.

`useOptimisticClaimUpdate` (`src/hooks/useRealtimeClaims.ts`) now delegates to
this boundary and rejects every status except `UNDER_REVIEW`.

### Cross-tab journal

`src/lib/optimistic-updates/journal.ts` stores metadata only (operation, query
key, changed field names, previous/optimistic primitives). It never stores
claim content, evidence, wallet data, receipts, or secrets. Corrupt, malformed,
unknown-operation, oversized, and expired (> 5 minutes) records are dropped.

### Documentation

- `docs/OPTIMISTIC_UPDATES.md` — inventory, allowlist, rollback contract,
  refresh/concurrent-tab semantics, accessibility, and extension checklist.
- `docs/ARCHITECTURE.md` — performance section now links to the allowlist.

## Acceptance criteria

| Criterion | Evidence |
|---|---|
| Optimism is opt-in by operation and documented | `OPTIMISTIC_UPDATE_ALLOWLIST`; `docs/OPTIMISTIC_UPDATES.md` |
| Canonical failure restores prior state exactly | `rollbackOptimisticUpdate` returns `record.previous`; lifecycle + hook tests |
| Final or economic outcomes are never optimistic | Prohibited path/status guards; allowlist tests |
| Cache and visible UI converge after recovery | Hook rollback/commit/reconcile invalidates the query; hook tests |

## Required tests

- **Every transaction terminal state:** `optimistic-update.test.ts` and
  `useOptimisticUpdate.test.tsx` cover `rejected`, `reverted`, `replaced`,
  `dropped`, `reorged`, and `finalized`.
- **Refresh:** hook test restores previous presentation values and clears the
  journal entry on mount.
- **Concurrent tab:** hook test withdraws the local overlay when another tab
  removes the journal entry.
- **Projection contradiction:** pure and hook tests roll back when canonical
  state matches neither the previous nor optimistic value.
- **Allowlist enforcement:** `allowlist.test.ts` covers unknown operations,
  unsafe fields, final statuses, and no-op patches.

## Verification

Because `main` already contains syntax errors in unrelated files (including
`src/app/queries/queryClient.ts`, which `jest.setup.js` imports), the standard
Jest setup cannot start. The new suites were run with a minimal setup file that
only loads `@testing-library/jest-dom`:

```text
Test Suites: 4 passed, 4 total
Tests:       44 passed, 44 total
```

A targeted TypeScript check covering only the new boundary, hook, and tests
completed with 0 errors. Full-repo `tsc` and ESLint remain blocked by
pre-existing failures on `main` (unrelated syntax errors and the
`eslint-plugin-react@7.37.5` / ESLint 10 incompatibility).

## Non-goals respected

- No board redesign.
- No API/contract behavior invented.
- No `Stellar Wave` label changes.
- No full projection payloads persisted.
