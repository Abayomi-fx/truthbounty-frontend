# Chromatic Baseline Policy

**Authority:** Frontend / UX Maintainers
**Scope:** All Storybook stories under `src/**/*.stories.{ts,tsx}`

## Baseline policy

1. **Auto-accept on `main`:** Changes pushed directly to `main` are
   auto-accepted as new baselines. All other branches require explicit
   reviewer approval in the Chromatic UI.

2. **Diff threshold:** Visual diffs exceeding 0.2% pixel difference are
   flagged as regressions. Reviewers can override for intentional design
   changes.

3. **Viewports:** Every story is captured at three approved widths:
   - **Desktop** — 1440px
   - **Tablet** — 768px
   - **Mobile** — 375px

4. **Modes:** Every story is captured in three modes:
   - **Default** — normal colour and motion.
   - **Reduced motion** — `prefers-reduced-motion: reduce`.
   - **Forced colours** — `forced-colors: active` (Windows High Contrast).

5. **Only changed:** Chromatic snapshots only stories whose source or
   dependencies changed since the last baseline, keeping CI fast.

6. **Ignore selectors:** Elements marked `[data-chromatic-ignore]` or
   `[class*='animate']` are excluded from diff comparison to avoid
   animation-timing flakiness.

7. **Skip:** Example stories under `src/stories/` are skipped — they are
   Storybook boilerplate, not production components.

## Update workflow

### When a visual change is intentional

1. Push the branch and open a PR.
2. Chromatic runs automatically and flags the diff.
3. Review the diff in the Chromatic UI.
4. If the change is approved, click **Accept** to snapshot a new baseline.
5. Merge the PR. The new baseline is now the reference for future diffs.

### When a visual change is a regression

1. Chromatic fails the CI check.
2. Do NOT accept the diff.
3. Fix the code so the screenshot matches the baseline.
4. Re-push — Chromatic re-runs automatically.

### Baseline review cadence

- Baselines are reviewed at least once per sprint.
- Stale baselines (no changes for >30 days) are audited for relevance.
- Any baseline that no longer reflects the approved design system must be
  updated via a PR with explicit reviewer approval.

## CI integration

- Chromatic runs in `.github/workflows/storybook.yml` on every PR and push.
- The workflow uses `--only-changed` to skip unchanged stories.
- A `CHROMATIC_PROJECT_TOKEN` repository secret is required.
- Missing or placeholder tokens fail the workflow with a clear error.

## Fixture isolation guarantee

Chromatic snapshots are captured against the Storybook fixture layer
(`.storybook/StorybookFixtureProvider.tsx`). No network, wallet, analytics,
or live adapter calls are made during snapshot capture. Unpinned actions
render unavailable — components show their disabled / unavailable state.
