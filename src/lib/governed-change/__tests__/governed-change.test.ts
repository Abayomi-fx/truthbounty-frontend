/**
 * UI-FE-029 — Governed change & timelock resolver tests.
 *
 * Verifies the fail-closed invariants: arbitrary calls are rejected, execution
 * is disabled before timelock readiness, and authority is revalidated at action
 * time.
 */

import {
  canExecute,
  formatCountdown,
  revalidateAuthority,
  rejectUnsupportedCall,
  resolveGovernedChange,
  resolveGovernedChangeCall,
  resolvePreparationGate,
  resolveTimelockReadiness,
} from '..';
import {
  FIXTURE_EPOCH_MS,
  createFixtureContext,
  makeGovernedChangeSnapshot,
} from '@/testing/fixtures';

const REQUIRED_CHAIN = 11155420;

describe('resolveGovernedChangeCall', () => {
  it('composes a supported call with the exact target, method, and parameters', () => {
    const result = resolveGovernedChangeCall('settlement-finality-threshold', {
      threshold: '64',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.call.targetResource).toBe(
      'TruthBountyWeighted#setSettlementFinalityThreshold',
    );
    expect(result.call.timelockOperation).toBe('schedule');
    expect(result.call.target.target).toBe('TruthBountyWeighted');
    expect(result.call.target.method).toBe('setSettlementFinalityThreshold');
    expect(result.call.target.parameters).toEqual(['64']);
    expect(result.call.target.selector).toBeNull();
  });

  it('rejects an unknown governed change', () => {
    const result = resolveGovernedChangeCall('arbitrary-admin-call', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejection.code).toBe('UNKNOWN_CHANGE');
  });

  it('rejects an unknown parameter', () => {
    const result = resolveGovernedChangeCall('settlement-finality-threshold', {
      threshold: '64',
      backdoor: 'true',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejection.code).toBe('UNKNOWN_PARAMETER');
  });

  it('rejects a missing parameter', () => {
    const result = resolveGovernedChangeCall('settlement-finality-threshold', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejection.code).toBe('MISSING_PARAMETER');
  });

  it('rejects a parameter with the wrong type', () => {
    const result = resolveGovernedChangeCall('settlement-finality-threshold', {
      threshold: 'not-a-number',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejection.code).toBe('INVALID_PARAMETER_TYPE');
  });

  it('rejects an arbitrary target/method pair', () => {
    const rejection = rejectUnsupportedCall('EvilContract', 'drain');
    expect(rejection.code).toBe('UNSUPPORTED_METHOD');
  });
});

describe('resolveTimelockReadiness', () => {
  it('reports not queued when there is no proposal', () => {
    const readiness = resolveTimelockReadiness(null, FIXTURE_EPOCH_MS);
    expect(readiness.queued).toBe(false);
    expect(readiness.ready).toBe(false);
    expect(readiness.secondsRemaining).toBeNull();
  });

  it('reports pending with a countdown before the delay elapses', () => {
    const readiness = resolveTimelockReadiness(
      {
        id: '0xabc',
        earliestExecution: new Date(FIXTURE_EPOCH_MS + 3_600_000).toISOString(),
        delaySeconds: 7200,
        blockNumber: 1,
      },
      FIXTURE_EPOCH_MS,
    );
    expect(readiness.queued).toBe(true);
    expect(readiness.ready).toBe(false);
    expect(readiness.secondsRemaining).toBe(3600);
  });

  it('reports ready once the delay has elapsed', () => {
    const readiness = resolveTimelockReadiness(
      {
        id: '0xabc',
        earliestExecution: new Date(FIXTURE_EPOCH_MS - 1000).toISOString(),
        delaySeconds: 7200,
        blockNumber: 1,
      },
      FIXTURE_EPOCH_MS,
    );
    expect(readiness.ready).toBe(true);
    expect(readiness.secondsRemaining).toBe(0);
  });

  it('fails closed on an unparseable earliest execution', () => {
    const readiness = resolveTimelockReadiness(
      {
        id: '0xabc',
        earliestExecution: 'not-a-date',
        delaySeconds: 7200,
        blockNumber: 1,
      },
      FIXTURE_EPOCH_MS,
    );
    expect(readiness.queued).toBe(true);
    expect(readiness.ready).toBe(false);
    expect(readiness.secondsRemaining).toBeNull();
  });
});

describe('resolveGovernedChange (fail closed)', () => {
  it('enables execution for a fully ready snapshot', () => {
    const snapshot = makeGovernedChangeSnapshot();
    expect(snapshot.blockedReasons).toEqual([]);
    expect(snapshot.executionEnabled).toBe(true);
    expect(canExecute(snapshot)).toBe(true);
  });

  const blockedCases: Array<[string, Parameters<typeof makeGovernedChangeSnapshot>[0]['input']]> = [
    ['surface is not ready', { surfaceState: 'loading' }],
    ['unsupported chain', { currentChainId: 1 }],
    [
      'unauthorized account',
      { authority: { ...makeGovernedChangeSnapshot().authority, authorized: false, reasons: ['missing role'] } },
    ],
    ['no supported call', { call: null }],
    ['proposal not queued', { proposal: null }],
    [
      'timelock delay not elapsed',
      {
        proposal: {
          id: '0xabc',
          earliestExecution: new Date(FIXTURE_EPOCH_MS + 60_000).toISOString(),
          delaySeconds: 7200,
          blockNumber: 1,
        },
      },
    ],
    [
      'unsatisfied dependency',
      {
        dependencies: [
          {
            id: 'audit-signoff',
            label: 'Security review',
            description: 'pending',
            satisfied: false,
            evidence: null,
          },
        ],
      },
    ],
    ['rollback not verified', { rollback: { steps: ['restore'], verified: false, evidence: null } }],
    ['execution already busy', { execution: { status: 'submitted' } }],
  ];

  it.each(blockedCases)('blocks execution when %s', (_label, input) => {
    const snapshot = makeGovernedChangeSnapshot({ input });
    expect(snapshot.executionEnabled).toBe(false);
    expect(snapshot.blockedReasons.length).toBeGreaterThan(0);
    expect(canExecute(snapshot)).toBe(false);
  });
});

describe('revalidateAuthority', () => {
  const snapshot = makeGovernedChangeSnapshot();
  const account = snapshot.authority.account as `0x${string}`;

  it('authorizes an unchanged account on a supported chain', () => {
    const result = revalidateAuthority(snapshot, {
      account,
      chainId: REQUIRED_CHAIN,
      authorized: true,
    });
    expect(result.authorized).toBe(true);
    expect(result.unchanged).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('blocks when the account changed since review', () => {
    const result = revalidateAuthority(snapshot, {
      account: '0x0000000000000000000000000000000000000001',
      chainId: REQUIRED_CHAIN,
      authorized: true,
    });
    expect(result.authorized).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/account changed/i);
  });

  it('blocks when the chain became unsupported', () => {
    const result = revalidateAuthority(snapshot, {
      account,
      chainId: 1,
      authorized: true,
    });
    expect(result.authorized).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/unsupported network/i);
  });

  it('blocks when the account is no longer connected', () => {
    const result = revalidateAuthority(snapshot, {
      account: null,
      chainId: REQUIRED_CHAIN,
      authorized: true,
    });
    expect(result.authorized).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/no longer connected/i);
  });

  it('blocks when authorization is revoked', () => {
    const result = revalidateAuthority(snapshot, {
      account,
      chainId: REQUIRED_CHAIN,
      authorized: false,
    });
    expect(result.authorized).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/not authorized/i);
  });
});

describe('resolvePreparationGate', () => {
  it('allows preparation without a queued proposal', () => {
    const snapshot = makeGovernedChangeSnapshot({ input: { proposal: null } });
    const gate = resolvePreparationGate(snapshot);
    expect(gate.enabled).toBe(true);
  });

  it('blocks preparation when the rollback plan is unverified', () => {
    const snapshot = makeGovernedChangeSnapshot({
      input: { rollback: { steps: ['restore'], verified: false, evidence: null } },
    });
    const gate = resolvePreparationGate(snapshot);
    expect(gate.enabled).toBe(false);
    expect(gate.reasons.join(' ')).toMatch(/rollback plan is not verified/i);
  });
});

describe('formatCountdown', () => {
  it('formats seconds as HH:MM:SS', () => {
    expect(formatCountdown(3661)).toBe('01:01:01');
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(null)).toBeNull();
  });
});

describe('deterministic fixture context', () => {
  it('produces reproducible snapshots for the same seed', () => {
    const first = makeGovernedChangeSnapshot({ ctx: createFixtureContext('seed-a') });
    const second = makeGovernedChangeSnapshot({ ctx: createFixtureContext('seed-a') });
    expect(first.authority.account).toBe(second.authority.account);
    expect(first.timelock.proposalId).toBe(second.timelock.proposalId);
  });
});
