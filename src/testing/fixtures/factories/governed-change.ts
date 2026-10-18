/**
 * UI-FE-088 — governed change & timelock fixtures.
 *
 * Deterministic fixtures for the UI-FE-029 governed-change surfaces. The
 * snapshot is always derived with the production `resolveGovernedChange`, so a
 * fixture can never claim `executionEnabled` when the fail-closed resolver
 * would block it.
 */

import {
  getGovernedChangeEntry,
  resolveGovernedChange,
  resolveGovernedChangeCall,
  type GovernedChangeAuthority,
  type GovernedChangeCall,
  type GovernedChangeDependency,
  type GovernedChangeParameter,
  type GovernedChangeRollbackPlan,
  type GovernedChangeSnapshot,
  type ResolveGovernedChangeInput,
} from '../../../lib/governed-change';
import { createFixtureContext, type FixtureContext } from '../deterministic';

const DEFAULT_CHANGE_KEY = 'settlement-finality-threshold';
const REQUIRED_ROLE = 'TIMELOCK_EXECUTOR_ROLE';
const REQUIRED_CHAIN_ID = 11155420;

/** Compose the default supported call; throws if the catalogue drifts. */
export function makeGovernedChangeCall(
  key: string = DEFAULT_CHANGE_KEY,
  values: Readonly<Record<string, string>> = { threshold: '64' },
): GovernedChangeCall {
  const result = resolveGovernedChangeCall(key, values);
  if (!result.ok) {
    throw new Error(`makeGovernedChangeCall: ${result.rejection.code} — ${result.rejection.reason}`);
  }
  return result.call;
}

export function makeGovernedChangeAuthority(
  ctx: FixtureContext = createFixtureContext(),
  overrides: Partial<GovernedChangeAuthority> = {},
): GovernedChangeAuthority {
  return {
    account: ctx.address('governed-change-account'),
    requiredRole: REQUIRED_ROLE,
    authorized: true,
    reasons: [],
    source: 'wallet-session-local',
    ...overrides,
  };
}

function defaultParameters(ctx: FixtureContext): GovernedChangeParameter[] {
  return [
    {
      key: 'threshold',
      label: 'Threshold (confirmations)',
      currentValue: '32',
      proposedValue: '64',
      source: 'pinned-contract',
      changed: true,
    },
    {
      key: 'blockNumber',
      label: 'Current block',
      currentValue: String(ctx.int('governed-change-block', 6_100_000, 6_199_000)),
      proposedValue: String(ctx.int('governed-change-block', 6_100_000, 6_199_000)),
      source: 'fresh-api-projection',
      changed: false,
    },
  ];
}

function defaultDependencies(): GovernedChangeDependency[] {
  return [
    {
      id: 'audit-signoff',
      label: 'Security review',
      description: 'Maintainer-signed review of the proposed threshold.',
      satisfied: true,
      evidence: 'audit/ui-fe-029.md',
    },
  ];
}

function defaultRollback(): GovernedChangeRollbackPlan {
  return {
    steps: [
      'Schedule a timelock proposal restoring the previous threshold.',
      'Re-run the settlement regression suite after execution.',
    ],
    verified: true,
    evidence: 'runbooks/rollback-governed-change.md',
  };
}

export interface MakeGovernedChangeOptions {
  ctx?: FixtureContext;
  /** Explicit overrides merged over the "ready to execute" baseline. */
  input?: Partial<ResolveGovernedChangeInput>;
}

/**
 * Build a governed-change snapshot. The baseline is fully ready (queued and
 * past the timelock delay, authorized, supported call, verified rollback);
 * pass `input` to model a blocked state.
 */
export function makeGovernedChangeSnapshot(
  options: MakeGovernedChangeOptions = {},
): GovernedChangeSnapshot {
  const ctx = options.ctx ?? createFixtureContext();
  const entry = getGovernedChangeEntry(DEFAULT_CHANGE_KEY);

  const baseline: ResolveGovernedChangeInput = {
    surfaceState: 'ready',
    changeKey: DEFAULT_CHANGE_KEY,
    label: entry?.label ?? 'Settlement finality threshold',
    call: makeGovernedChangeCall(),
    parameters: defaultParameters(ctx),
    dependencies: defaultDependencies(),
    rollback: defaultRollback(),
    proposal: {
      id: ctx.hex('governed-proposal', 32),
      earliestExecution: ctx.isoAt(-60_000),
      delaySeconds: 172_800,
      blockNumber: ctx.int('governed-proposal-block', 6_100_000, 6_199_000),
    },
    authority: makeGovernedChangeAuthority(ctx),
    currentChainId: REQUIRED_CHAIN_ID,
    requiredChainIds: [REQUIRED_CHAIN_ID],
    now: ctx.nowMs,
  };

  return resolveGovernedChange({
    ...baseline,
    ...options.input,
  });
}
