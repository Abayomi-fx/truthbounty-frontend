/**
 * UI-FE-088 — typed dispute factories.
 *
 * Conforms to the pinned dispute interfaces in `src/app/types/dispute.ts`.
 * Wei amounts are exact strings, never floats, matching the protocol rules
 * documented on those types.
 */

import type {
  ChallengeBond,
  DisputeContext,
  DisputeDeadline,
  DisputeSubmissionPayload,
  DisputeSubmissionStatus,
  DisputeTransaction,
  DisputeWalletPosition,
  ProvisionalOutcome,
} from '../../../app/types/dispute';
import { createFixtureContext, type FixtureContext } from '../deterministic';

/** Submission statuses from the pinned union, fixed order. */
export const DISPUTE_SUBMISSION_STATUSES: readonly DisputeSubmissionStatus[] = [
  'PENDING',
  'CONFIRMED',
  'FAILED',
  'REVERTED',
  'REPLACED',
] as const;

/** Exact-integer wei helper — no decimals, no scientific notation. */
function wei(ctx: FixtureContext, key: string, min: number, max: number): string {
  return (BigInt(ctx.int(key, min, max)) * 10n ** 18n).toString();
}

export interface MakeDisputeOptions {
  claimId?: string;
  ctx?: FixtureContext;
}

/** Provisional first-round outcome being challenged. */
export function makeProvisionalOutcome(
  options: MakeDisputeOptions = {},
): ProvisionalOutcome {
  const { claimId = 'claim-0001', ctx = createFixtureContext() } = options;
  return {
    claimId,
    decision: ctx.pick(`outcome-decision:${claimId}`, ['VERIFIED', 'REJECTED'] as const),
    votesFor: ctx.int(`votes-for:${claimId}`, 1, 12),
    votesAgainst: ctx.int(`votes-against:${claimId}`, 0, 6),
    totalStake: wei(ctx, `outcome-stake:${claimId}`, 500, 20_000),
    outcomeAt: ctx.isoAt(-172_800_000),
    outcomeBlock: ctx.int(`outcome-block:${claimId}`, 6_000_000, 6_200_000),
    isProvisional: true,
    isFinalized: false,
  };
}

/** Challenge window with block- and time-based deadlines. */
export function makeDisputeDeadline(
  options: MakeDisputeOptions & { timeRemaining?: number } = {},
): DisputeDeadline {
  const { claimId = 'claim-0001', ctx = createFixtureContext(), timeRemaining = 86_400 } = options;
  const windowEndBlock = ctx.int(`window-end-block:${claimId}`, 6_200_001, 6_300_000);
  const currentBlock = windowEndBlock - ctx.int(`blocks-remaining:${claimId}`, 10, 900);

  return {
    claimId,
    windowStartTime: ctx.isoAt(-86_400_000),
    windowEndTime: ctx.isoAt(timeRemaining * 1000),
    timeRemaining,
    windowEndBlock,
    currentBlock,
    blocksRemaining: windowEndBlock - currentBlock,
    isWindowOpen: timeRemaining > 0,
    isWindowClosed: timeRemaining === 0,
    hasActiveDispute: false,
  };
}

/** Bond economics for opening a challenge. */
export function makeChallengeBond(options: MakeDisputeOptions = {}): ChallengeBond {
  const { claimId = 'claim-0001', ctx = createFixtureContext() } = options;
  const bondAmount = wei(ctx, `bond:${claimId}`, 100, 2_000);

  return {
    claimId,
    bondAmount,
    slashAmount: (BigInt(bondAmount) / 2n).toString(),
    slashPercentage: 50,
    potentialReward: (BigInt(bondAmount) * 3n / 2n).toString(),
    rewardMultiplier: 1.5,
  };
}

/** Wallet eligibility snapshot for the challenge action. */
export function makeDisputeWalletPosition(
  options: MakeDisputeOptions & { userAddress?: string } = {},
): DisputeWalletPosition {
  const { claimId = 'claim-0001', ctx = createFixtureContext() } = options;
  const bondAmount = wei(ctx, `wallet-bond:${claimId}`, 100, 2_000);
  const currentBalance = wei(ctx, `balance:${claimId}`, 2_000, 40_000);

  return {
    claimId,
    userAddress: options.userAddress ?? ctx.address(`disputant:${claimId}`),
    canChallenge: true,
    hasParticipatedInFirstRound: false,
    hasOpenedDispute: false,
    currentBalance,
    hasSufficientBalance: BigInt(currentBalance) > BigInt(bondAmount),
    balanceAfterBond: (BigInt(currentBalance) - BigInt(bondAmount)).toString(),
  };
}

/** Complete dispute read model consumed by the dispute-opening UI. */
export function makeDisputeContext(options: MakeDisputeOptions = {}): DisputeContext {
  const { claimId = 'claim-0001', ctx = createFixtureContext() } = options;
  const provisionalOutcome = makeProvisionalOutcome({ claimId, ctx });
  const deadline = makeDisputeDeadline({ claimId, ctx });
  const bond = makeChallengeBond({ claimId, ctx });
  const walletPosition = makeDisputeWalletPosition({ claimId, ctx });

  return {
    provisionalOutcome,
    deadline,
    bond,
    walletPosition,
    isEligible:
      walletPosition.hasSufficientBalance && deadline.isWindowOpen && !walletPosition.hasOpenedDispute,
    ineligibilityReason: undefined,
  };
}

export interface MakeDisputeTransactionOptions {
  claimId?: string;
  status?: DisputeSubmissionStatus;
  overrides?: Partial<DisputeTransaction>;
  ctx?: FixtureContext;
}

/** Dispute-opening transaction record, including the REPLACED status. */
export function makeDisputeTransaction(
  options: MakeDisputeTransactionOptions = {},
): DisputeTransaction {
  const { claimId = 'claim-0001', overrides = {}, ctx = createFixtureContext() } = options;
  const status = options.status ?? 'CONFIRMED';

  const transaction: DisputeTransaction = {
    transactionHash: ctx.hex(`dispute-tx:${claimId}`, 32),
    from: ctx.address(`disputant:${claimId}`),
    to: ctx.address('dispute-contract'),
    status,
    claimId,
    disputeId: status === 'CONFIRMED' ? ctx.id('dispute', 0) : undefined,
    reason: 'Opening challenge against the provisional outcome.',
    bondAmount: wei(ctx, `dispute-bond:${claimId}`, 100, 2_000),
  };

  return { ...transaction, ...overrides };
}

/** POST payload for the dispute-opening mutation (not mocked beyond this). */
export function makeDisputeSubmissionPayload(
  options: MakeDisputeOptions = {},
): DisputeSubmissionPayload {
  const { claimId = 'claim-0001', ctx = createFixtureContext() } = options;
  return {
    claimId,
    reason: 'Fixture challenge reason generated by the UI-FE-088 factory library.',
    bondAmount: wei(ctx, `payload-bond:${claimId}`, 100, 2_000),
    userAddress: ctx.address(`disputant:${claimId}`),
    evidence: [`https://evidence.example.test/${claimId}/challenge-1`],
  };
}
