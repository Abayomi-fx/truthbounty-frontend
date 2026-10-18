# Component API Deprecation & Design-Token Drift Policy

**Tracking issue:** UI-FE-091 (#665)  
**Depends on:** #552, #571 (approved brand and foundation token authority)  
**Authority:** Approved V2 design-token contract (`src/lib/design-tokens.ts`)

---

## 1. Purpose

This policy prevents approved visual foundations from eroding as parallel
contributors add one-off props, raw CSS values, or silent breaking component
changes. It establishes a measurable conformance bar and a documented migration
path for every exception.

---

## 2. Token Conformance Rules

### 2.1 Forbidden raw values

The following raw visual values are **forbidden** in shared component source
(`src/components/**`) wherever an approved token exists:

| Category | Forbidden patterns | Approved alternative |
|---|---|---|
| Colors (hex) | `#[0-9a-fA-F]{3,8}` | `text-<token>`, `bg-<token>`, `border-<token>` |
| Colors (rgb/rgba) | `rgb(`, `rgba(` | semantic token utility |
| Colors (hsl/hsla) | `hsl(`, `hsla(` | semantic token utility |
| Colors (oklch raw) | `oklch(` in className strings | CSS variable via token |
| Hardcoded spacing | `style={{.*margin.*px`, `padding.*px` inline | Tailwind spacing scale |
| Hardcoded border-radius | `borderRadius.*px`, `rounded-[*px*]` arbitrary | `rounded-{sm,md,lg,xl}` scale |

> **Exception:** `oklch(` values in `globals.css` itself are the **source of
> truth** and are permitted. Data-visualisation libs (`recharts`) and
> third-party widget containers may be allowlisted in `scripts/token-drift-allowlist.json`.

### 2.2 Semantic colour tokens

All shared components **must** reference colour only through the semantic token
names declared in `src/lib/design-tokens.ts` → `SEMANTIC_COLOR_TOKENS`. These
names are mapped to Tailwind utilities in the `@theme inline` block of
`src/app/globals.css` and verified by the `semantic-tokens.test.ts` suite.

### 2.3 Detecting duplicate primitives

If a file outside `src/components/ui/primitives/` re-implements the same visual
pattern as `Card`, `StatusBadge`, or `TokenAmount`, a reviewer **must** request
migration to the shared primitive before approval.

The static checker (`scripts/check-token-drift.mjs`) detects files that contain
both `data-slot="card"` / `data-slot="status-badge"` / `data-slot="token-amount"`
duplicated outside the canonical primitive source.

---

## 3. Component API Deprecation Rules

### 3.1 What triggers a deprecation?

A **breaking API change** is any of:
- Removing a prop that callers depend on.
- Renaming a prop without an alias.
- Changing a prop's accepted value set (e.g. narrowing `tone` variants).
- Changing the rendered HTML structure in a way that breaks existing CSS selectors or tests.

### 3.2 Deprecation lifecycle

```
Phase 1 – Soft deprecation (≥1 sprint)
  • Add @deprecated JSDoc on the old prop/export.
  • Add a console.warn (dev-only) referencing the migration note.
  • Keep the old behaviour working.

Phase 2 – Hard removal (must be scheduled)
  • Fill in REMOVAL_TARGET in the migration note.
  • Open a tracking issue, link it from the migration note.
  • Remove the prop/export after REMOVAL_TARGET date passes.
```

### 3.3 Required migration note

Every deprecation **must** ship a migration note using the template in
`docs/design-system/MIGRATION_TEMPLATE.md`.  
Migration notes live in `docs/design-system/migrations/`.

---

## 4. Exception Allowlisting

Legitimate exceptions (e.g. `recharts` raw colours, third-party widget wrapper
colours) **must** be recorded in `scripts/token-drift-allowlist.json`.

Each entry requires:
- `file` — relative path from repo root (glob OK)
- `pattern` — the raw-value pattern being excepted
- `reason` — human-readable justification
- `reviewer` — GitHub login of approving maintainer
- `expiresAt` — ISO date after which the exception must be re-reviewed (max 180 days)

The CI gate (`check-token-drift` job) fails if the exception count in the
manifest **increases** compared to the baseline stored in the same file
(`"baseline"` key) without a corresponding increase in the `"approved"` count.

---

## 5. Emergency / Unrelated Legacy Debt

This policy applies to **shared component source** (`src/components/**`).

Page-level or feature-level legacy debt in app routes is **not blocked** by the
token-drift gate. The gate runs on `src/components/**` only, ensuring emergency
repairs elsewhere are never held up by unrelated legacy issues.

---

## 6. Enforcement

| Check | Phase | Fail mode |
|---|---|---|
| `semantic-tokens.test.ts` | `test` job | Hard fail |
| `check-token-drift.mjs` | `token-drift` job | Hard fail if new raw values added |
| Exception count baseline | `token-drift` job | Hard fail if count grows without approval |
| Migration note presence | Code review (CODEOWNERS) | Reviewer request |

---

## 7. Scope Boundaries (Non-Goals)

- This policy does **not** automatically rewrite application code.
- This policy does **not** remove all legacy exceptions in this sprint.
- Data-visualisation libraries (`recharts`) and external widget containers have
  a documented allowlist path and are **not** blocked by this policy.
