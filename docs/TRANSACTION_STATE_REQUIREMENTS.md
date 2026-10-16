# Transaction State Requirements

**Work Item:** V2-FE Transaction Confirmation, Finality, and Reorg States  
**Version:** 1.0  
**Last Updated:** 2026-09-27

## Purpose

This document defines the requirements for transaction state handling in TruthBounty's frontend, ensuring correct confirmation tracking, finality detection, and reorg reconciliation.

## Core Principles

### 1. Fail-Closed Validation

**Never fabricate transaction state.** All transaction data must come from canonical sources:

- **Transaction hashes:** Only from wallet provider (Wagmi)
- **Block numbers:** Only from RPC (`eth_blockNumber`, `eth_getTransactionReceipt`)
- **Confirmation counts:** Calculated from canonical block numbers only
- **Finality status:** Based on validated thresholds + indexer acknowledgement

**On uncertainty, fail closed:**
- Unknown chains → return null/false (no assumptions)
- Stale RPC data → return 0 confirmations (don't show progress)
- Missing receipt → don't show success (investigation required)
- Missing indexer ack → withhold durable success

### 2. Canonical Authority

**On-chain receipts are authoritative** for:
- Transaction inclusion (blockNumber, blockHash)
- Execution status (success/revert)
- Gas consumption (gasUsed)

**API projections** (indexer, subgraph) are:
- Read-only layer for query performance
- Must be acknowledged via `indexerAcknowledged` flag
- Cannot override on-chain state
- Must be invalidated on reorg

### 3. Multi-Condition Success Guards

**Durable success requires ALL conditions:**
```typescript
state.status === 'finalized' &&
confirmations >= finalizedThreshold &&
indexerAcknowledged === true &&
state.error !== 'REORGED'
```

**Provisional success requires:**
```typescript
(state.status === 'safe' || state.status === 'indexing') &&
confirmations >= safeThreshold &&
state.error !== 'REORGED'
```

### 4. Reorg Recovery

**Detection sources** (redundant, fail-safe):
1. WebSocket ROLLBACK events (primary, low latency)
2. RPC receipt validation (fallback, polls for missing receipts)
3. RPC block hash validation (fallback, compares blockHash at same height)

**Recovery flow** (5 steps, must complete sequentially):
1. **Detect:** Receive reorg signal from any detection source
2. **Invalidate:** Clear React Query caches for affected data
3. **Notify:** Display banner with reorg details (ARIA alert)
4. **Acknowledge:** User confirms they've seen the notification
5. **Retry:** User can retry transaction from idle state

**Never auto-resolve reorgs.** Require explicit user action.

## Transaction Lifecycle States

### State Diagram

```
IDLE
  ↓ (PREPARE)
PREPARING
  ↓ (REQUEST_SIGNATURE)
SIGNATURE-REQUESTED
  ↓ (SUBMIT)
SUBMITTED
  ↓ (CONFIRM)
CONFIRMING ←─────┐
  ↓ (MARK_SAFE)  │ (CONFIRM with incremented count)
SAFE ─────────────┤
  ↓ (INDEXING)   │
INDEXING ─────────┤
  ↓ (FINALIZE)   │
FINALIZED        │
                 │
  ┌──────────────┘
  │ (REORG from any post-SUBMITTED state)
  ↓
REORGED
  ↓ (RETRY)
IDLE

Terminal failures:
- DROPPED (mempool removal)
- REPLACED (gas price bump)
- REVERTED (on-chain failure)
```

### State Descriptions

| State | Description | Fields Required | UI Display |
|-------|-------------|-----------------|------------|
| `idle` | No transaction in progress | none | Hidden |
| `preparing` | Building transaction payload | `chainId` | Loading spinner |
| `signature-requested` | Wallet popup open | `chainId` | "Waiting for signature..." |
| `submitted` | In mempool | `txHash`, `chainId` | "Submitted to network" |
| `confirming` | Accumulating confirmations | `txHash`, `chainId`, `blockNumber`, `confirmations` | Progress bar (X/Y) |
| `safe` | Safe threshold reached | `txHash`, `chainId`, `blockNumber`, `confirmations` | Green badge "Safe" |
| `indexing` | API projection in progress | `txHash`, `chainId`, `blockNumber`, `confirmations` | "Indexing..." |
| `finalized` | Finalized threshold + indexer ack | `txHash`, `chainId`, `blockNumber`, `confirmations` | Green badge "Confirmed" |
| `dropped` | Removed from mempool | `txHash`, `chainId`, `error` | Error card + retry |
| `replaced` | Replaced by new tx | `txHash`, `chainId`, `replacedBy` | Info card + replacement link |
| `reverted` | On-chain revert | `txHash`, `chainId`, `error` | Error card + retry |
| `reorged` | Chain reorganization | `txHash`, `chainId`, `error: 'REORGED'` | Banner + retry |

## Confirmation Tracking

### Calculation

```typescript
confirmations = (currentBlock - txBlock) + 1
```

**Edge cases:**
- `currentBlock < txBlock` → return 0 (invalid state)
- `txBlock === null` → return 0 (not included yet)
- `currentBlock === null` → return 0 (RPC error, fail closed)

### Chain-Specific Thresholds

| Chain | Chain ID | Safe | Finalized | Block Time |
|-------|----------|------|-----------|------------|
| Optimism Mainnet | 10 | 1 | 12 | 2s |
| OP Sepolia | 11155420 | 1 | 12 | 2s |
| Hardhat (local) | 31337 | 1 | 1 | 100ms |

**Unknown chains:** Return `null` from all finality checks (fail closed).

### Polling Strategy

| State | Interval | Stop Condition |
|-------|----------|----------------|
| `submitted` | 2s | Transition to confirming |
| `confirming` | 3s | Reach safe threshold |
| `safe` | 5s | Reach finalized threshold |
| `indexing` | 5s | Indexer acknowledges |
| Terminal states | null | Already stopped |

**Optimization:** Stop polling immediately on terminal transitions.

## Finality Detection

### Finality Levels

1. **None:** `confirmations < safeThreshold`
   - Transaction vulnerable to reorg
   - Do not show success UI

2. **Safe:** `confirmations >= safeThreshold`
   - Low reorg risk (~2s on Optimism)
   - Show provisional success (green badge "Safe")
   - Still vulnerable to deep reorgs

3. **Indexed:** Transaction acknowledged by API
   - API projection updated
   - Query results now include this transaction
   - Combined with Safe threshold → show provisional success

4. **Finalized:** `confirmations >= finalizedThreshold + indexerAcknowledged`
   - Reorg-proof (~24s on Optimism)
   - Show durable success (green badge "Confirmed")
   - Safe to display protocol state changes (rewards, reputation, etc.)

### L2-Specific Considerations (Optimism)

**Optimism uses:**
- Bedrock sequencer (centralized, low latency)
- L1 batch submission (every ~few minutes)
- L1 finality for ultimate security

**Finalized threshold (12 confirmations) ensures:**
- Sequencer has submitted batch to L1
- L1 block is beyond reorg depth
- Data availability guaranteed

**Safe threshold (1 confirmation) provides:**
- Inclusion in canonical sequencer chain
- Acceptable for UI feedback (progress indicators)
- Not sufficient for protocol state mutations

## Reorg Reconciliation

### Detection Methods

#### 1. WebSocket ROLLBACK Events (Primary)

**Source:** `useReorgReconciliation` hook  
**Latency:** ~100ms  
**Coverage:** All tracked transactions  

```typescript
{
  type: 'ROLLBACK',
  affectedHashes: ['0x...'],
  oldCursor: { blockNumber: 12345n },
  newCursor: { blockNumber: 12340n }
}
```

**Pros:** Fast, comprehensive  
**Cons:** Events can be missed (connection issues)

#### 2. RPC Receipt Validation (Fallback)

**Source:** `useReorgDetection` hook  
**Method:** `eth_getTransactionReceipt(txHash)`  
**Interval:** 5s  
**Detection:** Receipt that existed now returns `null`

**Pros:** Reliable, canonical RPC data  
**Cons:** Higher latency, more RPC calls

#### 3. RPC Block Hash Validation (Fallback)

**Source:** `useReorgDetection` hook  
**Method:** `eth_getBlockByNumber(blockNumber)`  
**Interval:** 5s  
**Detection:** Receipt's `blockHash` ≠ current RPC block hash at same height

**Pros:** Detects reorgs even if receipt still exists  
**Cons:** Highest RPC usage

### Plausibility Assessment

| Confirmations | Assessment | Action |
|---------------|------------|--------|
| 0-3 | Plausible | Normal reorg, show banner |
| 4-10 | Suspicious | Unusual depth, escalate severity |
| 11+ | Anomalous | Report to monitoring, investigate |

**Optimism context:** Reorgs >3 confirmations are rare due to centralized sequencer.

### Recovery Actions

**Immediate (automatic):**
1. Mark transaction as `reorged` (state machine REORG event)
2. Invalidate React Query caches: `claims`, `verifications`, `settlements`
3. Stop polling (no point tracking orphaned transaction)

**User-facing (requires acknowledgement):**
1. Display banner with `role="alert"`, `aria-live="assertive"`
2. Show reorg details: method, depth, original block number
3. Provide actions: [Retry Transaction] [View Details] [Dismiss]

**Post-acknowledgement:**
1. User clicks "Retry" → return to `idle` state
2. User can re-initiate transaction with updated nonce/gas

### Never Auto-Resolve

**Do NOT:**
- Re-submit transaction automatically (nonce may be invalid)
- Fabricate replacement transaction hash
- Hide reorg from user (uncertainty must be visible)
- Continue polling orphaned transaction

**DO:**
- Make reorg state obvious (banner, alert)
- Require explicit user action to proceed
- Invalidate all derived state (caches, UI state)

## Accessibility Requirements

### WCAG 2.1 AA Compliance

All transaction state UI must meet:
- **1.4.3 Contrast:** 4.5:1 for normal text, 3:1 for large text
- **2.1.1 Keyboard:** All actions keyboard-accessible (Tab, Enter, Escape)
- **2.4.7 Focus Visible:** Clear focus indicators
- **4.1.3 Status Messages:** Appropriate ARIA live regions

### Component-Specific Requirements

#### ConfirmationProgress

```tsx
<div role="progressbar"
     aria-label="Transaction confirming, 5 of 12 confirmations"
     aria-valuenow={5}
     aria-valuemin={0}
     aria-valuemax={12}>
  {/* Visual progress bar */}
</div>

<span className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true">
  Transaction confirming, 5 of 12 confirmations, approximately 14 seconds remaining
</span>
```

**Announcement strategy:**
- 1st confirmation: "Transaction included in block"
- Every 3 confirmations: "X confirmations received"
- Safe threshold: "Transaction safe with X confirmations"
- Finalized threshold: "Transaction finalized with X confirmations"

**Do NOT announce every block** (spam for screen readers).

#### ReorgBanner

```tsx
<section role="alert"
         aria-live="assertive"
         aria-atomic="true">
  <h2>Chain Reorganization Detected</h2>
  <p>Your transaction was affected...</p>
  <button onClick={onAcknowledge}>Acknowledge</button>
</section>
```

**Focus management:**
- Trap focus within banner (Tab cycles actions)
- Escape key dismisses (returns focus to trigger)
- Focus first action button on mount

#### TransactionStatus

**Live regions per state:**
- Preparing, Submitted, Confirming: `aria-live="polite"` (non-disruptive)
- Safe, Finalized: `aria-live="polite"` (success announcement)
- Dropped, Reverted, Reorged: `aria-live="assertive"` (interrupts)

**Reduced motion:**
- Disable spinner animations
- Disable progress bar transitions
- Keep polling (still functional)

## Testing Requirements

### Unit Tests (Utilities)

**Coverage areas:**
- Confirmation calculation (all edge cases)
- Finality checks (all thresholds, unknown chains)
- Finality guards (multi-condition enforcement)
- Time estimates (formatting, edge cases)
- Polling intervals (state-based logic)
- Progress calculation (percentage, clamping)
- Validation (state consistency, transitions)
- Reorg state checks (all state combinations)
- Recovery state management (step sequencing)
- Impact analysis (severity determination)
- Plausibility assessment (depth-based)
- Notification generation (context-aware)
- Metrics tracking (recording, aggregation)

**Required:**
- ✅ `src/lib/__tests__/transaction-confirmation.test.ts` (implemented)
- ✅ `src/lib/__tests__/reorg-detection.test.ts` (implemented)

### Component Tests

**Coverage areas:**
- Rendering (all props, all states)
- ARIA attributes (roles, labels, values)
- Progress calculations (percentage accuracy)
- Time estimates (display, formatting)
- Animations (spinner, progress bar, reduced motion)
- Compact mode (conditional rendering)
- Edge cases (0 confirmations, overflow, large numbers)

**Required:**
- ✅ `src/components/transactions/__tests__/ConfirmationProgress.test.tsx` (implemented)
- ⚠️ `src/components/transactions/__tests__/TransactionStatus.test.tsx` (specified, not implemented)

### Integration Tests

**Coverage areas:**
- Polling behavior (intervals, start/stop)
- State machine integration (transitions, events)
- Reorg detection (WebSocket + RPC coordination)
- Cache invalidation (React Query keys)
- Hook composition (confirmations + reorg detection)

**Required:**
- ⚠️ Hook integration tests (specified, not implemented)
- ⚠️ State machine integration tests (specified, not implemented)

### E2E Tests (Playwright)

**Coverage areas:**
- Full transaction flow (submit → confirming → finalized)
- Reorg scenario (inject ROLLBACK event → verify banner)
- Accessibility (keyboard nav, screen reader announcements)
- Visual regression (snapshots for all states)

**Required:**
- ⚠️ `e2e/transaction-confirmation-flow.spec.ts` (specified, not implemented)
- ⚠️ `e2e/transaction-reorg-recovery.spec.ts` (specified, not implemented)

### CI Gates

All PRs must pass:
1. `npm run lint` (ESLint + Prettier)
2. `npm run typecheck` (TypeScript strict mode)
3. `npm test` (Jest unit + component tests)
4. `npm run build` (Next.js production build)
5. `npm run test:e2e` (Playwright E2E tests)

## Implementation Files

### Documentation
- `docs/TRANSACTION_CONFIRMATION_FINALITY_MODEL.md` — State model, 12 states, specifications
- `docs/TRANSACTION_STATE_REQUIREMENTS.md` — This document
- `IMPLEMENTATION_V2_FE_TRANSACTION_CONFIRMATION_FINALITY.md` — Implementation report

### Utilities
- `src/lib/transaction-confirmation.ts` — Pure confirmation tracking functions (18 utilities)
- `src/lib/reorg-detection.ts` — Pure reorg detection functions (15 utilities)

### Hooks
- `src/hooks/useTransactionConfirmations.ts` — Confirmation polling hook (wagmi integration)
- `src/hooks/useReorgDetection.ts` — Reorg detection hook (RPC validation)

### Components
- `src/components/transactions/ConfirmationProgress.tsx` — Progress bar component
- `src/components/transactions/TransactionStatus.tsx` — Compound status component (12 states)
- `src/components/transactions/ReorgBanner.tsx` — Reorg alert component (existing)

### Tests
- `src/lib/__tests__/transaction-confirmation.test.ts` — Confirmation utility tests (90+ cases)
- `src/lib/__tests__/reorg-detection.test.ts` — Reorg utility tests (60+ cases)
- `src/components/transactions/__tests__/ConfirmationProgress.test.tsx` — Component tests (40+ cases)

## Usage Examples

### Basic Confirmation Tracking

```typescript
import { useTransactionConfirmations } from '@/hooks/useTransactionConfirmations';
import { ConfirmationProgress } from '@/components/transactions/ConfirmationProgress';

function MyTransactionUI({ txHash, txBlockNumber, chainId }) {
  const {
    confirmations,
    isSafe,
    isFinalized,
    estimatedTimeToFinalized,
  } = useTransactionConfirmations({
    txHash,
    txBlockNumber,
    chainId,
  });

  return (
    <ConfirmationProgress
      confirmations={confirmations}
      targetConfirmations={12}
      blockNumber={txBlockNumber}
    />
  );
}
```

### Finality Guards

```typescript
import {
  canShowDurableSuccess,
  canShowProvisionalSuccess,
} from '@/lib/transaction-confirmation';

function RewardDisplay({ txState, indexerAcknowledged }) {
  const durableSuccess = canShowDurableSuccess(txState, indexerAcknowledged);
  const provisionalSuccess = canShowProvisionalSuccess(txState);

  if (durableSuccess) {
    return <RewardAmount amount={100} status="confirmed" />;
  }

  if (provisionalSuccess) {
    return <RewardAmount amount={100} status="pending" note="Awaiting indexer" />;
  }

  return <Skeleton />;
}
```

### Reorg Detection

```typescript
import { useIntegratedReorgDetection } from '@/hooks/useReorgDetection';
import { useReorgReconciliation } from '@/hooks/useReorgReconciliation';
import { ReorgBanner } from '@/components/transactions/ReorgBanner';

function TransactionMonitor({ txHash, txBlockNumber, txBlockHash, chainId }) {
  const { view: reorgBannerView } = useReorgReconciliation({ txHash, chainId });
  
  const { reorgDetected, reorgEvent, clearReorg } = useIntegratedReorgDetection({
    txHash,
    txBlockNumber,
    txBlockHash,
    chainId,
    websocketReorgDetected: reorgBannerView.state !== 'hidden',
    onReorg: (event) => {
      // Invalidate caches
      queryClient.invalidateQueries(['claims']);
      queryClient.invalidateQueries(['verifications']);
    },
  });

  if (reorgBannerView.state !== 'hidden') {
    return (
      <ReorgBanner
        view={reorgBannerView}
        onAcknowledge={clearReorg}
        chainId={chainId}
      />
    );
  }

  return <div>Transaction monitoring...</div>;
}
```

### Compound Status Component

```typescript
import { TransactionStatus } from '@/components/transactions/TransactionStatus';
import { useTransactionMachine } from '@/hooks/useTransactionMachine';

function ClaimTransaction() {
  const { state, send } = useTransactionMachine();
  
  return (
    <TransactionStatus
      state={state}
      safeThreshold={1}
      finalizedThreshold={12}
      indexerAcknowledged={state.indexerAcknowledged}
      currentBlockNumber={currentBlock}
      onRetry={() => send({ type: 'RETRY' })}
      onAcknowledgeReorg={() => send({ type: 'RESET' })}
    />
  );
}
```

## Acceptance Criteria

✅ **Infrastructure Complete:**
- [x] Chain-specific confirmation thresholds configured
- [x] Confirmation calculation utilities implemented
- [x] Finality check utilities implemented
- [x] Finality guard utilities implemented
- [x] Time estimate utilities implemented
- [x] Polling interval logic implemented
- [x] Progress calculation utilities implemented
- [x] Validation utilities implemented
- [x] Reorg state check utilities implemented
- [x] Reorg recovery state management implemented
- [x] Reorg impact analysis implemented
- [x] Reorg plausibility assessment implemented
- [x] Reorg notification generation implemented
- [x] Reorg metrics tracking implemented

✅ **Hooks Complete:**
- [x] `useTransactionConfirmations` with wagmi integration
- [x] `useConfirmationAnnouncement` for accessibility
- [x] `useReorgDetection` with RPC validation
- [x] `useIntegratedReorgDetection` combining WebSocket + RPC

✅ **Components Complete:**
- [x] `ConfirmationProgress` with ARIA progressbar
- [x] `TransactionStatus` compound component (12 states)
- [x] `ReorgBanner` (already existed, integrated)

✅ **Tests Complete:**
- [x] Unit tests for confirmation utilities (90+ cases)
- [x] Unit tests for reorg utilities (60+ cases)
- [x] Component tests for ConfirmationProgress (40+ cases)

⚠️ **Integration/E2E Tests Specified (Not Implemented):**
- [ ] Integration tests (polling, state machine)
- [ ] E2E tests (full flow, reorg scenario, accessibility)

✅ **Documentation Complete:**
- [x] State model documentation with specifications
- [x] Transaction state requirements (this document)
- [x] Implementation report with usage examples

## Related Work

- **V2-FE-051:** Transaction Machine (12 states, pure reducer, contradiction guards)
- **V2-FE-144:** Reorg/Replacement Reconciliation (WebSocket events, cache invalidation)
- **V2-FE Evidence Privacy:** Evidence URL/metadata privacy (completed)

## Sign-off

**Date:** 2026-09-27  
**Status:** Core infrastructure and components complete, integration/E2E tests pending  
**Ready for:** Code review, CI verification, integration test implementation

---

*This document defines the canonical requirements for transaction state handling in TruthBounty's frontend. All implementations must adhere to these requirements.*
