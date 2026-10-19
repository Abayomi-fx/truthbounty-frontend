# UI-FE-093: Approved-Board Conformity Reviews & Visual Evidence Bundles

**Issue:** [#664 UI-FE-093](https://github.com/DigiNodes/truthbounty-frontend)  
**Protocol Authority Reference:** `DigiNodes/truthbounty-protocol` @ commit `60c66b78cf797d8f821089c99ae1bc461009fecc`  
**Frontend Implementation Matrix:** 58 Approved High-Fidelity Boards across 6 Protocol Batches  
**Branch:** `main`

---

## 1. Executive Summary

Frontend pull requests previously risked allowing visual drift to silently bypass component-level tests because there was no deterministic mechanism connecting implemented routes, views, and canonical states back to the authoritative high-fidelity boards defined in the protocol repository.

This implementation delivers an end-to-end conformity review pipeline and visual evidence harness for `DigiNodes/truthbounty-frontend`, enforcing strict alignment across all 58 approved protocol boards spanning 6 logical batches.

---

## 2. Core Architecture & Deliverables

### Deliverable 1: Board-to-Route/State Manifest
- **File:** [`src/config/board-conformity-manifest.json`](file:///c:/Users/user/Desktop/Tekgodfrey/truthbounty-frontend/src/config/board-conformity-manifest.json)
- **Typed Interface:** [`src/config/board-conformity.ts`](file:///c:/Users/user/Desktop/Tekgodfrey/truthbounty-frontend/src/config/board-conformity.ts)
- **Coverage:** Exhaustively indexes all 58 approved boards:
  - **Batch 1 (Foundation):** 8 boards (`INDEX-001`, `INDEX-002`, `DASH-001`, `DASH-002`, `DASH-003`, `DASH-004`, `SEARCH-001`, `ERR-001`)
  - **Batch 2 (Public-Claimant):** 11 boards (`CLAIM-001` through `CLAIM-007`, `PROFILE-001`, `PROFILE-002`, `CLAIMANT-001`, `CLAIMANT-002`)
  - **Batch 3 (Verifier):** 7 boards (`VERIF-001` through `VERIF-007`)
  - **Batch 4 (Dispute):** 6 boards (`DISP-001` through `DISP-006`)
  - **Batch 5 (Privileged):** 13 boards (`ADMIN-001` through `ADMIN-008`, `MOD-001` through `MOD-005`)
  - **Batch 6 (Support-Legal):** 13 boards (`HELP-001` through `HELP-004`, `DOCS-001` through `DOCS-003`, `LEGAL-001` through `LEGAL-004`, `AUDIT-001`, `SEC-001`)
- **Viewport Matrix:** Desktop (`1440x900`), Tablet (`768x1024`), Mobile (`375x667`), and Zoom 200% (`640x900` at CSS device scale factor 2.0).
- **Explicit Blocked/Unavailable Records:** Every board not yet fully mounted in frontend route trees (`planned` or `unavailable`) contains an authoritative `blockedReason` (e.g. pending backend RPC or smart contract migration), satisfying the zero-unaccounted-screen invariant.

### Deliverable 2: Visual Capture Harness
- **File:** [`e2e/board-conformity.spec.ts`](file:///c:/Users/user/Desktop/Tekgodfrey/truthbounty-frontend/e2e/board-conformity.spec.ts)
- **Deterministic Capture:**
  - Mock wallet/session state (`truthbounty_test_session`, `truthbounty_test_wallet`) injected prior to page loads.
  - Animations disabled (`reducedMotion: 'reduce'`, CSS animation/transition zeroing, font smoothing normalization).
  - Fixed virtual clocks and deterministic mock data.
  - Zero root horizontal overflow assertion (`scrollWidth <= clientWidth + 1`).
  - Accessibility checks executed alongside captures using `@axe-core/playwright`.

### Deliverable 3: Visual-Regression Configuration
- **File:** [`playwright.visual-conformity.config.ts`](file:///c:/Users/user/Desktop/Tekgodfrey/truthbounty-frontend/playwright.visual-conformity.config.ts)
- **Threshold Enforcement:**
  - Standard diff pixel ratio: `maxDiffPixelRatio: 0.002` (0.2%).
  - Upper hard limit: `0.005` (0.5%). Any threshold above 0.005 is rejected automatically.
  - Dynamic masks for non-deterministic elements (block hashes, live timestamps, wallet balances, streaming IDs).

### Deliverable 4: Conformity Verifier & Evidence Bundle Generator
- **File:** [`scripts/verify-board-conformity.mjs`](file:///c:/Users/user/Desktop/Tekgodfrey/truthbounty-frontend/scripts/verify-board-conformity.mjs)
- **Outputs:**
  - Machine-readable evidence bundle: [`reports/board-conformity-bundle.json`](file:///c:/Users/user/Desktop/Tekgodfrey/truthbounty-frontend/reports/board-conformity-bundle.json) with SHA-256 digest.
  - Human-readable reviewer summary: [`reports/board-conformity-summary.md`](file:///c:/Users/user/Desktop/Tekgodfrey/truthbounty-frontend/reports/board-conformity-summary.md).
- **Security Check:** Embedded secret scanner ensuring zero private keys, MNEMONIC phrases, or personal user data are written to bundles.

### Deliverable 5: Reviewer Guidance Documentation
- **File:** [`docs/BOARD_CONFORMITY_REVIEW_GUIDANCE.md`](file:///c:/Users/user/Desktop/Tekgodfrey/truthbounty-frontend/docs/BOARD_CONFORMITY_REVIEW_GUIDANCE.md)
- **Contents:**
  - Normative review instructions for PR approvers.
  - Invariant rules (e.g. accessibility primacy over pixel matches, 44×44px touch targets).
  - Explicit variance lifecycle requiring documented rationale, approval tickets, and expiration milestones.

---

## 3. Enforcement of Ticket Constraints

| Constraint | Enforcement Mechanism |
|---|---|
| **Pixel similarity cannot override accessibility or authoritative live state** | Both unit tests and E2E harness run `axe` accessibility evaluations concurrently with visual snapshotting; tests fail if WCAG 2.1 AA violations occur even with 100% visual match. |
| **Approved responsive behavior matters more than literal desktop scaling** | Capture harness tests 4 viewports including Mobile (`375x667`) and Zoom 200% (`640x900`), enforcing zero root horizontal scroll overflow and responsive drawer behavior. |
| **Variances require review; they must not be silently accepted** | Any `knownVariances` entry requires `varianceId`, `description`, `justification`, and `approvedBy`. Unapproved drift triggers validation failure. |
| **Missing route/state/viewport entries fail the evidence job** | `verify-board-conformity.mjs` validates 100% presence of all 58 boards, all 4 viewports, and canonical states. |
| **Masked regions and threshold changes require code review** | Masks must map to valid CSS selectors; thresholds above `0.005` are hard-rejected; threshold changes modify the manifest, forcing git review. |
| **Link bundles from implementation PRs without committing secrets** | Automated regex scanner inspects all bundle fields for cryptographic keys and secrets before bundle emission. Bundle stored as CI artifact. |

---

## 4. Verification & Test Suite Execution

### 1. Board Conformity Verification & Bundle Generation
```bash
npm run verify:board-conformity:bundle
```
**Result:**
- Verified all 58 protocol boards across 6 batches.
- Secret scan clean (0 leaks).
- Bundle SHA-256 digest: `98f419109c89c04992a215971774a5486fea2af629267bf1d02b219ee7a26d32`.

### 2. Manifest & Security Verification Tests
```bash
node --test scripts/__tests__/verify-board-conformity.test.mjs
```
**Result:** 14 passed, 0 failed.
- Extracts exactly 58 approved boards from protocol route authority.
- Validates clean production manifest.
- Rejects missing authority boards, unauthorized boards, and unpinned commits.
- Rejects missing viewports, missing canonical states, and excessive thresholds.
- Rejects non-implemented screens lacking explicit `blockedReason` records.
- Rejects undocumented variances.
- Validates secret detector catches simulated keys.
- Confirms bundle determinism and markdown summary emission.

### 3. Design System & Accessibility Integration Tests
```bash
npx jest src/__tests__/design-system/board-conformity.test.tsx
```
**Result:** 17 passed, 0 failed.
- Confirms 58-board authority mapping and 6-batch distribution.
- Confirms canonical routes map to approved boards.
- Confirms WCAG 2.1 AA compliance (zero violations via `jest-axe`) on all canonical system states (`loading`, `empty`, `stale`, `offline`, `unavailable`, `error`, `denied`, `not-found`, `AccessDeniedState`, `ApiStaleBanner`, `RouteErrorFallback`).

---

## 5. CI Workflow Integration

Updated [`.github/workflows/ci.yml`](file:///c:/Users/user/Desktop/Tekgodfrey/truthbounty-frontend/.github/workflows/ci.yml):
- Added `board-conformity` job executing `npm run verify:board-conformity:bundle`.
- Uploads `reports/` as a 30-day workflow artifact (`board-conformity-evidence-bundle`).
- Added `board-conformity` to `e2e` job dependencies, blocking merges if conformity fails.
- Integrated `verify:board-conformity` into `prebuild` in `package.json` to prevent building out-of-sync bundles.
