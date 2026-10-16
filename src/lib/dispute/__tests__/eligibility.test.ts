import {
  DISPUTE_ARTIFACT_VERSION,
  DisputeArtifact,
} from '@/config/protocol/dispute-artifact';
import type {
  DisputeContractSnapshot,
  DisputeEligibility,
} from '@/app/types/dispute-entry';
import {
  canAttemptDisputeMutation,
  deriveDisputeEligibility,
  explainEligibility,
  phaseNameFromIndex,
  DisputeEligibilityInput,
} from '@/lib/dispute/eligibility';

const CHAIN = 11155420;
const ACCOUNT = '0x000000000000000000000000000000000000000a' as const;
const CHALLENGER = '0x000000000000000000000000000000000000000b' as const;
const BOND = 10n ** 18n;
const NOW = 1_800_000_000n;

const PINNED_ARTIFACT: DisputeArtifact = {
  chainId: CHAIN,
  releaseTag: 'v2-dispute@v0.1.0',
  artifactVersion: DISPUTE_ARTIFACT_VERSION,
  addresses: {
    disputeRegistry: '0x1111111111111111111111111111111111111111',
    claimRegistry: '0x2222222222222222222222222222222222222222',
    bondToken: '0x3333333333333333333333333333333333333333',
  },
  isPinned: true,
  disabledReasons: [],
};

const UNPINNED_ARTIFACT: DisputeArtifact = {
  ...PINNED_ARTIFACT,
  isPinned: false,
  disabledReasons: ['DisputeRegistry address is not pinned in the deployment release'],
};

function snapshot(
  overrides: Partial<DisputeContractSnapshot> = {}
): DisputeContractSnapshot {
  return {
    claimId: '42',
    chainId: CHAIN,
    observedAtBlock: 1234n,
    phase: 'DISPUTE_WINDOW',
    dispute: { disputeId: 0n, challenger: '0x0000000000000000000000000000000000000000', openedAt: 0n },
    window: { opensAt: NOW - 3600n, closesAt: NOW + 3600n },
    requiredBond: BOND,
    accountBalance: 5n * BOND,
    ...overrides,
  };
}

function input(
  overrides: Partial<DisputeEligibilityInput> = {}
): DisputeEligibilityInput {
  return {
    artifact: PINNED_ARTIFACT,
    chainId: CHAIN,
    account: ACCOUNT,
    nowSeconds: NOW,
    snapshot: snapshot(),
    bondAtDraft: null,
    ...overrides,
  };
}

const statusOf = (result: DisputeEligibility) => result.status;

describe('phaseNameFromIndex', () => {
  it('maps uint8 phase indexes to canonical names', () => {
    expect(phaseNameFromIndex(0)).toBe('NONE');
    expect(phaseNameFromIndex(1)).toBe('VERIFICATION');
    expect(phaseNameFromIndex(2)).toBe('DISPUTE_WINDOW');
    expect(phaseNameFromIndex(3)).toBe('DISPUTE_ACTIVE');
    expect(phaseNameFromIndex(4)).toBe('FINALIZED');
  });

  it('accepts bigint and fails closed on unknown values', () => {
    expect(phaseNameFromIndex(2n)).toBe('DISPUTE_WINDOW');
    expect(phaseNameFromIndex(undefined)).toBe('NONE');
    expect(phaseNameFromIndex(99)).toBe('NONE');
  });
});

describe('deriveDisputeEligibility', () => {
  it('is eligible when every contract-derived gate passes', () => {
    const result = deriveDisputeEligibility(input());

    expect(result.status).toBe('eligible');
    if (result.status === 'eligible') {
      expect(result.requiredBond).toBe(BOND.toString());
      expect(result.observedAtBlock).toBe('1234');
    }
    expect(canAttemptDisputeMutation(result)).toBe(true);
  });

  it('fails closed to protocol-unpinned when contract authority is not pinned', () => {
    const result = deriveDisputeEligibility(input({ artifact: UNPINNED_ARTIFACT }));

    expect(result.status).toBe('protocol-unpinned');
    if (result.status === 'protocol-unpinned') {
      expect(result.reasons).toEqual(UNPINNED_ARTIFACT.disabledReasons);
    }
    expect(canAttemptDisputeMutation(result)).toBe(false);
  });

  it('never grants authority from wallet connection alone (unpinned beats connected wallet)', () => {
    const result = deriveDisputeEligibility(
      input({ artifact: UNPINNED_ARTIFACT, chainId: CHAIN, account: ACCOUNT })
    );
    expect(result.status).toBe('protocol-unpinned');
  });

  it('reports wallet-not-connected when no chain is active', () => {
    expect(statusOf(deriveDisputeEligibility(input({ chainId: null })))).toBe(
      'wallet-not-connected'
    );
  });

  it('reports wallet-not-connected when no account is connected', () => {
    expect(statusOf(deriveDisputeEligibility(input({ account: null })))).toBe(
      'wallet-not-connected'
    );
  });

  it('reports unsupported-chain outside Optimism/EVM supported chains', () => {
    const result = deriveDisputeEligibility(input({ chainId: 1 }));
    expect(result.status).toBe('unsupported-chain');
    if (result.status === 'unsupported-chain') {
      expect(result.supportedChains).toEqual([10, 11155420]);
    }
  });

  it('reports loading while contract reads are unresolved (never guesses)', () => {
    expect(statusOf(deriveDisputeEligibility(input({ snapshot: null })))).toBe(
      'loading'
    );
  });

  it('reports existing-dispute when a dispute already exists on-chain', () => {
    const result = deriveDisputeEligibility(
      input({
        snapshot: snapshot({
          dispute: { disputeId: 7n, challenger: CHALLENGER, openedAt: NOW - 60n },
        }),
      })
    );

    expect(result.status).toBe('existing-dispute');
    if (result.status === 'existing-dispute') {
      expect(result.disputeId).toBe('7');
      expect(result.challenger).toBe(CHALLENGER);
      expect(result.openedAt).toBe(
        new Date(Number((NOW - 60n) * 1000n)).toISOString()
      );
    }
  });

  it.each(['VERIFICATION', 'DISPUTE_ACTIVE', 'FINALIZED', 'NONE'] as const)(
    'reports unsupported-phase for the %s phase',
    (phase) => {
      const result = deriveDisputeEligibility(
        input({ snapshot: snapshot({ phase }) })
      );

      expect(result.status).toBe('unsupported-phase');
      if (result.status === 'unsupported-phase') {
        expect(result.phase).toBe(phase);
        expect(result.phaseLabel).toBeTruthy();
      }
    }
  );

  it('reports expired-window when the window has closed', () => {
    const result = deriveDisputeEligibility(
      input({
        nowSeconds: NOW,
        snapshot: snapshot({
          window: { opensAt: NOW - 7200n, closesAt: NOW - 1n },
        }),
      })
    );

    expect(result.status).toBe('expired-window');
    if (result.status === 'expired-window') {
      expect(result.windowEnd).toBe(
        new Date(Number((NOW - 1n) * 1000n)).toISOString()
      );
    }
  });

  it('treats the exact window close instant as expired', () => {
    const result = deriveDisputeEligibility(
      input({
        snapshot: snapshot({
          window: { opensAt: NOW - 7200n, closesAt: NOW },
        }),
      })
    );
    expect(result.status).toBe('expired-window');
  });

  it('reports window-not-open before the window opens', () => {
    const result = deriveDisputeEligibility(
      input({
        snapshot: snapshot({
          window: { opensAt: NOW + 60n, closesAt: NOW + 3600n },
        }),
      })
    );
    expect(result.status).toBe('window-not-open');
  });

  it('reports bond-changed when the contract bond differs from the draft bond', () => {
    const result = deriveDisputeEligibility(
      input({
        bondAtDraft: BOND - 1n,
        snapshot: snapshot({ requiredBond: BOND }),
      })
    );

    expect(result.status).toBe('bond-changed');
    if (result.status === 'bond-changed') {
      expect(result.requiredBond).toBe(BOND.toString());
      expect(result.bondAtDraft).toBe((BOND - 1n).toString());
    }
  });

  it('stays eligible when the draft bond matches the contract bond', () => {
    const result = deriveDisputeEligibility(
      input({ bondAtDraft: BOND, snapshot: snapshot({ requiredBond: BOND }) })
    );
    expect(result.status).toBe('eligible');
  });

  it('reports insufficient-balance when the account cannot cover the bond', () => {
    const result = deriveDisputeEligibility(
      input({ snapshot: snapshot({ accountBalance: BOND - 1n }) })
    );

    expect(result.status).toBe('insufficient-balance');
    if (result.status === 'insufficient-balance') {
      expect(result.balance).toBe((BOND - 1n).toString());
    }
  });

  it('reports insufficient-balance when the balance read has not resolved', () => {
    const result = deriveDisputeEligibility(
      input({ snapshot: snapshot({ accountBalance: null }) })
    );
    expect(result.status).toBe('insufficient-balance');
  });

  it('keeps gate order: phase before existing dispute before window before bond before balance', () => {
    const stacked = snapshot({
      phase: 'FINALIZED',
      dispute: { disputeId: 9n, challenger: CHALLENGER, openedAt: NOW },
      window: { opensAt: NOW - 7200n, closesAt: NOW - 1n },
      accountBalance: 0n,
    });
    expect(statusOf(deriveDisputeEligibility(input({ snapshot: stacked })))).toBe(
      'unsupported-phase'
    );

    const disputeAndWindow = snapshot({
      dispute: { disputeId: 9n, challenger: CHALLENGER, openedAt: NOW },
      window: { opensAt: NOW - 7200n, closesAt: NOW - 1n },
    });
    expect(
      statusOf(deriveDisputeEligibility(input({ snapshot: disputeAndWindow })))
    ).toBe('existing-dispute');

    const windowAndBond = snapshot({
      window: { opensAt: NOW - 7200n, closesAt: NOW - 1n },
    });
    expect(
      statusOf(
        deriveDisputeEligibility(
          input({ snapshot: windowAndBond, bondAtDraft: 1n })
        )
      )
    ).toBe('expired-window');
  });
});

describe('explainEligibility', () => {
  const statuses: DisputeEligibility[] = [
    { status: 'protocol-unpinned', reasons: ['DisputeRegistry address is not pinned in the deployment release'] },
    { status: 'unsupported-chain', chainId: 1, supportedChains: [10, 11155420] },
    { status: 'wallet-not-connected' },
    { status: 'loading' },
    { status: 'unsupported-phase', phase: 'FINALIZED', phaseLabel: 'Finalized' },
    { status: 'existing-dispute', disputeId: '1', challenger: CHALLENGER, openedAt: '2026-01-01T00:00:00.000Z' },
    { status: 'expired-window', windowEnd: '2026-01-01T00:00:00.000Z' },
    { status: 'window-not-open', windowStart: '2026-01-01T00:00:00.000Z' },
    { status: 'bond-changed', requiredBond: '2', bondAtDraft: '1' },
    { status: 'insufficient-balance', requiredBond: '2', balance: '1' },
    { status: 'eligible', requiredBond: '1', windowEnd: '2026-01-01T00:00:00.000Z', observedAtBlock: '1' },
  ];

  it.each(statuses.map((eligibility) => [eligibility.status, eligibility] as const))(
    'explains the %s state in plain language',
    (_status, eligibility) => {
      const explanation = explainEligibility(eligibility);
      expect(explanation.length).toBeGreaterThan(0);
      expect(canAttemptDisputeMutation(eligibility)).toBe(
        eligibility.status === 'eligible'
      );
    }
  );

  it('states explicitly that unpinned actions cannot be enabled from the UI', () => {
    const explanation = explainEligibility({
      status: 'protocol-unpinned',
      reasons: ['DisputeRegistry address is not pinned in the deployment release'],
    });
    expect(explanation).toMatch(/not pinned/i);
  });
});
