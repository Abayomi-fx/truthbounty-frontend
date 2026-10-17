/**
 * UI-FE-088 — typed verification factories.
 *
 * Two pinned shapes live side by side on purpose:
 *
 *  - `OnChainVerification` — contract-derived record (bigints, enum verdict).
 *  - `VerificationProjection` — API projection (ISO strings, decimal amounts).
 *
 * The split keeps contract-derived values visibly distinct from API
 * projections, as required by the issue constraints.
 */

import type {
  OnChainVerification,
  Verification,
  VerificationDecision,
  VerificationPosition,
  VerificationProjection,
  VerificationStatus,
} from '../../../app/types/verification';
import { VERIFICATION_VERDICT } from '../../../app/types/verification';
import { createFixtureContext, type FixtureContext } from '../deterministic';

const DECISIONS: readonly VerificationDecision[] = ['VERIFY', 'REJECT'] as const;
const STATUSES: readonly VerificationStatus[] = ['PENDING', 'CONFIRMED', 'FAILED'] as const;
const POSITIONS: readonly VerificationPosition[] = ['TRUE', 'FALSE'] as const;

export interface MakeVerificationOptions {
  index?: number;
  /** Claim this verification belongs to. */
  claimId?: string;
  overrides?: Partial<Verification>;
  ctx?: FixtureContext;
}

/** API projection entity (`Verification`), deterministic per (claimId, index). */
export function makeVerification(options: MakeVerificationOptions = {}): Verification {
  const { index = 0, claimId = 'claim-0001', overrides = {}, ctx = createFixtureContext() } = options;
  const status = ctx.pick(`verification-status:${claimId}:${index}`, STATUSES);

  const verification: Verification = {
    id: ctx.id('verification', index),
    claimId,
    verifierAddress: ctx.address(`verifier:${claimId}:${index}`),
    decision: ctx.pick(`verification-decision:${claimId}:${index}`, DECISIONS),
    stakeAmount: ctx.int(`verification-stake:${claimId}:${index}`, 10, 5_000),
    status,
    transactionHash: ctx.hex(`verification-tx:${claimId}:${index}`, 32),
    createdAt: ctx.isoAt(-7_200_000 * (index + 1)),
    ...(status === 'CONFIRMED' ? { confirmedAt: ctx.isoAt(-3_600_000 * (index + 1)) } : {}),
  };

  return { ...verification, ...overrides };
}

export interface MakeVerificationProjectionOptions {
  index?: number;
  claimId?: string;
  overrides?: Partial<VerificationProjection>;
  ctx?: FixtureContext;
}

/**
 * API projection returned by the verifications endpoint (V2-BE-026).
 * Carries the extra projection-only fields (`chainId`, `artifactVersion`)
 * that the domain entity does not expose.
 */
export function makeVerificationProjection(
  options: MakeVerificationProjectionOptions = {},
): VerificationProjection {
  const { index = 0, claimId = 'claim-0001', overrides = {}, ctx = createFixtureContext() } = options;
  const base = makeVerification({ index, claimId, ctx });

  const projection: VerificationProjection = {
    ...base,
    chainId: 11155420,
    artifactVersion: '2.0.0',
  };

  return { ...projection, ...overrides };
}

export interface MakeOnChainVerificationOptions {
  index?: number;
  claimId?: bigint;
  overrides?: Partial<OnChainVerification>;
  ctx?: FixtureContext;
}

/**
 * Raw contract record (`IVerificationSubmission.Verification`).
 * `verdict` is the enum-encoded uint8 from the pinned artifact:
 * TRUE = 0, FALSE = 1 — never a UI-side invention.
 */
export function makeOnChainVerification(
  options: MakeOnChainVerificationOptions = {},
): OnChainVerification {
  const { index = 0, claimId = BigInt(index + 1), overrides = {}, ctx = createFixtureContext() } = options;
  const position = ctx.pick(`onchain-position:${claimId}:${index}`, POSITIONS);

  const record: OnChainVerification = {
    id: BigInt(index + 1),
    claimId,
    verifier: ctx.address(`onchain-verifier:${claimId}:${index}`),
    verdict: VERIFICATION_VERDICT[position],
    stake: BigInt(ctx.int(`onchain-stake:${claimId}:${index}`, 10, 5_000)) * 10n ** 18n,
    submittedAt: BigInt(Math.floor((ctx.nowMs - 3_600_000 * (index + 1)) / 1000)),
  };

  return { ...record, ...overrides };
}
