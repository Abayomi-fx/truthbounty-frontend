# IMMEDIATE CONFLICT RESOLUTION STEPS

## The Problem
GitHub PR shows conflicts but local branch is clean. This means main branch has the OLD files and our branch has the NEW files.

## SOLUTION: Use GitHub's Web Interface

### Step 1: Click "Resolve conflicts" button on the PR page

### Step 2: For `TransactionStatus.tsx`
**This file is being DELETED in our branch**

If you see conflict markers, choose to DELETE THE ENTIRE FILE or select "Use branch version" which will delete it.

### Step 3: For `VerificationActions.tsx`
**Keep OUR version (the one with TransactionStatusBadge)**

Look for these imports at the top - this is THE CORRECT VERSION:
```tsx
import { useTransactionMachine } from '@/hooks/useTransactionMachine';
import { TransactionStatusBadge } from '@/components/transactions/TransactionStatusBadge';
```

If you see the OLD version with:
```tsx
import { TransactionStatus } from './TransactionStatus';
```
**DELETE THE OLD VERSION and keep the new one**

### Step 4: Mark as resolved and commit

Click "Mark as resolved" then "Commit merge"

---

## Alternative: Command Line Force Resolution

If web interface is confusing, run these commands:

```bash
# Make sure we're on the feature branch
git checkout feat/wave9-transaction-status-consolidation

# Get latest from origin
git fetch origin

# Merge with strategy to prefer our changes
git merge origin/main -X ours --no-edit

# If there are still conflicts, manually resolve:

# Keep our VerificationActions (with TransactionStatusBadge)
git checkout --ours src/components/features/claim-verification/VerificationActions.tsx

# Ensure TransactionStatus.tsx is deleted
git rm -f src/components/features/claim-verification/TransactionStatus.tsx 2>nul

# Stage the resolutions
git add src/components/features/claim-verification/VerificationActions.tsx

# Complete the merge
git commit --no-edit

# Force push the resolution
git push origin feat/wave9-transaction-status-consolidation --force-with-lease
```

---

## Quick Check: What's Correct?

### ✅ VerificationActions.tsx should have:
- `import { useTransactionMachine }`
- `import { TransactionStatusBadge }`
- `const { state, send, reset } = useTransactionMachine`
- `<TransactionStatusBadge status={state.status} ... />`
- Retry button for terminal states

### ✅ TransactionStatus.tsx should:
- NOT EXIST (deleted)

### ❌ OLD version (WRONG - from main branch):
- `import { TransactionStatus } from './TransactionStatus'`
- `const [status, setStatus] = useState`
- `<TransactionStatus status={status} />`

---

## Why This Happened

Main branch still has the old broken implementations. Our PR deletes one file and completely rewrites another. GitHub sees this as a conflict and needs you to confirm which version to keep.

**ALWAYS KEEP OUR VERSION** - it's the new canonical implementation with full test coverage and proper ARIA semantics.
