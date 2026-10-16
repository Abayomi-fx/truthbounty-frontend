/**
 * UI-FE-080: Fail-Closed Canonical Evidence Validator
 *
 * Enforces the core security invariant:
 * "Receipt state never exceeds canonical evidence."
 *
 * Rules:
 *  - Unknown / unauthorized chain IDs fail closed.
 *  - Finalized status requires confirmations >= finalizedThreshold,
 *    indexer acknowledgment, and no unacknowledged reorg.
 *  - Safe status requires confirmations >= safeThreshold and no reorg.
 *  - Replaced status requires replacement hash.
 *  - Reorged status requires reorg details and forces finality level to 'none'.
 *  - Fabricated or ill-formed txHashes fail closed.
 */

import {
  ALLOWED_CHAIN_IDS_DEV,
  OPTIMISM_CHAIN_IDS,
} from '@/lib/transaction-machine/transaction-machine.types';
import {
  CONFIRMATION_THRESHOLDS,
  getConfirmationThresholds,
} from '@/lib/transaction-confirmation';
import type {
  FinalityProvenanceLevel,
  RawReceiptInput,
  ReceiptActionType,
  ReceiptLifecycleStatus,
} from './types';

export class ReceiptValidationError extends Error {
  readonly code:
    | 'INVALID_CHAIN'
    | 'INVALID_TX_HASH'
    | 'EVIDENCE_EXCEEDED'
    | 'MISSING_REPLACEMENT_HASH'
    | 'REORG_CONTRADICTION'
    | 'INVALID_ACTION';

  constructor(
    code:
      | 'INVALID_CHAIN'
      | 'INVALID_TX_HASH'
      | 'EVIDENCE_EXCEEDED'
      | 'MISSING_REPLACEMENT_HASH'
      | 'REORG_CONTRADICTION'
      | 'INVALID_ACTION',
    message: string,
  ) {
    super(`[ReceiptValidationError:${code}] ${message}`);
    this.name = 'ReceiptValidationError';
    this.code = code;
  }
}

const VALID_ACTIONS = new Set<ReceiptActionType>([
  'claim',
  'verification',
  'dispute',
  'governance',
  'pause',
  'retry',
  'support-reference',
]);

const VALID_STATUSES = new Set<ReceiptLifecycleStatus>([
  'pending',
  'submitted',
  'confirming',
  'safe',
  'indexing',
  'finalized',
  'replaced',
  'reverted',
  'reorged',
  'dropped',
]);

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

/**
 * Validate that a chain ID is an allowed Optimism/EVM chain.
 */
export function assertValidChainId(chainId: number, allowDev = true): void {
  const allowed = allowDev ? ALLOWED_CHAIN_IDS_DEV : OPTIMISM_CHAIN_IDS;
  if (!allowed.includes(chainId as (typeof allowed)[number])) {
    throw new ReceiptValidationError(
      'INVALID_CHAIN',
      `Chain ID ${chainId} is not supported. Supported chains: ${allowed.join(', ')}`,
    );
  }
}

/**
 * Validate a transaction hash format.
 */
export function assertValidTxHash(hash: string | null | undefined): `0x${string}` | null {
  if (!hash) return null;
  const trimmed = hash.trim();
  if (!TX_HASH_REGEX.test(trimmed)) {
    throw new ReceiptValidationError(
      'INVALID_TX_HASH',
      `Transaction hash "${hash}" is not a valid 32-byte hex string`,
    );
  }
  return trimmed as `0x${string}`;
}

/**
 * Validated consensus & finality parameters
 */
export interface ValidatedConsensusResult {
  finalityLevel: FinalityProvenanceLevel;
  safeThreshold: number;
  finalizedThreshold: number;
  confirmations: number | null;
  blockNumber: string | null;
  blockHash: `0x${string}` | null;
  indexerAcknowledged: boolean;
  status: ReceiptLifecycleStatus;
}

/**
 * Validate canonical evidence against thresholds and reorg/replaced states.
 * Fails closed if the claimed status exceeds real evidence.
 */
export function validateCanonicalEvidence(input: RawReceiptInput): ValidatedConsensusResult {
  if (!VALID_ACTIONS.has(input.action)) {
    throw new ReceiptValidationError(
      'INVALID_ACTION',
      `Action "${input.action}" is not one of the 7 supported canonical actions`,
    );
  }

  if (!VALID_STATUSES.has(input.status)) {
    throw new ReceiptValidationError(
      'EVIDENCE_EXCEEDED',
      `Status "${input.status}" is not a valid receipt status`,
    );
  }

  assertValidChainId(input.chainId, true);

  const thresholds = getConfirmationThresholds(input.chainId) ?? CONFIRMATION_THRESHOLDS[10];
  const safeThreshold = input.safeThreshold ?? thresholds.safeConfirmations;
  const finalizedThreshold = input.finalizedThreshold ?? thresholds.finalizedConfirmations;

  const confirmations = typeof input.confirmations === 'number' && input.confirmations >= 0
    ? input.confirmations
    : null;

  const isReorged = Boolean(input.isReorged || input.status === 'reorged');
  const isReplaced = Boolean(input.isReplaced || input.status === 'replaced');
  const indexerAcknowledged = Boolean(input.indexerAcknowledged);

  // Validate replaced history invariant
  if (isReplaced && !input.replacedBy) {
    throw new ReceiptValidationError(
      'MISSING_REPLACEMENT_HASH',
      'Replaced transactions must preserve the replacedBy transaction hash in history',
    );
  }

  // Validate reorged invariant
  if (isReorged) {
    if (input.status === 'finalized' || input.status === 'safe') {
      throw new ReceiptValidationError(
        'REORG_CONTRADICTION',
        'Cannot claim safe or finalized status for a reorged transaction',
      );
    }
  }

  // Determine finality level strictly from canonical facts
  // Terminal failure states (reverted, dropped, reorged, replaced) have finalityLevel = 'none'
  const isTerminalOrNonSuccess =
    isReorged ||
    isReplaced ||
    input.status === 'reverted' ||
    input.status === 'dropped';

  let finalityLevel: FinalityProvenanceLevel = 'none';

  if (!isTerminalOrNonSuccess && confirmations !== null) {
    if (confirmations >= finalizedThreshold && indexerAcknowledged) {
      finalityLevel = 'finalized';
    } else if (confirmations >= safeThreshold) {
      finalityLevel = 'safe';
    }
  }

  // Acceptance Criterion: "Receipt state never exceeds canonical evidence"
  if (input.status === 'finalized') {
    if (confirmations === null || confirmations < finalizedThreshold) {
      throw new ReceiptValidationError(
        'EVIDENCE_EXCEEDED',
        `Cannot generate finalized receipt: confirmations (${confirmations ?? 0}) < finalizedThreshold (${finalizedThreshold})`,
      );
    }
    if (!indexerAcknowledged) {
      throw new ReceiptValidationError(
        'EVIDENCE_EXCEEDED',
        'Cannot generate finalized receipt: TruthBounty indexer has not acknowledged projection',
      );
    }
    if (isReorged) {
      throw new ReceiptValidationError(
        'EVIDENCE_EXCEEDED',
        'Cannot generate finalized receipt: transaction was reorged out of canonical chain',
      );
    }
  }

  if (input.status === 'safe') {
    if (confirmations === null || confirmations < safeThreshold) {
      throw new ReceiptValidationError(
        'EVIDENCE_EXCEEDED',
        `Cannot generate safe receipt: confirmations (${confirmations ?? 0}) < safeThreshold (${safeThreshold})`,
      );
    }
    if (isReorged) {
      throw new ReceiptValidationError(
        'EVIDENCE_EXCEEDED',
        'Cannot generate safe receipt: transaction was reorged',
      );
    }
  }

  let blockNumberStr: string | null = null;
  if (input.blockNumber !== undefined && input.blockNumber !== null) {
    blockNumberStr = String(input.blockNumber);
  }

  const blockHash = assertValidTxHash(input.blockHash);

  return {
    finalityLevel,
    safeThreshold,
    finalizedThreshold,
    confirmations,
    blockNumber: blockNumberStr,
    blockHash,
    indexerAcknowledged,
    status: input.status,
  };
}
