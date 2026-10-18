/**
 * UI-FE-031 — Component tests for UpgradeReview.
 *
 * Covers governance context, fail-closed verification, and the guardian
 * unpause never appearing acceptance criteria.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { UpgradeReview } from '../UpgradeReview';
import type { UpgradeReviewSnapshot } from '@/lib/upgrade-review/types';
import type { CurrentReleaseReview } from '@/lib/upgrade-review/types';

const CANONICAL = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const currentRelease: CurrentReleaseReview = {
  protocolVersion: '2.0.0',
  releaseId: 'v2.0.0-sepolia',
  gitCommit: '5333c0acb9ccfb8a6a37ae76b3397d06781f0119',
  chainId: 11155420,
  abiVersion: '2.0.0',
  eventSchemaVersion: '2.0.0',
  parameterSetVersion: '2.0.0',
  abiHash: '6865824782c1df1cf5f16465d9a4e028e8ac7385c6506fea957116a09a1d8385',
  currentReleaseVerified: true,
  compatibilityIssues: [],
  blockedReasons: [],
};

const unverifiedSnapshot: UpgradeReviewSnapshot = {
  currentRelease,
  candidate: {
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
    affectedOperations: ['op-retry-batch-4410'],
    rollbackPlan: {
      steps: ['Queue rollback proposal', 'Execute rollback after timelock'],
      verified: false,
    },
    verification: 'unverified',
    verifiedBy: null,
    verifiedAt: null,
  },
  currentLifecycle: {
    state: 'empty',
    label: 'No protocol transaction',
    blockingReasons: [],
  },
  governedCalls: [
    {
      actionType: 'governance',
      targetResource: 'TimelockController#executeProposal',
      summary:
        'Execute the queued upgrade proposal after the 48-hour timelock delay and multi-party multisig approval.',
    },
  ],
  affectedOperations: [
    {
      operationId: 'op-retry-batch-4410',
      queued: true,
      queueAge: '12m ago',
      reason: 'queued operation; queue age 12m ago',
    },
  ],
  rollback: {
    steps: ['Queue rollback proposal', 'Execute rollback after timelock'],
    verified: false,
    blockedReasons: ['candidate rollback plan is not verified'],
  },
  blockedReasons: [
    'candidate manifest is not verified by a maintainer',
    'candidate rollback plan is not verified',
  ],
  isFullyVerified: false,
  currentLifecycleBlocksMutation: false,
};

const verifiedSnapshot: UpgradeReviewSnapshot = {
  ...unverifiedSnapshot,
  candidate: {
    ...unverifiedSnapshot.candidate,
    verification: 'verified',
    verifiedBy: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    verifiedAt: '2026-03-27T08:00:00Z',
  },
  rollback: {
    ...unverifiedSnapshot.rollback,
    verified: true,
    blockedReasons: [],
  },
  blockedReasons: [],
  isFullyVerified: true,
};

describe('UpgradeReview (unauthorized)', () => {
  it('shows the unauthorized state and never shows guardian unpause', () => {
    render(<UpgradeReview authorized={false} unauthorizedReason="Not the canonical admin." />);

    expect(
      screen.getByTestId('upgrade-review-unauthorized'),
    ).toBeInTheDocument();
    expect(screen.getByText(/upgrade review unavailable/i)).toBeInTheDocument();

    // No guardian unpause or activation surface of any kind.
    expect(screen.queryByText(/guardian unpause/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /unpause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /activate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /execute/i })).not.toBeInTheDocument();
  });
});

describe('UpgradeReview (unverified candidate blocks action)', () => {
  it('renders evidence sections and shows blocking reasons', () => {
    render(<UpgradeReview snapshot={unverifiedSnapshot} />);

    expect(screen.getByTestId('upgrade-release-summary')).toBeInTheDocument();
    expect(screen.getByTestId('upgrade-verification-evidence')).toBeInTheDocument();
    expect(screen.getByTestId('upgrade-compatibility-evidence')).toBeInTheDocument();
    expect(screen.getByTestId('upgrade-affected-operations')).toBeInTheDocument();
    expect(screen.getByTestId('upgrade-rollback-plan')).toBeInTheDocument();
    expect(screen.getByTestId('governed-unpause-review')).toBeInTheDocument();

    // Blocking reasons surface across evidence and blocked-state sections.
    expect(
      screen.getAllByText(/candidate manifest is not verified/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/candidate rollback plan is not verified/i).length,
    ).toBeGreaterThanOrEqual(1);

    // Execution is blocked: no activation button.
    expect(screen.queryByRole('button', { name: /activate candidate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /execute upgrade/i })).not.toBeInTheDocument();

    // Guardian unpause never appears.
    expect(screen.queryByText(/guardian unpause/i)).not.toBeInTheDocument();
  });

  it('shows candidate verification state as unverified', () => {
    render(<UpgradeReview snapshot={unverifiedSnapshot} />);

    expect(screen.getByTestId('candidate-verification')).toHaveAttribute(
      'data-candidate-verified',
      'false',
    );
    expect(screen.getByText(/unverified/i)).toBeInTheDocument();
  });

  it('shows rollback plan not verified', () => {
    render(<UpgradeReview snapshot={unverifiedSnapshot} />);

    expect(screen.getByTestId('rollback-blocked')).toBeInTheDocument();
    expect(
      screen.getAllByText(/not verified/i).length,
    ).toBeGreaterThanOrEqual(1);
  });
});

describe('UpgradeReview (verified candidate)', () => {
  it('shows verified gates pass with no blocking reasons', () => {
    render(<UpgradeReview snapshot={verifiedSnapshot} />);

    expect(screen.getByTestId('candidate-verification')).toHaveAttribute(
      'data-candidate-verified',
      'true',
    );
    expect(screen.getByTestId('rollback-verified')).toBeInTheDocument();
    expect(
      screen.queryByTestId('upgrade-review-blocked'),
    ).not.toBeInTheDocument();
  });
});

describe('UpgradeReview (governed calls and lifecycle)', () => {
  it('shows exact governed call and transaction lifecycle', () => {
    render(<UpgradeReview snapshot={verifiedSnapshot} />);

    expect(
      screen.getByText('TimelockController#executeProposal'),
    ).toBeInTheDocument();
    expect(screen.getByText(/48-hour timelock delay/i)).toBeInTheDocument();
    expect(screen.getByTestId('current-transaction-lifecycle')).toBeInTheDocument();
    expect(screen.getByText(/no protocol transaction/i)).toBeInTheDocument();
  });

  it('lists affected operations with queue cross-reference', () => {
    render(<UpgradeReview snapshot={verifiedSnapshot} />);

    expect(screen.getByTestId('affected-operation-op-retry-batch-4410')).toBeInTheDocument();
    expect(screen.getAllByText(/queued/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/12m ago/i).length).toBeGreaterThanOrEqual(1);
  });
});
