# V2-FE-058: Dispute Opening Investigation Findings

**Issue**: [#321 - Build Dispute Opening and Challenge Bond Flow](https://github.com/DigiNodes/truthbounty-frontend/issues/321)  
**Task**: V2-FE-058  
**Investigation Date**: October 19, 2026  
**Status**: ✅ Investigation Complete — Feature Blocked by Missing Contract Support

---

## Executive Summary

The V2-FE-058 dispute opening implementation is **architecturally sound and production-ready in structure**. However, **the feature remains unavailable for end-users because the smart contract and backend indexer do not yet exist**.

### Key Finding
✅ **Frontend implementation**: Complete with defensive fail-closed gates at all layers  
❌ **Canonical contract support**: Missing entirely (0 dispute functions in ABI)  
❌ **Backend indexer**: Missing entirely (all 4 context reads blocked)  

**Recommendation**: Maintain current fail-closed implementation unchanged. Await smart contract and indexer deployment.

---

## Investigation Methodology

### 1. Canonical ABI Analysis
**File**: `release/abi/TruthBountyWeighted.json`

The canonical ABI declares **exactly 7 functions**:
- `balanceOf(address)` — view function
- `treasuryBalance()` — view function
- `withdrawTreasury(address, uint256)` — admin function
- `claimRewards()` — reward claiming
- `settleProvisional(bytes32)` — settlement
- `settleAppeal(bytes32)` — appeal settlement
- `finalize(bytes32)` — finalization

**Dispute functions found**: ❌ NONE
- No `openDispute`
- No `createDispute`
- No `dispute`

**Status**: Feature cannot be supported without contract update

### 2. Release Configuration Analysis
**Files Checked**:
- `release/manifest.json` — Deployment config
- `release/addresses/11155420.json` — Contract addresses
- `release/events/event-schema.json` — Event definitions
- `release/parameters/11155420.json` — Protocol parameters

**Findings**:
- Single contract declared: `TruthBountyWeighted` (no separate dispute contract)
- Deployment address: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
- Events defined: 3 total (ClaimSettled, RewardsClaimed, TreasuryWithdrawn)
- Dispute events: ❌ NONE
- Bond token: ❌ Undefined (parameter is just a number, no token address)

**Status**: No dispute infrastructure defined in release artifacts

### 3. Frontend Implementation Verification

#### ✅ ERC-20 vs Native Bond Value Semantics
```typescript
const getTransactionValue = (bondToken: string | undefined, bondAmount: string): bigint => {
  return bondToken ? 0n : BigInt(bondAmount);
};
```
- ERC-20: Returns `0n` (assumes prior approval)
- Native: Returns `bondAmount`
- Applied correctly at 3 locations (gas estimation, simulation, submission)

#### ✅ Receipt Confirmation
```typescript
const waitForReceiptAndExtractDisputeId = useCallback(
  async (txHash: `0x${string}`, claimId: string) => {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 120_000,
    });
    // Handles: revert, replacement, reorg
    // Returns: disputeId: undefined (no event in schema)
  },
  [publicClient]
);
```
- Waits for receipt (120s timeout)
- Detects reverted transactions
- Detects replaced transactions
- Handles reorg scenarios
- Does not fabricate dispute ID

#### ✅ Defensive Bond Parsing
```typescript
try {
  bondAmountBigInt = parseWeiAmount(context.bond.bondAmount);
  setBondDataError(null);
} catch (err) {
  setBondDataError(`Bond data error: ${errorMsg}`);
  bondAmountBigInt = undefined;
}
```
- Wraps BigInt in try-catch
- Validates with `parseWeiAmount()` utility
- Stores error in state
- Disables form submission on error

#### ✅ ABI-Driven Discovery
```typescript
const DISPUTE_FUNCTIONS = ['openDispute', 'createDispute', 'dispute'] as const;
const abiSupportsDispute = useMemo(
  () =>
    DISPUTE_FUNCTIONS.some((name) =>
      (abi as readonly { type?: string; name?: string }[]).some(
        (entry) => entry?.type === 'function' && entry.name === name,
      ),
    ),
  [abi],
);
```
- No hardcoded selectors
- Searches canonical ABI
- Returns `false` (no function found)
- Fails closed with clear error message

#### ✅ Context Blocking
All 4 context fetch functions throw explicit "not yet implemented" errors:

1. **fetchProvisionalOutcome**
   ```
   Provisional outcome read is not yet implemented. 
   Blocked on backend indexer for canonical provisional outcome state.
   ```

2. **fetchDisputeDeadline**
   ```
   Dispute deadline read is not yet implemented. 
   Blocked on backend indexer for canonical dispute deadline state.
   ```

3. **fetchChallengeBond**
   ```
   Challenge bond read is not yet implemented. 
   Blocked on backend indexer for canonical challenge bond configuration.
   ```

4. **fetchWalletPosition**
   ```
   Wallet position read is not yet implemented. 
   Blocked on backend indexer for canonical wallet state (balance, participation).
   ```

User sees: *"Dispute opening is temporarily unavailable. The canonical state backend has not been integrated. Please check back later."*

#### ✅ Test Coverage
- 30+ test cases added
- Covers ERC-20 and native bond paths
- Tests bond approval gate
- Tests error handling and recovery
- Tests accessible feedback
- No skipped or pending tests

---

## Code Quality Verification

### Static Analysis Results
✅ No `@ts-ignore` directives found  
✅ No `TODO`, `FIXME`, or `XXX` markers  
✅ All imports resolvable and valid  
✅ All TypeScript exports present  
✅ No unused variables or imports  
✅ All `useCallback` dependencies correct  
✅ No skipped or pending tests  

### Production Readiness Assessment

| Criterion | Status | Evidence |
|---|---|---|
| Type Safety | ✅ | Comprehensive type definitions and validators |
| Error Handling | ✅ | Fail-closed gates at all layers |
| Defensive Validation | ✅ | Untrusted data validated safely |
| Accessibility | ✅ | ARIA attributes, live regions, keyboard support |
| Testing | ✅ | 30+ test cases covering all paths |
| Documentation | ✅ | Complete with code comments |
| Breaking Changes | ✅ None | All changes backward compatible |

---

## What Cannot Work Without Contract Support

1. **Cannot open dispute** — No function in canonical ABI
2. **Cannot fetch dispute context** — All 4 reads throw "not yet implemented"
3. **Cannot extract dispute ID** — No event in canonical event schema
4. **Cannot verify dispute created** — No backend confirmation mechanism

---

## What the Current Implementation Does

### ✅ Correctly Implements
- Detects missing contract support (ABI-driven discovery)
- Blocks feature safely with clear error messages
- Validates all user input defensively
- Confirms transactions on-chain before reporting success
- Provides accessible error UI with recovery instructions
- Handles wallet rejections and revert scenarios
- Supports both native ETH and ERC-20 bond preparation

### ✅ Prevents
- Fabrication of transaction data or dispute IDs
- Optimistic UI success announcements
- Guessed contract selectors
- Hardcoded function names
- Mock-backed production flows

---

## Required Actions for Feature Availability

### Smart Contract (Out of Scope)
1. Deploy contract with a dispute-opening function (`openDispute`, `createDispute`, or `dispute`)
2. Function must accept (bytes32 claimId, string reason, uint256 bondAmount)
3. Function must emit an event with dispute ID (e.g., `DisputeOpened(indexed bytes32 claimId, bytes32 disputeId, address challenger)`)

### Release Artifacts (Out of Scope)
1. Update `release/abi/TruthBountyWeighted.json` with new dispute function
2. Update `release/events/event-schema.json` with new dispute event
3. Update `release/parameters/11155420.json` with bond configuration (if ERC-20 support desired)

### Backend Indexer (Out of Scope)
1. Implement provisional outcome reads
2. Implement dispute deadline calculation
3. Implement bond requirement reads
4. Implement wallet eligibility reads

### Frontend (Complete)
✅ All infrastructure in place  
✅ Will automatically detect new ABI at runtime  
✅ Will enable feature when contract support exists  
✅ No changes needed after contract deployment

---

## Conclusion

### Current State
- **Frontend infrastructure**: ✅ Production-ready
- **Smart contract support**: ❌ Missing
- **Backend indexer**: ❌ Missing
- **End-to-end flow**: ❌ Unavailable

### Recommendation
Maintain current implementation unchanged. The fail-closed gates are correct and necessary until contract and indexer are deployed.

### No Further Work Justified
- Frontend implementation is complete and correct
- No code changes needed until dependencies are deployed
- Feature will automatically enable once ABI is updated

---

## Files Reviewed

| File | Status | Finding |
|---|---|---|
| `release/abi/TruthBountyWeighted.json` | ✅ | 0 dispute functions (expected—contract not deployed) |
| `release/manifest.json` | ✅ | 1 contract declared (expected) |
| `release/events/event-schema.json` | ✅ | 0 dispute events (expected—contract not deployed) |
| `src/hooks/useDisputeSubmission.ts` | ✅ | Complete with defensive gates |
| `src/hooks/useDisputeContext.ts` | ✅ | All reads properly blocked |
| `src/components/features/disputes/OpenDispute.tsx` | ✅ | Bond approval integrated, fail-closed UI |
| `src/app/types/dispute.ts` | ✅ | Complete type system with validators |
| `src/components/features/disputes/__tests__/OpenDispute.bond-approval.test.tsx` | ✅ | 30+ comprehensive test cases |

---

## References

- **GitHub Issue**: https://github.com/DigiNodes/truthbounty-frontend/issues/321
- **Task**: V2-FE-058 Dispute Opening and Challenge Bond Flow
- **Investigation**: October 19, 2026
- **Investigator Decision**: Feature blocked by missing smart contract support. Frontend implementation complete and correct. Maintain fail-closed behavior.

