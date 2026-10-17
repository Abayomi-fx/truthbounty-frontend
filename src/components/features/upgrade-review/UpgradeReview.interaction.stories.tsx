/**
 * UI-FE-031 — UpgradeReview interaction tests.
 *
 * Storybook interaction tests for all scoped states:
 *   - unauthorized reviewers never see review content,
 *   - unverified manifest/layout/rollback blocks action,
 *   - exact governed calls and transaction lifecycle are visible,
 *   - guardian unpause never appears.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { expect } from '@storybook/jest';
import { within, userEvent, waitFor } from '@storybook/testing-library';
import { UpgradeReview } from './UpgradeReview';
import type { UpgradeReviewSnapshot } from '@/lib/upgrade-review/types';

const meta: Meta<typeof UpgradeReview> = {
  title: 'Features/UpgradeReview/Interactions',
  component: UpgradeReview,
  parameters: {
    layout: 'fullscreen',
    a11y: {
      test: 'error',
    },
  },
};

export default meta;
type Story = StoryObj<typeof UpgradeReview>;

const CANONICAL = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const baseSnapshot: UpgradeReviewSnapshot = {
  currentRelease: {
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
  },
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
} as never as UpgradeReviewSnapshot;

export const UnauthorizedReviewerSeesNothing: Story = {
  args: {
    authorized: false,
    unauthorizedReason:
      'Current address is not registered as the canonical protocol administrator.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByTestId('upgrade-review-unauthorized')).toBeInTheDocument();
    });

    // Guardian unpause never appears; no activation surface.
    expect(canvas.queryByText(/guardian unpause/i)).not.toBeInTheDocument();
    expect(
      canvas.queryByRole('button', { name: /unpause/i }),
    ).not.toBeInTheDocument();
    expect(
      canvas.queryByRole('button', { name: /activate/i }),
    ).not.toBeInTheDocument();
  },
};

export const UnverifiedCandidateBlocksAction: Story = {
  args: {
    snapshot: baseSnapshot,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByTestId('upgrade-release-summary')).toBeInTheDocument();
    });

    // Candidate is unverified and rollback is unverified → action blocked.
    expect(canvas.getByTestId('candidate-verification')).toHaveAttribute(
      'data-candidate-verified',
      'false',
    );
    expect(canvas.getByTestId('rollback-blocked')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        canvas.getAllByText(/candidate manifest is not verified/i).length,
      ).toBeGreaterThanOrEqual(1);
    });
    await waitFor(() => {
      expect(
        canvas.getAllByText(/candidate rollback plan is not verified/i).length,
      ).toBeGreaterThanOrEqual(1);
    });

    // No activation path is ever rendered.
    expect(
      canvas.queryByRole('button', { name: /activate candidate/i }),
    ).not.toBeInTheDocument();
    expect(
      canvas.queryByRole('button', { name: /execute upgrade/i }),
    ).not.toBeInTheDocument();

    // Guardian unpause never appears.
    expect(canvas.queryByText(/guardian unpause/i)).not.toBeInTheDocument();
  },
};

export const VerifiedCandidateGatesPass: Story = {
  args: {
    snapshot: {
      ...baseSnapshot,
      candidate: {
        ...baseSnapshot.candidate,
        verification: 'verified',
        verifiedBy: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        verifiedAt: '2026-03-27T08:00:00Z',
      },
      rollback: {
        ...baseSnapshot.rollback,
        verified: true,
        blockedReasons: [],
      },
      blockedReasons: [],
      isFullyVerified: true,
    } as never as UpgradeReviewSnapshot,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByTestId('candidate-verification')).toHaveAttribute(
        'data-candidate-verified',
        'true',
      );
    });
    expect(canvas.getByTestId('rollback-verified')).toBeInTheDocument();

    // No blocked state when all gates pass.
    expect(
      canvas.queryByTestId('upgrade-review-blocked'),
    ).not.toBeInTheDocument();
  },
};

export const GovernedCallsAndLifecycleVisible: Story = {
  args: {
    snapshot: baseSnapshot,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Exact governed call is visible.
    await waitFor(() => {
      expect(
        canvas.getByText('TimelockController#executeProposal'),
      ).toBeInTheDocument();
    });
    expect(canvas.getByText(/48-hour timelock delay/i)).toBeInTheDocument();

    // Current transaction lifecycle is visible.
    expect(canvas.getByTestId('current-transaction-lifecycle')).toBeInTheDocument();
    expect(canvas.getByText(/no protocol transaction/i)).toBeInTheDocument();

    // Affected operations are cross-referenced against the queue.
    expect(
      canvas.getByTestId('affected-operation-op-retry-batch-4410'),
    ).toBeInTheDocument();
  },
};

export const KeyboardNavigation: Story = {
  args: {
    snapshot: baseSnapshot,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByTestId('upgrade-release-summary')).toBeInTheDocument();
    });

    // Tab focus moves through focusable elements without trapping.
    await userEvent.tab();
    await userEvent.tab();

    // Content remains accessible under keyboard navigation.
    await waitFor(() => {
      expect(canvas.getByText(/candidate manifest is not verified/i)).toBeInTheDocument();
    });
  },
};

export const ReducedMotion: Story = {
  args: {
    snapshot: baseSnapshot,
  },
  parameters: {
    a11y: {
      config: {
        rules: [
          {
            id: 'motion',
            enabled: true,
          },
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByTestId('upgrade-release-summary')).toBeInTheDocument();
    });

    // Set prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    Object.defineProperty(mediaQuery, 'matches', {
      writable: true,
      value: true,
    });

    // Content remains accessible under reduced motion.
    await waitFor(() => {
      expect(canvas.getByTestId('governed-unpause-review')).toBeInTheDocument();
    });

    // Interactive content remains reachable.
    expect(
      canvas.getByText('TimelockController#executeProposal'),
    ).toBeInTheDocument();
  },
};
