/**
 * UI-FE-031 — Unit tests for the upgrade/unpause review resolver.
 *
 * Fail-closed semantics: any missing verification, compatibility evidence,
 * or rollback produces blocking reasons and `isFullyVerified: false`.
 */

import {
  resolveUpgradeReview,
  resolveCandidateVerification,
} from '../upgrade-review';
import type { UpgradeCandidateDescriptor } from '../types';

const CANONICAL = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const artifact = {
  chainId: 11155420,
  releaseTag: 'v2.0.0-sepolia',
  artifactVersion: 'iv-verification-submission@v1.0.0',
  addresses: {
    verificationSubmission: CANONICAL,
    claimRegistry: CANONICAL,
    stakingToken: CANONICAL,
  },
  isDeployed: true,
  disabledReasons: [],
};

const diagnostics = {
  protocolVersion: '2.0.0',
  releaseId: 'v2.0.0-sepolia',
  chainId: 11155420,
  gitCommit: '5333c0acb9ccfb8a6a37ae76b3397d06781f0119',
  artifactPath: 'release',
  verifiedAt: '2026-03-27T08:00:00Z',
  abiVersion: '2.0.0',
  abiHash: '6865824782c1df1cf5f16465d9a4e028e8ac7385c6506fea957116a09a1d8385',
  environment: 'development',
  contracts: { TruthBountyWeighted: CANONICAL },
};

const verifiedCandidate: UpgradeCandidateDescriptor = {
  candidateId: 'v-next',
  releaseId: 'v2.1.0-sepolia',
  protocolVersion: '2.1.0',
  summary: 'Candidate release upgrading TruthBountyWeighted.',
  compatibility: {
    abiVersion: '2.1.0',
    eventSchemaVersion: '2.1.0',
    parameterSetVersion: '2.1.0',
    chainCompatibility: ['Compatible with Optimism Sepolia (chain 11155420).'],
  },
  affectedOperations: [],
  rollbackPlan: {
    steps: ['Queue rollback proposal', 'Execute rollback after timelock'],
    verified: true,
  },
  verification: 'verified',
  verifiedBy: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  verifiedAt: '2026-03-27T08:00:00Z',
};

describe('resolveUpgradeReview', () => {
  it('returns unverified candidate with blocking reasons by default', () => {
    const review = resolveUpgradeReview({
      artifact: artifact as never,
      diagnostics: diagnostics as never,
    });

    expect(review.candidate.verification).toBe('unverified');
    expect(review.isFullyVerified).toBe(false);
    expect(review.blockedReasons.length).toBeGreaterThan(0);
    expect(
      review.blockedReasons.some((r) => /candidate manifest is not verified/i.test(r)),
    ).toBe(true);
    expect(
      review.blockedReasons.some((r) => /rollback plan is not verified/i.test(r)),
    ).toBe(true);
  });

  it('does not expose any unpause or guardian activation path', () => {
    const review = resolveUpgradeReview({
      artifact: artifact as never,
      diagnostics: diagnostics as never,
    });

    const governedCallTargets = review.governedCalls.map((c) => c.targetResource);
    expect(governedCallTargets).toEqual(
      expect.arrayContaining(['TimelockController#executeProposal']),
    );
    // No unpause/emergency call surfaces anywhere.
    expect(review.governedCalls.some((c) => /unpause/i.test(c.targetResource))).toBe(false);
    expect(review.governedCalls.some((c) => /emergency/i.test(c.summary))).toBe(false);
  });

  it('surfaces exact governed call and current lifecycle', () => {
    const review = resolveUpgradeReview({
      artifact: artifact as never,
      diagnostics: diagnostics as never,
    });

    expect(review.governedCalls.length).toBeGreaterThan(0);
    expect(review.governedCalls[0].actionType).toBe('governance');
    expect(review.governedCalls[0].targetResource).toBe(
      'TimelockController#executeProposal',
    );
    expect(typeof review.currentLifecycle.state).toBe('string');
    expect(typeof review.currentLifecycle.label).toBe('string');
    expect(Array.isArray(review.currentLifecycle.blockingReasons)).toBe(true);
  });

  it('cross-references affected operations against the queue snapshot', () => {
    const queue = [
      {
        id: 'op-retry-batch-4410',
        title: 'Retry Failed Event Indexer Batch #4410',
        description: '',
        authority: 'PROTOCOL_OPERATOR',
        targetResource: 'Indexer Ingestion Pipeline',
        risk: 'high',
        consequence: '',
        queueAge: '12m ago',
        createdAt: '2026-03-27T07:48:00Z',
        status: 'pending',
      },
    ];

    const review = resolveUpgradeReview({
      artifact: artifact as never,
      diagnostics: diagnostics as never,
      operationalQueue: queue,
    });

    const entry = review.affectedOperations.find(
      (e) => e.operationId === 'op-retry-batch-4410',
    );
    expect(entry?.queued).toBe(true);
    expect(entry?.queueAge).toBe('12m ago');
  });

  it('reports affected operations not present in the queue as review-only', () => {
    const review = resolveUpgradeReview({
      artifact: artifact as never,
      diagnostics: diagnostics as never,
    });

    const entry = review.affectedOperations.find(
      (e) => e.operationId === 'op-retry-batch-4410',
    );
    expect(entry?.queued).toBe(false);
    expect(entry?.reason).toContain('not present in the operational queue');
  });

  it('passes all gates when candidate and current release are verified', () => {
    const review = resolveUpgradeReview({
      artifact: artifact as never,
      diagnostics: diagnostics as never,
      candidate: verifiedCandidate,
    });

    expect(review.isFullyVerified).toBe(true);
    expect(review.blockedReasons).toHaveLength(0);
    expect(review.currentLifecycleBlocksMutation).toBe(false);
    expect(review.rollback.verified).toBe(true);
  });

  it('fails closed when candidate rollback plan is unverified', () => {
    const unverifiedRollback: UpgradeCandidateDescriptor = {
      ...verifiedCandidate,
      rollbackPlan: { steps: ['Restore previous implementation'], verified: false },
    };

    const review = resolveUpgradeReview({
      artifact: artifact as never,
      diagnostics: diagnostics as never,
      candidate: unverifiedRollback,
    });

    expect(review.isFullyVerified).toBe(false);
    expect(
      review.blockedReasons.some((r) => /rollback plan is not verified/i.test(r)),
    ).toBe(true);
  });

  it('fails closed when candidate manifest is unverified', () => {
    const unverifiedCandidate: UpgradeCandidateDescriptor = {
      ...verifiedCandidate,
      verification: 'unverified',
      verifiedBy: null,
      verifiedAt: null,
    };

    const review = resolveUpgradeReview({
      artifact: artifact as never,
      diagnostics: diagnostics as never,
      candidate: unverifiedCandidate,
    });

    expect(review.isFullyVerified).toBe(false);
    expect(
      review.blockedReasons.some((r) => /candidate manifest is not verified/i.test(r)),
    ).toBe(true);
  });
});

describe('resolveCandidateVerification', () => {
  it('returns empty reasons for a fully verified candidate', () => {
    expect(resolveCandidateVerification(verifiedCandidate)).toEqual([]);
  });

  it('lists unverified manifest as a blocker', () => {
    const reasons = resolveCandidateVerification({
      ...verifiedCandidate,
      verification: 'unverified',
    });
    expect(reasons.some((r) => /not verified/i.test(r))).toBe(true);
  });

  it('lists unverified rollback as a blocker', () => {
    const reasons = resolveCandidateVerification({
      ...verifiedCandidate,
      rollbackPlan: { steps: [], verified: false },
    });
    expect(reasons.some((r) => /rollback plan is not verified/i.test(r))).toBe(true);
    expect(reasons.some((r) => /rollback plan is empty/i.test(r))).toBe(true);
  });
});
