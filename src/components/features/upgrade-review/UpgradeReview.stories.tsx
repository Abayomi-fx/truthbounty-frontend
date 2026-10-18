import type { Meta, StoryObj } from '@storybook/react';
import { UpgradeReview } from './UpgradeReview';
import type { UpgradeReviewSnapshot } from '@/lib/upgrade-review/types';

const meta: Meta<typeof UpgradeReview> = {
  title: 'Features/UpgradeReview',
  component: UpgradeReview,
  parameters: {
    layout: 'fullscreen',
    a11y: {
      test: 'error',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof UpgradeReview>;

const CANONICAL = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const baseCurrentRelease = {
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

const baseCandidate = {
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
};

const baseSnapshot: UpgradeReviewSnapshot = {
  currentRelease: baseCurrentRelease,
  candidate: baseCandidate,
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

export const Unauthorized: Story = {
  args: {
    authorized: false,
    unauthorizedReason:
      'Current address is not registered as the canonical protocol administrator.',
  },
};

export const UnverifiedCandidateBlocks: Story = {
  args: {
    snapshot: baseSnapshot,
  },
};

export const VerifiedCandidate: Story = {
  args: {
    snapshot: {
      ...baseSnapshot,
      candidate: {
        ...baseCandidate,
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
    },
  },
};

export const UnverifiedManifestOnly: Story = {
  args: {
    snapshot: {
      ...baseSnapshot,
      candidate: {
        ...baseCandidate,
        verification: 'unverified',
        rollbackPlan: {
          steps: ['Restore previous implementation'],
          verified: true,
        },
      },
      rollback: {
        ...baseSnapshot.rollback,
        verified: true,
        blockedReasons: [],
      },
      blockedReasons: ['candidate manifest is not verified by a maintainer'],
      isFullyVerified: false,
    },
  },
};
