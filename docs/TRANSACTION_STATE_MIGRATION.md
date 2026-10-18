# Transaction State Migration Guide

## Overview

Wave 9 consolidated duplicate transaction status implementations into a single canonical system. This guide documents the migration path from the deprecated `transaction-state.ts` to the canonical `transaction-machine` implementation.

## What Changed

### Before (Deprecated)
- **File**: `src/lib/transaction-state.ts`
- **Types**: `src/app/types/transaction.ts`
- **States**: 6 states (submitted, confirmed, safe, finalized, indexing, indexed)
- **Component**: None (inconsistent UI rendering)
- **Status**: ⚠️ Deprecated, maintained for backward compatibility only

### After (Canonical)
- **File**: `src/lib/transaction-machine/transaction-machine.types.ts`
- **Component**: `src/components/transactions/TransactionStatusBadge.tsx`
- **Hook**: `src/hooks/useTransactionMachine.ts`
- **States**: 11 states with explicit failure modes
- **Status**: ✅ Canonical implementation

## State Mapping

| Old State (transaction-state) | New State (transaction-machine) | Notes |
|-------------------------------|----------------------------------|-------|
| N/A | `idle` | New: no action started |
| N/A | `preparing` | New: validating preconditions |
| N/A | `signature-requested` | New: wallet popup open |
| `submitted` | `submitted` | Direct mapping |
| `confirmed` | `confirming` | Renamed for clarity |
| `safe` | `safe` | Direct mapping |
| `finalized` | `finalized` | Direct mapping |
| `indexing` | `indexing` | Direct mapping |
| `indexed` | `finalized` | Merged: indexed = finalized |
| `failed` | `dropped` | Split into specific failures |
| `failed` | `replaced` | Split into specific failures |
| `failed` | `reverted` | Split into specific failures |

## Migration Steps

### 1. Update Type Imports

**Before:**
```typescript
import type { Transaction, TransactionState } from '@/app/types/transaction';
import { isSubmitted, isConfirmed } from '@/lib/transaction-state';
```

**After:**
```typescript
import type { TransactionState, TransactionStatus } from '@/lib/transaction-machine';
```

### 2. Replace UI Rendering

**Before:**
```typescript
// Custom rendering logic in each component
function MyComponent({ tx }: { tx: Transaction }) {
  if (isPending(tx)) return <p>Pending...</p>;
  if (isFinalized(tx)) return <p className="text-green-600">Complete</p>;
  if (isFailed(tx)) return <p className="text-red-600">Failed</p>;
  return null;
}
```

**After:**
```typescript
import { TransactionStatusBadge } from '@/components/transactions/TransactionStatusBadge';

function MyComponent({ state }: { state: TransactionState }) {
  return <TransactionStatusBadge status={state.status} txHash={state.txHash} />;
}
```

### 3. Replace State Management

**Before:**
```typescript
const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');

async function submit() {
  setStatus('pending');
  try {
    await action();
    setStatus('success');
  } catch {
    setStatus('error');
  }
}
```

**After:**
```typescript
const { state, send, reset } = useTransactionMachine({
  id: 'my-transaction',
  label: 'My Action',
});

async function submit() {
  send({ type: 'PREPARE', chainId: 11155420 });
  send({ type: 'REQUEST_SIGNATURE' });
  // Machine handles state transitions automatically
}
```

### 4. Update Tests

**Before:**
```typescript
import { isPending, isFinalized } from '@/lib/transaction-state';

expect(isPending(tx)).toBe(true);
```

**After:**
```typescript
expect(state.status).toBe('submitted');
expect(state.status).toBe('finalized');
```

## Component Examples

### Verification Actions (Migrated)

See `src/components/features/claim-verification/VerificationActions.tsx` for a complete example of:
- Using `useTransactionMachine` hook
- Rendering `TransactionStatusBadge`
- Handling retry on terminal failures
- Proper ARIA semantics

### Status Card (Needs Migration)

`src/components/transactions/status-card.tsx` still uses simplified states. Migration pending.

## Key Benefits

1. **Explicit failure modes**: No more generic "error" - distinct dropped, replaced, reverted states
2. **ARIA compliance**: Built-in accessibility with proper live regions
3. **Consistent copy**: All transaction messages follow approved UX standards
4. **Recovery support**: Preserved transaction records across reload, replacement, reorg
5. **Single source of truth**: One component, one state model, no duplication

## Backward Compatibility

The deprecated `transaction-state.ts` remains available for existing code. However:

- **No new features** will be added to deprecated files
- **No UI components** should be built on deprecated types
- **Migration is required** before issue closure for any transaction-related work

## Testing Requirements

When migrating code, ensure:

1. ✅ All 11 states render correctly
2. ✅ ARIA live regions announce state changes
3. ✅ Terminal failures show retry option
4. ✅ Transaction hash displays when available
5. ✅ Confirmations count updates during confirming state

## References

- Issue #559 (Wave 9 consolidation)
- `docs/ux/TRANSACTION_STATE_MODEL.md` - UX state model
- `src/components/transactions/TransactionStatusBadge.stories.tsx` - Visual examples
- Protocol #13 - Replacement transaction approval

## Questions?

Check Storybook stories for visual examples of all states. Review `useTransactionMachine` hook for state management patterns.
