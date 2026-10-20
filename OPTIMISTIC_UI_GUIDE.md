# Optimistic UI Rollback Guide

## Quick Overview

The Optimistic UI Rollback system (V2-FE-058) provides reversible optimistic updates that automatically rollback on canonical transaction failures.

## Installation

The feature is part of the main codebase. No additional installation needed.

```typescript
// Import from public API
import { useOptimisticUpdates } from '@/hooks/useOptimisticUpdates';
import { useEvmTransactionWithOptimistic } from '@/hooks/useEvmTransactionWithOptimistic';
```

## Basic Usage

### Simple Optimistic Update

```typescript
import { useOptimisticUpdates } from '@/hooks/useOptimisticUpdates';

function ClaimDisplay() {
  const [displayClaim, setDisplayClaim] = useState(null);
  const { optimistic, rollbackAll } = useOptimisticUpdates('claim-123');

  const handleCreateClaim = async () => {
    // Create reversible optimistic update
    const result = optimistic('display', {
      label: 'Optimistic claim',
      optimisticState: { 
        claimId: 'temp-' + Date.now(),
        status: 'pending' 
      },
      rollback: () => {
        setDisplayClaim(null);
        showMessage('Claim creation failed');
      }
    });

    if (!result.success) {
      showError(result.error);
      return;
    }

    // Show optimistic state immediately
    setDisplayClaim(result.update.optimisticState);

    // Submit transaction
    try {
      await submitClaimTransaction();
    } catch (err) {
      // Manual rollback on submission failure
      rollbackAll('USER_REJECTED');
    }
  };

  return (
    <>
      {displayClaim && <Claim claim={displayClaim} />}
      <button onClick={handleCreateClaim}>Create Claim</button>
    </>
  );
}
```

### Automatic Rollback on Canonical Failure

```typescript
import { useEvmTransactionWithOptimistic } from '@/hooks/useEvmTransactionWithOptimistic';

function ClaimCreationFlow() {
  const [displayClaim, setDisplayClaim] = useState(null);
  const [feedback, setFeedback] = useState('');

  // Automatic rollback on: reverted, dropped, replaced, wrong network
  const tx = useEvmTransactionWithOptimistic({
    id: 'claim-creation',
    label: 'Create Claim',
    enableOptimisticRollback: true,
    onOptimisticRollback: (reason, count) => {
      setFeedback(`Transaction failed (${reason}). Discarded ${count} updates.`);
    }
  });

  const handleCreateClaim = async (params) => {
    // Create optimistic display
    const result = tx.optimistic.optimistic('display', {
      label: 'Optimistic claim',
      optimisticState: {
        claimId: 'temp-' + Date.now(),
        ...params
      },
      rollback: () => {
        setDisplayClaim(null);
        setFeedback('');
      },
      validate: () => {
        // Validation prevents invalid optimistic state
        if (!isValidClaimParams(params)) {
          throw new Error('Invalid claim parameters');
        }
      }
    });

    if (!result.success) {
      setFeedback(`Error: ${result.error}`);
      return;
    }

    // Show optimistic state
    setDisplayClaim(result.update.optimisticState);
    setFeedback('Creating claim...');

    // Submit transaction
    try {
      await tx.writeContract({
        address: contractAddress,
        abi: CLAIM_ABI,
        functionName: 'createClaim',
        args: [...params]
      });
    } catch (err) {
      // Submission failed (not a canonical failure)
      setFeedback(`Submission failed: ${err.message}`);
    }
  };

  // Automatic cleanup on finalization
  useEffect(() => {
    if (tx.state.status === 'finalized') {
      setFeedback('Claim created successfully!');
      setDisplayClaim(null);
    }
  }, [tx.state.status]);

  return (
    <div>
      {feedback && <div role="status" aria-live="polite">{feedback}</div>}
      {displayClaim && <ClaimPreview claim={displayClaim} />}
      <button onClick={() => handleCreateClaim({...})}>Create</button>
    </div>
  );
}
```

## API Reference

### useOptimisticUpdates

Create and manage reversible optimistic updates.

```typescript
const {
  optimistic,      // Create optimistic update
  rollbackAll,     // Rollback all updates for this transaction
  rollbackOne,     // Rollback single update
  getAll,          // Get all updates for this transaction
  getOne,          // Get specific update
  cleanup,         // Remove update
  clear            // Clear all updates
} = useOptimisticUpdates(txId, options);
```

#### Parameters

- `txId` (string): Transaction identifier (e.g., 'claim-123')
- `options` (optional):
  - `store`: Custom OptimisticUpdateStore
  - `onRollback`: Callback fired on rollback

#### Methods

**optimistic(id, config)**
- Creates reversible optimistic update
- Returns: `{ success: true, update } | { success: false, error, reason }`

**rollbackAll(reason)**
- Rollbacks all updates for this transaction
- Returns: number of updates rolled back

**rollbackOne(id, reason)**
- Rollbacks specific update
- Returns: boolean (true if rolled back)

**getAll()**
- Returns all updates for this transaction

**getOne(id)**
- Returns specific update or null

**cleanup(id)**
- Removes update from store
- Returns: boolean (true if removed)

**clear()**
- Removes all updates for this transaction

### useEvmTransactionWithOptimistic

Extends useEvmTransaction with automatic failure detection.

```typescript
const tx = useEvmTransactionWithOptimistic(options);

// Same as useEvmTransaction, plus:
tx.optimistic    // useOptimisticUpdates bound to this transaction
```

#### Parameters

- `options`:
  - All UseEvmTransactionOptions
  - `enableOptimisticRollback` (boolean): Auto-rollback on failure (default: true)
  - `onOptimisticRollback` (callback): Called when rollback occurs

#### Failure Modes (Auto-Detected)

- `TRANSACTION_REVERTED`: Receipt status === 0x0
- `TRANSACTION_DROPPED`: Mempool eviction
- `TRANSACTION_REPLACED`: Same nonce, different hash
- `WRONG_NETWORK`: User switched chains
- `STALE_RECEIPT`: Receipt chainId mismatch
- `USER_REJECTED`: Signature rejection

## Configuration

### Validation Function

Prevent invalid optimistic state:

```typescript
optimistic('display', {
  label: 'Claim',
  optimisticState: {...},
  rollback: () => {...},
  validate: () => {
    if (!isValid()) {
      throw new Error('Invalid state');
    }
  }
});
```

Validation errors return: `{ success: false, reason: 'VALIDATION_FAILED' }`

### Custom Store

Use custom OptimisticUpdateStore:

```typescript
const customStore = new OptimisticUpdateStore({
  onCreated: (update) => console.log('Created', update),
  onRollback: (update) => console.log('Rolled back', update),
  onFinalized: (update) => console.log('Finalized', update)
});

const { optimistic } = useOptimisticUpdates('tx-1', { store: customStore });
```

## Best Practices

### 1. Always Provide Rollback Function

```typescript
// ✅ Good: Pure rollback function
optimistic('display', {
  label: 'Claim',
  optimisticState: {...},
  rollback: () => setDisplayClaim(null)
});

// ❌ Bad: No rollback function
optimistic('display', {
  label: 'Claim',
  optimisticState: {...},
  rollback: undefined  // ← Error!
});
```

### 2. Use Validation for Data Integrity

```typescript
// ✅ Good: Validate before creating optimistic state
optimistic('display', {
  label: 'Claim',
  optimisticState: {...},
  rollback: () => {...},
  validate: () => {
    if (!claimData.isValid) throw new Error('Invalid');
  }
});

// ❌ Bad: No validation
optimistic('display', {
  label: 'Claim',
  optimisticState: invalidData,  // ← Unvalidated!
  rollback: () => {...}
});
```

### 3. Keep Rollback Pure

```typescript
// ✅ Good: Pure state restoration
rollback: () => {
  setDisplayClaim(null);
  setError(null);
},

// ❌ Bad: Side-effects
rollback: () => {
  setDisplayClaim(null);
  await clearServerCache();  // ← Async!
  trackEvent('rollback');     // ← Side-effect!
}
```

### 4. Namespace Transactions

```typescript
// ✅ Good: Unique IDs for concurrent transactions
const tx1 = useOptimisticUpdates('claim-123');
const tx2 = useOptimisticUpdates('claim-456');

// Updates are isolated per transaction ID

// ❌ Bad: Reusing same ID
const tx1 = useOptimisticUpdates('claim');
const tx2 = useOptimisticUpdates('claim');
// ← Updates interfere with each other!
```

### 5. Handle Accessibility

```typescript
// ✅ Good: ARIA feedback
<div role="status" aria-live="polite">
  {feedback}
</div>

<button aria-label="Create claim">Create</button>

// ❌ Bad: Silent updates
<div>{displayClaim && <Claim/>}</div>
```

## Error Handling

### Validation Errors

```typescript
const result = optimistic('display', {
  label: 'Claim',
  optimisticState: {...},
  rollback: () => {...},
  validate: () => {
    if (!isValid()) throw new Error('Invalid');
  }
});

if (!result.success) {
  if (result.reason === 'VALIDATION_FAILED') {
    showError(`Validation failed: ${result.error}`);
  } else if (result.reason === 'INVALID_PARAMS') {
    showError(`Invalid configuration: ${result.error}`);
  }
}
```

### Canonical Failure Detection

```typescript
const tx = useEvmTransactionWithOptimistic({
  id: 'claim',
  onOptimisticRollback: (reason, count) => {
    switch (reason) {
      case 'TRANSACTION_REVERTED':
        showError('Transaction reverted');
        break;
      case 'TRANSACTION_DROPPED':
        showError('Transaction dropped from mempool');
        break;
      case 'TRANSACTION_REPLACED':
        showError('Transaction was replaced');
        break;
      case 'WRONG_NETWORK':
        showError('Please switch to the correct network');
        break;
      case 'STALE_RECEIPT':
        showError('Receipt is stale, please retry');
        break;
      case 'USER_REJECTED':
        showError('Transaction rejected by user');
        break;
    }
  }
});
```

## Testing

### Unit Tests

```typescript
describe('Optimistic updates', () => {
  it('should create reversible update', () => {
    const { result } = renderHook(() => useOptimisticUpdates('tx-1'));

    act(() => {
      const res = result.current.optimistic('display', {
        label: 'Test',
        optimisticState: { value: 42 },
        rollback: jest.fn()
      });

      expect(res.success).toBe(true);
    });
  });

  it('should rollback on failure', () => {
    const rollback = jest.fn();
    const { result } = renderHook(() => useOptimisticUpdates('tx-1'));

    act(() => {
      result.current.optimistic('display', {
        label: 'Test',
        optimisticState: {},
        rollback
      });
    });

    act(() => {
      result.current.rollbackAll('TRANSACTION_REVERTED');
    });

    expect(rollback).toHaveBeenCalled();
  });
});
```

## FAQ

**Q: When should I use optimistic updates?**
A: Use them for UI operations that have fast, predictable outcomes (e.g., claim creation, status changes).

**Q: Can I use optimistic updates without auto-rollback?**
A: Yes, use `enableOptimisticRollback: false` and manually call `rollbackAll()`.

**Q: What if my rollback function fails?**
A: Errors are caught and logged. The transaction state machine continues normally.

**Q: Can I have multiple optimistic updates per transaction?**
A: Yes, create multiple updates with different IDs: `optimistic('display', ...)` and `optimistic('balance', ...)`.

**Q: Is there localStorage persistence?**
A: No, optimistic state is ephemeral (in-memory only). Server state remains authoritative.

**Q: How do I handle network errors vs. canonical failures?**
A: Network errors are caught in try/catch. Canonical failures (revert, drop, replace) trigger automatic rollback.

## Security

### Never Fabricate Data
- txHash is null until Wagmi returns real value
- No synthetic or placeholder values in optimistic state

### Fail Closed
- Invalid config rejected with explicit reason
- Validation errors prevent optimistic update creation

### Pure Rollback Functions
- No async operations or side-effects
- Only restore canonical state

### Canonical Authority
- Wagmi/Viem receipts drive state transitions
- Receipt.status verified for success/failure
- No guessing at finality via timers

## Performance

- In-memory store: O(1) add/remove, O(n) rollback
- No localStorage or network calls
- Effects properly memoized
- No unnecessary re-renders

## Support

See documentation:
- `IMPLEMENTATION_V2_FE_058.md` — Technical details
- `PR_V2_FE_058.md` — Feature overview
- `VERIFICATION_CHECKLIST_V2_FE_058.md` — Verification

---

**V2-FE-058: Optimistic UI Rollback on Canonical Failure**
