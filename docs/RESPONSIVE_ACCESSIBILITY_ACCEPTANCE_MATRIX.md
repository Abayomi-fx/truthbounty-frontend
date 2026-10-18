# Responsive and Accessibility Acceptance Matrix

> **Document ID:** STAB-DOC-FE-002  
> **Linked Issue:** [#435](https://github.com/DigiNodes/truthbounty-frontend/issues/435)  
> **Status:** Implementation Baseline / Normative Acceptance Matrix  
> **Authority:** Frontend / UX & Accessibility Maintainers  
> **Companion Documents:**
> - [Component State Inventory (`docs/COMPONENT_STATE_INVENTORY.md`)](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/docs/COMPONENT_STATE_INVENTORY.md) (STAB-DOC-FE-003)
> - [Responsive Workflows (`docs/ux/RESPONSIVE_WORKFLOWS.md`)](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/docs/ux/RESPONSIVE_WORKFLOWS.md) (V2-FE-128)
> - [Accessibility CI Guide (`docs/accessibility-ci.md`)](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/docs/accessibility-ci.md)
> - [Keyboard Navigation (`docs/keyboard-navigation.md`)](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/docs/keyboard-navigation.md)
> - [Design System (`docs/ux/DESIGN_SYSTEM.md`)](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/docs/ux/DESIGN_SYSTEM.md) (V2-FE-121)
> - [Information Architecture (`docs/ux/INFORMATION_ARCHITECTURE.md`)](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/docs/ux/INFORMATION_ARCHITECTURE.md)
> - [Frontend UI State Model (`docs/UI_STATE_MODEL.md`)](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/docs/UI_STATE_MODEL.md) (V2-FE-140)
> - [Privileged Separation Evidence (`docs/UI-FE-033-PRIVILEGED-SEPARATION-EVIDENCE.md`)](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/docs/UI-FE-033-PRIVILEGED-SEPARATION-EVIDENCE.md) (#603)
> - [WCAG 2.1 AA Audit (`docs/pr-a11y-wcag-aa.md`)](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/docs/pr-a11y-wcag-aa.md) (#FE-MATURE-001)

---

## 1. Executive Summary & Purpose

The purpose of this acceptance matrix is to translate maintainer-approved screen architecture, role dashboards, and golden user journeys into an exhaustive, testable specification for **responsiveness** and **accessibility (a11y)** across the TruthBounty V2 frontend.

TruthBounty is a decentralized public-good protocol on Optimism/EVM where users inspect disputed news claims, verify evidence, commit financial stakes, track consensus epochs, and manage protocol treasuries. In this domain:
- **No uncertainty may be concealed:** Protocol loading, pending mempool inclusion, reorg rollback, and revert states must be explicitly announced to assistive technologies and rendered legibly on viewports from 320px mobile phones to 4K desktop displays.
- **No permission model or visual design is invented:** All matrix specifications derive directly from canonical contracts, physical codebase components, and maintainer-approved UX documentation.
- **Testable distinctions:** Automated gates (lint, static analysis, unit axe tests, e2e browser assertions) are strictly distinguished from necessary human manual evaluation steps (screen reader speech verification, physical touch target ergonomics, high-contrast visual inspection).

---

## 2. Normative Standards & Universal Accessibility Contract

All user-facing surfaces in TruthBounty must satisfy **WCAG 2.1 Level AA** (with targeted WCAG 2.2 criteria including 2.5.8 Target Size Minimum) and conform to the following universal invariants:

### 2.1 WCAG Compliance Mapping

| WCAG Criterion | Level | Scope in TruthBounty | Measurable Requirement |
|---|---|---|---|
| **1.1.1 Non-text Content** | A | Icons, Badges, Charts, Skeletons | All decorative SVGs must have `aria-hidden="true"`. Informative icons (e.g. status badge icons) must pair with visible text or explicit `<span class="sr-only">`. Charts must supply programmatic summary fallback via `aria-label` or description. |
| **1.3.1 Info and Relationships** | A | Tables, Lists, Form Controls, Landmarks | Form inputs must have programmatically associated `<label>` tags with matching `htmlFor` / `id`. Tables must provide `<thead>`, `<th>` with `scope="col"`, and tabular data cells. Modal and drawer dialogs must use `role="dialog"` or `role="alertdialog"` with `aria-modal="true"`. |
| **1.3.2 Meaningful Sequence** | A | DOM Order vs Visual Order | DOM source order must match visual reading order across all screen sizes. Mobile collapse into drawers or stacked columns must maintain sequential reading logic without out-of-order tab hopping. |
| **1.4.1 Use of Color** | A | Status Badges, Health Indicators | Color is never used as the sole conveyor of information. All status badges (e.g., `StatusBadge.tsx`) combine color with distinct typography and unique icon glyphs. |
| **1.4.3 Contrast (Minimum)** | AA | Text & Typography | Text and images of text must have a contrast ratio of at least **4.5:1** for standard text and **3:1** for large text (≥18pt or 14pt bold) across both light and dark themes. |
| **1.4.4 Resize Text** | AA | Browser Zoom up to 200% | Text must be resizable up to 200% without assistive technology and without loss of content or functionality. No fixed `px` font sizes that bypass browser font settings. |
| **1.4.10 Reflow** | AA | Viewport reflow down to 320px | Content must reflow without loss of information and without requiring scrolling in two dimensions (no horizontal page scrolling) down to 320 CSS pixels wide (equivalent to 400% zoom on 1280px desktop). Genuine data tables may scroll horizontally within a dedicated scroll region. |
| **1.4.11 Non-text Contrast** | AA | Borders, Buttons, Focus Indicators | Visual information used to identify UI components and states (input borders, active tab outlines, toggle switches) must maintain at least **3:1** contrast against adjacent backgrounds. |
| **2.1.1 Keyboard** | A | All Interactive Controls | All functionality must be operable through a keyboard interface without requiring specific timings for individual keystrokes. |
| **2.1.2 No Keyboard Trap** | A | Modals, Drawers, Dialogs | Focus must not be trapped within any sub-component unless explicitly bound within an active modal dialog, which must allow escape via the `Escape` key. |
| **2.2.1 Timing Adjustable** | A | Blockchain Deadlines, Stale Warnings | Verification windows, challenge timeouts, and countdown timers (`SafeChainDeadline.tsx`) are on-chain block constraints. The UI must clearly display remaining blocks/time and update dynamically without unexpected session expiration. |
| **2.3.3 Animation from Interactions** | AAA / V2 Target | Motion & Shimmer | All animations, spinners, and pulse effects must respect `prefers-reduced-motion: reduce` and degrade immediately to static indicators via `MotionSafeStatus` or `motion-reduce:animate-none`. |
| **2.4.1 Bypass Blocks** | A | Navigation & Layout | A "Skip to main content" link must be the first focusable element on every page, jumping directly to `<main id="main-content" role="main">`. |
| **2.4.2 Page Titled** | A | Route Metadata | Every page route must supply a descriptive, unique `<title>` indicating context and status (e.g. `Claim #104 — TruthBounty`). |
| **2.4.3 Focus Order** | A | Dialogs, Forms, Wizards | When a modal dialog opens, focus must transition to the first focusable interactive element. When closed, focus must be restored to the triggering element. |
| **2.4.4 Link Purpose** | A | External & Protocol Links | All external links (e.g. block explorer links, IPFS citations) must declare destination context and include "(opens in new tab)" within `aria-label` or visible text. |
| **2.4.7 Focus Visible** | AA | Interactive Elements | Any keyboard-operable user interface must have a visible focus indicator with at least 3:1 contrast against surrounding surfaces (`focus-visible:ring-2 focus-visible:ring-blue-500`). |
| **2.5.3 Label in Name** | A | Action Buttons | For UI components with labels that include text or images of text, the accessible name must contain the string that is presented visually. |
| **2.5.8 Target Size (Minimum)** | AA | Touch Viewports | Interactive targets must measure at least **44×44 CSS pixels** on touch viewports (`min-h-[44px] min-w-[44px]`), preventing mis-taps. |
| **3.2.1 On Focus & 3.2.2 On Input** | A | Forms & Filters | Receiving focus or changing an input value must not initiate unexpected context changes (e.g., auto-submitting transactions or unexpected navigation). |
| **3.3.1 Error Identification** | A | Form Validation & Reverts | If an input error is detected, the item in error is identified and the error is described to the user in text via `role="alert"` or `aria-describedby`. |
| **3.3.2 Labels or Instructions** | A | Form Inputs | Clear labels, placeholder constraints, and balance thresholds must be provided when content requires user input. |
| **3.3.4 Error Prevention** | AA | Financial Transactions | Protocol transactions (stakes, verifications, claims, treasury withdrawals) must provide review confirmation, explicit parameter summaries, and irreversible action confirmations. |
| **4.1.2 Name, Role, Value** | A | Custom Components | Custom controls (switches, dialogs, status badges, tooltips) must expose correct ARIA roles, states, and properties (`aria-expanded`, `aria-checked`, `aria-busy`, `aria-hidden`). |
| **4.1.3 Status Messages** | AA | Live Regions & Realtime | Asynchronous state updates (fetching, pending mempool inclusion, receipt confirmed, WebSocket sync) must use `role="status"` (`aria-live="polite"`) or `role="alert"` (`aria-live="assertive"`). |

---

### 2.2 Breakpoint Taxonomy & Responsive Rules

The frontend strictly enforces Tailwind CSS default breakpoints without custom deviation:

| Breakpoint | Width (px) | Device Class | Primary Layout Behavior | Navigation Model |
|---|---|---|---|---|
| **Base** | `< 640px` | Mobile Phone | Single column vertical stack; full-width CTA buttons; secondary status chips collapsed; multi-column stats wrap into 2 columns. | Collapsible modal drawer triggered by fixed hamburger button (`lg:hidden`). Escape key closes drawer and restores focus. |
| **`sm`** | `≥ 640px` | Large Phone / Phablet | Filter chips wrap horizontally; search input expands; topbar displays wallet address + theme toggle. | Drawer navigation remains active. |
| **`md`** | `≥ 768px` | Tablet | 3-column metric cards; modal dialogs constrained to `max-w-lg`; form rows display side-by-side inputs where appropriate. | Drawer navigation remains active; header displays full network & sync indicators. |
| **`lg`** | `≥ 1024px` | Desktop / Laptop | 2-column layout for claim verification (`lg:grid-cols-[minmax(0,1fr)_360px]`); contextual sticky action rail enabled. | Persistent 256px sidebar visible; hamburger menu hidden. |
| **`xl`** | `≥ 1280px` | Wide Desktop | Full 6-column metric display (`xl:grid-cols-6`); expanded queue and audit tables. | Persistent sidebar with full navigation labels and pending transaction counters. |

#### Universal Responsiveness Rules:
1. **Zero Horizontal Page Scroll:** The viewport must never produce a root horizontal scrollbar (`overflow-x: hidden` on root container). Only genuine data tables with numerous columns may render an internal horizontal scroll container, which must be keyboard navigable (`tabIndex={0}`, `role="region"`).
2. **Protocol State Never Hidden:** Critical state indicators (Loading, Error, Pending, Confirmed, Finalized, Reorged, Stale, Wrong Chain) must remain visible and programmatically announced at every breakpoint. Only non-essential secondary badges or decorative icons may collapse.
3. **Touch Manipulation:** All touch targets must provide `touch-action: manipulation` and measure at least `44×44px` to eliminate mobile double-tap delays and mis-clicks.

---

## 3. Approved Screens Acceptance Matrix

Below is the exhaustive matrix of all maintainer-approved screens and entrypoints across the TruthBounty frontend.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TRUTHBOUNTY SCREEN MAP                          │
├─────────────────────────┬──────────────────────┬───────────────────────┤
│ Contributor Screens     │ Role Dashboards      │ Protocol & Utilities  │
├─────────────────────────┼──────────────────────┼───────────────────────┤
│ • Dashboard (/)         │ • Verifier (/verifier)│ • How It Works       │
│ • Claims Feed (/claims) │ • Admin (/admin)     │ • Identity (/identity)│
│ • Claim Detail ([id])   │ • Treasury (/treasury│ • Redirects          │
│ • Claim New (/claims/new│ • Stake Treasury     │ • Layout & Modals    │
│ • Disputes (/disputes)  │   (/treasury/stake)  │                       │
│ • Rewards (/rewards)    │                      │                       │
└─────────────────────────┴──────────────────────┴───────────────────────┘
```

---

### 3.1 Dashboard Overview (`/`)

- **Route:** `/`
- **Entrypoint:** [`src/app/(dashboard)/page.tsx`](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/src/app/(dashboard)/page.tsx)
- **Primary Consumed Components:** `MainLayout`, `StatsCards`, `ClaimRewardsPanel`, `ActivityAndNodes`, `VerificationNodes`, `ActiveClaimsTable`, `DashboardSkeleton`

| Specification Domain | Acceptance Criteria & Measurable Requirements | WCAG Criteria | Verification Type |
|---|---|---|---|
| **Keyboard Order & Focus Transitions** | 1. Skip link (`#main-content`) is first focusable element.<br>2. Focus descends from Topbar (Wallet connection -> Network selector -> Theme toggle) to Page Header.<br>3. Focus traverses metric cards (`StatsCards`), then `ClaimRewardsPanel` CTA button.<br>4. Tab navigates to `ActiveClaimsTable` search input -> filter pills -> sort buttons -> table rows.<br>5. Table body rows are individually focusable; Enter/Space activates claim navigation.<br>6. Focus moves to `ActivityAndNodes` interactive chart tooltips -> `VerificationNodes` "View All" button. | 2.1.1, 2.4.1, 2.4.3, 2.4.7 | **Automated:** Jest DOM tab sequence test.<br>**Manual:** Keyboard-only navigation with visible ring verification. |
| **Accessible Names & Landmarks** | 1. `<main id="main-content" role="main">` wraps core content.<br>2. Single `<h1>` with text "TruthBounty Protocol Dashboard".<br>3. `<h2>` tags for sections: "Protocol Metrics", "Rewards Overview", "Active Claims Feed", "Network Activity".<br>4. Each stats card has explicit `aria-label` (e.g. `aria-label="Total Value Locked: $1,240,500"`).<br>5. Search input has `<label for="claim-search" class="sr-only">Search claims by title or address</label>`.<br>6. Filter chips declare `role="button"` and `aria-pressed="true|false"`. | 1.3.1, 2.4.6, 4.1.2 | **Automated:** `eslint-plugin-jsx-a11y`, `jest-axe` landmark scan.<br>**Manual:** NVDA landmark speech review. |
| **Tables & Data Structures** | 1. `ActiveClaimsTable` wrapped in container with `role="region"`, `tabIndex={0}`, and `aria-label="Active claims table, scrollable horizontally"`.<br>2. `<table>` has explicit `<caption>Active protocol verification claims</caption>` (visually hidden if needed).<br>3. Headers use `<th scope="col">` with sort indicators using `aria-sort="ascending|descending|none"`.<br>4. Numeric cells use `.tb-data` (tabular numerals) for predictable character width. | 1.3.1, 1.4.10, 4.1.2 | **Automated:** Axe table ruleset (`aria-required-children`, `th-has-data-cells`).<br>**Manual:** NVDA table reading shortcuts (Ctrl+Alt+Arrows). |
| **Loading, Error & Live Regions** | 1. `DashboardSkeleton` exposes `role="status"` and `aria-busy="true"` with `<span class="sr-only">Loading dashboard metrics and active claims...</span>`.<br>2. Stale projection alert renders via `ApiStaleBanner` with `role="status"` and `aria-live="polite"`.<br>3. WebSocket reconnection triggers announcement in `WebSocketStatus` (`role="status" aria-live="polite"`).<br>4. API query crash caught by `FallbackBoundary` rendering sanitized error card with retry button (`role="alert"`). | 1.3.1, 4.1.3 | **Automated:** `verify-accessibility.mjs` live region scanner.<br>**Manual:** Simulated offline network transition in browser devtools. |
| **Layout & Breakpoints** | 1. **Base (<640px):** Single column. `StatsCards` renders as a 2-column grid (`grid-cols-2`). Table renders within its dedicated horizontal scroll region with min-width 640px. Filter pills wrap onto multiple lines.<br>2. **Tablet (`md` 768px):** Stats grid expands to 3 columns (`md:grid-cols-3`). Search and filter pills share a single horizontal row.<br>3. **Desktop (`lg`/`xl` ≥1024px):** Persistent sidebar visible; stats cards expand to 6 columns (`xl:grid-cols-6`). Zero horizontal scroll across page. | 1.4.10, 2.5.5 | **Automated:** Playwright viewport test (`e2e/mobile-responsive.spec.ts`).<br>**Manual:** Viewport resizing from 320px to 2560px. |
| **Zoom, Motion, Contrast & Targets** | 1. **200% Zoom:** Layout reflows into single column without clipping text or dropping buttons.<br>2. **Reduced Motion:** Skeleton shimmer animations and chart transitions disabled when `prefers-reduced-motion: reduce` is active.<br>3. **Contrast:** Text meets 4.5:1 ratio; table row hover background meets 3:1 contrast against text.<br>4. **Touch Targets:** All filter chips and table row action buttons have minimum dimensions of 44×44px (`min-h-[44px]`). | 1.4.3, 1.4.4, 2.3.3, 2.5.8 | **Automated:** Lighthouse a11y score ≥ 95, contrast scan.<br>**Manual:** OS-level high contrast mode and 200% browser zoom verification. |

---

### 3.2 Claim Detail & Verification (`/claims/[id]`)

- **Route:** `/claims/[id]`
- **Entrypoint:** [`src/app/(dashboard)/claims/[id]/page.tsx`](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/src/app/(dashboard)/claims/[id]/page.tsx)
- **Primary Consumed Components:** `ClaimDetails`, `EvidenceViewer`, `StakeForm`, `VerificationActions`, `ClaimLifecycleTimeline`, `TransactionStatus`, `SafeChainDeadline`, `FeatureErrorBoundary`

| Specification Domain | Acceptance Criteria & Measurable Requirements | WCAG Criteria | Verification Type |
|---|---|---|---|
| **Keyboard Order & Focus Transitions** | 1. Skip link bypasses breadcrumb and lands on Claim Title (`<h1>`).<br>2. Tab order: Breadcrumb back link -> Claim Header -> Status Badge -> Bounty Summary -> Evidence Accordion -> Timeline items -> Stake Amount Input -> Approve/Verify Buttons.<br>3. Evidence accordion expands/collapses via Space/Enter with `aria-expanded` toggle.<br>4. When StakeForm triggers token approval, focus moves directly to `ApprovalButton`, then advances to `VerificationActions` upon confirmation. | 2.1.1, 2.4.3, 2.4.7 | **Automated:** Jest unit tests on StakeForm and EvidenceViewer.<br>**Manual:** Keyboard flow through full verification sequence without mouse. |
| **Accessible Names & Landmarks** | 1. Main container marked as `<article role="article" aria-labelledby="claim-heading">`.<br>2. `<h1>` id="claim-heading" contains the full verbatim claim statement.<br>3. Status badge exposes text label plus assistive description (`aria-describedby="status-meaning"`).<br>4. External evidence links include `aria-label="View evidence source at [domain] (opens in new tab)"` and `rel="noopener noreferrer"`.<br>5. Decorative icons (thumbs up/down, shield, external link) marked `aria-hidden="true"`. | 1.1.1, 1.3.1, 2.4.4, 4.1.2 | **Automated:** ESLint `jsx-a11y/anchor-is-valid`, `jest-axe`.<br>**Manual:** Screen reader inspection of evidence links. |
| **Transaction & Live Announcements** | 1. Stake transaction states announce via live region:<br>   - Simulating: `role="status" aria-busy="true"` "Simulating verification transaction..."<br>   - Pending: `role="status"` "Transaction submitted to mempool with hash 0x... awaiting block inclusion."<br>   - Confirming: `role="status"` "Transaction confirmed in block #... accumulating finality confirmations."<br>   - Finalized: `role="status"` "Verification finalized on Optimism canonical chain."<br>   - Revert/Fail: `role="alert" aria-live="assertive"` "Verification transaction reverted: [sanitized reason]. Your stake was not committed."<br>2. SafeChainDeadline announces remaining blocks and deadline countdown politely. | 1.3.1, 3.3.1, 4.1.3 | **Automated:** `src/__tests__/accessibility/transaction-states.test.tsx`.<br>**Manual:** Live mock verification with screen reader audio recording. |
| **Layout & Breakpoints** | 1. **Base (<640px):** Single column. Claim title wraps with `break-words`. Status badge sits on separate row. Verify (green) and Reject (red) buttons stack vertically with `w-full` and 44px min-height.<br>2. **Tablet (`md` 768px):** Verify and Reject buttons sit side-by-side with `flex-1`. Evidence preview displays 2-column image/document grid.<br>3. **Desktop (`lg` ≥1024px):** 2-column layout: left column contains Statement, EvidenceViewer, and LifecycleTimeline; right column contains sticky action rail (`StakeForm`, `VerificationActions`, `AllowanceDisplay`). | 1.4.10, 2.5.5 | **Automated:** Playwright mobile screenshot comparison.<br>**Manual:** Touch viewport testing on iOS Safari and Android Chrome. |
| **Zoom, Motion, Contrast & Targets** | 1. **200%/400% Zoom:** Sticky action rail unpins and reflows into single document stream below content to prevent overlapping text.<br>2. **Reduced Motion:** Timeline pulse dots convert to solid static glyphs (`MotionSafeStatus`).<br>3. **Contrast:** Stake input text, labels, and balance helper text exceed 4.5:1 ratio.<br>4. **Touch Targets:** Verify/Reject buttons measure 48px height (`h-12`). | 1.4.3, 1.4.10, 2.3.3, 2.5.8 | **Automated:** `jest-axe` color contrast verification.<br>**Manual:** Chrome Zoom set to 400% at 1280px resolution. |

---

### 3.3 Claim Submission Wizard (`/claims/new`)

- **Route:** `/claims/new` (and modal variant rendered from Topbar)
- **Entrypoint:** [`src/app/(dashboard)/claims/new/page.tsx`](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/src/app/(dashboard)/claims/new/page.tsx)
- **Primary Consumed Components:** `ClaimSubmissionForm`, `ClaimWorkflowReadinessGate`, `AllowanceDisplay`, `ApprovalButton`, `Button`, `Input`

| Specification Domain | Acceptance Criteria & Measurable Requirements | WCAG Criteria | Verification Type |
|---|---|---|---|
| **Keyboard Order & Focus Transitions** | 1. When rendered as modal dialog, initial focus transitions immediately to first form input (Claim Title).<br>2. Focus cycle is strictly trapped inside dialog: Tab from last button (Submit/Cancel) loops to first input; Shift+Tab from first input loops to Cancel button.<br>3. `Escape` key closes modal immediately and returns focus to "Submit Claim" CTA button in header.<br>4. Wizard step progression (Step 1: Statement -> Step 2: Evidence -> Step 3: Bond Review) moves focus to the step's primary heading (`<h2>`). | 2.1.1, 2.1.2, 2.4.3, 2.4.7 | **Automated:** `src/__tests__/accessibility/modals.test.tsx` (focus trap & escape assertions).<br>**Manual:** Keyboard-only wizard completion with Tab/Escape validation. |
| **Accessible Names & Landmarks** | 1. Modal wrapper has `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="submit-claim-modal-title"`.<br>2. `<h2>` id="submit-claim-modal-title" reads "Submit New Truth Claim".<br>3. Wizard step indicator marked with `role="navigation"` and `aria-label="Submission steps"`. Current step marked `aria-current="step"`.<br>4. Form inputs have explicit `<label>` tags with `aria-required="true"`.<br>5. Character counters have `aria-live="polite"` announcing remaining characters upon threshold milestones (e.g. 50 characters left). | 1.3.1, 2.4.6, 4.1.2 | **Automated:** Axe form element audit.<br>**Manual:** Screen reader step announcements across wizard progression. |
| **Validation, Error & Submission Alerts** | 1. Inline validation errors link to inputs via `aria-describedby="[input-id]-error"`.<br>2. Form submission with invalid fields moves focus automatically to the first invalid input with `aria-invalid="true"`.<br>3. IPFS file upload progress announced via `role="progressbar" aria-valuenow="X" aria-valuemin="0" aria-valuemax="100"`.<br>4. Insufficient token balance or allowance displays persistent error banner (`role="alert"`). | 3.3.1, 3.3.2, 3.3.3, 4.1.3 | **Automated:** Unit tests asserting `aria-invalid` on empty submit.<br>**Manual:** Submitting empty form with screen reader active. |
| **Layout & Breakpoints** | 1. **Base (<640px):** Modal expands to full viewport width with 16px padding (`w-[calc(100vw-32px)]`). Wizard step indicators stack vertically or render as compact numeric text ("Step 2 of 3"). Buttons stack with `flex-col-reverse` (Cancel below Submit).<br>2. **Tablet (`md` 768px):** Modal width locks to `max-w-xl`. Action buttons sit side-by-side (`flex-row justify-end gap-3`).<br>3. **Desktop (`lg` ≥1024px):** When displayed on standalone route `/claims/new`, renders inside standard `MainLayout` with centered container (`max-w-3xl`). | 1.4.10, 2.5.5 | **Automated:** Playwright modal size assertions on mobile emulators.<br>**Manual:** Verifying no button clipping on iPhone SE (375px). |
| **Zoom, Motion, Contrast & Targets** | 1. **200% Zoom:** Modal body becomes internally scrollable (`overflow-y-auto max-h-[80vh]`), keeping header and footer reachable without breaking viewport.<br>2. **Reduced Motion:** Step transition sliding animations disabled (`transition-none`).<br>3. **Contrast:** Input borders meet 3:1 contrast in dark mode (`border-zinc-700` against `bg-zinc-900`).<br>4. **Touch Targets:** Inputs have minimum height of 44px (`h-11`); file upload dropzone provides minimum 44px touchable surface. | 1.4.3, 1.4.11, 2.3.3, 2.5.8 | **Automated:** Axe contrast checks.<br>**Manual:** Testing file dropzone tapping on Android device. |

---

### 3.4 Disputes & Appeals Hub (`/disputes`)

- **Route:** `/disputes`
- **Entrypoint:** [`src/app/(dashboard)/disputes/page.tsx`](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/src/app/(dashboard)/disputes/page.tsx)
- **Primary Consumed Components:** `DisputeVoting`, `OpenDispute`, `useAppealParticipation`, `TimeRemainingNotice`, `Card`, `StatusBadge`

| Specification Domain | Acceptance Criteria & Measurable Requirements | WCAG Criteria | Verification Type |
|---|---|---|---|
| **Keyboard Order & Focus Transitions** | 1. Skip link reaches Dispute Hub Header.<br>2. Tab order: Search & dispute filters -> Active dispute cards -> Dispute action buttons ("Vote", "Challenge Verdict", "View Evidence").<br>3. Dispute challenge modal traps focus; Tab stays within dispute round stake input and confirmation buttons.<br>4. Esc closes dispute participation modal and restores focus to triggering card button. | 2.1.1, 2.1.2, 2.4.3 | **Automated:** Jest modal focus tests.<br>**Manual:** Dispute flow navigation with keyboard alone. |
| **Accessible Names & Landmarks** | 1. `<main>` landmark with `<h1>Disputes & Community Appeals</h1>`.<br>2. Section headings `<h2>Active Voting Rounds</h2>`, `<h2>Pending Appeals</h2>`.<br>3. Dispute voting buttons have explicit accessible names: `aria-label="Vote to Uphold Claim #120"` and `aria-label="Vote to Overturn Claim #120"`.<br>4. Voting progress bars declare `role="meter"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, and `aria-label="Voting consensus ratio"`. | 1.3.1, 2.4.4, 4.1.2 | **Automated:** Axe accessibility audit.<br>**Manual:** Screen reader announcement of vote distribution bars. |
| **Announcements & Timers** | 1. Challenge round countdown uses `TimeRemainingNotice` with monotonic timer update; announces remaining time politely every 5 minutes rather than every second (`aria-live="polite"`).<br>2. Dispute stake submission announces mempool pending state and finality resolution via `role="status"`.<br>3. Reorg detection triggers `role="alert"` announcing re-calculation of appeal round threshold. | 2.2.1, 4.1.3 | **Automated:** Unit tests on `TimeRemainingNotice`.<br>**Manual:** Verification that timer does not spam screen reader speech queue. |
| **Layout & Breakpoints** | 1. **Base (<640px):** Dispute cards stack vertically. Vote buttons display as full-width grid (`grid-cols-1 gap-2`). Challenge stake input occupies 100% card width.<br>2. **Tablet (`md` 768px):** Vote buttons arrange into 2-column grid (`grid-cols-2`). Dispute cards render 2-across.<br>3. **Desktop (`lg` ≥1024px):** 3-column dispute card grid with persistent sidebar navigation. | 1.4.10, 2.5.5 | **Automated:** Playwright breakpoint test.<br>**Manual:** Tablet responsive layout inspection in Chrome devtools. |
| **Zoom, Motion, Contrast & Targets** | 1. **200% Zoom:** Cards wrap cleanly into single column without truncation of dispute stake values.<br>2. **Reduced Motion:** Vote progress bar transition animations disabled.<br>3. **Contrast:** Uphold (emerald) and Overturn (rose) badges maintain 4.5:1 text contrast and 3:1 badge border contrast.<br>4. **Touch Targets:** All vote and challenge buttons exceed 44×44px. | 1.4.3, 1.4.11, 2.3.3, 2.5.8 | **Automated:** Lighthouse audit.<br>**Manual:** Visual verification of text legibility on mobile. |

---

### 3.5 Protocol Rewards Center (`/rewards`)

- **Route:** `/rewards`
- **Entrypoint:** [`src/app/(dashboard)/rewards/page.tsx`](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/src/app/(dashboard)/rewards/page.tsx)
- **Primary Consumed Components:** `ClaimRewardsPanel`, `RewardsClaimFlow`, `TokenAmount`, `StatusBadge`, `Button`

| Specification Domain | Acceptance Criteria & Measurable Requirements | WCAG Criteria | Verification Type |
|---|---|---|---|
| **Keyboard Order & Focus Transitions** | 1. Skip link enters Rewards Overview.<br>2. Tab order: Accumulated Rewards Summary -> Epoch History Table -> Claim All Rewards Button -> External Explorer Receipt Links.<br>3. When "Claim All Rewards" is triggered, focus stays on the button while showing loading spinner, then shifts to transaction status confirmation link upon mining. | 2.1.1, 2.4.3, 2.4.7 | **Automated:** Component unit tests.<br>**Manual:** Keyboard flow through rewards claim transaction. |
| **Accessible Names & Landmarks** | 1. `<main>` landmark with `<h1>Protocol Rewards & Entitlements</h1>`.<br>2. Reward balance container marked with `role="region" aria-label="Accumulated claimable balance"`.<br>3. Token amounts render through `TokenAmount.tsx` with `aria-label="[amount] TRUTH tokens"`.<br>4. Block explorer transaction receipts have `aria-label="View reward payout transaction [hash] on Optimism explorer (opens in new tab)"`. | 1.3.1, 2.4.4, 4.1.2 | **Automated:** Axe scan on rewards panel.<br>**Manual:** VoiceOver verification on macOS Safari. |
| **Loading, Error & Live Announcements** | 1. Unclaimed balance loading state renders skeleton with `role="status" aria-busy="true"`.<br>2. Reward claim transaction states:<br>   - Pending: `role="status"` "Claiming rewards... Transaction submitted to mempool."<br>   - Confirmed: `role="status"` "Rewards successfully transferred to your wallet."<br>   - Error: `role="alert"` "Reward claim reverted: [reason]. No funds were deducted."<br>3. Zero balance empty state exposes neutral announcement (`role="status"` "No claimable rewards for the connected wallet at this epoch"). | 1.3.1, 4.1.3 | **Automated:** `src/__tests__/accessibility/rewards.test.tsx`.<br>**Manual:** Mocking zero rewards and active rewards with screen reader. |
| **Layout & Breakpoints** | 1. **Base (<640px):** Header stacks vertically (`flex-col`). Total earned balance and "Claim All" button span full width (`w-full`). Historical payouts table scrolls horizontally inside labelled container.<br>2. **Tablet (`md` 768px):** Header aligns horizontally (`flex-row justify-between`). Metrics display in 2 columns.<br>3. **Desktop (`lg` ≥1024px):** Full-width ledger layout with persistent sidebar. | 1.4.10, 2.5.5 | **Automated:** Playwright responsive test.<br>**Manual:** Checking mobile viewport padding and tap spacing. |
| **Zoom, Motion, Contrast & Targets** | 1. **200% Zoom:** Balance typography scales without overlapping claim button.<br>2. **Reduced Motion:** Counter animation from zero to earned balance is instantaneous when reduced motion is preferred.<br>3. **Contrast:** Gold/amber reward token amounts maintain 4.5:1 contrast against dark card background.<br>4. **Touch Targets:** "Claim All" button provides minimum 48px height. | 1.4.3, 1.4.4, 2.3.3, 2.5.8 | **Automated:** Jest contrast checks.<br>**Manual:** Browser zoom test at 200%. |

---

### 3.6 Identity & Humanity Verification (`/identity`)

- **Route:** `/identity`
- **Entrypoint:** [`src/app/(dashboard)/identity/page.tsx`](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/src/app/(dashboard)/identity/page.tsx)
- **Primary Consumed Components:** `WorldcoinVerificationPanel`, `WorldcoinVerifyButton`, `VerificationStatusIndicator`, `TrustIndicator`, `TrustScoreTooltip`, `TrustExplanationModal`

| Specification Domain | Acceptance Criteria & Measurable Requirements | WCAG Criteria | Verification Type |
|---|---|---|---|
| **Keyboard Order & Focus Transitions** | 1. Skip link targets Identity Header.<br>2. Tab order: Trust Tier Summary Card -> Trust Score Breakdown Tooltip trigger -> "How Trust Scoring Works" Modal CTA -> "Verify with World ID" Button.<br>3. Opening `TrustExplanationModal` traps focus; `Escape` closes modal and restores focus to info CTA.<br>4. Activating World ID verification opens IDKit modal; focus transfers into modal; closing IDKit restores focus to `WorldcoinVerifyButton`. | 2.1.1, 2.1.2, 2.4.3 | **Automated:** `src/__tests__/accessibility/modals.test.tsx`.<br>**Manual:** Keyboard verification of World ID trigger flow. |
| **Accessible Names & Landmarks** | 1. `<main>` landmark with `<h1>Identity & Sybil Verification</h1>`.<br>2. Trust score indicator has `aria-label="Current trust score: [reputation] out of 100 points"`.<br>3. Tooltip has `role="tooltip"` and links to trigger via `aria-describedby`. Tooltip dismissible via `Escape` key without moving focus.<br>4. Status indicator exposes `role="status"` with visible text plus screen-reader label ("Humanity Verified" or "Unverified Wallet"). | 1.3.1, 2.4.4, 4.1.2 | **Automated:** ESLint a11y tooltip checks.<br>**Manual:** Screen reader inspection of trust badge and tooltip. |
| **Live Announcements & State Flow** | 1. World ID verification stages announce accessibly:<br>   - Waiting for QR scan: `role="status"` "World ID QR code ready. Scan with World App."<br>   - ZK-proof generation: `role="status"` "Generating zero-knowledge proof of humanity..."<br>   - Verification success: `role="status"` "World ID verified successfully. Your trust tier has been updated."<br>   - Verification error: `role="alert"` "World ID verification failed or was cancelled." | 4.1.3 | **Automated:** Unit tests for Worldcoin verification hook.<br>**Manual:** End-to-end verification simulation with screen reader audio. |
| **Layout & Breakpoints** | 1. **Base (<640px):** Single column. Trust score circle and score metrics stack vertically. World ID verify button spans full container width (`w-full`).<br>2. **Tablet (`md` 768px):** 2-column layout pairing Trust Score with Sybil Protection Explanation.<br>3. **Desktop (`lg` ≥1024px):** Balanced 2-column view with persistent sidebar navigation. | 1.4.10, 2.5.5 | **Automated:** Playwright viewport checks.<br>**Manual:** Visual verification on mobile phone screen. |
| **Zoom, Motion, Contrast & Targets** | 1. **200% Zoom:** Trust progress ring scales proportionally; text labels do not truncate.<br>2. **Reduced Motion:** Rotating scanning spinners disabled; static checkmark renders on completion.<br>3. **Contrast:** Verified green badge and Unverified amber badge meet 4.5:1 text contrast.<br>4. **Touch Targets:** World ID verify button has minimum 48px height (`h-12`). | 1.4.3, 1.4.4, 2.3.3, 2.5.8 | **Automated:** Axe accessibility scan.<br>**Manual:** Testing with Android TalkBack. |

---

### 3.7 Verifier Role Dashboard (`/verifier`)

- **Route:** `/verifier`
- **Entrypoint:** [`src/app/verifier/page.tsx`](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/src/app/verifier/page.tsx)
- **Primary Consumed Components:** `VerifierDashboardContainer`, `VerifierDashboard`, `EligibilityNotice`, `QueuePanel`, `PhaseAndSummaries`, `Button`

| Specification Domain | Acceptance Criteria & Measurable Requirements | WCAG Criteria | Verification Type |
|---|---|---|---|
| **Keyboard Order & Focus Transitions** | 1. Skip link lands on Verifier Header.<br>2. Tab order: Eligibility Notice (if unverified or ineligible) -> Active Verification Queue filter tabs ("Open Claims", "In Consensus", "Resolved") -> Queue table rows -> "Review & Vote" action buttons -> Consensus summary metrics.<br>3. Selecting a queue item transfers focus cleanly into the verification inspection view without loss of position upon return. | 2.1.1, 2.4.3, 2.4.7 | **Automated:** Feature unit tests.<br>**Manual:** Keyboard-only navigation across verification queue. |
| **Accessible Names & Landmarks** | 1. `<main>` landmark with `<h1>Verifier Consensus Dashboard</h1>`.<br>2. Section headings `<h2>Verifier Eligibility</h2>`, `<h2>Active Verification Queue</h2>`, `<h2>Consensus & Epoch Summaries</h2>`.<br>3. Queue filter tabs use `role="tablist"` with `role="tab"`, `aria-selected="true|false"`, and `aria-controls="[tabpanel-id]"`.<br>4. Action buttons in queue table declare specific target claim: `aria-label="Review evidence and vote on Claim #109"`. | 1.3.1, 2.4.6, 4.1.2 | **Automated:** Axe tablist ruleset verification.<br>**Manual:** NVDA speech check across tab switching. |
| **Eligibility & Queue Announcements** | 1. Ineligible wallet displays fail-closed alert banner: `role="alert"` "Wallet 0x... is not registered as a verifier or lacks required stake balance."<br>2. Real-time queue updates (new claims entering verification) announce politely: `role="status"` "New claim added to verification queue."<br>3. Submitting consensus vote triggers `role="status"` transaction progress announcements. | 1.3.1, 3.3.1, 4.1.3 | **Automated:** `verify-accessibility.mjs` live region checks.<br>**Manual:** Testing unauthenticated vs authenticated verifier views. |
| **Layout & Breakpoints** | 1. **Base (<640px):** Single column. Queue table scrolls horizontally inside a focusable region (`role="region"`). Filter tabs wrap into scrollable pill bar. Summary cards stack vertically.<br>2. **Tablet (`md` 768px):** Summary metrics render in 2-column grid. Filter tabs render inline.<br>3. **Desktop (`lg` ≥1024px):** Persistent sidebar; 3-column layout dividing Queue, Consensus Phase, and Verifier Rewards. | 1.4.10, 2.5.5 | **Automated:** Playwright responsive tests.<br>**Manual:** Verification of horizontal scroll keyboard accessibility. |
| **Zoom, Motion, Contrast & Targets** | 1. **200% Zoom:** Content reflows without obscuring queue action buttons.<br>2. **Reduced Motion:** Consensus progress bar transitions render instantly without CSS animations.<br>3. **Contrast:** Queue priority badges (High/Medium/Low) meet WCAG AA contrast.<br>4. **Touch Targets:** All queue row action buttons meet 44×44px minimum target size. | 1.4.3, 1.4.10, 2.3.3, 2.5.8 | **Automated:** Jest axe tests.<br>**Manual:** High contrast mode testing. |

---

### 3.8 Protocol Operations & Admin Dashboard (`/admin`)

- **Route:** `/admin`
- **Entrypoint:** [`src/app/(dashboard)/admin/page.tsx`](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/src/app/(dashboard)/admin/page.tsx)
- **Primary Consumed Components:** `AdminDashboard`, `OperationalQueueTable`, `AdminAuditTrail`, `OperationConfirmModal`, `ReadOnlyConfigSummary`, `SystemHealthSummary`, `AdminUnauthorizedState`

| Specification Domain | Acceptance Criteria & Measurable Requirements | WCAG Criteria | Verification Type |
|---|---|---|---|
| **Keyboard Order & Focus Transitions** | 1. Skip link lands on Admin Dashboard Header.<br>2. Tab order: System Health Summary -> Operational Queue table -> Action buttons ("Retry Batch", "Re-sync State") -> Read-Only Config Table -> Audit Trail log table.<br>3. Triggering any operational action opens `OperationConfirmModal`. Focus traps inside modal directly onto typed confirmation input.<br>4. Typed confirmation string ("CONFIRM") is required before execute button becomes enabled.<br>5. `Escape` key closes confirmation modal without executing mutation and restores focus to triggering table button. | 2.1.1, 2.1.2, 2.4.3, 3.3.4 | **Automated:** `AdminDashboard.interaction.stories.tsx` & E2E tests (`e2e/privileged-separation.spec.ts`).<br>**Manual:** Keyboard execution of operations modal. |
| **Accessible Names & Landmarks** | 1. `<main>` landmark with `<h1>Protocol Operations & Governance Dashboard</h1>`.<br>2. `<h2>` headings for `System Health`, `Operational Queue`, `Protocol Parameters (Read-Only)`, and `Immutable Audit Trail`.<br>3. Security governance notices explicitly marked with `role="region" aria-label="Privileged authority boundaries"`.<br>4. Tables expose `<th>` headers with `scope="col"`.<br>5. Audit trail records provide timestamps with `<time datetime="[ISO8601]">[Formatted Time]</time>`. | 1.3.1, 2.4.6, 4.1.2 | **Automated:** Axe table and landmark audit.<br>**Manual:** Screen reader traversal of admin tables. |
| **Privileged Fail-Closed Announcements** | 1. Disconnected wallet renders `AdminUnauthorizedState` with `role="alert"`: "Wallet disconnected. Privileged operations are restricted to authorized protocol administrators."<br>2. Unauthorized connected address renders `role="alert"`: "Access Denied: Address 0x... does not hold the PROTOCOL_OPERATOR or AUDIT_ADMIN role."<br>3. Successful operational dispatch announces live: `role="status"` "Operation [name] executed successfully. Audit trail record created."<br>4. Execution revert announces assertive alert (`role="alert"`). | 1.3.1, 3.3.1, 4.1.3 | **Automated:** Unit tests for fail-closed admin states.<br>**Manual:** Testing address switching in MetaMask with screen reader active. |
| **Layout & Breakpoints** | 1. **Base (<640px):** Single column. System health cards wrap into 2 columns. Tables live within horizontal scroll regions (`min-w-[700px]`). Modal occupies full viewport width.<br>2. **Tablet (`md` 768px):** Health cards expand to 4 columns. Audit trail shows compact timestamp + action.<br>3. **Desktop (`lg` ≥1024px):** Persistent sidebar; full multi-column audit trail and parameter grid. Zero root horizontal scroll. | 1.4.10, 2.5.5 | **Automated:** Playwright breakpoint test.<br>**Manual:** Mobile phone inspection of admin tables. |
| **Zoom, Motion, Contrast & Targets** | 1. **200% Zoom:** Critical operation buttons and confirmation modals remain fully reachable and usable.<br>2. **Reduced Motion:** System health pulsing status dots disabled; static status glyphs rendered.<br>3. **Contrast:** Error alerts (red) and warning notices (amber) pass 4.5:1 text contrast on dark backgrounds.<br>4. **Touch Targets:** Operation execute buttons and modal action buttons meet 44×44px minimum touch targets. | 1.4.3, 1.4.10, 2.3.3, 2.5.8 | **Automated:** Axe contrast checks.<br>**Manual:** 200% zoom testing on desktop. |

---

### 3.9 Protocol Treasury Admin (`/treasury` & `/treasury/stake`)

- **Routes:** `/treasury` & `/treasury/stake`
- **Entrypoints:** [`src/app/(dashboard)/treasury/page.tsx`](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/src/app/(dashboard)/treasury/page.tsx) & [`src/app/(dashboard)/treasury/stake/page.tsx`](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/src/app/(dashboard)/treasury/stake/page.tsx)
- **Primary Consumed Components:** `SafeTreasuryWithdrawalPanel`, `StakeTreasuryWithdrawalPanel`, `MainLayout`, `Card`, `Button`, `Input`

| Specification Domain | Acceptance Criteria & Measurable Requirements | WCAG Criteria | Verification Type |
|---|---|---|---|
| **Keyboard Order & Focus Transitions** | 1. Skip link reaches Treasury Header.<br>2. Tab order: Treasury Balance Overview -> Recipient Address Input -> Token Amount Input -> Simulation Trigger Button -> Confirmation Modal -> Final Execution Button.<br>3. Guardian withdrawal confirmation modal traps focus; requires typing "EXECUTE" before button activates.<br>4. `Escape` dismisses withdrawal confirmation modal and returns focus to "Withdraw" trigger button. | 2.1.1, 2.1.2, 2.4.3, 3.3.4 | **Automated:** E2E Guardian tests (`e2e/privileged-separation.spec.ts`).<br>**Manual:** Keyboard withdrawal simulation. |
| **Accessible Names & Landmarks** | 1. `<main>` landmark with `<h1>Protocol Treasury & Guardian Reserve</h1>`.<br>2. Inputs have explicit associated labels: `<label for="treasury-recipient">Recipient Address</label>` and `<label for="treasury-amount">Withdrawal Amount</label>`.<br>3. Available balance indicator links to amount input via `aria-describedby="available-treasury-balance"`.<br>4. Max button has `aria-label="Set maximum available withdrawal amount"`. | 1.3.1, 2.4.6, 4.1.2 | **Automated:** Axe form element validation.<br>**Manual:** Screen reader inspection of treasury inputs. |
| **Transaction & Safeguard Announcements** | 1. Simulation phase announces politely: `role="status"` "Simulating treasury withdrawal contract call..."<br>2. Simulation failure announces assertively: `role="alert"` "Withdrawal simulation reverted: [reason]. Execution blocked by guardian safety rule."<br>3. On-chain execution announcements:<br>   - Pending: `role="status"` "Withdrawal transaction submitted... Awaiting block inclusion."<br>   - Confirmed: `role="status"` "Withdrawal confirmed on Optimism. Funds transferred to recipient."<br>4. Wrong chain alert (`ChainIntegrityGuard`): `role="alert"` "Unsupported chain: Treasury operations permitted only on Optimism Mainnet or OP Sepolia." | 1.3.1, 3.3.1, 3.3.4, 4.1.3 | **Automated:** Unit tests for treasury withdrawal hooks.<br>**Manual:** Testing wrong-chain detection in wallet. |
| **Layout & Breakpoints** | 1. **Base (<640px):** Single column. Balance cards stack. Recipient and amount inputs take full width. Simulation summary cards stack vertically.<br>2. **Tablet (`md` 768px):** Balance cards display in 2 columns. Amount input and "Max" button align horizontally.<br>3. **Desktop (`lg` ≥1024px):** Centered panel layout (`max-w-4xl`) with persistent sidebar. | 1.4.10, 2.5.5 | **Automated:** Playwright mobile checks.<br>**Manual:** Touch validation of recipient input and max button. |
| **Zoom, Motion, Contrast & Targets** | 1. **200% Zoom:** Content reflows without truncating balance amounts or hiding confirmation inputs.<br>2. **Reduced Motion:** Shimmering simulation indicators disabled.<br>3. **Contrast:** Balance text and input placeholders meet 4.5:1 contrast.<br>4. **Touch Targets:** Withdrawal execution button has minimum 48px height. | 1.4.3, 1.4.10, 2.3.3, 2.5.8 | **Automated:** Lighthouse a11y audit.<br>**Manual:** Zoom and contrast review. |

---

### 3.10 How It Works / Educational Guide (`/how-it-works`)

- **Route:** `/how-it-works`
- **Entrypoint:** [`src/app/(dashboard)/how-it-works/page.tsx`](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/src/app/(dashboard)/how-it-works/page.tsx)
- **Primary Consumed Components:** Informational presentation cards, `Button`, `SafeExternalLink`

| Specification Domain | Acceptance Criteria & Measurable Requirements | WCAG Criteria | Verification Type |
|---|---|---|---|
| **Keyboard Order & Focus Transitions** | 1. Skip link reaches Guide Header.<br>2. Tab order flows logically down the guide: Step 1 (Submit Claim) -> Step 2 (Stake & Verify) -> Step 3 (Disputes & Consensus) -> Step 4 (Earn Rewards) -> Action CTA ("Start Verifying Claims"). | 2.1.1, 2.4.3 | **Automated:** Jest DOM tab test.<br>**Manual:** Full keyboard walkthrough. |
| **Accessible Names & Landmarks** | 1. `<main>` landmark with `<h1>How TruthBounty Decentralized Verification Works</h1>`.<br>2. Ordered steps marked with semantic `<ol>` and `<li>` elements.<br>3. Each step header marked with `<h2>Step [N]: [Title]</h2>`.<br>4. Decorative step timeline lines marked `aria-hidden="true"`. | 1.3.1, 2.4.6 | **Automated:** Axe list and heading structure audit.<br>**Manual:** Screen reader reading order review. |
| **Layout & Breakpoints** | 1. **Base (<640px):** Single column stack. Decorative connecting lines hidden (`hidden sm:block`) to prevent horizontal overflow.<br>2. **Tablet (`md` 768px):** Multi-column workflow cards.<br>3. **Desktop (`lg` ≥1024px):** Full guide layout with persistent sidebar. | 1.4.10 | **Automated:** Playwright overflow gate test.<br>**Manual:** Viewport inspection at 320px. |
| **Zoom, Motion, Contrast & Targets** | 1. **200% & 400% Zoom:** Text reflows without truncation or horizontal scroll.<br>2. **Reduced Motion:** Card entry animations disabled.<br>3. **Contrast:** Step badge numerals maintain 4.5:1 contrast against surface.<br>4. **Touch Targets:** Bottom CTA button has minimum 44px height. | 1.4.3, 1.4.10, 2.3.3, 2.5.8 | **Automated:** Axe scan.<br>**Manual:** Zoom testing. |

---

### 3.11 Application Frame & Global Overlays

- **Components:** `MainLayout`, `Sidebar`, `Topbar`, `TrustWarningBanner`, `OfflineBanner`, `WebSocketStatus`, `ThemeToggle`, `ConnectButton`, `LocaleSwitcher`, `IntegrityBoundary`
- **Repository Entrypoint:** [`src/app/layout.tsx`](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/src/app/layout.tsx), [`src/components/layout/MainLayout.tsx`](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/src/components/layout/MainLayout.tsx), [`src/components/layout/Topbar.tsx`](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/src/components/layout/Topbar.tsx), [`src/components/layout/Sidebar.tsx`](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/src/components/layout/Sidebar.tsx)

| Specification Domain | Acceptance Criteria & Measurable Requirements | WCAG Criteria | Verification Type |
|---|---|---|---|
| **Keyboard Order & Mobile Drawer** | 1. Skip link (`#main-content`) is first focusable element.<br>2. On mobile, hamburger button (`aria-label="Open navigation menu"`) opens slide-in drawer.<br>3. Focus immediately shifts to first navigation link inside drawer.<br>4. Tab and Shift+Tab strictly cycle within drawer; `Escape` or backdrop click closes drawer and returns focus to hamburger button.<br>5. When closed, sidebar is removed from accessibility tree (`hidden` / `inert`) so Tab cannot reach hidden links. | 2.1.1, 2.1.2, 2.4.1, 2.4.3 | **Automated:** `Sidebar.test.tsx`, `e2e/keyboard-navigation.spec.ts`.<br>**Manual:** Mobile drawer opening, tabbing, and Escape closing on mobile viewport. |
| **Accessible Names & Landmarks** | 1. Topbar marked `<header role="banner">`.<br>2. Sidebar marked `<nav role="navigation" aria-label="Main Navigation">`.<br>3. Active navigation link marked with `aria-current="page"`.<br>4. External links in navigation append `aria-label="[Label] (opens in new tab)"`.<br>5. `ThemeToggle` button declares current mode and upcoming mode: `aria-label="Toggle theme, current theme is dark"`.<br>6. `LocaleSwitcher` exposes accessible name: `aria-label="Select language"`. | 1.3.1, 2.4.4, 4.1.2 | **Automated:** Axe landmark and nav checks.<br>**Manual:** NVDA speech review across topbar controls. |
| **System Banners & Global Alerts** | 1. `TrustWarningBanner` renders when reputation is low or unverified: `role="status"` + `aria-live="polite"`.<br>2. `OfflineBanner` renders when browser detects offline state: `role="alert"` + `aria-live="assertive"` "Network offline. Read-only cached mode active."<br>3. `WebSocketStatus` announces connection drops and resyncs: `role="status"` + `aria-live="polite"`.<br>4. `IntegrityBoundary` catches missing CSP nonces or unsupported chain: `role="alert"` fail-closed screen. | 1.3.1, 4.1.3 | **Automated:** `verify-accessibility.mjs` live region gate.<br>**Manual:** Toggling offline mode in browser devtools. |
| **Layout & Breakpoints** | 1. **Base (<640px):** Hamburger button visible on top left (`pl-16` reserved); Sidebar renders as modal drawer overlay; Topbar shows compact wallet address + Submit Claim CTA; Theme toggle and language switcher move inside drawer.<br>2. **Tablet (`md` 768px):** Topbar restores Theme toggle and realtime sync dot.<br>3. **Desktop (`lg` ≥1024px):** Hamburger button hidden; Sidebar docks as persistent 256px column; Topbar displays full wallet info and network badge. | 1.4.10, 2.5.5 | **Automated:** Playwright responsive test (`e2e/mobile-responsive.spec.ts`).<br>**Manual:** Resizing browser window across 640px and 1024px thresholds. |
| **Zoom, Motion, Contrast & Targets** | 1. **200% Zoom:** Sidebar remains docked or converts to drawer if viewport width drops below 1024px equivalent.<br>2. **Reduced Motion:** Drawer slide-in animation disabled (`transition-none`).<br>3. **Contrast:** Focus rings meet 3:1 contrast against dark/light surfaces (`ring-blue-500`).<br>4. **Touch Targets:** Hamburger button, wallet button, theme toggle, and nav links measure at least 44×44px. | 1.4.3, 1.4.10, 2.3.3, 2.5.8 | **Automated:** Axe automated scan.<br>**Manual:** Touch testing on mobile hardware. |

---

## 4. Approved Golden Journeys Acceptance Matrix

The frontend defines 10 canonical golden journeys representing end-to-end user workflows. Each journey is mapped to strict, measurable responsive and accessibility requirements.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CANONICAL GOLDEN JOURNEYS MAP                        │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Public Discovery & Feed Exploration Journey (Public Contributor)    │
│ 2. Claim Verification & Staking Journey (Verifier / Staker)           │
│ 3. New Claim Submission Journey (Whistleblower / Submitter)           │
│ 4. Dispute & Challenge Escalation Journey (Disputant / Appellant)     │
│ 5. Protocol Rewards Claiming Journey (Beneficiary / Staker)           │
│ 6. World ID Sybil Verification Journey (Identity User)                │
│ 7. Verifier Queue Prioritization Journey (Active Verifier Role)       │
│ 8. Protocol Operations & Maintenance Journey (Operator Role)          │
│ 9. Governance & Treasury Guardian Withdrawal Journey (Guardian Role)  │
│ 10. Degraded RPC & Chain Reorg Recovery Journey (System Resiliency)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Journey 1: Public Discovery & Feed Exploration Journey

- **Persona:** Unauthenticated Public Reader or Connected Community Member
- **User Goal:** Discover high-impact news claims, filter by category/verdict, search by keyword, and inspect claim health without wallet friction.
- **Path:** `/` -> Filter Pills -> ActiveClaimsTable -> Search Input -> Table Row Navigation

| Dimension | Measurable Expectation | WCAG Reference | Verification Strategy |
|---|---|---|---|
| **Keyboard Sequence & Focus Transitions** | User presses Tab -> Skip link (`#main-content`) activates -> Focus lands on search input -> Tab moves through category filter pills ("All", "Politics", "Science", "Tech") -> Tab moves into table header sort buttons -> Tab enters table body rows -> Enter on row navigates to `/claims/[id]`. | 2.1.1, 2.4.1, 2.4.3 | **Automated:** Unit test in `ActiveClaimsTable.test.tsx`.<br>**Manual:** Keyboard-only run through search, filtering, and row activation. |
| **Accessible Names & Semantics** | Filter pills use `role="button"` and toggle `aria-pressed="true|false"`. Search input announces placeholder and label via screen reader. Table column headers indicate sorting state via `aria-sort="ascending|descending|none"`. | 1.3.1, 4.1.2 | **Automated:** ESLint `jsx-a11y` ruleset.<br>**Manual:** NVDA speech verification during search filtering. |
| **Announcements & Live Regions** | When search or filter results update, table updates are announced politely: `role="status"` "Showing [N] matching claims." Loading skeleton announces `aria-busy="true"`. | 4.1.3 | **Automated:** Jest assertion on filter live region.<br>**Manual:** Testing rapid search input with screen reader. |
| **Responsive Expectations** | Base (<640px): Search bar expands to 100% width; filter chips wrap cleanly onto multiple rows with 8px gap; table renders inside a keyboard-focusable scroll container (`tabIndex={0}`) without horizontal body overflow. Desktop (≥1024px): Search and filters align in single row; table displays all columns without clipping. | 1.4.10, 2.5.5 | **Automated:** Playwright test at 375×812 viewport.<br>**Manual:** Checking scroll behavior and target sizes on mobile phone. |
| **Zoom & Touch Targets** | At 200% zoom, search input and filter chips stack naturally. All filter pills provide at least 44×44px touchable surface. | 1.4.4, 1.4.10, 2.5.8 | **Automated:** Lighthouse touch targets audit.<br>**Manual:** Physical tap test on smartphone. |

---

### Journey 2: Claim Verification & Staking Journey

- **Persona:** Staked Verifier
- **User Goal:** Evaluate a pending news claim, inspect IPFS evidence documents, commit an on-chain stake with a verdict (Verify vs Reject), and observe finality.
- **Path:** `/claims/[id]` -> Evidence Viewer -> StakeForm -> ApprovalButton -> VerificationActions -> Transaction Monitoring

| Dimension | Measurable Expectation | WCAG Reference | Verification Strategy |
|---|---|---|---|
| **Keyboard Sequence & Focus Transitions** | User tabs to Evidence Viewer toggle -> Space expands evidence -> Tab moves through IPFS external links -> Tab moves to Stake Input (`<input type="number">`) -> User types stake amount -> Tab to `ApprovalButton` (if allowance insufficient) -> Enter initiates ERC-20 approval -> Upon approval confirmation, focus shifts to `Verify` button -> Enter submits verification transaction -> Focus transitions to `TransactionStatus` live card. | 2.1.1, 2.4.3, 3.3.4 | **Automated:** `useTransactionMachine` integration test.<br>**Manual:** Full keyboard completion from evidence inspection to on-chain confirmation. |
| **Accessible Names & Semantics** | Stake input has explicit `<label for="stake-amount">Stake Amount (TRUTH)</label>` and `aria-describedby="stake-balance-helper"`. Verify and Reject buttons have explicit accessible names: `aria-label="Verify claim #104 and stake [X] TRUTH"` and `aria-label="Reject claim #104 and stake [X] TRUTH"`. | 1.3.1, 2.5.3, 4.1.2 | **Automated:** Axe form & button audit.<br>**Manual:** Screen reader readout of stake button text. |
| **Transaction Live Announcements** | As transaction executes, screen reader receives sequential live announcements without alert spam:<br>1. "Simulating transaction..." (`role="status"` polite)<br>2. "Transaction submitted. Hash: 0x... awaiting block inclusion." (`role="status"` polite)<br>3. "Confirmed in block #... accumulating finality confirmations." (`role="status"` polite)<br>4. "Transaction finalized on-chain." (`role="status"` polite)<br>5. In case of revert: `role="alert"` assertive "Transaction reverted: Insufficient stake balance." | 1.3.1, 3.3.1, 4.1.3 | **Automated:** `src/__tests__/accessibility/transaction-states.test.tsx`.<br>**Manual:** End-to-end screen reader transaction simulation. |
| **Responsive Expectations** | Base (<640px): 2-column desktop layout collapses to 1 column. Statement and evidence render first; StakeForm and VerificationActions render below. Verify and Reject buttons span 100% width with 48px height (`h-12`). Desktop (≥1024px): Statement and evidence occupy main column; StakeForm forms sticky right rail (`w-[360px]`). | 1.4.10, 2.5.5 | **Automated:** Playwright viewport test at 375px and 1280px.<br>**Manual:** Checking sticky rail behavior on tablet vs desktop. |
| **Zoom & Reduced Motion** | At 200% zoom, right action rail unpins and reflows into single document stream. Pulse indicators in `ClaimLifecycleTimeline` become static icons when `prefers-reduced-motion` is active. | 1.4.4, 1.4.10, 2.3.3 | **Automated:** `MotionSafeStatus.test.tsx`.<br>**Manual:** OS reduced motion toggle verification. |

---

### Journey 3: New Claim Submission Journey

- **Persona:** Whistleblower / Fact-Check Submitter
- **User Goal:** Create a new news claim, attach supporting IPFS URLs/evidence, approve required submission bond, and broadcast transaction to the protocol.
- **Path:** Topbar "Submit Claim" CTA -> `ClaimSubmissionForm` (Modal / `/claims/new`) -> Title & Category -> Evidence Upload -> Bond Review -> Submit

| Dimension | Measurable Expectation | WCAG Reference | Verification Strategy |
|---|---|---|---|
| **Keyboard Sequence & Focus Transitions** | User activates "Submit Claim" button -> Modal opens -> Focus automatically shifts to Claim Title input -> Tab advances to Category dropdown -> Tab to Statement textarea -> Tab to IPFS Evidence URL input -> Tab to Bond Allowance button -> Enter approves bond -> Tab to Submit button -> Enter submits claim -> On transaction mining, modal closes and focus returns to "Submit Claim" header CTA. | 2.1.1, 2.1.2, 2.4.3 | **Automated:** `ClaimSubmissionForm.modal.test.tsx` (focus trap & restoration assertions).<br>**Manual:** Tabbing through full form and pressing Escape to test focus restoration. |
| **Accessible Names & Semantics** | Modal container has `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="submit-claim-title"`. All inputs have mandatory labels with `aria-required="true"`. Step progression exposes `role="navigation"` with `aria-current="step"`. | 1.3.1, 2.4.6, 4.1.2 | **Automated:** Axe modal ruleset scan.<br>**Manual:** Screen reader inspection of modal structure. |
| **Validation & Announcements** | Submitting an empty form triggers inline error messages with `aria-describedby` linking each input to its error text. Focus moves automatically to the first invalid field. IPFS upload announces progress (`role="progressbar"`). Transaction submission announces pending and confirmed status live. | 3.3.1, 3.3.2, 3.3.3, 4.1.3 | **Automated:** Form validation unit tests.<br>**Manual:** Submitting invalid inputs with screen reader. |
| **Responsive Expectations** | Base (<640px): Modal displays full width with 16px horizontal margins (`w-[calc(100vw-32px)]`). Action buttons stack vertically (`w-full`). Desktop (≥1024px): Modal centers with `max-w-xl` and side-by-side action buttons. | 1.4.10, 2.5.5 | **Automated:** Playwright mobile dialog snapshot.<br>**Manual:** Testing on mobile phone touch screen. |
| **Zoom & Contrast** | At 200% zoom, modal body becomes internally scrollable (`max-h-[80vh] overflow-y-auto`) so submit/cancel buttons remain accessible. Input borders maintain 3:1 contrast against modal canvas. | 1.4.3, 1.4.4, 1.4.11 | **Automated:** Axe contrast audit.<br>**Manual:** Browser zoom testing at 200%. |

---

### Journey 4: Challenge Window & Dispute Voting Escalation

- **Persona:** Disputant / Community Appellant
- **User Goal:** Challenge a contested claim verdict during the open challenge window, submit challenge stake, and participate in multi-round consensus voting.
- **Path:** `/disputes` -> Active Challenge Card -> Review Opposing Verdicts -> Enter Dispute Stake -> Confirm Vote

| Dimension | Measurable Expectation | WCAG Reference | Verification Strategy |
|---|---|---|---|
| **Keyboard Sequence & Focus Transitions** | User tabs to Active Dispute card -> Tab to "Challenge Verdict" button -> Modal opens -> Focus moves to Challenge Stake input -> User inputs amount -> Tab moves to "Submit Challenge" button -> Enter executes challenge transaction -> Modal closes on confirmation and updates dispute timeline. | 2.1.1, 2.1.2, 2.4.3 | **Automated:** Dispute modal unit test.<br>**Manual:** Keyboard-only dispute submission. |
| **Accessible Names & Semantics** | Dispute cards marked with `role="article"`. Voting distribution meters declare `role="meter"` with accessible name and min/max/current values. Challenge window countdown declares `aria-label="Challenge window closes in [X] hours"`. | 1.3.1, 2.2.1, 4.1.2 | **Automated:** Axe meter and timer audit.<br>**Manual:** Screen reader announcement of voting ratios. |
| **Announcements & Timers** | `TimeRemainingNotice` uses monotonic clock to prevent drift. Announces remaining time politely in 5-minute intervals. Challenge stake submission announces transaction lifecycle live (`role="status"`). | 2.2.1, 4.1.3 | **Automated:** Monotonic timer test in `TimeRemainingNotice.test.tsx`.<br>**Manual:** Observing live countdown with screen reader. |
| **Responsive Expectations** | Base (<640px): Cards stack in single column. Voting buttons stack vertically with full width. Tablet/Desktop: 2-column or 3-column card grid with side-by-side vote buttons. | 1.4.10, 2.5.5 | **Automated:** Playwright breakpoint test.<br>**Manual:** Resizing dispute hub across breakpoints. |
| **Zoom & Touch Targets** | At 200% zoom, dispute cards reflow cleanly. All vote and challenge buttons measure at least 44×44px. | 1.4.4, 2.5.8 | **Automated:** Target size verification script.<br>**Manual:** Touch testing on physical device. |

---

### Journey 5: Protocol Rewards Claiming Journey

- **Persona:** Verification Reward Beneficiary
- **User Goal:** View accumulated token earnings across verification epochs, verify payout breakdown, and claim rewards to connected wallet.
- **Path:** Topbar Profile / Navigation -> `/rewards` -> Review Entitlements -> Click "Claim All Rewards" -> Confirm in Wallet -> View Receipt

| Dimension | Measurable Expectation | WCAG Reference | Verification Strategy |
|---|---|---|---|
| **Keyboard Sequence & Focus Transitions** | User navigates to `/rewards` via sidebar/topbar -> Tab lands on "Claim All Rewards" button -> Enter triggers claim transaction -> Button displays loading state -> Focus remains on button until mined -> Upon mining, focus moves to block explorer confirmation link. | 2.1.1, 2.4.3, 2.4.7 | **Automated:** Component integration test.<br>**Manual:** Keyboard walkthrough of reward claim. |
| **Accessible Names & Semantics** | Claim button declares accessible name: `aria-label="Claim [amount] TRUTH rewards to connected wallet"`. Payout table uses `<th>` with `scope="col"`. External block explorer link declares "(opens in new tab)". | 1.3.1, 2.4.4, 2.5.3 | **Automated:** Axe audit on `ClaimRewardsPanel`.<br>**Manual:** Screen reader readout of claim button and table. |
| **Announcements & Live States** | Zero reward balance renders empty state with polite status: `role="status"` "No claimable rewards for the connected wallet at this epoch." Transaction states announce live: "Claiming rewards..." -> "Rewards transferred to wallet." Reverts announce via `role="alert"`. | 1.3.1, 4.1.3 | **Automated:** `src/__tests__/accessibility/rewards.test.tsx`.<br>**Manual:** Simulating zero vs non-zero reward states. |
| **Responsive Expectations** | Base (<640px): Header stacks vertically. Total reward display and Claim button span 100% width. Payout history table scrolls within labelled scroll region. Desktop: Side-by-side header with tabular payout history. | 1.4.10, 2.5.5 | **Automated:** Playwright mobile test.<br>**Manual:** Mobile viewport inspection. |
| **Zoom & Contrast** | At 200% zoom, token balances scale with tabular numerals (`.tb-data`) without visual overlap. Token amount colors maintain 4.5:1 contrast against dark surface. | 1.4.3, 1.4.4 | **Automated:** Jest token amount contrast test.<br>**Manual:** High contrast mode verification. |

---

### Journey 6: World ID Sybil Verification Journey

- **Persona:** Identity User seeking higher trust score
- **User Goal:** Connect World ID to prove uniqueness and humanity, increasing protocol reputation and unlocking higher staking limits.
- **Path:** `/identity` -> Review Trust Tier -> "Verify with World ID" Button -> IDKit Modal -> Scan QR / ZK Proof -> Payout Tier Upgrade

| Dimension | Measurable Expectation | WCAG Reference | Verification Strategy |
|---|---|---|---|
| **Keyboard Sequence & Focus Transitions** | User tabs to "Verify with World ID" button -> Enter opens IDKit modal -> Focus transitions into IDKit dialog -> User completes ZK-proof verification -> Modal closes -> Focus returns to `WorldcoinVerifyButton` -> Live region announces verified status. | 2.1.1, 2.1.2, 2.4.3 | **Automated:** Unit test for World ID trigger and focus return.<br>**Manual:** Testing focus return after closing IDKit modal. |
| **Accessible Names & Semantics** | Verification button declares `aria-label="Verify humanity with World ID to upgrade trust score"`. Trust indicator exposes `aria-label="Trust score: [reputation] out of 100"`. Tooltip opens on focus/hover and dismisses via `Escape`. | 1.3.1, 2.4.4, 4.1.2 | **Automated:** Axe tooltip and button audit.<br>**Manual:** VoiceOver testing on iOS. |
| **Announcements & Live States** | Proof verification states announce live:<br>- "QR code ready for World App scanning" (`role="status"`)<br>- "Generating zero-knowledge proof..." (`role="status"` busy)<br>- "Proof verified! Trust tier updated to Verified Human." (`role="status"`)<br>- Error: `role="alert"` "World ID proof verification failed." | 4.1.3 | **Automated:** Live region scan in `verify-accessibility.mjs`.<br>**Manual:** Simulated ZK proof generation with screen reader. |
| **Responsive Expectations** | Base (<640px): Trust score and verification status stack vertically. Verify button spans full width (`w-full min-h-[48px]`). Desktop (≥1024px): 2-column balanced view pairing Score with Explanation. | 1.4.10, 2.5.5 | **Automated:** Playwright viewport test.<br>**Manual:** Tap testing on iPhone screen. |
| **Zoom & Reduced Motion** | At 200% zoom, circular progress indicator scales smoothly. Rotating radar/scanner animations disabled when reduced motion is preferred. | 1.4.4, 2.3.3 | **Automated:** Motion safe test in `MotionSafeStatus.test.tsx`.<br>**Manual:** OS reduced motion toggle test. |

---

### Journey 7: Verifier Queue Prioritization Journey

- **Persona:** Active Protocol Verifier
- **User Goal:** Review open claims awaiting consensus, sort by urgency/bounty, claim verification task, and submit consensus vote.
- **Path:** `/verifier` -> Eligibility Gate -> Queue Filter Tabs -> Queue Table Row -> Task Details -> Submit Consensus Vote

| Dimension | Measurable Expectation | WCAG Reference | Verification Strategy |
|---|---|---|---|
| **Keyboard Sequence & Focus Transitions** | Skip link to Verifier Content -> Tab to Queue Filter tabs ("Open", "In Consensus", "Resolved") -> Arrow keys switch active tab -> Tab into Queue Table -> Tab to row action button ("Review & Vote") -> Enter opens task -> Tab to consensus choice -> Enter submits vote. | 2.1.1, 2.4.3, 2.4.7 | **Automated:** Axe tablist ruleset assertions.<br>**Manual:** Arrow key tab switching and row activation with keyboard. |
| **Accessible Names & Semantics** | Filter tabs use `role="tab"` and `role="tabpanel"`. Table rows have row headers (`<th scope="row">Claim #[ID]</th>`). Action buttons include claim ID in accessible name: `aria-label="Review and vote on Claim #109"`. | 1.3.1, 2.5.3, 4.1.2 | **Automated:** Axe table and tablist audit.<br>**Manual:** Screen reader inspection of queue items. |
| **Eligibility & Live Updates** | Ineligible wallet renders fail-closed alert: `role="alert"` "Wallet not registered as verifier." Real-time additions to queue announce politely: `role="status"` "New claim added to verification queue." Consensus updates announce live. | 1.3.1, 3.3.1, 4.1.3 | **Automated:** Fail-closed verifier unit tests.<br>**Manual:** Switching between registered and unregistered wallets. |
| **Responsive Expectations** | Base (<640px): Queue table scrolls horizontally inside a focusable container (`tabIndex={0}`); filter tabs wrap into scrollable pill bar; summary metrics stack vertically. Desktop (≥1024px): 3-column layout dividing Queue, Consensus Phase, and Rewards. | 1.4.10, 2.5.5 | **Automated:** Playwright responsive test.<br>**Manual:** Mobile browser horizontal table navigation test. |
| **Zoom & Targets** | At 200% zoom, table headers and actions remain clear without overlapping. Queue action buttons meet 44×44px minimum target size. | 1.4.4, 2.5.8 | **Automated:** Target size check.<br>**Manual:** Zoom testing at 200%. |

---

### Journey 8: Protocol Operations & Maintenance Journey

- **Persona:** Protocol Operator / System Maintainer
- **User Goal:** Inspect real-time indexing pipeline, identify stalled or dead-letter queue batches, execute operational retry, and audit execution trail.
- **Path:** `/admin` -> System Health -> Operational Queue Table -> "Retry Batch" -> `OperationConfirmModal` -> Type "CONFIRM" -> Dispatch -> Audit Log

| Dimension | Measurable Expectation | WCAG Reference | Verification Strategy |
|---|---|---|---|
| **Keyboard Sequence & Focus Transitions** | Skip link lands on Admin Dashboard -> Tab to Operational Queue Table -> Tab to "Retry Batch" button -> Enter opens `OperationConfirmModal` -> Focus traps inside modal onto confirmation input -> User types "CONFIRM" -> Tab to "Execute Operation" button -> Enter dispatches call -> Modal closes; focus returns to "Retry Batch" button -> Focus can advance to Audit Trail table to inspect new log record. | 2.1.1, 2.1.2, 2.4.3, 3.3.4 | **Automated:** `AdminDashboard.interaction.stories.tsx` & E2E tests (`e2e/privileged-separation.spec.ts`).<br>**Manual:** Keyboard execution of operations modal and typed confirmation. |
| **Accessible Names & Semantics** | Modal container marked `role="dialog" aria-modal="true" aria-labelledby="op-modal-title"`. Confirmation input has `<label for="confirm-string">Type CONFIRM to execute</label>`. Audit table records use `<time datetime="[ISO]">[Time]</time>`. Governance boundary banner marked `role="region" aria-label="Privileged operations boundary"`. | 1.3.1, 2.4.6, 4.1.2 | **Automated:** Axe scan on AdminDashboard.<br>**Manual:** Screen reader audit of admin controls. |
| **Privileged Fail-Closed Alerts** | Disconnected wallet renders `AdminUnauthorizedState` (`role="alert"`). Non-operator address renders `role="alert"` "Access Denied". Successful operational dispatch announces live: `role="status"` "Batch #44 retry dispatched. Audit record created." Reverts announce via `role="alert"`. | 1.3.1, 3.3.1, 4.1.3 | **Automated:** Unit tests for privileged separation.<br>**Manual:** Testing disconnected wallet vs operator address. |
| **Responsive Expectations** | Base (<640px): System health cards render in 2 columns; Operational Queue and Audit tables scroll horizontally inside labelled containers (`min-w-[700px]`); confirmation modal spans full width. Desktop (≥1024px): Multi-column layout with persistent sidebar. Zero root page overflow. | 1.4.10, 2.5.5 | **Automated:** Playwright breakpoint test.<br>**Manual:** Testing table horizontal scrolling with keyboard on small screens. |
| **Zoom & Contrast** | At 200% zoom, operation buttons and confirmation inputs remain fully visible and operational. Danger/warning badges maintain 4.5:1 text contrast. All interactive elements meet 44×44px touch target minimum. | 1.4.3, 1.4.4, 2.5.8 | **Automated:** Axe contrast audit.<br>**Manual:** High contrast mode verification. |

---

### Journey 9: Governance & Treasury Guardian Withdrawal Journey

- **Persona:** Protocol Guardian / Treasury Admin
- **User Goal:** Monitor protocol reserve solvency, simulate emergency or scheduled treasury withdrawal on Optimism, type execution confirmation, and broadcast transaction.
- **Path:** `/treasury` -> Review Reserves -> Recipient & Amount Input -> Simulate -> Confirm Modal -> Type "EXECUTE" -> Broadcast -> Receipt

| Dimension | Measurable Expectation | WCAG Reference | Verification Strategy |
|---|---|---|---|
| **Keyboard Sequence & Focus Transitions** | Skip link lands on Treasury Header -> Tab to Recipient Input -> User enters address -> Tab to Amount Input -> User enters amount -> Tab to "Simulate Withdrawal" button -> Enter triggers simulation -> Simulation success renders "Withdraw Funds" button -> Enter opens guardian confirmation modal -> Focus traps on typed phrase input -> User types "EXECUTE" -> Tab to "Broadcast Withdrawal" -> Enter submits transaction -> Modal closes; focus returns to withdrawal panel. | 2.1.1, 2.1.2, 2.4.3, 3.3.4 | **Automated:** Guardian E2E tests (`e2e/privileged-separation.spec.ts`).<br>**Manual:** Keyboard-only guardian withdrawal execution. |
| **Accessible Names & Semantics** | Inputs have explicit associated labels with `aria-required="true"`. Balance helper link uses `aria-describedby`. Guardian confirmation modal marked `role="alertdialog" aria-modal="true" aria-labelledby="guardian-modal-title"`. Danger buttons use distinct border styling and icon glyphs. | 1.3.1, 1.4.1, 2.4.6, 4.1.2 | **Automated:** Axe modal and form audit.<br>**Manual:** Screen reader inspection of guardian modal. |
| **Safeguards & Announcements** | Pre-flight simulation announces politely: `role="status"` "Simulating treasury withdrawal..." Simulation failure announces assertively: `role="alert"` "Withdrawal simulation reverted: [reason]." On-chain broadcast announces pending mempool and block finality states live. Wrong-chain alerts display fail-closed alert. | 1.3.1, 3.3.1, 3.3.4, 4.1.3 | **Automated:** Unit tests for treasury withdrawal machine.<br>**Manual:** Wrong-chain simulation in browser. |
| **Responsive Expectations** | Base (<640px): Balance cards stack vertically. Recipient and amount inputs take full container width. Desktop (≥1024px): Balanced panel layout with persistent sidebar. Zero horizontal root scroll. | 1.4.10, 2.5.5 | **Automated:** Playwright mobile test.<br>**Manual:** Touch validation of recipient and amount inputs. |
| **Zoom & Contrast** | At 200% zoom, balance figures scale without overlapping inputs or buttons. Danger execution button maintains 4.5:1 text contrast and 3:1 border contrast. Interactive buttons measure at least 48px height. | 1.4.3, 1.4.4, 1.4.11, 2.5.8 | **Automated:** Axe contrast checks.<br>**Manual:** 200% zoom verification. |

---

### Journey 10: Degraded RPC & Chain Reorg Recovery Journey

- **Persona:** Any User during Network / Chain Instability
- **User Goal:** Retain access to read-only protocol data during RPC outage, recognize when indexed state lags behind chain head, and gracefully recover when a block reorganization occurs without loss of pending inputs.
- **Path:** Any Route -> RPC Dropout / Chain Reorg Detected -> Live Alert Announcement -> Degraded Mode Banner -> Reconnection -> Sync Restoration

| Dimension | Measurable Expectation | WCAG Reference | Verification Strategy |
|---|---|---|---|
| **Keyboard Sequence & Focus Transitions** | When degraded banner appears, focus is NOT ripped away from user's active input. User can tab to degraded banner's "Retry Sync" button -> Enter triggers immediate refetch -> On recovery, banner dismisses politely and focus remains on active context. | 2.1.1, 2.4.3 | **Automated:** Unit test for non-stealing focus banner.<br>**Manual:** Simulating RPC drop while typing in a form input. |
| **Accessible Names & Semantics** | `OfflineBanner` and `ApiStaleBanner` marked with `role="status"` (for minor staleness) or `role="alert"` (for active chain reorg). Banners include clear text explanations and retry affordances with explicit accessible names (`aria-label="Retry connection to protocol RPC"`). | 1.3.1, 4.1.2 | **Automated:** Axe banner audit.<br>**Manual:** Screen reader announcement review. |
| **Live Announcements & State Model** | All 12 canonical UI states announced cleanly per [`docs/accessibility-ci.md`](file:///c:/Users/hp/OneDrive/Desktop/GrantFox/truthbounty-frontend/docs/accessibility-ci.md):<br>- `stale`: `role="status"` "Data projection lags behind chain head. Refreshing..."<br>- `degraded-rpc`: `role="status"` "Primary RPC unreachable. Falling back to secondary node."<br>- `reorged`: `role="alert"` "Chain reorganization detected. Reconciling transaction state..."<br>- `unsupported-chain`: `role="alert"` "Connected wallet is on an unsupported chain. Please switch to Optimism." | 1.3.1, 4.1.3 | **Automated:** `verifyCanonicalStatesCoverage()` in `scripts/verify-accessibility.mjs`.<br>**Manual:** Mocking reorg event and checking assertive speech. |
| **Responsive Expectations** | Base (<640px): Stale and degraded banners pin to top of screen with full-width layout and compact wording; action buttons stack cleanly. Desktop: Full-width alert banner across top of main content canvas. | 1.4.10, 2.5.5 | **Automated:** Playwright banner test at 375px.<br>**Manual:** Mobile viewport inspection. |
| **Zoom & Contrast** | At 200% zoom, banner text reflows without overlapping navigation header or breadcrumbs. Alert backgrounds (amber for stale, red for reorg) meet 4.5:1 text contrast. Retry button has minimum 44×44px touch target. | 1.4.3, 1.4.4, 2.5.8 | **Automated:** Lighthouse contrast scan.<br>**Manual:** High contrast mode verification. |

---

## 5. Automated versus Manual Verification Protocol

To prevent regressions and ensure strict WCAG 2.1 AA adherence, verification is divided into a 5-tier automated pipeline and a mandatory 4-point manual human review protocol.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   VERIFICATION GATES & PROTOCOL                        │
├────────────────────────────────────────────────────────────────────────┤
│ AUTOMATED GATES (CI / Build)                                           │
│ 1. Static Analysis: ESLint (eslint-plugin-jsx-a11y) + TypeScript       │
│ 2. Accessibility CI Gate: scripts/verify-accessibility.mjs             │
│ 3. Automated DOM Auditing: jest-axe on all component test suites       │
│ 4. Synthetic Browser Testing: Playwright (mobile responsive + a11y)    │
│ 5. Storybook A11y Addon: Error-mode visual and DOM ruleset             │
├────────────────────────────────────────────────────────────────────────┤
│ REQUIRED MANUAL GATES (Human Maintainer Review)                        │
│ 1. Assistive Technology Matrix: NVDA, VoiceOver, TalkBack, JAWS        │
│ 2. Keyboard-Only Navigation & Focus Trap Checklist                     │
│ 3. 200% & 400% Browser Zoom Reflow & Text Resizing                     │
│ 4. High-Contrast / Forced-Colors Mode Visual Inspection                │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Automated Verification Gates

| Tier | Tool / Script | Enforcement Scope | Command | CI Gate Failure Trigger |
|---|---|---|---|---|
| **Tier 1: Static Linter** | ESLint (`eslint-plugin-jsx-a11y`) | Missing alt text, unlabelled buttons, invalid ARIA roles, missing form labels, non-interactive handlers. | `npm run lint` | Any `jsx-a11y` error. |
| **Tier 2: Static Types** | TypeScript (`tsc --noEmit`) | Strict ARIA prop types, missing HTML attributes, invalid role literals. | `npm run type-check` | Type check failures. |
| **Tier 3: CI Gate Script** | `scripts/verify-accessibility.mjs` | 1. Zero concealed test skips (`.skip`, `xit`, `xdescribe`).<br>2. Coverage of all 12 canonical UI states.<br>3. Mandatory ARIA live regions on status/banner components. | `npm run verify:accessibility` | Exit code 1 on skips or missing canonical states. Runs automatically in `prebuild`. |
| **Tier 4: Component Axe** | Jest + `jest-axe` | Automated WCAG 2.1 AA DOM rule checks on mounted React component trees. | `npm run test:a11y` | Any axe violation found during test execution. |
| **Tier 5: E2E Playwright** | Playwright Test | Mobile viewport reflow (375×812), focus traps, keyboard navigation (`e2e/keyboard-navigation.spec.ts`, `e2e/mobile-responsive.spec.ts`). | `npm run test:e2e` | Overflow detected or modal focus escape. |
| **Tier 6: Storybook A11y** | `@storybook/addon-a11y` | Evaluates component stories against axe-core rules in error mode. | `npm run build-storybook` | Any component story failing axe-core rules. |

---

### 5.2 Required Manual Review Protocol

Automated tools catch approximately 40–50% of accessibility issues. The following manual checks are **mandatory** for human maintainers prior to merging pull requests:

#### Check 1: Screen Reader Speech Verification Matrix
Test every primary flow with at least two screen reader / browser pairings:
1. **Windows:** NVDA (latest) + Google Chrome / Mozilla Firefox
2. **macOS:** VoiceOver + Apple Safari
3. **iOS:** VoiceOver + Mobile Safari (physical device)
4. **Android:** TalkBack + Chrome (physical device)

*Verification Checklist:*
- [ ] Landmarks announce clearly (`banner`, `navigation`, `main`, `contentinfo`).
- [ ] Heading hierarchy reads logically (h1 -> h2 -> h3) without skipped levels.
- [ ] Live regions announce transaction progression without repeating or cutting off speech.
- [ ] Decorative icons are completely silent (`aria-hidden="true"`).
- [ ] Error messages announce assertively upon form validation failure.

#### Check 2: Keyboard-Only Traversal Checklist
Operate the entire application using only the keyboard (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`, Arrow keys):
- [ ] Skip link is visible on first Tab press and navigates directly to `#main-content`.
- [ ] Focus ring is clearly visible on every interactive control with at least 3:1 contrast.
- [ ] Focus moves logically from top to bottom, left to right.
- [ ] Opening any modal dialog traps focus inside the dialog; `Escape` closes it and restores focus to the trigger.
- [ ] Data tables are keyboard-scrollable using Arrow keys when content overflows horizontally.

#### Check 3: 200% & 400% Zoom Reflow Checklist
In desktop Chrome / Firefox, zoom page to 200% and 400%:
- [ ] No root horizontal scrollbar appears (reflows to single column).
- [ ] Text content does not truncate with ellipsis in a way that hides critical numbers or hashes.
- [ ] Sticky headers and action rails unpin cleanly or provide internal scrolling without blocking view.
- [ ] Action buttons (Verify, Stake, Submit, Claim) remain fully visible and clickable.

#### Check 4: High Contrast & Forced Colors Mode
Enable Windows High Contrast / Contrast Themes (Desert, Aquatic, Night Sky) or macOS Increase Contrast:
- [ ] All button borders and active tab indicators remain visible.
- [ ] Status badges remain distinguishable via text label and unique icon glyph without relying on color.
- [ ] Focus rings remain sharp and high-contrast against canvas.

---

## 6. Accessibility Gaps & Proposed Follow-Up Issues

In strict compliance with the contribution boundaries of STAB-DOC-FE-002, existing gaps identified during this audit are cataloged below and formally proposed as standalone issues. No code or architecture is invented or refactored within this documentation issue.

```
┌────────────────────────────────────────────────────────────────────────┐
│               IDENTIFIED ACCESSIBILITY GAPS & ROADMAP                  │
├────────────────────────────────────────────────────────────────────────┤
│ GAP-A11Y-001: Debounce Live Region Announcements on Rapid WebSocket    │
│ GAP-A11Y-002: Roving Tabindex for Dense Claims & Queue Tables          │
│ GAP-A11Y-003: Automated 400% Zoom Reflow Playwright CI Suite          │
│ GAP-A11Y-004: Unified Focus Trap for RainbowKit & World ID Modals      │
│ GAP-A11Y-005: High-Contrast / Forced-Colors Design Token Gate          │
└────────────────────────────────────────────────────────────────────────┘
```

### Proposed Issue 1: Standardize Live-Region Debouncing for Rapid WebSocket Bursts
- **Identifier:** `GAP-A11Y-001`
- **Objective:** Prevent screen reader speech buffer flooding during rapid block re-indexing or high-frequency activity feed events.
- **Scope:**
  - Create a custom hook `useDebouncedLiveAnnouncer(message, delay = 500)` in `src/hooks/`.
  - Throttle sequential polite status announcements in `WebSocketStatus.tsx` and `RealtimeActivityFeed.tsx`.
  - Ensure high-priority error/revert alerts (`role="alert"`) bypass debounce throttling.

### Proposed Issue 2: Implement Roving Tabindex and Grid Navigation for Data Tables
- **Identifier:** `GAP-A11Y-002`
- **Objective:** Improve keyboard efficiency in `ActiveClaimsTable` and `OperationalQueueTable` by adopting the WAI-ARIA Grid pattern.
- **Scope:**
  - Support Arrow key navigation (Up, Down, Left, Right) between table cells.
  - Implement roving `tabIndex={0}` so tabbing into the table remembers the last focused cell rather than cycling through every individual link/button.
  - Retain horizontal scroll region fallback for screen readers.

### Proposed Issue 3: Automated 400% Zoom Reflow Regression Gate in Playwright CI
- **Identifier:** `GAP-A11Y-003`
- **Objective:** Ensure automated regression protection against horizontal page overflow at 400% zoom (WCAG 1.4.10 Reflow).
- **Scope:**
  - Add Playwright E2E suite `e2e/reflow-zoom.spec.ts` testing 1280px viewport at 4.0 device scale factor (simulating 320 CSS px width).
  - Assert `document.documentElement.scrollWidth <= window.innerWidth` across all 10 approved screens.
  - Add visual regression snapshots for mobile reflow layouts.

### Proposed Issue 4: Unified Focus Trapping and Restoration for External Modals
- **Identifier:** `GAP-A11Y-004`
- **Objective:** Standardize focus restoration and trapping when interacting with third-party Web3 modal SDKs (RainbowKit wallet connect, Worldcoin IDKit).
- **Scope:**
  - Audit RainbowKit modal dismissal to ensure focus reliably returns to `ConnectButton.tsx`.
  - Audit Worldcoin IDKit modal dismissal to ensure focus returns to `WorldcoinVerifyButton.tsx`.
  - Provide fallback focus restoration target when external iframe modals unmount unexpectedly.

### Proposed Issue 5: Automated Color Contrast Regression Gate for High Contrast Mode
- **Identifier:** `GAP-A11Y-005`
- **Objective:** Establish automated CI tests ensuring semantic token contrast holds under Windows High Contrast Mode and CSS `forced-colors: active`.
- **Scope:**
  - Add `@media (forced-colors: active)` overrides in `src/app/globals.css` ensuring button borders and focus rings use `ButtonText` and `Highlight`.
  - Add automated test assertions verifying status badge icon glyphs render with explicit borders when colors are flattened by OS contrast themes.

---

## 7. Verification and Contribution Integrity Evidence

- **Document Authority:** STAB-DOC-FE-002 (#435) completes the Responsive and Accessibility Acceptance Matrix requirement.
- **Additive Baseline:** 100% additive documentation artifact; no production bundle code, dependencies, or CI checks were modified, bypassed, or weakened.
- **Non-Invention Guarantee:** All routes, components, and journeys documented correspond strictly to existing codebase entrypoints and canonical contracts.
- **Repository Link Integrity:** All cross-document links utilize GitHub-style and local repo paths adhering to repository conventions.
