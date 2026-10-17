/**
 * UI-FE-080: Reusable Production Boundary for Transaction & Decision Receipts
 *
 * Core type definitions for privacy-safe, deterministic receipts across
 * the 7 canonical TruthBounty actions:
 *  - claim
 *  - verification
 *  - dispute
 *  - governance
 *  - pause
 *  - retry
 *  - support-reference
 *
 * Security invariants:
 *  - Contracts and reviewed API projections remain authoritative.
 *  - Receipt state never exceeds canonical evidence (fail-closed).
 *  - Replaced/reorged history remains permanently visible in provenance.
 *  - Secrets, credentials, and protected rationale are strictly excluded.
 *  - Deterministic serialization guarantees identical output for identical records.
 */

export const RECEIPT_SCHEMA_VERSION = '1.0.0' as const;

export type ReceiptActionType =
  | 'claim'
  | 'verification'
  | 'dispute'
  | 'governance'
  | 'pause'
  | 'retry'
  | 'support-reference';

export type ReceiptLifecycleStatus =
  | 'pending'
  | 'submitted'
  | 'confirming'
  | 'safe'
  | 'indexing'
  | 'finalized'
  | 'replaced'
  | 'reverted'
  | 'reorged'
  | 'dropped';

export type FinalityProvenanceLevel = 'none' | 'safe' | 'finalized';

/**
 * Protocol Release & Chain Provenance
 */
export interface ReceiptChainProvenance {
  readonly chainId: number;
  readonly chainName: string;
  readonly protocolVersion: string;
  readonly releaseId: string;
  readonly gitCommit: string;
  readonly contractAddress: `0x${string}`;
  readonly contractName: string;
  readonly apiVersion: string;
  readonly indexerReference: string | null;
}

/**
 * Block & Consensus Provenance (Canonical on-chain evidence)
 */
export interface ReceiptConsensusProvenance {
  readonly txHash: `0x${string}` | null;
  readonly blockNumber: string | null; // stringified bigint for deterministic JSON
  readonly blockHash: `0x${string}` | null;
  readonly confirmations: number | null;
  readonly safeThreshold: number;
  readonly finalizedThreshold: number;
  readonly finalityLevel: FinalityProvenanceLevel;
  readonly indexerAcknowledged: boolean;
}

/**
 * Lineage & Reorg Provenance
 * Ensures replaced/reorged history remains permanently visible
 */
export interface ReceiptHistoryProvenance {
  readonly isReplaced: boolean;
  readonly replacedBy: `0x${string}` | null;
  readonly originalTxHash: `0x${string}` | null;
  readonly isReorged: boolean;
  readonly orphanedBlockHash: `0x${string}` | null;
  readonly reorgDetectedAt: string | null;
  readonly previousStates?: readonly ReceiptLifecycleStatus[];
}

/**
 * Privacy-safe Action Payload.
 * All sensitive credentials, authorization tokens, and protected rationale
 * are stripped or replaced with `[REDACTED]`.
 */
export interface ReceiptActionDetails {
  readonly actionType: ReceiptActionType;
  readonly referenceId: string; // e.g. claimId, disputeId, governanceProposalId, or supportTicketId
  readonly targetResource?: string;
  readonly parameters: Readonly<Record<string, string | number | boolean | null>>;
  readonly notes?: string; // Privacy-safe public summary, NEVER protected rationale
}

/**
 * Canonical, Immutable Receipt Record
 */
export interface CanonicalReceiptRecord {
  readonly schemaVersion: typeof RECEIPT_SCHEMA_VERSION;
  readonly receiptId: string;
  readonly action: ReceiptActionType;
  readonly status: ReceiptLifecycleStatus;
  readonly timestamp: string; // ISO 8601 UTC
  readonly provenance: {
    readonly chain: ReceiptChainProvenance;
    readonly consensus: ReceiptConsensusProvenance;
    readonly history: ReceiptHistoryProvenance;
  };
  readonly actionDetails: ReceiptActionDetails;
  readonly checksum: string; // SHA-256 over deterministic canonical JSON (excluding checksum field)
}

/**
 * Raw input provided to receipt generator before canonical validation & redaction
 */
export interface RawReceiptInput {
  readonly action: ReceiptActionType;
  readonly status: ReceiptLifecycleStatus;
  readonly chainId: number;
  readonly txHash?: string | null;
  readonly blockNumber?: bigint | number | string | null;
  readonly blockHash?: string | null;
  readonly confirmations?: number | null;
  readonly safeThreshold?: number;
  readonly finalizedThreshold?: number;
  readonly indexerAcknowledged?: boolean;
  readonly contractAddress?: string;
  readonly contractName?: string;
  readonly protocolVersion?: string;
  readonly releaseId?: string;
  readonly gitCommit?: string;
  readonly apiVersion?: string;
  readonly indexerReference?: string | null;
  readonly isReplaced?: boolean;
  readonly replacedBy?: string | null;
  readonly originalTxHash?: string | null;
  readonly isReorged?: boolean;
  readonly orphanedBlockHash?: string | null;
  readonly reorgDetectedAt?: string | null;
  readonly referenceId?: string;
  readonly targetResource?: string;
  readonly parameters?: Record<string, unknown>;
  readonly notes?: string;
  readonly timestamp?: string | Date;
}
