# UI-FE-084: Add Unsaved-Change Guards for Recoverable Forms
## Pull Request Summary

### Issue Reference
**UI-FE-084** — Add Unsaved-Change Guards for Recoverable Forms ([#655](https://github.com/DigiNodes/truthbounty-frontend/issues/655))

---

## Overview

Adds a reusable production boundary for **dirty-state tracking, local draft
recovery, and navigation protection** across recoverable forms (claim,
evidence, dispute, governance preparation, support, and settings). The
boundary never claims server or on-chain persistence: a draft is always a
browser-local artifact, and guards are cleared only after verified
persistence or an explicit discard.

This is a boundary capability, intentionally separate from the
screen-composition issues (#582 claim statement, #594 dispute entry). It
reuses the existing `useDialogFocus` primitive, the wallet/release identity
model, and the repo's versioned, validating `localStorage` patterns.

### Key Deliverables

1. **`src/lib/drafts/recoverable-draft.ts`** — local draft store
   - Versioned, form- and scope-keyed `localStorage` records
   - Untrusted payloads are validated by a caller-supplied guard before use
   - Corrupt / stale-schema / ambiguous / invalid payloads are dropped (fail closed)
   - Drafts pinned to account + chain + protocol release; mismatches are **quarantined**, never restored
   - `markDraftPersisted` and `clearLocalDraft` are the only ways to clear a draft
   - `quarantineIncompatibleDrafts` sweeps storage on scope switches
   - SSR-safe (no `window`/`localStorage` on the server)

2. **`src/hooks/useRecoverableFormDraft.ts`** — draft coordination hook
   - Debounced local autosave while the form is dirty
   - Explicit restore surface (`hasRestoredDraft`, `restoredPayload`) — never silent
   - `discardDraft()` and `markPersisted()` (post-verified-persistence) clear storage
   - Reports `clean | dirty | saved-local | persisted | rejected | quarantined | save-failed`

3. **`src/hooks/useUnsavedChangesGuard.ts`** — navigation protection
   - `beforeunload` for refresh/tab-close/browser back (native prompt)
   - Capture-phase internal anchor interception with an async confirm
   - `popstate` (SPA back) reversal + confirm
   - `confirmNavigation()` for wrapped programmatic navigation

4. **`src/hooks/useUnsavedChangesDialog.ts` + `src/components/ui/UnsavedChangesDialog.tsx`**
   - Promise-based confirm controller; only an explicit "leave" resolves true
   - Accessible modal: labelled/described, focus-trapped via `useDialogFocus`,
     Escape = stay, safe default focus, optional "save draft and leave"
   - States plainly that drafts are browser-local only

5. **`src/hooks/useDraftScope.ts`** — builds the account/chain/release scope

6. **`src/components/ui/DraftStatusIndicator.tsx`** — announces local vs canonical status

### Integrations

- **`ClaimSubmissionWizard`** — replaced the ambiguous `window.confirm`
  ("Your progress will be saved") with the accessible guard dialog; Escape,
  backdrop, close button, refresh, back, and in-app links are all guarded
  while the wizard holds nontrivial input; the guard releases on the
  confirmation step.
- **`OpenDispute`** — reason input is autosaved to a scoped local draft,
  recoverable explicitly, quarantined on account/chain/release change, and
  protected on close/Escape/refresh/back. Verified on-chain success clears
  the draft and releases the guard.

### Acceptance Criteria Mapping

#### ✅ Users cannot lose nontrivial input silently
- Dirty forms arm `beforeunload`, internal-link, and `popstate` guards.
- Closing a dirty form routes through a confirmation dialog (no `window.confirm`).

#### ✅ Draft status clearly states local versus canonical persistence
- `DraftStatusIndicator` renders distinct copy for `saved-local` ("Saved as a
  local draft on this device") vs `persisted` ("Saved").
- The dialog's persistence notice states browser-local only; nothing is sent
  to the server or on-chain until the user completes submission.

#### ✅ Account/chain/release switches quarantine incompatible drafts
- Drafts are keyed by account + chain + release; mismatches are moved to a
  quarantine record and surfaced with an explicit reason
  (`account-change | chain-change | release-change | scope-mismatch`).

#### ✅ Guards do not trap users after successful completion
- `markPersisted()` clears the draft and `when` becomes false after verified
  persistence; explicit discard also releases the guard. The wizard releases
  its guard once the confirmation step is reached.

### Security & Architecture Constraints

- **Optimism/EVM only.** No alternate-chain runtime code is added.
- Contracts/API remain authoritative; this boundary performs **no** writes and
  never fabricates persistence — `markPersisted` must be called by the caller
  only after it verified a real persistence step.
- Remote content, browser state, wallet data, and user input are treated as
  untrusted: stored payloads are validated by the caller before use, and
  missing/stale/ambiguous scope fails closed.
- No secrets are stored; drafts contain only non-secret form fields.

### Accessibility (WCAG 2.2 AA)

- Dialog is `role="dialog"` + `aria-modal`, labelled and described.
- Focus is trapped and returned to the trigger on close (`useDialogFocus`).
- Escape closes as "stay"; the destructive action is never the default focus.
- Status is announced with `role="status"` / `aria-live="polite"`.
- Visible focus styles on all dialog actions.

### Tests

- `src/lib/drafts/__tests__/recoverable-draft.test.ts` — storage, validation,
  corruption, schema, scope quarantine, discard/persist clearing
- `src/hooks/__tests__/useUnsavedChangesGuard.test.tsx` — beforeunload,
  internal links, popstate, ignored clicks, confirmNavigation
- `src/hooks/__tests__/useRecoverableFormDraft.test.tsx` — autosave, restore,
  discard, verified persistence, save failure, quarantine
- `src/hooks/__tests__/useUnsavedChangesDialog.test.tsx` — promise fail-closed semantics
- `src/components/ui/__tests__/UnsavedChangesDialog.test.tsx` — roles, names,
  focus, Escape, actions, axe
- `src/__tests__/accessibility/unsaved-changes-dialog.test.tsx` — keyboard
  focus-trap, accessible name/description, axe
- `src/__tests__/unsaved-changes/recoverable-form-guard.test.tsx` — end-to-end
  refresh, internal navigation, account switch, successful save, failed save,
  restore, discard
- `src/components/features/claim-submission/__tests__/ClaimSubmissionWizard.unsaved.test.tsx`
- `src/components/features/disputes/__tests__/OpenDispute.unsaved.test.tsx`

### Non-Goals

- Redesigning approved boards.
- Inventing API/contract behavior.
- Applying `Stellar Wave` before maintainer activation.

### Complexity and Points

- **Medium — 150 points**
