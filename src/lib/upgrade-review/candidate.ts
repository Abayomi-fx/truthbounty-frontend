import type { UpgradeCandidateDescriptor, UpgradeGovernedCall } from './types';

/**
 * UI-FE-031 — Maintainer-declared candidate evidence.
 *
 * The candidate descriptor is controlled by maintainers. It is never
 * user-configurable, never executed by this interface, and every candidate
 * claim requires explicit maintainer confirmation before any execution
 * could be considered.
 */

/** The exact governed call the timelock executor would perform. */
export const UPGRADE_GOVERNED_CALLS: readonly UpgradeGovernedCall[] = [
  {
    actionType: 'governance',
    targetResource: 'TimelockController#executeProposal',
    summary:
      'Execute the queued upgrade proposal after the 48-hour timelock delay and multi-party multisig approval.',
  },
];

/**
 * Canonical candidate under review. Unverified by default — activation of
 * the candidate remains maintainer-controlled.
 */
export const UPGRADE_CANDIDATE: UpgradeCandidateDescriptor = {
  candidateId: 'v-next',
  releaseId: 'v2.1.0-sepolia',
  protocolVersion: '2.1.0',
  summary:
    'Candidate release upgrading the TruthBountyWeighted implementation with the settlement finality schedule.',
  compatibility: {
    abiVersion: '2.1.0',
    eventSchemaVersion: '2.1.0',
    parameterSetVersion: '2.1.0',
    chainCompatibility: [
      'Compatible with Optimism Mainnet (chain 10) and OP Sepolia (chain 11155420).',
    ],
  },
  affectedOperations: ['op-retry-batch-4410'],
  rollbackPlan: {
    steps: [
      'Queue a rollback proposal in the TimelockController.',
      'Wait out the 48-hour timelock with multisig approval.',
      'Execute the rollback proposal to restore the previous implementation.',
    ],
    verified: false,
  },
  verification: 'unverified',
  verifiedBy: null,
  verifiedAt: null,
};
