/**
 * Dispute opening and challenge types for V2 protocol
 * Handles opening challenges against provisional outcomes on Optimism/EVM
 */

/**
 * Provisional outcome from first-round verification
 * This is the outcome being challenged by opening a dispute
 */
export interface ProvisionalOutcome {
  claimId: string;
  
  // First-round verification result
  decision: 'VERIFIED' | 'REJECTED';
  votesFor: number;
  votesAgainst: number;
  totalStake: string; // Wei amount as string
  
  // Outcome finalization
  outcomeAt: string; // ISO 8601 timestamp when outcome was determined
  outcomeBlock: number;
  
  // Settlement state
  isProvisional: boolean; // True if dispute window still open
  isFinalized: boolean; // True if dispute window closed without challenge
}

/**
 * Dispute deadline and challenge window
 */
export interface DisputeDeadline {
  claimId: string;
  
  // Challenge window timestamps
  windowStartTime: string; // ISO 8601
  windowEndTime: string; // ISO 8601
  
  // Time remaining to challenge (in seconds, 0 if expired)
  timeRemaining: number;
  
  // Block-based deadline (for on-chain finality)
  windowEndBlock: number;
  currentBlock: number;
  blocksRemaining: number;
  
  // State flags
  isWindowOpen: boolean; // Can still challenge
  isWindowClosed: boolean; // Toolate to challenge
  hasActiveDispute: boolean; // Already challenged
}

/**
 * Challenge bond requirements
 */
export interface ChallengeBond {
  claimId: string;
  
  // Bond amount required to open dispute
  bondAmount: string; // Wei amount as string
  
  // Slashing risk if challenge fails
  slashAmount: string; // Wei amount as string
  slashPercentage: number; // e.g., 10 for 10%
  
  // Potential reward if challenge succeeds
  potentialReward: string; // Wei amount as string
  rewardMultiplier: number; // e.g., 1.5 for 1.5x bond
}

/**
 * User's wallet eligibility for opening dispute
 */
export interface DisputeWalletPosition {
  claimId: string;
  userAddress: string;
  
  // Can user open dispute?
  canChallenge: boolean;
  
  // Existing participation checks
  hasParticipatedInFirstRound: boolean; // Participated in verification
  hasOpenedDispute: boolean; // Already opened this dispute
  
  // Balance checks
  currentBalance: string; // Wei amount as string
  hasSufficientBalance: boolean;
  balanceAfterBond: string; // Wei amount remaining after bond
}

/**
 * Complete dispute context for opening challenges
 * Combines provisional outcome, deadline, bond, and wallet position
 */
export interface DisputeContext {
  provisionalOutcome: ProvisionalOutcome;
  deadline: DisputeDeadline;
  bond: ChallengeBond;
  walletPosition: DisputeWalletPosition;
  
  // Computed eligibility
  isEligible: boolean;
  ineligibilityReason?: string;
}

/**
 * Dispute submission status
 */
export type DisputeSubmissionStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'REVERTED'
  | 'REPLACED'; // Transaction replaced with higher gas

/**
 * Dispute opening submission payload
 */
export interface DisputeSubmissionPayload {
  claimId: string;
  reason: string;
  bondAmount: string; // Wei amount as string
  userAddress: string;
  
  // Optional metadata
  evidence?: string[]; // URLs or IPFS hashes
}

/**
 * Dispute opening transaction
 */
export interface DisputeTransaction {
  transactionHash: string;
  from: string;
  to: string; // Contract address
  status: DisputeSubmissionStatus;
  
  claimId: string;
  disputeId?: string; // Available after indexing
  reason: string;
  bondAmount: string; // Wei amount as string
  
  timestamp: string; // ISO 8601
  blockNumber?: number;
  
  // Gas details
  gasUsed?: string;
  gasPrice?: string;
  
  // Bond lock confirmation
  bondLocked: boolean;
  bondLockConfirmedAt?: string; // ISO 8601
}

/**
 * Dispute simulation result
 */
export interface DisputeSimulationResult {
  success: boolean;
  error?: string;
  
  // Gas estimation
  gasEstimate?: string;
  
  // Projected state after dispute opens.
  // `disputeId` is absent until the contract assigns it on-chain; the id is
  // never predicted locally.
  projectedState?: {
    disputeId?: string;
    bondLocked: string;
    newStatus: 'DISPUTING';
  };
  
  // Transaction data
  data?: {
    from: string;
    to: string;
    value?: string;
    callata: string;
  };
}

/**
 * Dispute validation result
 */
export interface DisputeValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  
  // Validation details
  checks: {
    windowOpen: boolean;
    noActiveDispute: boolean;
    walletConnected: boolean;
    correctChain: boolean;
    sufficientBalance: boolean;
    notParticipatedInFirstRound: boolean; // Some protocols disallow
    bondAmountValid: boolean;
    reasonProvided: boolean;
    contractAddressValid: boolean;
    artifactVersionValid: boolean;
    contractNotPaused: boolean;
  };
}

/**
 * Dispute reconciliation result after confirmation
 */
export interface DisputeReconciliationResult {
  transactionHash: string;
  status: 'confirmed' | 'reverted' | 'timeout' | 'replaced';
  
  // Final state after reconciliation
  disputeId?: string;
  bondLocked: boolean;
  bondAmount: string;
  
  // Updated wallet state
  newBalance: string;
  
  // Error details (if failed)
  error?: string;
  revertReason?: string;
}

// Legacy types (kept for backward compatibility)

export interface ClaimData {
  id: string;
  category: string;
  hash: string;
  status: 'Verified' | 'Disputed' | 'Pending';
  title: string;
  source: string;
  timeAgo: string;
  votesFor: number;
  votesAgainst: number;
  verifiersCount: number;
  confidenceScore: number;
  totalStaked: number;
}

export interface Dispute {
  id: string;
  claimId: string;
  reason: string;
  status: 'OPEN' | 'VOTING' | 'RESOLVED' | 'FAILED' | 'APPEALED';
  proVotes: number;
  conVotes: number; 
  totalStaked: number;
  createdAt: string;
  
  // Appeal information (if dispute has been appealed)
  appealId?: string;
  appealInitiatedAt?: string;
  appealDeadline?: string;
}

export interface CreateDisputePayload {
  claimId: string;
  reason: string;
  initialStake: number;
}

export interface Evidence {
  id: string;
  title: string;
  description: string;
  url: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  timeAgo: string;
  actor: string;
  isRecent?: boolean;
  type?: string;
}

export interface TopVerifier {
  id: string;
  rank: number;
  name: string;
  staked: string;
  score: number;
}

/**
 * Public dispute register entry.
 *
 * Projection only. The contract is canonical for all mutations and for
 * final resolution state. The `outcomeState` field distinguishes a
 * provisional outcome from a finalized one.
 */
export type DisputeOutcomeState = 'provisional' | 'final';

export type DisputeResolutionState =
  | 'OPEN'
  | 'VOTING'
  | 'RESOLVED'
  | 'FAILED'
  | 'APPEALED';

export type DisputeRegisterEntry = {
  id: string;
  claimId: string;
  claimTitle: string;
  claimHref: string;
  outcomeState: DisputeOutcomeState;
  resolutionState: DisputeResolutionState;
  challengerAddress: string;
  bondAmountWei: string;
  bondAssetSymbol: string;
  openedAt: string; // ISO 8601
  deadlineAt: string; // ISO 8601
  appealable: boolean;
  freshnessLabel: string; // human-readable freshness description
  freshnessAt: string; // ISO 8601 of last projection update
}

export type DisputeEvidenceItem = {
  id: string;
  label: string;
  url?: string;
  description?: string;
  // When the evidence reference fails sanitization the projection returns
  // a sanitized placeholder instead of the raw URL.
  sanitized: boolean;
};

export type DisputeTimelineEntry = {
  id: string;
  label: string;
  at: string; // ISO 8601
  actor: string;
  detail?: string;
};

export type DisputeDetail = {
  id: string;
  claimId: string;
  claimTitle: string;
  claimHref: string;
  outcomeState: DisputeOutcomeState;
  resolutionState: DisputeResolutionState;
  challengerAddress: string;
  bondAmountWei: string;
  bondAssetSymbol: string;
  openedAt: string;
  deadlineAt: string;
  appealable: boolean;
  appealDeadlineAt?: string;
  freshnessLabel: string;
  freshnessAt: string;
  evidence: DisputeEvidenceItem[];
  timeline: DisputeTimelineEntry[];
};
