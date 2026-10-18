# Claim Submission State Model

**Work Item:** V2-FE Canonical Claim Submission Wizard  
**Version:** 1.0  
**Last Updated:** 2026-09-27

## Purpose

This document defines the canonical state model for claim submission in TruthBounty's frontend, ensuring proper wizard flow, validation, evidence handling, transaction lifecycle, and fail-closed behavior.

## Core Principles

### 1. Fail-Closed Validation

**Never fabricate claim submission state.** All validation must be explicit:

- **Wallet connection:** Required before any submission step
- **Chain validation:** Must match expected chain from release manifest
- **Contract artifacts:** Must be verified and checksummed
- **Evidence integrity:** Local SHA-256 must match canonical digest
- **Transaction state:** Never show success without confirmed receipt + indexer acknowledgement

**On uncertainty, fail closed:**
- Missing wallet → block submission, show connect button
- Wrong chain → block submission, show chain switch prompt
- Stale artifacts → block submission, show reload prompt
- Invalid evidence → block submission, require re-upload
- Transaction pending → show progress, don't allow new submission

### 2. Multi-Step Wizard Flow

Claim submission is a **5-step wizard**:

```
1. CLAIM_DETAILS (form inputs)
   ↓ (validate details)
2. EVIDENCE_UPLOAD (file or URL)
   ↓ (validate evidence)
3. REVIEW (confirm all inputs)
   ↓ (user confirms)
4. TRANSACTION (wallet approval + on-chain submission)
   ↓ (wait for confirmation)
5. CONFIRMATION (success/failure with next actions)
```

**Step validation:** User cannot proceed to next step until current step is valid.

**Step navigation:** User can go back to previous steps to edit, but must re-validate forward.

### 3. Evidence Privacy

**Never log or telemeter:**
- Evidence file names
- Evidence file contents
- Evidence URLs (except sanitized domain)
- SHA-256 digests

**Redaction:** Evidence URLs must be sanitized for display (show domain only, hide paths/params).

### 4. Transaction Lifecycle Integration

Claim submission must integrate with the transaction confirmation model:

- **Preparing:** Building transaction payload
- **Signature Requested:** Wallet popup open
- **Submitted:** Transaction in mempool
- **Confirming:** Accumulating block confirmations
- **Safe:** Safe threshold reached
- **Indexing:** Waiting for indexer acknowledgement
- **Finalized:** Durable success (show success UI)
- **Dropped/Reverted/Reorged:** Terminal failures (show retry UI)

## Wizard Steps

### Step 1: Claim Details

**State:** `claim-details`

**Purpose:** Collect claim metadata and validate user input.

**Fields:**
- `title` (string, 5-200 chars, required)
- `category` (string, required, predefined list)
- `impact` (string, required, predefined severity)
- `source` (URL string, required, valid URL format)
- `description` (string, 10-5000 chars, required)

**Validation Rules:**

| Field | Rule | Error Message |
|-------|------|---------------|
| title | Required | "Title is required" |
| title | Min 5 chars | "Title must be at least 5 characters" |
| title | Max 200 chars | "Title must be at most 200 characters" |
| title | No leading/trailing whitespace | "Title cannot start or end with whitespace" |
| category | Required | "Category is required" |
| category | Must be in predefined list | "Invalid category selected" |
| impact | Required | "Impact is required" |
| impact | Must be in predefined list | "Invalid impact selected" |
| source | Required | "Source URL is required" |
| source | Valid URL | "Source must be a valid URL (https://example.com)" |
| source | HTTPS only | "Source must use HTTPS" |
| description | Required | "Description is required" |
| description | Min 10 chars | "Description must be at least 10 characters" |
| description | Max 5000 chars | "Description must be at most 5000 characters" |

**Predefined Values:**
```typescript
categories = [
  'Healthcare',
  'Environment',
  'Finance',
  'Technology',
  'Politics',
  'Education',
  'Other'
];

impacts = [
  'Low',      // Minor issue, limited scope
  'Medium',   // Moderate issue, some affected
  'High',     // Major issue, many affected
  'Critical'  // Severe issue, systemic impact
];
```

**UI State:**
- Loading: false (no async validation in this step)
- Errors: Map of field name → error message
- Touched: Map of field name → boolean (for progressive validation)
- Valid: boolean (all fields valid)

**Actions:**
- User types in field → Validate field on blur, update errors
- User clicks "Next" → Validate all fields, if valid go to Step 2

**Accessibility:**
- Each field has `<label>` with `htmlFor`
- Each error has `role="alert"` and `aria-live="polite"`
- Each field with error has `aria-invalid="true"` and `aria-describedby` pointing to error
- Form has `aria-labelledby` pointing to step title
- Step indicator shows current step with `aria-current="step"`

### Step 2: Evidence Upload

**State:** `evidence-upload`

**Purpose:** Upload evidence file or provide evidence URL with integrity verification.

**Evidence Sources:**
1. **File Upload:** User selects local file (PDF, image, video)
2. **URL Reference:** User provides URL to external evidence

**File Upload Flow:**

```
IDLE
  ↓ (user selects file)
VALIDATING (check file type, size)
  ↓ (validation passes)
HASHING (calculate local SHA-256)
  ↓ (hash complete)
UPLOADING (send to storage service)
  ↓ (upload complete)
VERIFYING (check canonical digest matches local)
  ↓ (verification passes)
VERIFIED ✓
```

**URL Reference Flow:**

```
IDLE
  ↓ (user enters URL)
VALIDATING (check URL format, HTTPS, reachability)
  ↓ (validation passes)
VERIFIED ✓
```

**File Validation Rules:**

| Rule | Constraint | Error Message |
|------|-----------|---------------|
| File type | PDF, PNG, JPG, MP4, WEBM | "Unsupported file type. Please upload PDF, PNG, JPG, MP4, or WEBM." |
| File size | Max 50MB | "File is too large. Maximum size is 50MB." |
| File name | Must not contain path traversal | "Invalid file name" |

**URL Validation Rules:**

| Rule | Constraint | Error Message |
|------|-----------|---------------|
| Format | Valid URL | "Invalid URL format" |
| Protocol | HTTPS only | "URL must use HTTPS" |
| Reachability | HEAD request succeeds | "URL is not reachable" |
| Content-Type | Must be valid evidence type | "URL does not point to valid evidence" |

**Privacy Requirements:**

**Never log/telemeter:**
- File name (use "evidence.{ext}" in logs)
- File contents (never read beyond hash calculation)
- SHA-256 digest (use "[redacted]" in logs)
- Full URL (sanitize to domain only: "evidence from example.com")

**Integrity Verification:**

For file uploads:
1. Calculate local SHA-256 digest in browser (Web Crypto API)
2. Upload file to storage service
3. Storage service returns canonical digest
4. Compare local digest === canonical digest
5. If mismatch → FAILED state, user must re-upload

For URL references:
1. Validate URL format and HTTPS
2. Optionally: HEAD request to verify reachability
3. Mark as VERIFIED (canonical validation happens server-side)

**Wallet Change Invalidation:**

If user changes wallet account or chain during upload:
1. Abort in-progress upload
2. Transition to INVALIDATED state
3. Clear evidence data
4. User must select evidence again

**UI State:**
```typescript
type EvidenceState = {
  source: 'file' | 'url' | null;
  status: 'idle' | 'validating' | 'hashing' | 'uploading' | 'verifying' | 'verified' | 'failed' | 'cancelled' | 'invalidated';
  progress: number; // 0-99 during upload, 100 when verified
  error: string | null;
  fileName: string | null; // Sanitized display name
  fileSize: number | null; // In bytes
  url: string | null; // For URL source
  digest: string | null; // Never logged
  canProceed: boolean; // status === 'verified'
};
```

**Actions:**
- User selects file → Validate, hash, upload, verify
- User enters URL → Validate, verify reachability
- User clicks "Back" → Go to Step 1 (preserve evidence if verified)
- User clicks "Next" → If verified, go to Step 3
- Upload fails → Show error, offer "Retry" button
- User clicks "Cancel Upload" → Abort, return to IDLE

**Accessibility:**
- File input has `<label>` with clear text
- Upload progress has `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Progress announces milestones: "Hashing...", "Uploading 25%", "Verifying...", "Verified"
- Error messages have `role="alert"`
- "Retry" button has clear label and keyboard focus

### Step 3: Review

**State:** `review`

**Purpose:** Show user all inputs for final confirmation before transaction.

**Display:**
- Claim Details (from Step 1)
  - Title
  - Category
  - Impact
  - Source URL (sanitized: domain only)
  - Description
- Evidence (from Step 2)
  - Source type (File or URL)
  - File name (sanitized) or URL domain
  - File size (human-readable)
  - Status: ✓ Verified
- Transaction Details
  - Stake amount (from contract config)
  - Stake asset (token symbol)
  - Expected gas cost (estimated)
  - Network (chain name)

**Validation:**
- All Step 1 fields still valid
- Evidence still verified
- Wallet still connected
- Chain still matches expected
- Contract artifacts still valid

**Fail-Closed Checks:**

| Check | Failure Action |
|-------|---------------|
| Wallet disconnected | Show "Wallet disconnected" error, disable submit |
| Chain mismatch | Show "Switch to [Expected Chain]" error, disable submit |
| Evidence invalidated | Show "Evidence invalidated, go back to Step 2" error |
| Stale artifacts | Show "Reload page to get latest contract info" error |
| Insufficient balance | Show "Insufficient [Token] balance" error, disable submit |

**UI State:**
```typescript
type ReviewState = {
  claimDetails: ClaimFormData;
  evidence: EvidenceState;
  transactionEstimate: {
    stakeAmount: bigint;
    stakeAsset: { symbol: string; decimals: number };
    estimatedGas: bigint;
    chainId: number;
    chainName: string;
  };
  validation: {
    walletConnected: boolean;
    chainMatch: boolean;
    evidenceValid: boolean;
    artifactsValid: boolean;
    sufficientBalance: boolean;
  };
  canSubmit: boolean; // All validations pass
};
```

**Actions:**
- User clicks "Edit Claim" → Go back to Step 1
- User clicks "Edit Evidence" → Go back to Step 2
- User clicks "Submit Claim" → If all validations pass, go to Step 4
- Validation fails → Show specific error, disable submit

**Accessibility:**
- Review has clear heading structure (h2 for sections, h3 for subsections)
- All displayed data has clear labels
- Edit buttons have clear labels: "Edit claim details", "Edit evidence"
- Submit button has `aria-describedby` pointing to any validation errors
- Validation errors have `role="alert"`

### Step 4: Transaction

**State:** `transaction`

**Purpose:** Execute on-chain claim creation with approval flow, show progress, handle errors.

**Transaction Flow:**

```
PREPARING
  ↓ (build contentDigest, check allowance)
APPROVAL_NEEDED? (if allowance < stakeAmount)
  ↓ yes
REQUESTING_APPROVAL
  ↓ (user approves in wallet)
APPROVAL_SUBMITTED
  ↓ (wait for approval receipt)
APPROVAL_CONFIRMED
  ↓
REQUESTING_SIGNATURE (claim creation)
  ↓ (user signs in wallet)
SUBMITTED
  ↓ (transaction in mempool)
CONFIRMING (accumulating blocks)
  ↓ (confirmations >= safe threshold)
SAFE
  ↓ (waiting for indexer)
INDEXING
  ↓ (indexer acknowledges)
FINALIZED ✓

Terminal Failures:
- USER_REJECTED (wallet signature denied)
- SIMULATION_REVERTED (transaction would revert)
- TRANSACTION_REVERTED (transaction reverted on-chain)
- DROPPED (transaction dropped from mempool)
- REORGED (chain reorganization)
```

**contentDigest Calculation:**

```typescript
contentDigest = keccak256(
  concat([
    stringToHex(title),
    stringToHex(category),
    stringToHex(impact),
    stringToHex(source),
    stringToHex(description),
    evidenceDigest, // From Step 2
  ])
);
```

**Approval Flow (if needed):**

1. Check current allowance: `ERC20.allowance(userAddress, claimContractAddress)`
2. If `allowance < stakeAmount`:
   - Show "Approval needed: [Amount] [Token]"
   - Submit approval: `ERC20.approve(claimContractAddress, stakeAmount)`
   - Wait for approval receipt
   - Show "Approval confirmed, proceeding with claim creation"
3. Proceed to claim creation

**Claim Creation:**

1. Simulate transaction: `simulateContract(claimContract, 'createClaim', [contentDigest, asset, amount, frozenConfig])`
2. If simulation fails → SIMULATION_REVERTED, show error
3. If simulation succeeds → Request signature
4. Submit transaction: `writeContract(...)`
5. Wait for receipt: `waitForTransactionReceipt(txHash)`
6. Verify receipt status === 'success'
7. Wait for indexer acknowledgement: `getIndexedClaim(contentDigest, txHash, chainId)`
8. If indexer ack → FINALIZED
9. If timeout → show "Indexing delayed, check back later"

**Error Handling:**

| Error Code | User Message | Recovery Action |
|------------|-------------|-----------------|
| USER_REJECTED | "You rejected the transaction in your wallet" | "Back to Review" button |
| SIMULATION_REVERTED | "Transaction would fail: [reason]" | "Back to Review" button, show reason |
| TRANSACTION_REVERTED | "Transaction failed on-chain: [reason]" | "View on Explorer" link, "Retry" button |
| DROPPED | "Transaction was dropped from mempool" | "Retry" button |
| REORGED | "Chain reorganization detected" | "Retry" button, clear state |
| INSUFFICIENT_FUNDS | "Insufficient balance for gas + stake" | "Add funds" guidance, "Cancel" button |
| ALLOWANCE_INSUFFICIENT | "Token approval failed" | "Retry Approval" button |

**UI State:**
```typescript
type TransactionState = {
  status: TransactionStatus; // From transaction machine
  txHash: Hash | null;
  blockNumber: bigint | null;
  confirmations: number;
  error: ClaimCreationErrorCode | null;
  errorMessage: string | null;
  approvalNeeded: boolean;
  approvalTxHash: Hash | null;
  approvalConfirmed: boolean;
  indexerAcknowledged: boolean;
};
```

**Progress Display:**

- **Preparing:** Loading spinner, "Preparing transaction..."
- **Approval Needed:** Info banner, "Token approval required: [Amount] [Token]"
- **Requesting Approval:** Wallet icon, "Check your wallet to approve"
- **Approval Submitted:** Progress, "Approving token... (tx: 0x...)"
- **Approval Confirmed:** Success checkmark, "Approval confirmed ✓"
- **Requesting Signature:** Wallet icon, "Check your wallet to sign claim creation"
- **Submitted:** Progress, "Transaction submitted (tx: 0x...)"
- **Confirming:** Progress bar, "Confirming... X / Y blocks"
- **Safe:** Success badge, "Transaction safe ✓"
- **Indexing:** Loading spinner, "Indexing claim..."
- **Finalized:** Success checkmark, "Claim created successfully ✓"

**Actions:**
- User rejects in wallet → USER_REJECTED, show "Back to Review"
- Transaction fails → Show error + recovery actions
- User clicks "View on Explorer" → Open block explorer in new tab
- User clicks "Retry" → Go back to PREPARING, attempt again
- User clicks "Cancel" → Abort (only if not yet submitted)

**Accessibility:**
- Transaction progress has `role="status"` and `aria-live="polite"`
- Confirmation progress uses ConfirmationProgress component (from previous work)
- Error messages have `role="alert"` and `aria-live="assertive"`
- Transaction hash has `aria-label="Transaction hash: [hash]"`
- All buttons have clear labels and keyboard focus

### Step 5: Confirmation

**State:** `confirmation`

**Purpose:** Show final success or failure state with next actions.

**Success State:**

**Display:**
- Large success icon/animation
- "Claim Created Successfully"
- Claim ID (from indexer response)
- Transaction hash with explorer link
- "What's next?" section:
  - "Your claim is now open for verification"
  - "Verifiers will review and vote on your claim"
  - Expected timeline: "Verification typically takes X days"
  - "View your claim" button → Navigate to claim detail page
  - "Create another claim" button → Reset wizard, go to Step 1

**Failure State:**

**Display:**
- Error icon
- "Claim Submission Failed"
- Error reason (user-friendly message)
- Technical details (expandable)
  - Error code
  - Transaction hash (if exists)
  - Revert reason (if available)
- Recovery actions:
  - "Try Again" button → Go back to Step 4, retry transaction
  - "Edit Claim" button → Go back to Step 1
  - "Get Help" link → Open support/FAQ

**UI State:**
```typescript
type ConfirmationState = {
  status: 'success' | 'failure';
  claimId: string | null; // From indexer
  txHash: Hash | null;
  error: {
    code: ClaimCreationErrorCode;
    message: string;
    technicalDetails: string;
  } | null;
  nextActions: {
    viewClaim?: string; // URL to claim detail
    createAnother?: () => void;
    tryAgain?: () => void;
    editClaim?: () => void;
    getHelp?: string; // URL to support
  };
};
```

**Actions:**
- User clicks "View your claim" → Navigate to `/claims/[claimId]`
- User clicks "Create another claim" → Reset wizard state, go to Step 1
- User clicks "Try Again" → Go back to Step 4, retry transaction
- User clicks "Edit Claim" → Go back to Step 1, preserve form data
- User clicks "Get Help" → Open support page in new tab
- User closes modal → Return to claims list

**Accessibility:**
- Success/failure status announced via `aria-live="assertive"`
- Success icon has `role="img"` and `aria-label="Success"`
- Error icon has `role="img"` and `aria-label="Error"`
- Technical details expandable has `aria-expanded` state
- All action buttons have clear labels
- Focus moves to primary action button on mount

## Wizard State Machine

### State Type

```typescript
type WizardStep = 
  | 'claim-details'
  | 'evidence-upload'
  | 'review'
  | 'transaction'
  | 'confirmation';

type WizardState = {
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
  canGoBack: boolean;
  canGoNext: boolean;
  data: {
    claimDetails: ClaimFormData | null;
    evidence: EvidenceState | null;
    transaction: TransactionState | null;
    confirmation: ConfirmationState | null;
  };
};
```

### State Transitions

```
CLAIM_DETAILS
  ← back: N/A (first step)
  → next: EVIDENCE_UPLOAD (if form valid)
  → cancel: Close wizard

EVIDENCE_UPLOAD
  ← back: CLAIM_DETAILS (preserve evidence if verified)
  → next: REVIEW (if evidence verified)
  → cancel: Close wizard (confirm if upload in progress)

REVIEW
  ← back: EVIDENCE_UPLOAD (re-validate on return)
  ← edit: CLAIM_DETAILS or EVIDENCE_UPLOAD (depending on edit button clicked)
  → next: TRANSACTION (if all validations pass)
  → cancel: Close wizard (confirm data loss)

TRANSACTION
  ← back: N/A (cannot go back once transaction started)
  → next: CONFIRMATION (when transaction complete: finalized or failed)
  → cancel: N/A (cannot cancel once submitted)

CONFIRMATION
  ← back: N/A (terminal state)
  → next: N/A (terminal state)
  → view-claim: Navigate to claim detail
  → create-another: Reset to CLAIM_DETAILS
  → close: Close wizard
```

### State Persistence

**Session Storage:** Wizard state persisted to `sessionStorage` for page refresh recovery:
- Claim details (form data)
- Evidence state (but NOT file contents or digests)
- Current step

**Not Persisted:**
- Transaction state (re-fetch from chain on mount)
- Confirmation state (re-fetch from indexer)
- Evidence file contents
- SHA-256 digests

**On Page Refresh:**
1. Check `sessionStorage` for wizard state
2. If found and timestamp < 1 hour old:
   - Restore claim details
   - Restore current step (but not TRANSACTION or CONFIRMATION)
   - Show "Resume submission?" prompt
3. If user confirms resume → Restore state, validate all data
4. If user declines or state stale → Clear storage, start fresh

## Validation Utilities

### Claim Details Validation

```typescript
type ValidationResult = { valid: boolean; error?: string };

// Field validators
validateTitle(title: string): ValidationResult;
validateCategory(category: string): ValidationResult;
validateImpact(impact: string): ValidationResult;
validateSourceUrl(url: string): ValidationResult;
validateDescription(description: string): ValidationResult;

// Composite validator
validateClaimDetails(data: ClaimFormData): {
  valid: boolean;
  errors: Partial<Record<keyof ClaimFormData, string>>;
};
```

### Evidence Validation

```typescript
// File validators
validateFileType(file: File): ValidationResult;
validateFileSize(file: File): ValidationResult;
validateFileName(fileName: string): ValidationResult;

// URL validators
validateEvidenceUrl(url: string): ValidationResult;
checkUrlReachability(url: string): Promise<ValidationResult>;

// Integrity validators
calculateFileHash(file: File): Promise<Hex>; // SHA-256
verifyEvidenceIntegrity(localHash: Hex, canonicalHash: Hex): boolean;
```

### Transaction Validation

```typescript
// Wallet/chain validators
validateWalletConnected(address?: Address): ValidationResult;
validateChainMatch(connectedChainId: number, expectedChainId: number): ValidationResult;
validateArtifactVersion(version: string): ValidationResult;
validateContractAddress(address: Address, expectedChecksum: string): ValidationResult;

// Balance validators
validateSufficientBalance(balance: bigint, required: bigint): ValidationResult;
validateAllowance(allowance: bigint, required: bigint): ValidationResult;

// Content digest validators
validateContentDigest(digest: Hex): ValidationResult;
validateFrozenConfig(config: Hex): ValidationResult;
```

### Sanitization Utilities

```typescript
// Privacy-preserving display
sanitizeFileName(fileName: string): string; // "evidence.pdf"
sanitizeUrl(url: string): string; // "evidence from example.com"
redactDigest(digest: Hex): string; // "[redacted]"

// Input sanitization
stripWhitespace(text: string): string;
normalizeLineEndings(text: string): string;
truncateText(text: string, maxLength: number): string;
```

## Accessibility Requirements

### Wizard Navigation

**Keyboard Navigation:**
- Tab: Move focus between interactive elements
- Shift+Tab: Move focus backwards
- Enter: Activate buttons, submit forms
- Escape: Cancel/close wizard (with confirmation if data entered)
- Arrow keys: Navigate between steps (if step indicator is focusable)

**Focus Management:**
- Focus moves to first input when wizard opens
- Focus moves to first input of new step on step transition
- Focus moves to primary action button on confirmation step
- Focus returns to trigger element when wizard closes

**Screen Reader Announcements:**
- Step transition: "Step X of 5: [Step Name]"
- Validation error: "Error: [Field] - [Error message]"
- Progress update: "[Action] - [Progress]%"
- Success/failure: "[Status] - [Message]"

### ARIA Patterns

**Wizard Container:**
```html
<div role="dialog" aria-modal="true" aria-labelledby="wizard-title">
  <h2 id="wizard-title">Create Claim</h2>
  <!-- Wizard content -->
</div>
```

**Step Indicator:**
```html
<ol role="list" aria-label="Wizard steps">
  <li aria-current="step">1. Claim Details</li>
  <li>2. Evidence Upload</li>
  <li>3. Review</li>
  <li>4. Transaction</li>
  <li>5. Confirmation</li>
</ol>
```

**Form Fields:**
```html
<label for="claim-title">Title</label>
<input
  id="claim-title"
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby={hasError ? "title-error" : undefined}
/>
{hasError && (
  <span id="title-error" role="alert" aria-live="polite">
    {errorMessage}
  </span>
)}
```

**Progress Bar:**
```html
<div
  role="progressbar"
  aria-label="Upload progress"
  aria-valuenow={progress}
  aria-valuemin={0}
  aria-valuemax={100}
/>
```

**Transaction Status:**
```html
<div role="status" aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>
```

## Testing Requirements

### Unit Tests (Validation Utilities)

**Claim details validation:**
- Valid inputs return { valid: true }
- Invalid inputs return { valid: false, error: "..." }
- Edge cases: empty, whitespace, boundary lengths
- XSS/injection attempts rejected

**Evidence validation:**
- File type validation (allowed/rejected types)
- File size validation (within/exceeding limit)
- URL validation (valid/invalid formats, HTTP/HTTPS)
- Hash calculation accuracy
- Integrity verification (match/mismatch)

**Transaction validation:**
- Wallet connected/disconnected
- Chain match/mismatch
- Sufficient/insufficient balance
- Allowance checks
- Artifact version validation

### Component Tests (Wizard Steps)

**Step 1 - Claim Details:**
- Renders all fields
- Shows validation errors on blur
- Disables "Next" when invalid
- Enables "Next" when valid
- Preserves data on back/next navigation

**Step 2 - Evidence Upload:**
- File selection triggers upload flow
- Shows progress during upload
- Shows error on upload failure
- "Retry" button works
- URL input validates format
- Evidence verified enables "Next"

**Step 3 - Review:**
- Displays all claim details correctly
- Displays evidence info correctly
- Shows transaction estimate
- "Edit" buttons navigate correctly
- Fail-closed validations block submit

**Step 4 - Transaction:**
- Shows approval UI when needed
- Shows transaction progress
- Shows confirmation count
- Handles user rejection gracefully
- Handles transaction revert gracefully
- Shows success on finalization

**Step 5 - Confirmation:**
- Success state shows claim ID and actions
- Failure state shows error and recovery
- "View claim" navigates correctly
- "Create another" resets wizard
- "Try again" returns to transaction step

### Integration Tests

**Full wizard flow:**
1. Open wizard
2. Fill claim details → Next
3. Upload evidence → Next
4. Review → Submit
5. Approve token (if needed)
6. Sign transaction
7. Wait for confirmation
8. Verify success state

**Error recovery flow:**
1. Fill claim details
2. Upload evidence
3. Review → Submit
4. Reject in wallet → See error
5. Click "Try Again" → Retry successfully

**Wallet change invalidation:**
1. Fill claim details
2. Start evidence upload
3. Change wallet account → Evidence invalidated
4. User must re-upload evidence

**Page refresh recovery:**
1. Fill claim details → Next
2. Upload evidence
3. Refresh page
4. See "Resume submission?" prompt
5. Resume → Wizard restores state

### E2E Tests (Playwright)

**Happy path:**
- Complete full submission wizard
- Verify claim appears in claims list
- Verify transaction on block explorer

**Error scenarios:**
- User rejects wallet signature → Sees error, can retry
- Transaction reverts → Sees revert reason, can edit claim
- Network error during upload → Sees error, can retry

**Accessibility:**
- Keyboard navigation works (Tab, Enter, Escape)
- Focus management correct at each step
- Screen reader announcements work
- ARIA attributes present and correct

## Sign-off

**Date:** 2026-09-27  
**Status:** State model defined, ready for implementation  
**Next:** Implement validation utilities, evidence handling, wizard components

---

*This document defines the canonical state model for claim submission. All implementations must adhere to these specifications.*
