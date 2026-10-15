import { getAddressValidationError, isValidContractAddress } from './address-guard';
import {
  getContractAddress,
  getProtocolRelease,
  getReleaseChainId,
} from './registry';
import type { LoadedReleaseArtifacts, ReleaseManifest } from './types';
import {
  OPTIMISM_CHAIN_IDS,
  isValidChain,
} from '@/lib/transaction-machine/transaction-machine.types';

export type WriteGateErrorCode =
  | 'MISSING_MANIFEST'
  | 'WRONG_CHAIN'
  | 'WRONG_ADDRESS'
  | 'STALE_ARTIFACT'
  | 'PLACEHOLDER_ADDRESS'
  | 'CHAIN_UNSUPPORTED';

export type WriteGateFailureCode =
  | WriteGateErrorCode
  | 'WALLET_DISCONNECTED'
  | 'ALLOWANCE_UNKNOWN'
  | 'ALLOWANCE_INSUFFICIENT'
  | 'SIMULATION_REQUIRED'
  | 'SIMULATION_FAILED'
  | 'RECEIPT_PENDING'
  | 'RECEIPT_REVERTED'
  | 'READINESS_UNCERTAIN';

export interface WriteGateFailure {
  readonly code: WriteGateFailureCode;
  readonly message: string;
  readonly blocking: true;
}

export interface WriteGateInput {
  readonly account?: string | null;
  readonly chainId?: number | null;
  readonly expectedChainId?: number;
  readonly targetAddress?: string | null;
  readonly allowance?: {
    readonly required: bigint;
    readonly approved: bigint | null;
  } | null;
  readonly simulation?: {
    readonly status: 'not-required' | 'pending' | 'passed' | 'failed';
    readonly error?: string;
  } | null;
  readonly receipt?: {
    readonly status: 'pending' | 'success' | 'reverted';
  } | null;
  readonly allowLocalDev?: boolean;
  readonly requireCanonicalMatch?: boolean;
}

export interface WriteGateResult {
  readonly ready: boolean;
  readonly failures: readonly WriteGateFailure[];
  readonly reason: string | null;
}

export interface WriteTargetProvenance {
  readonly protocolVersion: string;
  readonly releaseId: string;
  readonly chainId: number;
  readonly gitCommit: string;
  readonly abiVersion: string;
  readonly artifactPath: string;
}

export type WriteTargetEvaluation =
  | {
      readonly ok: true;
      readonly address: `0x${string}`;
      readonly chainId: number;
      readonly protocolVersion: string;
      readonly provenance: WriteTargetProvenance;
      readonly errors: readonly [];
    }
  | {
      readonly ok: false;
      readonly address: null;
      readonly chainId: number | null;
      readonly protocolVersion: string | null;
      readonly provenance: WriteTargetProvenance | null;
      readonly errors: readonly string[];
      readonly code: WriteGateErrorCode;
    };

export interface EvaluateWriteTargetInput {
  readonly activeChainId: number;
  readonly contractAddress?: string | null;
  readonly expectedProtocolVersion?: string | null;
  readonly requireReleaseAddressMatch?: boolean;
  readonly release?: LoadedReleaseArtifacts;
}

export interface AssertWriteReadyResult {
  readonly address: `0x${string}`;
  readonly chainId: number;
  readonly protocolVersion: string;
  readonly provenance: WriteTargetProvenance;
}

export class WriteGateError extends Error {
  readonly code: WriteGateErrorCode | WriteGateFailureCode;
  readonly errors: string[];
  readonly failures: readonly WriteGateFailure[];

  constructor(failures: readonly WriteGateFailure[]);
  constructor(code: WriteGateErrorCode, errors: string[]);
  constructor(
    value: WriteGateErrorCode | readonly WriteGateFailure[],
    errors: string[] = [],
  ) {
    if (typeof value === 'string') {
      super(`[WriteGate] ${value}: ${errors.join('; ')}`);
      this.code = value;
      this.errors = [...errors];
      this.failures = errors.map((message) => ({
        code: value,
        message,
        blocking: true as const,
      }));
    } else {
      const failures = value;
      const primary = failures[0];
      const code = primary?.code ?? 'READINESS_UNCERTAIN';
      const messages = failures.map((failure) => failure.message);
      super(
        primary
          ? `[WriteGate] ${primary.code}: ${primary.message}`
          : '[WriteGate] READINESS_UNCERTAIN: write readiness could not be established',
      );
      this.code = code;
      this.errors = messages;
      this.failures = failures;
    }
    this.name = 'WriteGateError';
  }
}

function failure(code: WriteGateFailureCode, message: string): WriteGateFailure {
  return { code, message, blocking: true };
}

function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function loadReleaseOrError(
  release?: LoadedReleaseArtifacts,
): { release: LoadedReleaseArtifacts | null; errors: string[] } {
  if (release) return { release, errors: [] };
  try {
    return { release: getProtocolRelease(), errors: [] };
  } catch (error) {
    return {
      release: null,
      errors: [
        `Release manifest unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }
}

function classifyArtifactFailure(errors: readonly string[]): WriteGateErrorCode {
  const joined = errors.join(' | ');
  if (/manifest unavailable|missing release|missing required chain metadata/i.test(joined)) {
    return 'MISSING_MANIFEST';
  }
  if (/placeholder|zero address|invalid evm address|legacy stellar/i.test(joined)) {
    return 'PLACEHOLDER_ADDRESS';
  }
  if (/stale/i.test(joined)) return 'STALE_ARTIFACT';
  if (/wrong address|does not match|release address rejected/i.test(joined)) {
    return 'WRONG_ADDRESS';
  }
  if (/wrong chain|active chain|chain id|unsupported chain/i.test(joined)) {
    return 'WRONG_CHAIN';
  }
  return 'CHAIN_UNSUPPORTED';
}

function evaluateArtifactTarget(input: EvaluateWriteTargetInput): WriteTargetEvaluation {
  const { release, errors: loadErrors } = loadReleaseOrError(input.release);
  if (loadErrors.length > 0 || release === null) {
    return {
      ok: false,
      address: null,
      chainId: null,
      protocolVersion: null,
      provenance: null,
      errors: loadErrors,
      code: 'MISSING_MANIFEST',
    };
  }

  const manifest: ReleaseManifest = release.manifest;
  if (!manifest || typeof manifest.chainId !== 'number' || !Number.isFinite(manifest.chainId)) {
    return {
      ok: false,
      address: null,
      chainId: null,
      protocolVersion: null,
      provenance: null,
      errors: ['Release manifest is missing required chain metadata'],
      code: 'MISSING_MANIFEST',
    };
  }

  const provenance: WriteTargetProvenance = {
    protocolVersion: manifest.protocolVersion,
    releaseId: manifest.releaseId,
    chainId: manifest.chainId,
    gitCommit: manifest.gitCommit,
    abiVersion: manifest.abiVersion,
    artifactPath: 'release',
  };
  const errors: string[] = [];

  if (!Number.isFinite(input.activeChainId) || input.activeChainId !== manifest.chainId) {
    errors.push(
      `Wrong chain: active chain ${input.activeChainId} is not the reviewed release chain ${manifest.chainId}`,
    );
  }

  const releaseAddress =
    release.addresses?.TruthBountyWeighted ??
    manifest.contracts?.TruthBountyWeighted?.proxy;
  if (!releaseAddress) {
    errors.push('Release manifest does not pin a TruthBountyWeighted address');
  } else {
    const addressError = getAddressValidationError(releaseAddress);
    if (addressError) errors.push(`Release address rejected: ${addressError}`);
  }

  if (input.contractAddress !== undefined && input.contractAddress !== null) {
    const override = input.contractAddress.trim();
    const overrideError = getAddressValidationError(override);
    if (overrideError) {
      errors.push(`Write target address rejected: ${overrideError}`);
    } else if (
      input.requireReleaseAddressMatch !== false &&
      releaseAddress &&
      !sameAddress(override, releaseAddress)
    ) {
      errors.push(
        `Wrong address: ${override} does not match release manifest address ${releaseAddress}`,
      );
    }
  }

  if (
    input.expectedProtocolVersion !== undefined &&
    input.expectedProtocolVersion !== null &&
    input.expectedProtocolVersion !== '' &&
    input.expectedProtocolVersion !== manifest.protocolVersion
  ) {
    errors.push(
      `Stale artifact: expected protocol version ${input.expectedProtocolVersion}, release has ${manifest.protocolVersion}`,
    );
  }

  if (errors.length > 0) {
    return {
      ok: false,
      address: null,
      chainId: manifest.chainId,
      protocolVersion: manifest.protocolVersion,
      provenance,
      errors,
      code: classifyArtifactFailure(errors),
    };
  }

  return {
    ok: true,
    address: releaseAddress as `0x${string}`,
    chainId: manifest.chainId,
    protocolVersion: manifest.protocolVersion,
    provenance,
    errors: [],
  };
}

export function resolveCanonicalTargetAddress(): string | null {
  try {
    return getContractAddress('TruthBountyWeighted');
  } catch {
    return null;
  }
}

export function resolveExpectedChainId(): number | null {
  try {
    const chainId = getReleaseChainId();
    return typeof chainId === 'number' && Number.isFinite(chainId) ? chainId : null;
  } catch {
    return null;
  }
}

function evaluateWalletTarget(input: WriteGateInput): WriteGateResult {
  const failures: WriteGateFailure[] = [];
  const expectedChainId =
    input.expectedChainId ?? resolveExpectedChainId() ?? OPTIMISM_CHAIN_IDS[0];

  if (!input.account) {
    failures.push(failure('WALLET_DISCONNECTED', 'Connect a wallet to continue.'));
  } else {
    const accountError = getAddressValidationError(input.account);
    if (accountError) {
      failures.push(
        failure(
          /placeholder|zero address|legacy stellar|invalid evm/i.test(accountError)
            ? 'PLACEHOLDER_ADDRESS'
            : 'WRONG_ADDRESS',
          `Connected account is not a canonical EVM address: ${accountError}`,
        ),
      );
    }
  }

  if (input.chainId === undefined || input.chainId === null) {
    failures.push(
      failure('CHAIN_UNSUPPORTED', 'Wallet network is unknown. Reconnect and try again.'),
    );
  } else if (!isValidChain(input.chainId, input.allowLocalDev === true)) {
    failures.push(
      failure(
        'CHAIN_UNSUPPORTED',
        `Unsupported network (chain ${input.chainId}). Use Optimism Mainnet or OP Sepolia.`,
      ),
    );
  } else if (
    input.chainId !== expectedChainId &&
    !(input.allowLocalDev === true && input.chainId === 31337)
  ) {
    failures.push(
      failure(
        'WRONG_CHAIN',
        `Wrong network: connected to chain ${input.chainId}, expected ${expectedChainId}.`,
      ),
    );
  }

  if (input.targetAddress === undefined || input.targetAddress === null || input.targetAddress === '') {
    failures.push(failure('MISSING_MANIFEST', 'Contract address is missing from release artifacts.'));
  } else {
    const addressError = getAddressValidationError(input.targetAddress);
    if (addressError) {
      failures.push(
        failure(
          /placeholder|zero address|legacy stellar/i.test(addressError)
            ? 'PLACEHOLDER_ADDRESS'
            : 'WRONG_ADDRESS',
          `Invalid contract address: ${addressError}`,
        ),
      );
    } else if (input.requireCanonicalMatch === true) {
      const canonical = resolveCanonicalTargetAddress();
      if (!canonical) {
        failures.push(failure('MISSING_MANIFEST', 'Canonical contract address is unavailable.'));
      } else if (!sameAddress(canonical, input.targetAddress)) {
        failures.push(
          failure('WRONG_ADDRESS', 'Target address does not match the canonical release artifact.'),
        );
      }
    }
  }

  if (input.allowance) {
    if (input.allowance.approved === null || input.allowance.approved === undefined) {
      failures.push(failure('ALLOWANCE_UNKNOWN', 'Token allowance could not be verified.'));
    } else if (input.allowance.approved < input.allowance.required) {
      failures.push(
        failure(
          'ALLOWANCE_INSUFFICIENT',
          'Insufficient token allowance. Approve the required amount first.',
        ),
      );
    }
  }

  if (
    input.simulation &&
    input.simulation.status !== 'not-required' &&
    input.simulation.status !== 'passed'
  ) {
    failures.push(
      failure(
        input.simulation.status === 'pending' ? 'SIMULATION_REQUIRED' : 'SIMULATION_FAILED',
        input.simulation.status === 'pending'
          ? 'Transaction simulation is still running.'
          : input.simulation.error || 'Transaction simulation failed.',
      ),
    );
  }

  if (input.receipt) {
    if (input.receipt.status === 'pending') {
      failures.push(failure('RECEIPT_PENDING', 'Waiting for transaction confirmation.'));
    } else if (input.receipt.status === 'reverted') {
      failures.push(
        failure('RECEIPT_REVERTED', 'Transaction reverted on-chain. No protocol change was applied.'),
      );
    }
  }

  return {
    ready: failures.length === 0,
    failures,
    reason: failures[0]?.message ?? null,
  };
}

function isArtifactInput(
  input: EvaluateWriteTargetInput | WriteGateInput,
): input is EvaluateWriteTargetInput {
  return 'activeChainId' in input;
}

export function evaluateWriteTarget(input: EvaluateWriteTargetInput): WriteTargetEvaluation;
export function evaluateWriteTarget(input: WriteGateInput): WriteGateResult;
export function evaluateWriteTarget(
  input: EvaluateWriteTargetInput | WriteGateInput,
): WriteTargetEvaluation | WriteGateResult {
  return isArtifactInput(input)
    ? evaluateArtifactTarget(input)
    : evaluateWalletTarget(input);
}

export function evaluateWalletWriteReadiness(input: WriteGateInput): WriteGateResult {
  return evaluateWalletTarget(input);
}

export function getWriteGateChainId(): number {
  return getReleaseChainId();
}

export function assertWriteReady(input: EvaluateWriteTargetInput): AssertWriteReadyResult;
export function assertWriteReady(input: WriteGateInput): void;
export function assertWriteReady(
  input: EvaluateWriteTargetInput | WriteGateInput,
): AssertWriteReadyResult | void {
  if (isArtifactInput(input)) {
    const result = evaluateArtifactTarget(input);
    if (!result.ok) throw new WriteGateError(result.code, [...result.errors]);
    return {
      address: result.address,
      chainId: result.chainId,
      protocolVersion: result.protocolVersion,
      provenance: result.provenance,
    };
  }

  const result = evaluateWalletTarget(input);
  if (!result.ready) throw new WriteGateError(result.failures);
}

export function assertWalletWriteReady(input: WriteGateInput): void {
  const result = evaluateWalletTarget(input);
  if (!result.ready) throw new WriteGateError(result.failures);
}

export function mapGateFailureToMachineReason(
  failureValue: WriteGateFailure,
): 'WRONG_NETWORK' | 'INVALID_TRANSITION' {
  if (
    failureValue.code === 'WRONG_CHAIN' ||
    failureValue.code === 'CHAIN_UNSUPPORTED'
  ) {
    return 'WRONG_NETWORK';
  }
  return 'INVALID_TRANSITION';
}

export { isValidContractAddress };
