# Approved-Board Conformity Reviews & Visual Evidence Guidance

> **Document ID:** STAB-DOC-FE-004  
> **Issue Reference:** [UI-FE-093 (#664)](https://github.com/DigiNodes/truthbounty-frontend/issues/664)  
> **Authority Source:** [DigiNodes/truthbounty-protocol @ `60c66b78cf797d8f821089c99ae1bc461009fecc`](https://github.com/DigiNodes/truthbounty-protocol/commit/60c66b78cf797d8f821089c99ae1bc461009fecc)  
> **Status:** Normative Review Policy & CI Enforcement  
> **Scope:** All frontend routes, application shells, and canonical system states  

---

## 1. Executive Summary & Purpose

The protocol repository provides 58 approved high-fidelity vector boards across six design batches establishing the authoritative visual design for TruthBounty V2. Component-level unit and integration tests alone cannot prove that implemented screens adhere to these authoritative visual models without regression or visual drift.

This guidance establishes a **deterministic review artifact** and **evidence bundle** connecting every implemented route and canonical system state back to its governing protocol board authority.

```
┌────────────────────────────────────────────────────────────────────────┐
│               APPROVED-BOARD CONFORMITY PIPELINE                       │
├─────────────────────────┬──────────────────────┬───────────────────────┤
│ 1. Authority Manifest   │ 2. Deterministic     │ 3. CI Gate & Review   │
│    (58 Boards, 6 Batches)│    Capture Harness   │    Evidence Bundle    │
├─────────────────────────┼──────────────────────┼───────────────────────┤
│ • Pinned Commit         │ • Desktop (1440px)   │ • SHA-256 Digest      │
│ • Canonical Route Map   │ • Tablet (768px)     │ • Zero Secret Leak    │
│ • State Coverage        │ • Mobile (375px)     │ • A11y Verification   │
│ • Blocked Justification │ • 200% Zoom Reflow   │ • PR Markdown Table   │
└─────────────────────────┴──────────────────────┴───────────────────────┘
```

---

## 2. Pinned Authority & Six-Batch Architecture

All visual conformity is pinned to protocol commit `60c66b78cf797d8f821089c99ae1bc461009fecc`:

| Batch | Title | Directory | Boards |
| :---: | :--- | :--- | :---: |
| **Batch 1** | **Foundation Architecture, Tokens & Shells** | `designs/frontend-v2/foundation/boards/` | 8 |
| **Batch 2** | **Public Discovery & Claimant Lifecycle** | `designs/frontend-v2/public-claimant/boards/` | 11 |
| **Batch 3** | **Verifier Eligibility, Queue & Workspace** | `designs/frontend-v2/verifier-dispute/boards/` (01–07) | 7 |
| **Batch 4** | **Public Dispute Register & Appeal Resolution** | `designs/frontend-v2/verifier-dispute/boards/` (08–13) | 6 |
| **Batch 5** | **Privileged Operations & Governance Timelock** | `designs/frontend-v2/privileged/boards/` | 13 |
| **Batch 6** | **Support, Incident Status & Legal Compliance** | `designs/frontend-v2/support-legal/boards/` | 13 |
| **Total** | **Authoritative Approved Boards** | | **58** |

The manifest file at [`src/config/board-conformity-manifest.json`](file:///c:/Users/user/Desktop/Tekgodfrey/truthbounty-frontend/src/config/board-conformity-manifest.json) tracks all 58 boards. Every approved screen must have either:
1. An **implemented** evidence capture mapping; or
2. An **explicit blocked / planned / unavailable** record with documented rationale.

---

## 3. Core Constraints & Non-Negotiable Rules

Reviewers and pull request authors must enforce three foundational constraints:

### 3.1 Pixel similarity cannot override accessibility or authoritative live state
- A high pixel-similarity score (e.g. 99.8%) is invalid if the component compromises accessibility (WCAG 2.1 AA) or falsifies protocol state.
- Contrast ratios (4.5:1 text, 3:1 non-text), visible focus rings (`focus-visible:ring-2`), keyboard tab order, and ARIA live regions take precedence over identical pixel geometry.
- Live Optimism/EVM contract state is authoritative: the frontend **never fabricates** finality, optimistic settlements, or balances to match a mockup.

### 3.2 Approved responsive behavior matters more than literal desktop scaling
- Desktop layouts must not simply be scaled down or horizontally compressed onto narrow screens.
- Below 640px (`base` breakpoint), navigation must reflow into the accessible mobile drawer (`e2e/mobile-responsive.spec.ts`).
- Interactive targets must measure at least **44×44 CSS pixels** on touch viewports (WCAG 2.5.8).
- **Zero horizontal page scroll:** The root viewport must never produce a horizontal scrollbar (`scrollWidth <= clientWidth`). Data tables scroll within their own labelled, keyboard-accessible regions.

### 3.3 Variances require review; they must not be silently accepted
- Any intentional visual or structural difference between an SVG board and the browser implementation must be registered in the manifest under `knownVariances`.
- Each variance requires:
  - Unique ID (e.g. `VAR-01-LANDING-ANTIALIAS`)
  - Semantic category (`typography-rendering`, `responsive-behavior`, `mock-isolation`)
  - Detailed description and technical justification
  - Approving maintainer and timestamp
- Undocumented variances fail CI automatically.

---

## 4. Viewport & Dynamic Masking Specifications

Every implemented board is captured across four standard viewports:

| Viewport | Dimensions | Scale | Reflow Contract |
| :--- | :---: | :---: | :--- |
| **Desktop** | `1440 × 900` | 1x | Persistent sidebar, 2-column verification/action rail |
| **Tablet** | `768 × 1024` | 1x | 3-column stats cards, drawer navigation, modal `max-w-lg` |
| **Mobile** | `375 × 812` | 1x | Single column stack, full-width buttons (44px min), drawer navigation |
| **200% Zoom** | `1440 × 900` | 2x | Reflow into single column stream without text clipping (WCAG 1.4.4 & 1.4.10) |

### Dynamic Data Masking
To prevent nondeterministic visual drift caused by dynamic data, the capture harness applies standard CSS masking:

- **Masked elements:**
  - `[data-mask="dynamic-data"]` (general dynamic container)
  - `[data-testid*="hash"]` (transaction hashes, block hashes)
  - `[data-testid*="timestamp"]`, `time` (clock dates, relative timestamps)
  - `[data-testid*="block-number"]` (block heights)
  - `[data-testid*="countdown"]` (safe chain deadline timers)
  - `[class*='animate-pulse']`, `[class*='animate-spin']` (shimmers and spinners)
  - `.wallet-dynamic-balance` (fluctuating wallet balances)
- **Masking appearance:** Masked elements render with neutral gray fill (`#374151`), transparent text, and disabled animations.

---

## 5. Reviewer Checklist for Pull Requests

When reviewing pull requests that touch routes, components, or layout styles:

1. **Verify Evidence Bundle Presence:**
   - Ensure the PR description links or embeds the output of `reports/board-conformity-summary.md`.
   - Confirm the bundle SHA-256 digest is recorded.

2. **Check for Unapproved Visual Drift:**
   - Are any screenshot diffs flagged in Playwright / Chromatic?
   - If diffs exist, are they intentional design improvements or accidental regressions?

3. **Audit Masked Regions & Thresholds:**
   - Any modification to `diffThreshold` or `maskedRegions` requires explicit code review.
   - Thresholds must never exceed the global cap of **0.5% (0.005)**.
   - Dynamic masks must strictly target variable data (timestamps, hashes), never entire functional cards.

4. **Review Documented Variances:**
   - Are newly introduced variances recorded in `src/config/board-conformity-manifest.json`?
   - Is the justification sound, and does it reference accessibility or responsive necessity?

5. **Confirm Zero Secrets Leaked:**
   - Evidence bundles must contain no private keys, seed phrases, or sensitive API tokens.

---

## 6. Developer Commands

```bash
# 1. Run the board conformity verification check
pnpm verify:board-conformity

# 2. Generate the deterministic review bundle and markdown PR summary
pnpm verify:board-conformity:bundle

# 3. Run unit tests for the conformity gate
pnpm test:board-conformity

# 4. Run Jest integration and accessibility tests
pnpm test src/__tests__/design-system/board-conformity.test.tsx

# 5. Run Playwright visual conformity captures (requires running server)
pnpm test:e2e:visual-conformity
```
