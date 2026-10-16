# STAB-FE-002: Repair the Frontend Jest Snapshot Baseline

**Status:** implemented
**Scope:** one test file and one snapshot file. No component, dependency, or CI changes.

## Summary

The repository contains exactly one Jest snapshot baseline:
`src/components/features/__tests__/__snapshots__/StatsCards.test.tsx.snap`, guarding
`StatsCards` in `src/components/features/StatsCards.tsx`.

That baseline asserted the rendered Tailwind utility-class strings, so any
semantics-preserving change to a class string failed the suite while the accessible
output was completely unchanged. It also carried the only assertion of the component's
`aria-label` accessible name (`My Trust: 95`), but expressed as serialized markup inside
a snapshot rather than as a named accessibility assertion.

The snapshot was replaced with focused semantic assertions and the `.snap` file was
deleted. No `-u` run was performed; no snapshot was rewritten.

## Investigation

### The reported failure does not reproduce

The issue describes a failing snapshot suite. Measured on both revisions:

| Revision | Suites | Tests | Snapshot result |
| --- | --- | --- | --- |
| `origin/main` (`5ff966e`) | 27 failed, 128 passed | 151 failed, 1687 passed (1838 total) | `Snapshots: 1 passed, 1 total` |
| `feat/v2-fe-150-production-readiness` (`3794fa9`) | 157 passed | 3065 passed | `Snapshots: 1 passed, 1 total` |

`main` is red, but for unrelated reasons — 151 failing tests across 27 suites, none of
them snapshot failures. The single snapshot in the repository passes on both revisions
under `jest --ci` (which disables writing). There was therefore no stale snapshot to
reconcile, and no obsolete or written snapshot anywhere in the tree.

Reproduce:

```bash
git worktree add /tmp/tb-main origin/main
cd /tmp/tb-main && cp -al <repo>/node_modules ./node_modules
npx jest --ci --silent | grep -E 'Tests:|Suites:|Snapshots:'
```

### What the baseline actually covered

Diffing the snapshot against the component and the sibling assertions shows the
baseline's only non-redundant, non-cosmetic coverage was the accessible name:

| Snapshot content | Covered elsewhere? |
| --- | --- |
| `aria-label="My Trust: 95"` | **No — nowhere in the repo** |
| `class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4"` | Cosmetic |
| `class="bg-[#18181b] rounded-xl p-6 …"` | Cosmetic |
| Text `95` | Yes — `getByText('95')` |
| Text `My Trust` | Yes — `getByText('My Trust')` |
| `<div data-testid="trust-score-tooltip" />` | Yes — `getByTestId(...)`, and this is the *mocked* tooltip, not real output |

So removing the snapshot required explicitly promoting the accessible name to a named
assertion; that is the accessibility-relevant output the issue requires to remain
asserted.

## Change

`src/components/features/__tests__/StatsCards.test.tsx` — the single
`toMatchSnapshot()` test is replaced by three focused tests, plus one loading-state test:

1. **`exposes an accessible name pairing the stat label with its value`** —
   `getByLabelText('My Trust: 95')`. This is the coverage the snapshot used to provide
   opaquely, now asserted by name.
2. **`keeps the value, label and tooltip in the same stat card`** — the same three
   lookups scoped with `within(card)`. This is *stricter* than the pre-existing
   page-wide `getByText` calls, which would still pass if the label and the value were
   rendered in different cards.
3. **`renders exactly one stat card so a missing or duplicated stat is caught`** —
   `getAllByLabelText(/^[^:]+: \S+$/)` has length 1, so adding, dropping or duplicating
   a stat is caught semantically rather than through a markup diff.
4. **`does not render stat cards while loading`** — the skeleton replaces the cards and
   no accessible name is present, so the two states cannot silently overlap.

`src/components/features/__tests__/__snapshots__/StatsCards.test.tsx.snap` — deleted.
The `__snapshots__` directory is now empty and removed. The repository contains no
Jest snapshots.

## Before/after evidence

All three experiments were run on this branch and reverted afterwards;
`src/components/features/StatsCards.tsx` is unmodified in the final diff.

**Before — a cosmetic class reorder fails the suite.** Reordering
`"grid grid-cols-2 … gap-4"` to `"grid gap-4 grid-cols-2 …"`, which changes no rendered
semantics and no accessibility output:

```
● StatsCards Component › matches snapshot to ensure no unexpected changes
  Snapshot name: `StatsCards Component matches snapshot to ensure no unexpected changes 1`
  + Received  + 1
Tests:       1 failed, 2 passed, 3 total
Snapshots:   1 failed, 1 total
```

The two semantic tests passed; only the serialized class string differed.

**After — the same cosmetic reorder passes:**

```
Tests:       6 passed, 6 total
Snapshots:   0 total
```

**After — a real accessibility regression is still caught.** Removing the
`aria-label` from the stat card:

```
TestingLibraryElementError: Unable to find a label with the text of: My Trust: 95
TestingLibraryElementError: Unable to find a label with the text of: /^[^:]+: \S+$/
Tests:       3 failed, 3 passed, 6 total
```

**After — an accessible-name/value desync is caught.** Changing the accessible name to
report `0` while the card still displays `95`:

```
TestingLibraryElementError: Unable to find a label with the text of: My Trust: 95
Tests:       2 failed, 4 passed, 6 total
```

This desync is the case the old suite handled worst: both pre-existing `getByText`
assertions still passed, so the regression surfaced only as an opaque snapshot diff with
no indication that the accessible name had drifted from the visible value.

## Verification

| Gate | Command | Before | After |
| --- | --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | clean | clean |
| Lint | `npm run lint` | 0 errors, 53 warnings | 0 errors, 53 warnings |
| Jest (CI mode) | `npx jest --ci` | 157 suites, 3065 tests, `Snapshots: 1 passed` | 157 suites, 3068 tests, `Snapshots: 0 total` |

No obsolete or written snapshots are reported, and no CI check was weakened or skipped.
The test count rises by three because one snapshot test became four semantic tests; no
existing assertion was deleted.

## Note on the branch base

The issue requires rebasing on the then-current `main` and one issue per pull request.
`main` (`5ff966e`) currently has 27 failing suites, so this branch is stacked on
`feat/v2-fe-150-production-readiness` (`3794fa9`), which contains the fixes for those
failures. Targeting `main` directly would mean bundling an unrelated issue's changes
into this pull request. The diff against `feat/v2-fe-150-production-readiness` is
confined to the two files above, so this pull request can be reviewed on its own and
retargeted to `main` once V2-FE-150 merges.

## Follow-up observations (not actioned here)

- `StatsCards.test.tsx` mocks `TrustScoreTooltip` with a bare
  `<div data-testid="trust-score-tooltip" />`, so the real tooltip's accessibility
  wiring — a `button` with `aria-describedby="trust-tooltip"` pointing at a
  `role="tooltip"` element in `src/components/ui/TrustScoreTooltip.tsx` — is not
  asserted anywhere. That belongs to the tooltip's own test surface and is out of scope
  for a snapshot repair, so the mock was left in place per the isolation intent of
  `42931c8`.
- STAB-FE-001 and the #429 toolchain overlap noted in the issue do not affect this work:
  the snapshot depended on React 19.3.0, `@testing-library/react` ^16.3.3 and jest
  30.5.2 for its serialized output, and the suite no longer depends on serialized output
  at all, so a toolchain change can no longer invalidate it.
