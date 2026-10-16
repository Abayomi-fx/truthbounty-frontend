# Transaction Confirmation, Finality, and Reorg State Model

**Version:** V2-FE Transaction Lifecycle  
**Status:** Canonical Reference  
**Date:** 2026-09-27

## Overview

This document defines the canonical UI state model for transaction confirmation tracking, finality detection, and reorg reconciliation. All transaction status components, hooks, and utilities must conform to this model.

## Security Principles

1. **Never Fabricate State:** Transaction hashes, block numbers, confirmation counts, and finality status come only from wallet/provider/API — never invented client-side
2. **Fail Closed:** On uncertainty (stale data, missing receipt, invalid chain), withhold success affordances
3. **Canonical Authority:** On-chain receipts are authoritative for mutations; API projections are read-only
4. **No Premature Finality:** Safe/finalized states require validated confirmation thresholds + indexer acknowledgement
5. **Reorg Recovery:** Orphaned receipts immediately invalidate success UI; only canonical replacement events resolve reorgs

## Transaction Lifecycle States

### 1. State Diagram

```
                                 ┌─────────────────┐
                                 │      IDLE       │
                                 └────────┬────────┘
                                          │
                                          │ PREPARE
                                          ▼
                                 ┌─────────────────┐
                                 │   PREPARING     │
                                 └────────┬────────┘
                                          │
                                          │ REQUEST_SIGNATURE
                                          ▼
                                 ┌─────────────────┐
                     USER_REJECTED │  SIGNATURE-   │
                          ┌────────┤  REQUESTED    │
                          │        └────────┬────────┘
                          │                 │
                          │                 │ SUBMIT
                          ▼                 ▼
                     ┌─────────┐   ┌─────────────────┐
                     │ DROPPED │   │    SUBMITTED    │
                     └─────────┘   └────────┬────────┘
                                            │
                                            │ CONFIRM (1+ blocks)
                                            ▼
                                   ┌─────────────────┐
                                   │   CONFIRMING    │
                                   │ (N confirmations)│
                                   └────────┬────────┘
                                            │
                           ┌────────────────┼────────────────┐
                           │                │                │
                      REVERT           MARK_SAFE          REPLACE
                           │                │                │
                           ▼                ▼                ▼
                     ┌─────────┐   ┌─────────────────┐ ┌─────────┐
                     │REVERTED │   │      SAFE       │ │REPLACED │
                     └─────────┘   │ (≥ threshold)   │ └─────────┘
                                   └────────┬────────┘
                                            │
                                            │ INDEXING
                                            ▼
                                   ┌─────────────────┐
                                   │    INDEXING     │
                                   │(backend ack pend)│
                                   └────────┬────────┘
                                            │
                                            │ FINALIZE
                                            ▼
                                   ┌─────────────────┐
                                   │   FINALIZED     │
                                   │  (L1 finalized) │
                                   └─────────────────┘
                                   
                                   
         ┌──────────────────────────────────────────┐
         │     REORG (any post-SUBMITTED state)     │
         │                                          │
         │        ┌─────────────────┐              │
         └────────►│     REORGED     │              │
                  │ (receipt orphaned)│             │
                  └─────────────────┘              │
```

### 2. State Definitions

#### IDLE
- **Description:** No transaction in progress; wallet may or may not be connected
- **Fields:** `txHash: null`, `blockNumber: null`, `confirmations: null`
- **UI:** No transaction status displayed
- **Accessibility:** N/A (no active transaction)

#### PREPARING
- **Description:** Building transaction payload; chain/address validation in progress
- **Fields:** `chainId: number`, `txHash: null`, `confirmations: null`
- **UI:** Loading spinner with "Preparing transaction..."
- **Accessibility:** `role="status"`, `aria-live="polite"`, `aria-label="Preparing transaction"`

#### SIGNATURE-REQUESTED
- **Description:** Wallet popup open; waiting for user signature
- **Fields:** `chainId: number`, `txHash: null`, `confirmations: null`
- **UI:** Modal overlay with "Waiting for signature..." + wallet icon
- **Accessibility:** `role="alertdialog"`, focus trap, `aria-label="Confirm transaction in your wallet"`

#### SUBMITTED
- **Description:** Transaction broadcast to mempool; hash received from wallet
- **Fields:** `txHash: 0x...`, `chainId: number`, `blockNumber: null`, `confirmations: null`
- **UI:** "Transaction submitted" with truncated hash link
- **Accessibility:** `role="status"`, `aria-live="polite"`, announce "Transaction submitted"

#### CONFIRMING
- **Description:** Transaction included in block; awaiting sufficient confirmations
- **Fields:** `txHash: 0x...`, `blockNumber: bigint`, `confirmations: number`
- **UI:** **Confirmation counter:** "Confirming... 2/12 blocks" with progress bar
- **Accessibility:** `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax`, `aria-label="Transaction confirming, 2 of 12 blocks"`
- **Update Frequency:** Poll every 2-5 seconds; announce every N confirmations (not every block)

#### SAFE
- **Description:** Sufficient L2 confirmations received (≥ threshold); safe to act on, not yet L1-finalized
- **Fields:** `txHash: 0x...`, `blockNumber: bigint`, `confirmations: number`
- **UI:** "Safe" badge (green) with checkmark icon
- **Accessibility:** `role="status"`, `aria-label="Transaction safe, X confirmations"`
- **Note:** On Optimism L2, still await indexer acknowledgement before durable success

#### INDEXING
- **Description:** TruthBounty indexer processing; backend projection update pending
- **Fields:** `txHash: 0x...`, `blockNumber: bigint`, `confirmations: number`
- **UI:** "Processing..." with spinner
- **Accessibility:** `role="status"`, `aria-live="polite"`, `aria-label="Transaction indexing"`

#### FINALIZED
- **Description:** L1-finalized and fully indexed; terminal success
- **Fields:** `txHash: 0x...`, `blockNumber: bigint`, `confirmations: number`
- **UI:** "Finalized" badge (dark green) with checkmark icon
- **Accessibility:** `role="status"`, `aria-label="Transaction finalized, X confirmations"`
- **Persistence:** Clear localStorage entry after user acknowledgement

#### DROPPED
- **Description:** Transaction dropped from mempool (gas too low, timeout, etc.)
- **Fields:** `txHash: 0x... | null`, `error: 'DROPPED'`
- **UI:** Error card with "Transaction dropped" + retry button
- **Accessibility:** `role="alert"`, `aria-live="assertive"`, focus on retry button

#### REPLACED
- **Description:** Transaction replaced by different tx (speedup/cancel with same nonce)
- **Fields:** `txHash: 0x...`, `replacedBy: 0x...`
- **UI:** Warning card with "Transaction replaced" + link to replacement
- **Accessibility:** `role="status"`, `aria-label="Transaction replaced by [hash]"`

#### REVERTED
- **Description:** Transaction included but EVM execution reverted (status 0x0)
- **Fields:** `txHash: 0x...`, `blockNumber: bigint`, `error: 'REVERT'`
- **UI:** Error card with "Transaction reverted" + revert reason if available + retry button
- **Accessibility:** `role="alert"`, `aria-live="assertive"`, focus on retry button

#### REORGED
- **Description:** Previously observed receipt orphaned by chain reorganization
- **Fields:** `txHash: 0x...`, `blockNumber: bigint | null`, `error: 'REORGED'`, `orphanedBlockHash: 0x... | null`
- **UI:** **Banner:** "Chain reorganization detected. This transaction was removed from the chain. [View Details] [Retry]"
- **Accessibility:** `role="alert"`, `aria-live="assertive"`, keyboard focus on banner
- **Recovery:** User must acknowledge; UI removes all success affordances; allow retry from idle

## Confirmation Tracking

### 1. Confirmation Count Calculation

```typescript
/**
 * Calculate confirmations from transaction block and current block.
 * Returns 0 if transaction not yet included.
 */
function calculateConfirmations(
  txBlockNumber: bigint | null,
  currentBlockNumber: bigint
): number {
  if (txBlockNumber === null) return 0;
  if (currentBlockNumber < txBlockNumber) return 0; // Stale current block
  return Number(currentBlockNumber - txBlockNumber) + 1;
}
```

### 2. Confirmation Thresholds (Per Chain)

| Chain | Safe Confirmations | Finalized Confirmations | Block Time |
|-------|-------------------|------------------------|------------|
| **Optimism Mainnet (10)** | 1 | 12 | ~2s |
| **OP Sepolia (11155420)** | 1 | 12 | ~2s |
| **Hardhat Fork (31337)** | 1 | 1 | instant |

**Rationale:**
- **Safe (1 conf):** Transaction unlikely to reorg on L2; safe to show provisional success
- **Finalized (12 conf):** Sufficient time for L1 batch submission + finality (~24s on Optimism)
- **Hardhat:** Instant finality for local testing

### 3. Confirmation Progress UI

**Visual Format:**
```
┌─────────────────────────────────────────────┐
│ 🔄 Confirming...                   2 / 12   │
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░        │
│ Block #12,345,678                           │
└─────────────────────────────────────────────┘
```

**Accessible Format:**
- Progress bar: `role="progressbar"`, `aria-valuenow="2"`, `aria-valuemin="0"`, `aria-valuemax="12"`
- Label: `aria-label="Transaction confirming, 2 of 12 blocks"`
- Live region: Announce every 3 confirmations or when reaching safe/finalized thresholds

### 4. Polling Strategy

**Goals:**
- Balance responsiveness with RPC rate limits
- Avoid unnecessary polling for terminal states
- Respect user's reduced-motion preferences

**Implementation:**
```typescript
const pollingIntervals = {
  submitted: 2000,      // Poll every 2s (mempool → inclusion)
  confirming: 3000,     // Poll every 3s (accumulating confirmations)
  safe: 5000,           // Poll every 5s (awaiting indexer)
  indexing: 5000,       // Poll every 5s (awaiting backend)
  finalized: null,      // Stop polling (terminal success)
  reorged: null,        // Stop polling (terminal failure)
  reverted: null,       // Stop polling (terminal failure)
  dropped: null,        // Stop polling (terminal failure)
  replaced: null,       // Stop polling (terminal failure)
};
```

**Reduced Motion:**
- Disable animated progress bar
- Static confirmation count text only
- Maintain polling (state updates still needed)

## Finality Detection

### 1. Finality Levels

| Level | Description | Confirmation Requirement | Indexer Ack | UI Indicator |
|-------|-------------|-------------------------|-------------|--------------|
| **None** | Transaction not included or < safe threshold | `confirmations < safe` | N/A | Spinner / "Confirming..." |
| **Safe** | Unlikely to reorg; safe for provisional UI | `confirmations >= safe` | Not required | "Safe" badge (green) |
| **Indexed** | Backend projection updated | `confirmations >= safe` | **Required** | "Processing..." → "Safe" |
| **Finalized** | L1-finalized; durable success | `confirmations >= finalized` | **Required** | "Finalized" badge (dark green) |

### 2. Finality Guard (Fail-Closed)

**Principle:** Never show durable success until **all** conditions met:

```typescript
function canShowDurableSuccess(tx: TransactionState, indexerAck: boolean): boolean {
  // Must be in finalized state
  if (tx.status !== 'finalized') return false;
  
  // Must have valid confirmation count
  if (tx.confirmations === null || tx.confirmations < FINALIZED_THRESHOLD) return false;
  
  // Must have indexer acknowledgement (projection updated)
  if (!indexerAck) return false;
  
  // Must not be orphaned
  if (tx.error === 'REORGED') return false;
  
  return true;
}
```

### 3. L2 Finality Considerations

**Optimism-specific:**
- L2 blocks finalize ~12-24 seconds after inclusion
- L1 batch submission occurs every ~10 minutes
- **Safe threshold (1 conf):** High confidence against L2 reorg
- **Finalized threshold (12 conf):** High confidence L1 batch submitted

**UI Implications:**
- Show "Safe" badge quickly (1 conf) for responsive UX
- Withhold protocol mutation success until "Finalized" (12 conf + indexer ack)
- Display estimated time to finality based on block time

## Reorg Reconciliation

### 1. Reorg Detection Sources

| Source | Mechanism | Trigger |
|--------|-----------|---------|
| **WebSocket ROLLBACK Event** | Backend detects chain reorg, broadcasts to clients | Immediate; push-based |
| **Receipt Validation** | RPC `eth_getTransactionReceipt` returns null for previously seen hash | Poll-based; fallback |
| **Block Hash Mismatch** | Receipt's `blockHash` doesn't match RPC `eth_getBlockByNumber` for same height | Poll-based; deep validation |

**Priority:** WebSocket events are canonical; RPC validation is fallback for offline/missed events.

### 2. Reorg Recovery Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Detect Reorg (WebSocket ROLLBACK or RPC validation)     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Mark Transaction as REORGED                              │
│    - Set error: 'REORGED'                                   │
│    - Preserve orphanedBlockHash if known                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Invalidate React Query Caches                            │
│    - claims, verifications, disputes query roots            │
│    - Clear persisted WebSocket cursor (refetch from safe)  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Display Reorg Banner (Modal/Alert)                       │
│    - "Chain reorganization detected"                        │
│    - Explain transaction was removed                        │
│    - Provide [View Details] and [Retry] actions            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. User Acknowledges → Clear Banner                         │
│    - Transaction remains in REORGED state until RETRY       │
│    - RETRY event resets to IDLE for resubmission           │
└─────────────────────────────────────────────────────────────┘
```

### 3. Reorg Banner Component Specification

**Visual Design:**
```
┌────────────────────────────────────────────────────────────┐
│ ⚠️  Chain Reorganization Detected                          │
│                                                            │
│ Your transaction (0xabc...def) was removed from the chain │
│ due to a blockchain reorganization. This is a rare but    │
│ normal occurrence.                                         │
│                                                            │
│ [View Details]  [Retry Transaction]  [Dismiss]            │
└────────────────────────────────────────────────────────────┘
```

**Accessibility:**
- `role="alert"` (assertive announcement)
- `aria-live="assertive"` (interrupt screen readers)
- `aria-label="Chain reorganization alert"`
- Focus trap: Tab cycles through [View Details], [Retry], [Dismiss]
- Escape key: Dismiss banner
- High contrast: Warning icon + border

**Details Modal:**
- Transaction hash (truncated with copy button)
- Orphaned block number (if known)
- Timestamp of original inclusion
- Link to block explorer (if supported)
- Explanation: "The blockchain reorganized, and this block was replaced. Your transaction may still be valid but needs resubmission."

### 4. Replacement Events

**Scenario:** Transaction replaced by speedup/cancel (same nonce, different hash)

**Banner:**
```
┌────────────────────────────────────────────────────────────┐
│ ℹ️  Transaction Replaced                                    │
│                                                            │
│ Your transaction was replaced by a new transaction with   │
│ the same nonce. This may have been a speedup or cancel.   │
│                                                            │
│ Original: 0xabc...def                                     │
│ Replacement: 0x123...456 [View →]                         │
│                                                            │
│ [Dismiss]                                                  │
└────────────────────────────────────────────────────────────┘
```

**State Transition:**
- Original transaction: `REPLACED` state with `replacedBy` hash
- Replacement transaction: May be tracked separately if user-initiated

## Component Boundaries

### 1. TransactionStatus (Compound Component)

**Purpose:** Unified status display for all transaction lifecycle states

**API:**
```typescript
interface TransactionStatusProps {
  /** Current transaction state from transaction machine */
  state: TransactionState;
  /** Safe confirmation threshold for this chain */
  safeThreshold: number;
  /** Finalized confirmation threshold for this chain */
  finalizedThreshold: number;
  /** Whether indexer has acknowledged (for safe/finalized UI) */
  indexerAcknowledged: boolean;
  /** Callback when user clicks retry (for terminal failure states) */
  onRetry?: () => void;
  /** Callback when user acknowledges reorg banner */
  onAcknowledgeReorg?: () => void;
  /** Optional: Custom className */
  className?: string;
}
```

**Sub-components:**
- `TransactionStatus.Preparing` - Loading spinner
- `TransactionStatus.SignatureRequested` - Wallet modal overlay
- `TransactionStatus.Confirming` - Progress bar with confirmation count
- `TransactionStatus.Safe` - Success badge
- `TransactionStatus.Finalized` - Success badge (terminal)
- `TransactionStatus.Reorged` - Alert banner with retry
- `TransactionStatus.Reverted` - Error card with retry
- `TransactionStatus.Dropped` - Error card with retry
- `TransactionStatus.Replaced` - Info card with replacement link

### 2. ConfirmationProgress

**Purpose:** Confirmation counter with progress bar

**API:**
```typescript
interface ConfirmationProgressProps {
  /** Current confirmation count */
  confirmations: number;
  /** Target confirmations for safe/finalized */
  targetConfirmations: number;
  /** Block number where transaction was included */
  blockNumber: bigint;
  /** Optional: Show as compact (just count, no progress bar) */
  compact?: boolean;
  /** Optional: Show time estimate */
  showTimeEstimate?: boolean;
  /** Average block time in milliseconds */
  blockTimeMs?: number;
}
```

**Accessibility:**
- `role="progressbar"`
- `aria-valuenow={confirmations}`
- `aria-valuemin="0"`
- `aria-valuemax={targetConfirmations}`
- `aria-label="Transaction confirming, X of Y blocks"`

### 3. ReorgBanner

**Purpose:** Alert banner for reorg/replacement events

**API:**
```typescript
interface ReorgBannerProps {
  /** Type of reorg event */
  type: 'rollback' | 'replacement';
  /** Original transaction hash */
  txHash: `0x${string}`;
  /** Replacement hash (for replacement events) */
  replacementHash?: `0x${string}`;
  /** Orphaned block number (for rollback events) */
  orphanedBlock?: bigint;
  /** Callback when user clicks retry */
  onRetry: () => void;
  /** Callback when user dismisses banner */
  onDismiss: () => void;
  /** Callback when user clicks view details */
  onViewDetails?: () => void;
}
```

**Accessibility:**
- `role="alert"`
- `aria-live="assertive"`
- Focus trap (Tab cycles through actions)
- Escape key dismisses

## Hook Boundaries

### 1. useTransactionConfirmations

**Purpose:** Track confirmation count with polling

**API:**
```typescript
interface UseTransactionConfirmationsOptions {
  /** Transaction hash to track */
  txHash: `0x${string}` | null;
  /** Chain ID */
  chainId: number;
  /** Transaction block number (from receipt) */
  txBlockNumber: bigint | null;
  /** Polling interval in ms (default: 3000) */
  pollingInterval?: number;
  /** Whether to enable polling (default: true) */
  enabled?: boolean;
}

interface UseTransactionConfirmationsResult {
  /** Current confirmation count */
  confirmations: number;
  /** Current block number */
  currentBlockNumber: bigint | null;
  /** Whether currently polling */
  isPolling: boolean;
  /** Whether confirmations >= safe threshold */
  isSafe: boolean;
  /** Whether confirmations >= finalized threshold */
  isFinalized: boolean;
  /** Estimated time to safe (ms) */
  estimatedTimeToSafe: number | null;
  /** Estimated time to finalized (ms) */
  estimatedTimeToFinalized: number | null;
}
```

### 2. useReorgDetection

**Purpose:** Detect reorgs via WebSocket + RPC validation

**API:**
```typescript
interface UseReorgDetectionOptions {
  /** Transaction to monitor */
  txHash: `0x${string}` | null;
  /** Chain ID */
  chainId: number;
  /** Transaction block number */
  txBlockNumber: bigint | null;
  /** Callback when reorg detected */
  onReorg?: (event: { orphanedBlockHash?: `0x${string}` }) => void;
  /** Whether to enable detection (default: true) */
  enabled?: boolean;
}

interface UseReorgDetectionResult {
  /** Whether a reorg has been detected */
  reorgDetected: boolean;
  /** Orphaned block hash (if known) */
  orphanedBlockHash: `0x${string}` | null;
  /** Whether currently monitoring */
  isMonitoring: boolean;
  /** Clear reorg state (user acknowledged) */
  clearReorg: () => void;
}
```

## Testing Requirements

### 1. Unit Tests

**Confirmation Tracking:**
- ✅ Calculate confirmations from tx block and current block
- ✅ Handle edge case: current block < tx block (stale)
- ✅ Return 0 for null tx block number
- ✅ Confirmation count increases as blocks advance

**Finality Guards:**
- ✅ `canShowDurableSuccess` returns false for non-finalized states
- ✅ Returns false without indexer acknowledgement
- ✅ Returns false for confirmations < threshold
- ✅ Returns false for reorged transactions
- ✅ Returns true only when all conditions met

**State Transitions:**
- ✅ CONFIRMING → SAFE at safe threshold
- ✅ SAFE → FINALIZED at finalized threshold
- ✅ CONFIRMING → REORGED on reorg event
- ✅ REORGED → IDLE on retry event

### 2. Component Tests

**TransactionStatus:**
- ✅ Renders confirmation progress for confirming state
- ✅ Shows safe badge for safe state
- ✅ Shows finalized badge for finalized state
- ✅ Shows reorg banner for reorged state
- ✅ Retry button calls onRetry callback
- ✅ Accessible (ARIA roles, labels, live regions)

**ConfirmationProgress:**
- ✅ Progress bar reflects confirmation percentage
- ✅ Aria attributes update with confirmations
- ✅ Time estimate calculates correctly
- ✅ Compact mode hides progress bar

**ReorgBanner:**
- ✅ Displays rollback message for rollback events
- ✅ Displays replacement message with link for replacement events
- ✅ Dismiss button calls onDismiss
- ✅ Retry button calls onRetry
- ✅ Focus trap works (Tab cycles actions)
- ✅ Escape key dismisses

### 3. Integration Tests

**Confirmation Polling:**
- ✅ Hook polls RPC at specified interval
- ✅ Stops polling for terminal states
- ✅ Confirmation count increases with new blocks
- ✅ isSafe/isFinalized flags update at thresholds

**Reorg Detection:**
- ✅ WebSocket ROLLBACK event triggers reorg state
- ✅ RPC validation detects missing receipt
- ✅ Block hash mismatch detected
- ✅ onReorg callback fires with orphaned block info
- ✅ clearReorg() resets state

**State Machine Integration:**
- ✅ CONFIRM event updates confirmations field
- ✅ MARK_SAFE transitions at correct threshold
- ✅ REORG event transitions from any post-SUBMITTED state
- ✅ Invalid transitions throw TransactionMachineError

### 4. E2E Tests (Playwright)

**Confirmation Flow:**
- ✅ Submit transaction → see "Submitted" status
- ✅ Wait for inclusion → see "Confirming 1/12"
- ✅ Confirmations increase → see progress bar update
- ✅ Reach safe threshold → see "Safe" badge
- ✅ Reach finalized threshold + indexer ack → see "Finalized" badge

**Reorg Scenario:**
- ✅ Transaction confirming → reorg event → see reorg banner
- ✅ Click "View Details" → modal opens with transaction info
- ✅ Click "Retry" → transaction returns to idle, resubmit flow starts
- ✅ Dismiss banner → banner hidden, transaction remains reorged

**Accessibility:**
- ✅ Screen reader announces confirmation updates (every 3 confirmations)
- ✅ Keyboard navigation works (Tab to retry button)
- ✅ Focus management for reorg banner (trap focus, restore on dismiss)
- ✅ High contrast mode: All states visually distinct

## Implementation Checklist

- [ ] Define chain-specific confirmation thresholds configuration
- [ ] Implement `calculateConfirmations()` utility
- [ ] Implement `useTransactionConfirmations` hook with polling
- [ ] Implement `useReorgDetection` hook with WebSocket + RPC
- [ ] Create `TransactionStatus` compound component
- [ ] Create `ConfirmationProgress` component with progress bar
- [ ] Create `ReorgBanner` component with focus trap
- [ ] Add confirmation counter tests (unit)
- [ ] Add finality guard tests (unit)
- [ ] Add component tests (accessibility, visual states)
- [ ] Add integration tests (polling, reorg detection)
- [ ] Add E2E tests (full flow, reorg scenario)
- [ ] Update documentation with usage examples
- [ ] Verify CI gates pass (lint, typecheck, tests, a11y)

## References

- **Transaction Machine:** `src/lib/transaction-machine/transaction-machine.types.ts`
- **Reorg Reconciliation:** `src/lib/reorg-reconciliation.ts`
- **UI State Model:** `docs/UI_STATE_MODEL.md`
- **Accessibility:** WCAG 2.1 AA (focus management, live regions, progress indicators)
