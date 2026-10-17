# Migration Note Template

<!-- Copy this file to docs/design-system/migrations/YYYY-MM-DD-<slug>.md -->

## Migration: `<ComponentName>` — `<propName>` deprecation

| Field | Value |
|---|---|
| **Component** | `<ComponentName>` |
| **Deprecated prop / export** | `<propName>` |
| **Deprecated since** | `<!-- ISO date -->` |
| **Removal target** | `<!-- ISO date, ≥ 1 sprint after soft-deprecation -->` |
| **Tracking issue** | `#<issue-number>` |
| **Reviewer** | `@<github-login>` |

### Why

<!-- Explain the design or API reason for the deprecation. -->

### Before (deprecated)

```tsx
// Old usage — will warn in dev and be removed after REMOVAL_TARGET.
<ComponentName propName="old-value" />
```

### After (migration)

```tsx
// New usage.
<ComponentName newProp="new-value" />
```

### Automated codemod (if available)

```bash
# Optional: run from repo root to migrate all callsites.
node scripts/codemods/<slug>.mjs
```

### Exception process

If a callsite cannot be migrated before the removal target, open an issue
referencing this migration note and request an extension from a maintainer.
Extensions must be reviewed every 30 days.
