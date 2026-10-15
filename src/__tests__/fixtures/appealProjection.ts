/**
 * Test fixture builder for the canonical appeal projection.
 *
 * Produces payload shapes that pass `parseAppealProjection` unchanged. Tests
 * should start from this and override only the field under test, so a fixture
 * can never drift into a shape the production validator would reject.
 */

import type { AppealProjectionPayload } from '@/lib/appeals/projection';

export const FIXTURE_APPEAL_ID = `0x${'ab'.repeat(32)}`;
export const FIXTURE_CLAIM_ID = 'claim-456';
export const FIXTURE_DISPUTE_ID = `0x${'cd'.repeat(32)}`;
export const FIXTURE_WALLET = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
export const FIXTURE_SNAPSHOT_BLOCK = 12_345_678;
export const FIXTURE_CURRENT_BLOCK = 12_349_678;
export const FIXTURE_END_BLOCK = 12_388_878;

/**
 * @param overrides merged two levels deep; pass `{ position: { hasParticipated: true } }`.
 */
/** Deep override accepted by {@link buildAppealProjection}. */
export type AppealProjectionOverrides = Partial<
  Omit<AppealProjectionPayload, 'snapshot' | 'deadline' | 'stakeBounds' | 'position'>
> & {
  snapshot?: Partial<AppealProjectionPayload['snapshot']>;
  deadline?: Partial<AppealProjectionPayload['deadline']>;
  stakeBounds?: Partial<AppealProjectionPayload['stakeBounds']>;
  position?: Partial<AppealProjectionPayload['position']>;
};

export function buildAppealProjection(
  overrides: AppealProjectionOverrides = {},
): AppealProjectionPayload {
  const { position, snapshot, deadline, stakeBounds, ...rest } = overrides;

  const base: AppealProjectionPayload = {
    appealId: FIXTURE_APPEAL_ID,
    chainId: 11155420,
    snapshot: {
      appealId: FIXTURE_APPEAL_ID,
      claimId: FIXTURE_CLAIM_ID,
      disputeId: FIXTURE_DISPUTE_ID,
      initiatorAddress: `0x${'11'.repeat(20)}`,
      initiatorStake: '1000000000000000000',
      firstRoundDecision: 'VERIFIED',
      firstRoundVotesFor: 15,
      firstRoundVotesAgainst: 8,
      reason: 'First round verification was compromised',
      initiatedAt: '2026-01-01T00:00:00.000Z',
      blockNumber: FIXTURE_SNAPSHOT_BLOCK,
      ...snapshot,
    },
    deadline: {
      appealId: FIXTURE_APPEAL_ID,
      startTime: '2026-01-01T00:00:00.000Z',
      endTime: '2026-01-02T00:00:00.000Z',
      timeRemaining: 36_000,
      endBlock: FIXTURE_END_BLOCK,
      currentBlock: FIXTURE_CURRENT_BLOCK,
      blocksRemaining: 39_200,
      isActive: true,
      hasEnded: false,
      ...deadline,
    },
    stakeBounds: {
      appealId: FIXTURE_APPEAL_ID,
      minStake: '100000000000000000',
      maxStake: '10000000000000000000',
      recommendedStake: '500000000000000000',
      totalSupportStake: '3500000000000000000',
      totalOpposeStake: '2100000000000000000',
      supporterCount: 7,
      opposerCount: 4,
      ...stakeBounds,
    },
    position: {
      appealId: FIXTURE_APPEAL_ID,
      userAddress: FIXTURE_WALLET,
      hasParticipated: false,
      currentBalance: '5000000000000000000',
      hasMinimumBalance: true,
      ...position,
    },
  };

  return { ...base, ...rest };
}

/** Convenience: a fetcher that always resolves the given payload. */
export function projectionFetcher(payload: AppealProjectionPayload = buildAppealProjection()) {
  return async () => payload;
}

/**
 * Config for `useAppealContext` that returns a coherent projection.
 *
 * Call sites spread this so every test drives the projection transport
 * explicitly instead of relying on fabricated hook defaults.
 */
export function appealContextConfig(options: {
  appealId: string;
  claimId: string;
  contractAddress: string;
  expectedChainId?: number;
  pollInterval?: number;
  overrides?: AppealProjectionOverrides;
  userAddress: string;
}) {
  const { overrides, userAddress, ...rest } = options;
  return {
    ...rest,
    fetcher: projectionFetcher(
      buildAppealProjection({
        appealId: rest.appealId,
        chainId: rest.expectedChainId ?? 11155420,
        snapshot: { appealId: rest.appealId, claimId: rest.claimId },
        deadline: { appealId: rest.appealId },
        stakeBounds: { appealId: rest.appealId },
        position: { appealId: rest.appealId, userAddress },
        ...overrides,
      })
    ),
  };
}
