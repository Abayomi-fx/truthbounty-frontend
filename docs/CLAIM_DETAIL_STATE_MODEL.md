# Claim Detail State Model

> **Part of:** V2-FE Claim Details from Canonical Projections
> **Companion to:** [UI_STATE_MODEL.md](./UI_STATE_MODEL.md), [THREAT_MODEL.md](./THREAT_MODEL.md)

---

## 1. Purpose

This document defines the UI state model and component boundaries for rendering claim details from canonical API projections. It ensures:

- **No fabrication**: Transaction success, settlement, verifications, and reputation are never invented.
- **Visible uncertainty**: Stale, degraded, and failed states are accessible and announced.
- **Fail-closed posture**: Missing critical config, unsupported chains, or malformed projections prevent rendering fabricated state.
- **Deterministic states**: Given the same chain state and inputs, the UI renders the same state.

---

## 2. Component Boundaries

### 2.1 Core Components

| Component | Responsibility | State Sources |
|---|---|---|
| `ClaimDetailPage` | Route-level container; loads claim by ID | URL params, useClaimDetailProjection |
| `ClaimDetailView` | Main claim presentation; orchestrates sub-components | ClaimDetailEnvelope, wallet state |
| `ClaimHeader` | Title, status badge, metadata banner | claim.title, claim.status, projection.freshness |
| `ClaimContent` | Description, evidence, category | claim.description, claim.evidence, sanitizers |
| `ClaimVerifications` | Verification list, vote counts, confidence | claim.verifications, claim.voteCounts, claim.confidenceScore |
| `ClaimSettlement` | Settlement state, finalization, tx links | claim.settlement, useFinalizationDetection |
| `ClaimActions` | Wallet-gated mutation triggers (verify, dispute) | useCanonicalWallet, useWriteReadiness |
| `ClaimStalenessIndicator` | Projection freshness warning banner | projection.freshness, projection.generatedAt |
| `ClaimDetailSkeleton` | Loading state skeleton | — |
| `ClaimNotFound` | Not-found state with recovery actions | — |
| `ClaimDetailError` | Error boundary fallback | ClaimDetailError |

### 2.2 Hook Boundaries

| Hook | Purpose | Returns |
|---|---|---|
| `useClaimDetailProjection` | Fetch claim detail projection from API | ClaimDetailEnvelope, viewState, error |
| `useClaimDetailFreshness` | Determine staleness from projection metadata | isStale, freshnessStatus, lastUpdated |
| `useClaimVerificationState` | Derive verification aggregates | supportCount, rejectCount, confidenceScore |
| `useClaimSettlementState` | Derive settlement/finalization state | isSettled, isFinalized, settlementTx |

---

## 3. State Model

### 3.1 Canonical View States

| State | Condition | User-Visible Meaning | ARIA |
|---|---|---|---|
| `loading` | Initial fetch; no data yet | "Loading claim details…" | `role="status" aria-busy="true"` |
| `ready` | Fresh projection available | Claim content rendered | Normal flow |
| `ready-stale` | Projection stale/degraded | Claim content + staleness banner | `role="status"` on banner |
| `not-found` | HTTP 404 or `CLAIM_NOT_FOUND` | "Claim not found" | `role="status"` |
| `error` | Network, server, or malformed projection | "Failed to load claim details" | `role="alert"` |

**Forbidden transitions:**
- `loading` → `ready` without validating the projection envelope.
- `error` → `ready` without a successful refetch.
- `ready` → `ready-stale` without checking projection freshness.

### 3.2 State × Component Matrix

| Component | loading | ready | ready-stale | not-found | error |
|---|:-:|:-:|:-:|:-:|:-:|
| ClaimDetailSkeleton | ✅ | — | — | — | — |
| ClaimDetailView | — | ✅ | ✅ | — | — |
| ClaimStalenessIndicator | — | — | ✅ | — | — |
| ClaimNotFound | — | — | — | ✅ | — |
| ClaimDetailError | — | — | — | — | ✅ |
| ClaimActions (wallet-gated) | — | ✅ | ⚠️ | — | — |

**Legend:** ✅ rendered • ⚠️ rendered with warning • — not rendered

---

## 4. Projection Freshness Model

### 4.1 Freshness Levels

| Level | Condition | UI Treatment |
|---|---|---|
| `fresh` | generatedAt ≤ 30s ago AND freshness=`fresh` | No indicator |
| `stale` | generatedAt > 30s ago OR freshness=`stale` | Yellow banner: "Data may be out of date. Last updated X ago." |
| `degraded` | freshness=`degraded` | Amber banner: "Some data unavailable. [reason]" |

### 4.2 Freshness Thresholds

```typescript
export const CLAIM_DETAIL_FRESHNESS_DEFAULTS = {
  staleAfterMs: 30_000,      // 30s: show staleness indicator
  pollIntervalMs: 10_000,    // 10s: poll when claim is mutable (OPEN, UNDER_REVIEW)
};
```

### 4.3 Polling Behavior

- **Mutable states** (OPEN, UNDER_REVIEW, DISPUTED): Poll every 10s.
- **Terminal states** (VERIFIED, REJECTED): No polling; manual refresh only.
- **On wallet connect/disconnect**: Invalidate and refetch.
- **On visible tab focus**: Refetch if data is stale.

---

## 5. Error Handling

### 5.1 Canonical Error Codes

| Code | Meaning | Recovery |
|---|---|---|
| `CLAIM_NOT_FOUND` | Claim does not exist or was removed | Show not-found state; no retry |
| `PROJECTION_UNAVAILABLE` | Network or server error | Show error state with retry button |
| `PROJECTION_MALFORMED` | Schema validation failed | Show error state; log to telemetry |
| `PROJECTION_STALE` | Indexer lag > critical threshold | Show stale banner; allow manual refresh |
| `UNSUPPORTED_CHAIN` | Chain is not Optimism/OP Sepolia | Fail-closed UI; prompt chain switch |
| `UNKNOWN` | Unexpected error | Show generic error state with retry |

### 5.2 Error Boundary

All claim detail components are wrapped in:

```tsx
<ErrorBoundary scope="feature:claim-detail">
  <ClaimDetailView />
</ErrorBoundary>
```

Unhandled React errors surface as the `ClaimDetailError` component with a "Something went wrong" message and a "Try again" action.

---

## 6. Wallet Integration

### 6.1 Wallet States

Claim actions (verify, dispute) are gated by `useCanonicalWallet`:

| Wallet State | Actions Enabled | UI Treatment |
|---|---|---|
| `disconnected` | ❌ | "Connect wallet to verify" |
| `loading` | ❌ | Disabled with spinner |
| `unsupported` | ❌ | "Switch to Optimism" button |
| `account_error` | ❌ | Show error; "Reconnect wallet" |
| `config_error` | ❌ | Fail-closed boundary |
| `ready` | ✅ | Actions enabled |

### 6.2 Write Readiness

Actions are further gated by `useWriteReadiness`:

```typescript
const readiness = useWriteReadiness({
  claimId: claim.id,
  claimStatus: claim.status,
  wallet,
});

if (!readiness.isReady) {
  // Render disabled state with readiness.blockingReason
}
```

**Blocking reasons:**
- Wallet not connected
- Unsupported network
- Claim in terminal state (cannot verify settled claims)
- Projection stale beyond critical threshold (no writes on stale data)

---

## 7. Settlement & Finalization

### 7.1 Settlement State Projection

The `claim.settlement` field is a projection of on-chain settlement state:

```typescript
interface ClaimSettlementProjection {
  settledAt: string | null;
  settlementTxHash: string | null;
  isFinalized: boolean;
  finalizedBlock: number | null;
}
```

**Invariants:**
- All fields are `null` when not settled (never fabricated).
- `isFinalized` is `true` ONLY when chain finality rules are met.
- `settlementTxHash` links to the canonical settlement transaction.

### 7.2 Finalization Detection

`useFinalizationDetection` validates finalization independently:

```typescript
const finalization = useFinalizationDetection({
  claimId: claim.id,
  contractAddress: canonicalContractAddress,
  enabled: claim.settlement.settledAt !== null,
});

if (finalization.isFinalized && !claim.settlement.isFinalized) {
  // Projection lags chain: show "Confirming…" state
}
```

**Forbidden:**
- Rendering "Finalized" based solely on API projection without chain confirmation.
- Skipping `confirmed` → `finalized` transition (see UI_STATE_MODEL.md).

---

## 8. Evidence Handling

### 8.1 Evidence Sanitization

All evidence content is untrusted and must be sanitized:

```typescript
import { sanitizeEvidenceList } from '@/lib/security/evidence-sanitizer';

const safeEvidence = sanitizeEvidenceList(claim.evidence);
```

**Sanitization rules:**
- URLs validated; unsafe URLs fail closed to plain text.
- Text content trimmed to max length; HTML stripped.
- Images loaded with `loading="lazy"` and `referrerPolicy="no-referrer"`.

### 8.2 Evidence Types

| Type | Rendering | Security |
|---|---|---|
| `link` | SafeExternalLink with noopener/noreferrer | URL validation via safeUrl() |
| `text` | Sanitized text span | sanitizeText() with max length |
| `image` | Lazy-loaded img with referrer policy | URL validation; blocked if unsafe |
| `video` | Not implemented (fail closed) | — |
| `document` | Not implemented (fail closed) | — |

---

## 9. Accessibility Requirements

### 9.1 State Announcements

| State | Announcement | Live Region |
|---|---|---|
| Loading | "Loading claim details" | `aria-live="polite"` |
| Ready | None (content is self-describing) | — |
| Stale | "Data may be out of date" | `role="status"` |
| Error | "Failed to load claim details" | `role="alert" aria-live="assertive"` |
| Not found | "Claim not found" | `role="status"` |

### 9.2 Keyboard Navigation

- All actions reachable via Tab.
- Retry/refresh buttons focusable and actionable via Enter/Space.
- Evidence links include aria-labels for screen readers.
- Verification list uses semantic list markup (`<ul>`, `<li>`).

### 9.3 Focus Management

- On error: Focus moves to error heading.
- On not-found: Focus moves to not-found message.
- On modal open (dispute): Focus trapped in modal.
- On retry success: Focus returns to main content heading.

### 9.4 Reduced Motion

- Skeleton loading animations disabled when `prefers-reduced-motion: reduce`.
- Transition animations replaced with instant state changes.
- Polling indicators use static icons instead of spinners.

---

## 10. Testing Requirements

### 10.1 Unit Tests

- All view state derivation logic (deriveClaimDetailViewState).
- Freshness detection (isProjectionStale).
- Type guards (isClaimDetailProjection, isClaimDetailEnvelope).
- Error code mapping.

### 10.2 Component Tests

- Every view state renders correctly (loading, ready, ready-stale, not-found, error).
- Staleness indicator appears when projection is stale.
- Actions disabled when wallet is not ready.
- Evidence sanitization applied (no raw URLs in DOM).

### 10.3 Integration Tests

- Fetch → loading → ready transition.
- Fetch → error → retry → ready recovery.
- Wallet connect → actions enabled.
- Chain switch → projection refetch.
- Stale projection → manual refresh → fresh projection.

### 10.4 Accessibility Tests

- No axe violations in any view state.
- Keyboard navigation covers all interactive elements.
- Screen reader announcements for state transitions.
- Focus management on error/not-found.

### 10.5 E2E Tests

- Load claim detail by ID from canonical staging API.
- Verify projection freshness metadata is displayed.
- Trigger verification action (wallet interaction mocked).
- Handle not-found claim gracefully.

---

## 11. Telemetry & Redaction

### 11.1 Logged Events

- `claim_detail_loaded` — successful projection fetch
- `claim_detail_stale` — projection marked stale
- `claim_detail_error` — error code, no PII
- `claim_detail_not_found` — claim ID (hashed)

### 11.2 Redaction Rules

- Never log claim content (title, description, evidence).
- Wallet addresses hashed before logging.
- Transaction hashes logged as-is (public on-chain data).

---

## 12. References

- [UI_STATE_MODEL.md](./UI_STATE_MODEL.md) — Canonical frontend state model
- [THREAT_MODEL.md](./THREAT_MODEL.md) — Security boundaries and fail-closed posture
- [CONTRACT_ARTIFACTS.md](./CONTRACT_ARTIFACTS.md) — Contract release artifacts
- [SIWE_AUTH.md](./SIWE_AUTH.md) — Wallet authentication
- [pr-a11y-wcag-aa.md](./pr-a11y-wcag-aa.md) — Accessibility compliance

---

## 13. Implementation Checklist

- [ ] `src/app/types/claim-detail-projection.ts` — Projection types
- [ ] `src/app/api/claim-detail.api.ts` — API client with fail-closed validation
- [ ] `src/hooks/useClaimDetailProjection.ts` — React Query hook
- [ ] `src/hooks/useClaimDetailFreshness.ts` — Freshness detection
- [ ] `src/components/features/claim-detail-canonical/ClaimDetailView.tsx` — Main component
- [ ] `src/components/features/claim-detail-canonical/ClaimHeader.tsx` — Header sub-component
- [ ] `src/components/features/claim-detail-canonical/ClaimContent.tsx` — Content sub-component
- [ ] `src/components/features/claim-detail-canonical/ClaimVerifications.tsx` — Verifications list
- [ ] `src/components/features/claim-detail-canonical/ClaimSettlement.tsx` — Settlement state
- [ ] `src/components/features/claim-detail-canonical/ClaimActions.tsx` — Wallet-gated actions
- [ ] `src/components/features/claim-detail-canonical/ClaimStalenessIndicator.tsx` — Staleness banner
- [ ] `src/components/features/claim-detail-canonical/ClaimDetailSkeleton.tsx` — Loading skeleton
- [ ] `src/components/features/claim-detail-canonical/ClaimNotFound.tsx` — Not-found state
- [ ] `src/components/features/claim-detail-canonical/ClaimDetailError.tsx` — Error state
- [ ] Tests: Unit, component, integration, accessibility, E2E
- [ ] Documentation: Update ARCHITECTURE.md, add JSDoc
