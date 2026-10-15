/**
 * Settlement and finalization types for V2 protocol
 * Handles provisional settlement, appeal settlement, and finalization states
 */

/**
 * Settlement lifecycle states
 */
export type SettlementState =
  | 'PENDING_SETTLEMENT'
  | 'SETTLED'
  | 'SETTLEMENT_CLAIMED'
  | 'PENDING_APPEAL'
  | 'APPEAL_SETTLED'
  | 'APPEAL_CLAIMED'
  | 'FINALIZED';

/**
 * Permissionless action types that can be executed
 */
export type PermissionlessActionType =
  | 'SETTLE_PROVISIONAL'
  | 'SETTLE_APPEAL'
  | 'FINALIZE'
  | 'CLAIM_SETTLEMENT'
  | 'CLAIM_APPEAL';

/**
 * Settlement action that can be executed permissionlessly
 */
export interface SettlementAction {
  type: PermissionlessActionType;
  claimId: string;
  disputeId?: string;
  isCallable: boolean;
  reason?: string; // Why action is not callable
}

/**
 * Simulation result for a settlement action.
 *
 * `gasEstimate` is only populated when the RPC node actually reported one, and
 * `data.calldata` only when the pinned canonical ABI can encode the call. Both
 * are optional precisely so that a missing value can never be back-filled with
 * an invented one.
 */
export interface SimulationResult {
  success: boolean;
  gasEstimate?: string;
  error?: string;
  data?: {
    transactionHash?: string;
    from: string;
    to: string;
    value?: string;
    calldata?: string;
  };
}

/**
 * Settlement submission response
 */
export interface SettlementSubmission {
  transactionHash: string;
  from: string;
  to: string;
  status: 'pending' | 'confirmed' | 'failed';
  type: PermissionlessActionType;
  claimId: string;
  disputeId?: string;
  timestamp: string;
}

/**
 * Reconciliation result after finality
 */
export interface ReconciliationResult {
  transactionHash: string;
  status: 'confirmed' | 'reverted' | 'timeout';
  finalState: SettlementState;
  rewards?: {
    address: string;
    amount: string;
  };
  error?: string;
}

/**
 * State validation for preventing stale calls
 */
export interface StateValidation {
  isValid: boolean;
  currentState: SettlementState;
  error?: string;
  contractVersion?: string;
  chainId?: number;
}

/**
 * Settlement context for detecting callable actions
 */
export interface SettlementContext {
  claimId: string;
  currentState: SettlementState;
  contractAddress: string;
  chainId: number;
  userAddress: string;
  votingPeriodEnded: boolean;
  appealPeriodEnded: boolean;
  finalizationPeriodEnded: boolean;
}

/**
 * Finalization requirements
 */
export interface FinalizationRequirements {
  claimId: string;
  disputeId?: string;
  allSettlementsCompleted: boolean;
  noActiveAppeals: boolean;
  finalizationWindowOpen: boolean;
  timeRemaining?: number; // seconds
}
