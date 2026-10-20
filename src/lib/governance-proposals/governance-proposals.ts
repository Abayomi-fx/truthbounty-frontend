/**
 * UI-FE-028 — Pure fail-closed governance proposal logic.
 *
 * All state gates are pure functions with no side effects and zero authority synthesis.
 * Follows FRONTEND_IMPLEMENTATION_MATRIX.md fail-closed security rules.
 */

import type {
  GovernanceProposal,
  GovernanceProposalState,
  ProposalActionContext,
  ProposalActionGate,
  ProposalTargetCall,
} from './types';

/**
 * Validates that all target calls in a proposal have verified ABIs.
 * Returns the count of unverified/missing ABIs and associated failure reasons.
 */
export function validateProposalCalls(calls: readonly ProposalTargetCall[]): {
  readonly allVerified: boolean;
  readonly missingCount: number;
  readonly failureReasons: readonly string[];
} {
  if (!calls || calls.length === 0) {
    return {
      allVerified: false,
      missingCount: 0,
      failureReasons: ['Proposal contains no executable target calls.'],
    };
  }

  const missing: string[] = [];
  let count = 0;

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    if (!call.abiVerified) {
      count++;
      missing.push(
        call.abiMissingReason ||
          `Target contract call #${i + 1} (${call.contractName}#${call.methodName}) is missing verified release ABI.`,
      );
    }
  }

  return {
    allVerified: count === 0,
    missingCount: count,
    failureReasons: missing,
  };
}

/**
 * Resolves the action gate for a proposal given the caller's authority context.
 * Strictly fail-closed: missing release, missing ABI, wrong chain, or unauthorized account
 * will block mutations completely.
 */
export function resolveProposalActionGate(
  proposal: GovernanceProposal,
  context: ProposalActionContext,
): ProposalActionGate {
  const reasons: string[] = [];

  // Chain gate
  if (!context.isSupportedChain) {
    reasons.push('Connected chain is not the pinned Optimism EVM release.');
  }

  // Release verification gate
  if (!context.releaseVerified) {
    reasons.push('Release manifest or contract verification is missing or unverified.');
  }

  // Caller authorization gate
  if (!context.isAuthorizedOperator) {
    reasons.push(
      context.connectedAddress
        ? `Connected account (${context.connectedAddress.slice(0, 6)}...${context.connectedAddress.slice(-4)}) does not hold the Governance Operator role.`
        : 'Wallet not connected. Connect an authorized Governance Operator account.',
    );
  }

  // ABI verification gate (fails closed)
  const callValidation = validateProposalCalls(proposal.calls);
  if (!callValidation.allVerified) {
    for (const r of callValidation.failureReasons) {
      reasons.push(r);
    }
  }

  let canQueue = false;
  let canExecute = false;
  let canCancel = false;

  const baseAuthorized =
    context.isSupportedChain &&
    context.releaseVerified &&
    context.isAuthorizedOperator &&
    callValidation.allVerified;

  switch (proposal.state) {
    case 'succeeded':
      canQueue = baseAuthorized && !proposal.timelock.queuedAt;
      canCancel = baseAuthorized;
      break;

    case 'queued':
      canCancel = baseAuthorized;
      if (proposal.timelock.ready) {
        canExecute = baseAuthorized;
      } else {
        const remaining = proposal.timelock.secondsRemaining ?? 0;
        reasons.push(
          remaining > 0
            ? `Timelock delay is active. ${formatProposalCountdown(remaining)} remaining before execution window opens.`
            : 'Timelock delay has not elapsed on-chain.',
        );
      }
      break;

    case 'executable':
      canExecute = baseAuthorized;
      canCancel = baseAuthorized;
      break;

    case 'draft':
    case 'active':
      canCancel = baseAuthorized;
      break;

    case 'expired':
      reasons.push('Proposal timelock execution grace period has expired.');
      break;

    case 'cancelled':
      reasons.push('Proposal has been cancelled and cannot be executed.');
      break;

    default:
      reasons.push('Proposal is in an unsupported or unrecognised lifecycle state.');
  }

  return {
    canQueue,
    canExecute,
    canCancel,
    isActionable: canQueue || canExecute || canCancel,
    blockingReasons: reasons,
    missingAbiCount: callValidation.missingCount,
  };
}

/**
 * Formats a remaining seconds countdown into a human-readable display string.
 */
export function formatProposalCountdown(secondsRemaining: number | null): string {
  if (secondsRemaining === null || secondsRemaining === undefined) {
    return 'Pending schedule';
  }
  if (secondsRemaining <= 0) {
    return 'Ready to execute';
  }

  const days = Math.floor(secondsRemaining / 86400);
  const hours = Math.floor((secondsRemaining % 86400) / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const seconds = secondsRemaining % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

/**
 * Filters and searches proposals according to state tab and search text.
 */
export function filterProposals(
  proposals: readonly GovernanceProposal[],
  stateFilter: GovernanceProposalState | 'all',
  searchQuery = '',
): readonly GovernanceProposal[] {
  const query = searchQuery.trim().toLowerCase();

  return proposals.filter((proposal) => {
    // State matching
    if (stateFilter !== 'all' && proposal.state !== stateFilter) {
      return false;
    }

    // Text search query
    if (query) {
      const matchId = proposal.id.toLowerCase().includes(query);
      const matchTitle = proposal.title.toLowerCase().includes(query);
      const matchDesc = proposal.description.toLowerCase().includes(query);
      const matchProposer = proposal.proposer.toLowerCase().includes(query);
      const matchTarget = proposal.calls.some(
        (c) =>
          c.target.toLowerCase().includes(query) ||
          c.contractName.toLowerCase().includes(query) ||
          c.methodName.toLowerCase().includes(query),
      );

      if (!matchId && !matchTitle && !matchDesc && !matchProposer && !matchTarget) {
        return false;
      }
    }

    return true;
  });
}
