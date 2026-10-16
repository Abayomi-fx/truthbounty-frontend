/**
 * UI-FE-080: Canonical Receipt Generator
 *
 * Assembles privacy-safe, deterministic receipts across the 7 canonical actions.
 * Integrates fail-closed validation, secret redaction, and SHA-256 digital fingerprinting.
 */

import type { TransactionState as TxMachineState } from '@/lib/transaction-machine/transaction-machine.types';
import type { TransactionLifecycleState } from '@/hooks/useTransactionLifecycleMonitor';
import type { AdminAuditRecord } from '@/app/types/admin';
import type {
  CanonicalReceiptRecord,
  RawReceiptInput,
  ReceiptActionType,
  ReceiptChainProvenance,
  ReceiptConsensusProvenance,
  ReceiptHistoryProvenance,
  ReceiptLifecycleStatus,
} from './types';
import { RECEIPT_SCHEMA_VERSION } from './types';
import {
  sanitizeNotes,
  sanitizeParameters,
  generateReceiptFilename,
} from './sanitization';
import {
  assertValidTxHash,
  validateCanonicalEvidence,
} from './validator';
import {
  computeReceiptChecksum,
  serializeDeterministicReceiptJson,
} from './serializer';
import {
  formatReceiptAsPrintableHtml,
  formatReceiptAsText,
} from './formatters';

/** Canonical default parameters for known chains */
const CHAIN_METADATA: Record<
  number,
  {
    chainName: string;
    protocolVersion: string;
    releaseId: string;
    gitCommit: string;
    contractAddress: `0x${string}`;
    contractName: string;
    apiVersion: string;
  }
> = {
  10: {
    chainName: 'Optimism Mainnet',
    protocolVersion: '2.0.0',
    releaseId: 'v2.0.0-mainnet',
    gitCommit: '5333c0acb9ccfb8a6a37ae76b3397d06781f0119',
    contractAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    contractName: 'TruthBountyWeighted',
    apiVersion: 'v2',
  },
  11155420: {
    chainName: 'Optimism Sepolia Testnet',
    protocolVersion: '2.0.0',
    releaseId: 'v2.0.0-sepolia',
    gitCommit: '5333c0acb9ccfb8a6a37ae76b3397d06781f0119',
    contractAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    contractName: 'TruthBountyWeighted',
    apiVersion: 'v2',
  },
  31337: {
    chainName: 'Hardhat Local Development',
    protocolVersion: '2.0.0',
    releaseId: 'v2.0.0-local',
    gitCommit: '5333c0acb9ccfb8a6a37ae76b3397d06781f0119',
    contractAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    contractName: 'TruthBountyWeighted',
    apiVersion: 'v2',
  },
};

/**
 * Format a timestamp to canonical ISO-8601 UTC string.
 */
function toCanonicalIso(ts?: string | Date | number | null): string {
  if (!ts) return new Date().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  if (typeof ts === 'number') return new Date(ts).toISOString();
  const parsed = new Date(ts);
  if (isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

/**
 * Generate a deterministic receipt ID.
 */
function createDeterministicReceiptId(
  action: ReceiptActionType,
  txHash: string | null,
  referenceId: string,
  timestampIso: string,
): string {
  const hashPart = txHash ? txHash.slice(2, 10) : referenceId.slice(0, 8);
  // Extract date components YYYYMMDD
  const dateStr = timestampIso.replace(/[-:T.]/g, '').slice(0, 14);
  return `rcpt_${action}_${hashPart}_${dateStr}`;
}

/**
 * Core receipt generation function.
 * Validates canonical evidence, redacts sensitive data, and computes SHA-256 fingerprint.
 */
export function generateReceipt(input: RawReceiptInput): CanonicalReceiptRecord {
  // 1. Validate canonical evidence (fails closed if claimed state exceeds truth)
  const validatedConsensus = validateCanonicalEvidence(input);

  const chainMeta = CHAIN_METADATA[input.chainId] ?? CHAIN_METADATA[11155420];

  const chainProvenance: ReceiptChainProvenance = {
    chainId: input.chainId,
    chainName: chainMeta.chainName,
    protocolVersion: input.protocolVersion ?? chainMeta.protocolVersion,
    releaseId: input.releaseId ?? chainMeta.releaseId,
    gitCommit: input.gitCommit ?? chainMeta.gitCommit,
    contractAddress: (input.contractAddress as `0x${string}`) ?? chainMeta.contractAddress,
    contractName: input.contractName ?? chainMeta.contractName,
    apiVersion: input.apiVersion ?? chainMeta.apiVersion,
    indexerReference: input.indexerReference ?? (validatedConsensus.indexerAcknowledged ? 'ACK_VERIFIED' : null),
  };

  const consensusProvenance: ReceiptConsensusProvenance = {
    txHash: assertValidTxHash(input.txHash),
    blockNumber: validatedConsensus.blockNumber,
    blockHash: validatedConsensus.blockHash,
    confirmations: validatedConsensus.confirmations,
    safeThreshold: validatedConsensus.safeThreshold,
    finalizedThreshold: validatedConsensus.finalizedThreshold,
    finalityLevel: validatedConsensus.finalityLevel,
    indexerAcknowledged: validatedConsensus.indexerAcknowledged,
  };

  const historyProvenance: ReceiptHistoryProvenance = {
    isReplaced: Boolean(input.isReplaced || input.status === 'replaced'),
    replacedBy: assertValidTxHash(input.replacedBy),
    originalTxHash: assertValidTxHash(input.originalTxHash),
    isReorged: Boolean(input.isReorged || input.status === 'reorged'),
    orphanedBlockHash: assertValidTxHash(input.orphanedBlockHash),
    reorgDetectedAt: input.reorgDetectedAt ? toCanonicalIso(input.reorgDetectedAt) : null,
  };

  const refId = input.referenceId?.trim() || consensusProvenance.txHash || 'ref-unassigned';
  const timestampIso = toCanonicalIso(input.timestamp);

  const actionDetails = {
    actionType: input.action,
    referenceId: refId,
    targetResource: input.targetResource?.trim() || undefined,
    parameters: sanitizeParameters(input.parameters),
    notes: sanitizeNotes(input.notes),
  };

  const receiptId = createDeterministicReceiptId(
    input.action,
    consensusProvenance.txHash,
    refId,
    timestampIso,
  );

  const unsignedRecord: Omit<CanonicalReceiptRecord, 'checksum'> = {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    receiptId,
    action: input.action,
    status: validatedConsensus.status,
    timestamp: timestampIso,
    provenance: {
      chain: chainProvenance,
      consensus: consensusProvenance,
      history: historyProvenance,
    },
    actionDetails,
  };

  // Compute digital checksum over sorted JSON representation
  const checksum = computeReceiptChecksum(unsignedRecord);

  return {
    ...unsignedRecord,
    checksum,
  };
}

/**
 * Adapter: Create a receipt from a transaction state machine state
 */
export function createReceiptFromTxState(
  action: ReceiptActionType,
  state: TxMachineState,
  options?: {
    referenceId?: string;
    parameters?: Record<string, unknown>;
    indexerAcknowledged?: boolean;
    notes?: string;
  },
): CanonicalReceiptRecord {
  const chainId = state.chainId ?? 11155420;
  const isReplaced = state.status === 'replaced';
  const isReorged = state.status === 'reorged';

  return generateReceipt({
    action,
    status: state.status,
    chainId,
    txHash: state.txHash,
    blockNumber: 'blockNumber' in state && state.blockNumber !== null ? state.blockNumber : null,
    confirmations: 'confirmations' in state && state.confirmations !== null ? state.confirmations : null,
    isReplaced,
    replacedBy: isReplaced && 'replacedBy' in state ? (state.replacedBy as string) : null,
    isReorged,
    indexerAcknowledged: options?.indexerAcknowledged ?? (state.status === 'finalized'),
    referenceId: options?.referenceId,
    parameters: options?.parameters,
    notes: options?.notes,
  });
}

/**
 * Adapter: Create a receipt from a TransactionLifecycleState
 */
export function createReceiptFromLifecycleState(
  action: ReceiptActionType,
  txState: TransactionLifecycleState,
  options?: {
    chainId?: number;
    referenceId?: string;
    parameters?: Record<string, unknown>;
  },
): CanonicalReceiptRecord {
  const chainId = options?.chainId ?? 11155420;

  let status: ReceiptLifecycleStatus = 'pending';
  if (txState.status === 'confirmed') status = 'safe';
  else if (txState.status === 'replaced') status = 'replaced';
  else if (txState.status === 'dropped') status = 'dropped';
  else if (txState.status === 'failed') status = 'reverted';

  return generateReceipt({
    action,
    status,
    chainId,
    txHash: txState.hash,
    isReplaced: txState.status === 'replaced',
    replacedBy: txState.replacementHash,
    referenceId: options?.referenceId,
    parameters: options?.parameters,
    notes: txState.message,
  });
}

/**
 * Adapter: Create a receipt from an AdminAuditRecord
 */
export function createReceiptFromAuditRecord(
  audit: AdminAuditRecord,
  chainId = 11155420,
): CanonicalReceiptRecord {
  let action: ReceiptActionType = 'governance';
  const lowerAction = audit.action.toLowerCase();
  if (lowerAction.includes('pause')) {
    action = 'pause';
  } else if (lowerAction.includes('dispute')) {
    action = 'dispute';
  } else if (lowerAction.includes('claim')) {
    action = 'claim';
  }

  let status: ReceiptLifecycleStatus = 'safe';
  if (audit.status === 'CONFIRMED' || audit.status === 'SUCCESS') {
    status = 'finalized';
  } else if (audit.status === 'FAILED') {
    status = 'reverted';
  }

  return generateReceipt({
    action,
    status,
    chainId,
    txHash: audit.consequenceHash?.startsWith('0x') ? audit.consequenceHash : null,
    confirmations: 12,
    indexerAcknowledged: true,
    referenceId: audit.auditId,
    targetResource: audit.targetResource,
    parameters: {
      operator: audit.operator,
      authority: audit.authority,
      action: audit.action,
      consequenceHash: audit.consequenceHash,
      details: audit.details ?? null,
    },
    timestamp: audit.timestamp,
  });
}

export {
  formatReceiptAsText,
  formatReceiptAsPrintableHtml,
  generateReceiptFilename,
  serializeDeterministicReceiptJson,
};
