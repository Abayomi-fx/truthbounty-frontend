export type ClaimStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'DISPUTED';

export type EvidenceType = 'link' | 'text' | 'image' | 'video' | 'document';

export interface Evidence {
  id: string;
  type: EvidenceType;
  value: string; 
  createdAt: string;
}

export interface Claim {
  id: string;
  title: string;
  description: string;
  category?: string;
  claimantAddress: string;
  proposer?: string;
  status: ClaimStatus;
  bountyAmount: number;
  totalStaked: number;
  evidence: Evidence[];
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export type ContentDigest = `0x${string}`;

export interface BountyAsset {
  token: `0x${string}`;
  amount: bigint;
}

export interface ClaimCreationConfig {
  artifactVersion: string;
  frozen?: boolean;
}

export interface ClaimCreationInput {
  contentDigest: ContentDigest;
  bountyAsset: BountyAsset;
  config: ClaimCreationConfig;
}

export type ClaimCreationErrorCode =
  | 'UNSUPPORTED_CHAIN'
  | 'INVALID_ADDRESS'
  | 'INVALID_ARTIFACT_VERSION'
  | 'INVALID_WALLET_ACCOUNT'
  | 'INVALID_AMOUNT'
  | 'INVALID_CONTENT'
  | 'ALLOWANCE_NOT_APPROVED'
  | 'SIMULATION_REVERTED'
  | 'USER_REJECTED'
  | 'STALE_RECONMILITATION'
  | 'UNKNOWN'

export interface ClaimCreationProtocolError {
  code: ClaimCreationErrorCode;
  message: string;
  cause?: unknown;
}

export type ClaimCreationStep =
  | 'idle'
  | 'allowance'
  | 'simulation'
  | 'submission'
  | 'confirmation'
  | 'reconciliation'
  | 'success'
  | 'error';

export interface ClaimCreationState {
  step: ClaimCreationStep;
  txHash?: `0x${string}`;
  claimId?: string;
  error?: ClaimCreationProtocolError;
}
