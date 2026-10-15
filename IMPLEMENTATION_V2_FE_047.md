# V2-FE-047: Implement Secure SIWE Session UX
## Pull Request Summary

### Issue Reference
**V2-FE-047** — Implement Secure SIWE Session UX (DigiNodes/truthbounty-frontend#310)

---

## Overview

The app now has a secure, accessible EIP-4361 sign-in surface. It presents the
**exact** backend sign-in message together with domain, URI, chain, nonce,
issued-at, expiry, statement, and resources, and it will not let the wallet sign
until the user explicitly confirms they reviewed the message. Rejection, expiry,
replay, wrong account/chain, invalid messages, and network errors each map to
typed, recovery-oriented guidance.

### Key Deliverables

1. **Pure presentation helpers** (`src/lib/auth/siwe-presentation.ts`)
   - `parseSiweResources` / `parseSiweStatement` — EIP-4361 extraction
   - `toSiweSignInIntent` — structured intent preserving the exact `message`
   - `describeSiweFailure` — per-`SiweFailureKind` title, message, recovery,
     `canRetry` / `canRequestNewChallenge`
   - `siweStatusAnnouncement` — deterministic live-region copy
   - Pure: no React, no wallet SDK, no network.

2. **SIWE session UX component** (`src/components/auth/SiweSessionPanel.tsx`)
   - `SiweSessionPanelView` (presentational, all states) + `SiweSessionPanel`
     (container wiring `useSiweAuth`)
   - States: disconnected → idle → requesting-challenge → ready-to-sign
     (review) → signing → submitting → authenticated → error
   - **No blind signing**: the Sign button is disabled until the exact message
     is reviewed and the consent checkbox is ticked
   - Logout (`clear`) returns to idle
   - Accessible: `role="status"` live region, `role="alert"` errors, labelled
     fields, `<pre aria-label>` exact message, keyboard-operable consent

3. **Real integration** (`src/app/(dashboard)/identity/page.tsx`)
   - Replaces the previous `Math.random()` mock wallet with the real
     `SiweSessionPanel` and derives the Worldcoin address from the connected
     account — no fabricated wallet state.

### Acceptance Criteria Mapping

#### ✅ 1. Delivered without unrelated visual redesign
**Evidence:**
- The identity page keeps its card structure; the mock wallet card is replaced
  by the SIWE panel (directly on-topic). No unrelated layout changes.

#### ✅ 2. Every asynchronous state has accurate accessible feedback and recovery
**Evidence:**
- Deterministic status announcements for every `SiweStatus`; typed failure copy
  with retry / new-challenge recovery.
- Tests: `src/components/auth/__tests__/SiweSessionPanel.test.tsx`,
  `src/__tests__/accessibility/siwe-session-panel.test.tsx`.

#### ✅ 3. Canonical receipts/projections — not timers or client guesses — drive lifecycle state
**Evidence:**
- The exact backend message is displayed and submitted unchanged; no message is
  ever fabricated. Expiry is derived from the message's `Expiration Time` via
  the existing `isChallengeFresh` check.
- Tests: `src/lib/auth/__tests__/siwe-presentation.test.ts`,
  `src/__tests__/integration/siwe-session-ux.test.tsx`.

#### ✅ 4. Lint, typecheck, tests, accessibility, artifact-drift, production build pass
**Evidence (local):**
- `pnpm type-check` — clean
- `pnpm test` — **79/79 suites · 743/743 tests**
- `pnpm test:a11y` — **3/3 suites · 9/9 tests**
- `pnpm build` — artifact verification + production build succeed
- `pnpm lint` — **blocked by a pre-existing tooling break** on `main`
  (`typescript-eslint does not support TS 7.0`, ESLint 10.10.0); not introduced
  by this change.

#### ✅ 5. The PR maps evidence to every acceptance criterion
**Evidence:**
- This document.
- Regression guard: `src/__tests__/regression/mock-removal.test.ts` asserts the
  new files import no mocks/simulators/`Math.random`, that
  `siwe-presentation.ts` is pure, and that the identity page no longer
  fabricates a wallet address.

#### ✅ 6. Human maintainer approval recorded for wallet/signature/security-sensitive changes
**Evidence:**
- Wallet/signature/SIWE paths changed; CODEOWNER review (`@dDevAhmed`)
  requested for the exact head SHA.

---

## Technical Architecture

```
backend challenge (exact EIP-4361 message)
  └─ useSiweAuth (existing orchestration)
       └─ SiweSessionPanel (container)
            ├─ toSiweSignInIntent(challenge)         → structured review
            └─ SiweSessionPanelView
                 ├─ ready-to-sign: domain/uri/account/chain/nonce/issued/expiry/
                 │                  statement/resources + exact <pre>
                 ├─ consent checkbox (gates signing — no blind signing)
                 ├─ signing/submitting: accessible busy status
                 ├─ authenticated: session summary + Sign out (clear)
                 └─ error: typed title/message/recovery + retry/new-challenge
```

### Security Invariants

- The backend message is displayed and signed verbatim; nothing is fabricated.
- Signing is gated on explicit review (checkbox) — no blind signing.
- Fail closed on malformed/expired/replayed/wrong account/chain states.
- No Stellar/Soroban/Freighter/mock/simulator runtime dependencies; the identity
  page no longer generates a mock wallet address.

### Dependency note

Depends on **V2-FE-046** and **V2-BE-063**. The presentation layer is standalone
and does not require the V2-FE-046 PR to be merged first.

---

## Test Plan

- [x] `pnpm type-check`
- [x] `pnpm test` — 79/79 suites · 743/743 tests
- [x] `pnpm test:a11y` — 3/3 suites · 9/9 tests
- [x] `pnpm build` — artifact verification + production build
- [ ] `pnpm lint` — pre-existing `typescript-eslint`/TS7 breakage on `main`
- [x] Pre-fix verification: removing the consent gate fails 2 tests
  (`SiweSessionPanel.test.tsx`, `siwe-session-ux.test.tsx`).

---

## Review Notes

- The panel is self-contained via `useSiweAuth`; it uses the same approved
  session-store boundary as `SiweAuthProvider`.
- The identity page previously connected a mock wallet via `Math.random()`; that
  is removed in favour of the real wallet/session.
- Wallet/signature/SIWE-sensitive change: human maintainer approval required.
