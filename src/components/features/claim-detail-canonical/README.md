# Claim Detail Canonical Components

Components for rendering claim details from canonical API projections with comprehensive error handling, accessibility, and state management.

## Overview

This module implements the claim detail view according to [CLAIM_DETAIL_STATE_MODEL.md](../../../../docs/CLAIM_DETAIL_STATE_MODEL.md), providing:

- **Canonical projection rendering**: Never fabricates protocol state
- **Fail-closed validation**: Malformed projections throw errors instead of rendering
- **Comprehensive state handling**: Loading, ready, ready-stale, not-found, error
- **Accessibility**: WCAG AA compliant with ARIA, keyboard nav, focus management
- **Error recovery**: Automatic retry, manual refresh, navigation fallback

## Components

### ClaimDetailView

Main orchestration component that fetches and renders claim details.

```tsx
import { ClaimDetailView } from '@/components/features/claim-detail-canonical';

<ClaimDetailView claimId="claim-123" enablePolling={true} />
```

**Props:**
- `claimId: string` — Canonical claim identifier (required)
- `enablePolling?: boolean` — Enable polling for mutable claims (default: true)

### ClaimActions

Wallet-gated action buttons (verify, dispute).

```tsx
import { ClaimActions } from '@/components/features/claim-detail-canonical';

<ClaimActions
  claim={claimProjection}
  freshness={freshnessResult}
  onVerify={handleVerify}
  onDispute={handleDispute}
/>
```

**Props:**
- `claim: ClaimDetailProjection` — Claim projection data (required)
- `freshness: UseClaimDetailFreshnessResult` — Freshness metadata (required)
- `onVerify?: () => void` — Callback when Verify button clicked
- `onDispute?: () => void` — Callback when Dispute button clicked

**Gating Logic:**
1. **Wallet state**: Disconnected, loading, unsupported, or error disables actions
2. **Claim status**: Settled claims (VERIFIED, REJECTED) hide actions
3. **Freshness**: Degraded projections disable actions
4. **Write readiness**: Chain, account, or config issues disable actions

### ClaimDetailErrorBoundary

Error boundary wrapper that isolates rendering errors.

```tsx
import { ClaimDetailErrorBoundary, ClaimDetailView } from '@/components/features/claim-detail-canonical';

<ClaimDetailErrorBoundary claimId="claim-123">
  <ClaimDetailView claimId="claim-123" />
</ClaimDetailErrorBoundary>
```

**Props:**
- `children: ReactNode` — Components to wrap (required)
- `claimId?: string` — Claim ID for scoped error logging
- `onReset?: () => void` — Callback invoked on error boundary reset

## Error Handling

### Error States

The component handles 6 canonical error codes:

| Code | Meaning | Recovery |
|------|---------|----------|
| `CLAIM_NOT_FOUND` | Claim does not exist | Navigate to claims list |
| `PROJECTION_UNAVAILABLE` | Network or server error | Retry with exponential backoff |
| `PROJECTION_MALFORMED` | Invalid data from API | Retry, log to telemetry |
| `PROJECTION_STALE` | Indexer lag | Show stale banner, manual refresh |
| `UNSUPPORTED_CHAIN` | Not on Optimism/OP Sepolia | Prompt chain switch |
| `UNKNOWN` | Unexpected error | Retry |

### Error Recovery Strategies

1. **Automatic Retry** (PROJECTION_UNAVAILABLE, PROJECTION_MALFORMED, UNKNOWN)
   - React Query handles retries with exponential backoff
   - Max 2 retries for transient errors
   - Aborts don't trigger retry (normal cancellation flow)

2. **Manual Refresh** (PROJECTION_STALE, ready-stale state)
   - Staleness indicator shown with "Refresh" button
   - User-initiated refetch without page reload

3. **Navigation** (CLAIM_NOT_FOUND)
   - "Back to Claims" button navigates to claims list
   - Terminal state, no retry

4. **Chain Switch** (UNSUPPORTED_CHAIN)
   - Error message prompts chain switch
   - No retry until chain is switched

### Focus Management

All error states implement focus management for accessibility:

- **ClaimDetailError**: Focus moves to error heading when error appears
- **ClaimNotFound**: Focus moves to not-found heading when shown
- **Retry button**: Focusable and keyboard-accessible

## Freshness Handling

### Freshness Levels

| Level | Condition | UI Treatment |
|-------|-----------|--------------|
| `fresh` | ≤30s old, API reports fresh | No indicator |
| `stale` | >30s old or API reports stale | Yellow banner with "Refresh" button |
| `degraded` | API reports degraded (partial data) | Amber banner with reason |

### Polling Behavior

- **Mutable states** (OPEN, UNDER_REVIEW, DISPUTED): Poll every 10s
- **Terminal states** (VERIFIED, REJECTED): No polling
- **On window focus**: Refetch if data is stale
- **On wallet connect/disconnect**: Invalidate and refetch

## Accessibility

### ARIA Roles and Attributes

- **Loading**: `role="status" aria-busy="true"`
- **Error**: `role="alert" aria-live="assertive"`
- **Stale banner**: `role="status" aria-live="polite"`
- **Not found**: `role="status"`

### Keyboard Navigation

- All interactive elements (buttons, links) reachable via Tab
- Retry/refresh buttons actionable via Enter/Space
- Evidence links include descriptive aria-labels
- Focus management on state transitions

### Reduced Motion

- Skeleton animations disabled when `prefers-reduced-motion: reduce`
- Transitions replaced with instant state changes
- Loading indicators use static icons instead of spinners

## Usage Examples

### Basic Usage with Actions

```tsx
// app/(dashboard)/claim-detail/[claimId]/page.tsx
import { ClaimDetailView, ClaimDetailErrorBoundary } from '@/components/features/claim-detail-canonical';
import { useClaimActionWorkflow } from '@/hooks/useClaimActionWorkflow';

export default function ClaimDetailPage({ params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = React.use(params);
  const workflow = useClaimActionWorkflow(claimId);

  return (
    <ClaimDetailErrorBoundary claimId={claimId}>
      <ClaimDetailView
        claimId={claimId}
        onVerify={workflow.openVerify}
        onDispute={workflow.openDispute}
      />
    </ClaimDetailErrorBoundary>
  );
}
```

### Basic Usage

```tsx
// app/(dashboard)/claim-detail/[claimId]/page.tsx
import { ClaimDetailView, ClaimDetailErrorBoundary } from '@/components/features/claim-detail-canonical';

export default function ClaimDetailPage({ params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = React.use(params);

  return (
    <ClaimDetailErrorBoundary claimId={claimId}>
      <ClaimDetailView claimId={claimId} />
    </ClaimDetailErrorBoundary>
  );
}
```

### With Custom Error Recovery

```tsx
function ClaimDetailPageWithRecovery({ claimId }: { claimId: string }) {
  const [resetKey, setResetKey] = React.useState(0);

  return (
    <ClaimDetailErrorBoundary
      claimId={claimId}
      key={resetKey}
      onReset={() => setResetKey(prev => prev + 1)}
    >
      <ClaimDetailView claimId={claimId} />
    </ClaimDetailErrorBoundary>
  );
}
```

### Disabling Polling

```tsx
// For static/archived claims where polling is unnecessary
<ClaimDetailView claimId="claim-123" enablePolling={false} />
```

### Disabling Polling

```tsx
// For static/archived claims where polling is unnecessary
<ClaimDetailView claimId="claim-123" enablePolling={false} />
```

### Disabling Actions

```tsx
// For read-only views without wallet integration
<ClaimDetailView claimId="claim-123" showActions={false} />
```

## Wallet Integration

### Wallet States

ClaimActions handles 6 wallet states from `useCanonicalWallet`:

| State | UI Treatment | Actions Enabled |
|-------|--------------|-----------------|
| `disconnected` | "Connect wallet" banner | ❌ |
| `loading` | "Connecting..." spinner | ❌ |
| `unsupported` | "Switch network" prompt with button | ❌ |
| `account_error` | Error message with reconnect | ❌ |
| `config_error` | Fatal error message | ❌ |
| `ready` | Wallet address shown | ✅ |

### Write Readiness Gates

Actions are further gated by `useWriteReadiness`:

- ✅ Wallet connected and on supported chain
- ✅ Account address is valid
- ✅ Claim is in mutable state (not VERIFIED or REJECTED)
- ✅ Projection is not degraded (critical data available)
- ✅ No blocking configuration errors

**Blocking conditions:**
- Projection staleness level `degraded` (partial data)
- Claim status is `VERIFIED` or `REJECTED` (settled)
- Wallet is not on Optimism/OP Sepolia
- Canonical contract address is not resolved

### Action Workflow Hook

`useClaimActionWorkflow` manages the complete user journey:

```tsx
import { useClaimActionWorkflow } from '@/hooks/useClaimActionWorkflow';

function MyComponent({ claimId }: { claimId: string }) {
  const workflow = useClaimActionWorkflow(claimId);

  // Open verify modal
  const handleVerify = () => workflow.openVerify();

  // Submit transaction
  const handleSubmit = async (txHash: string) => {
    workflow.submit(txHash);
    // Wait for confirmation...
    workflow.onSuccess(); // or workflow.onError(error)
  };

  return (
    <>
      <ClaimDetailView claimId={claimId} onVerify={handleVerify} />
      
      {workflow.state.isOpen && (
        <VerifyModal
          isSubmitting={workflow.state.isSubmitting}
          error={workflow.state.error}
          onSubmit={handleSubmit}
          onClose={workflow.close}
        />
      )}
    </>
  );
}
```

**Workflow states:**
- `action: 'verify' | 'dispute' | null` — Current action
- `isOpen: boolean` — Modal visibility
- `isSubmitting: boolean` — Transaction in flight
- `txHash: string | null` — Transaction hash
- `error: Error | null` — Submission error

**Automatic behaviors:**
- Invalidates claim detail projection on success
- Invalidates claims list projection on success
- Closes modal 2s after success (for feedback)
- Resets workflow state on close

## Testing

### Required Test Coverage

- ✅ Unit tests for view state derivation
- ✅ Component tests for all 5 view states (loading, ready, ready-stale, not-found, error)
- ✅ Error recovery tests (retry, refresh, navigate)
- ✅ Focus management tests
- ✅ Accessibility tests (axe violations, keyboard nav, screen reader announcements)
- ✅ Integration tests (fetch → loading → ready, error → retry → ready)

See [CLAIM_DETAIL_STATE_MODEL.md](../../../../docs/CLAIM_DETAIL_STATE_MODEL.md) for complete testing requirements.

## Security

### Content Sanitization

All user-generated content is sanitized before rendering:

- **Title**: `sanitizeText(claim.title, 300)`
- **Description**: `sanitizeText(claim.description, 5000)`
- **Evidence URLs**: `safeUrl()` validation, fail closed to plain text
- **Images**: `loading="lazy"` and `referrerPolicy="no-referrer"`

### Telemetry Redaction

- Never log claim content (title, description, evidence)
- Wallet addresses hashed before logging
- Transaction hashes logged as-is (public on-chain data)
- Error messages redacted (no PII or secrets)

## Related Documentation

- [CLAIM_DETAIL_STATE_MODEL.md](../../../../docs/CLAIM_DETAIL_STATE_MODEL.md) — Complete state model
- [UI_STATE_MODEL.md](../../../../docs/UI_STATE_MODEL.md) — Canonical frontend state model
- [THREAT_MODEL.md](../../../../docs/THREAT_MODEL.md) — Security boundaries
- [pr-a11y-wcag-aa.md](../../../../docs/pr-a11y-wcag-aa.md) — Accessibility requirements
