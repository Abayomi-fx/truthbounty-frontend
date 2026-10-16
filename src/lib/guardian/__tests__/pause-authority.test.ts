/**
 * UI-FE-032 — Guardian pause authority negative-capability tests.
 *
 * These tests assert the fail-closed boundary: pause is permitted only when
 * the pinned ABI proves the scope, the network matches the release, the
 * caller is the canonical guardian, on-chain authority is live, and the read
 * is fresh.
 */

import {
  APPROVED_PAUSE_SCOPES,
  FORBIDDEN_GUARDIAN_CAPABILITIES,
  derivePauseProofs,
  describeGuardianPausePhase,
  isForbiddenGuardianCapability,
  isSupportedGuardianChain,
  resolveGuardianPauseAuthority,
  scopeId,
  type GuardianAuthorityRead,
  type GuardianFreshness,
  type GuardianPauseScope,
} from '@/lib/guardian';
import releaseAbi from '../../../../release/abi/TruthBountyWeighted.json';

const GUARDIAN = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const OTHER = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';

const pauseAbi = [
  {
    type: 'function',
    name: 'pauseClaimSubmission',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'scope', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'pauseVerification',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'pauseDispute',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'scope', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'pauseAppeal',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'scope', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'pauseRewardDistribution',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'scope', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'hasRole',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }, { type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

const roleRead = (overrides: Partial<GuardianAuthorityRead> = {}): GuardianAuthorityRead => ({
  status: 'success',
  hasPauseRole: true,
  revoked: false,
  blockNumber: 123n,
  ...overrides,
});

const fresh = (overrides: Partial<GuardianFreshness> = {}): GuardianFreshness => ({
  status: 'fresh',
  ageMs: 1000,
  observedAtBlock: 123n,
  ...overrides,
});

function resolve(
  overrides: Partial<Parameters<typeof resolveGuardianPauseAuthority>[0]> = {},
) {
  return resolveGuardianPauseAuthority({
    chainId: 11155420,
    abi: pauseAbi,
    releaseChainId: 11155420,
    account: GUARDIAN,
    guardianAddress: GUARDIAN,
    authorityRead: roleRead(),
    freshness: fresh(),
    manifestVerified: true,
    ...overrides,
  });
}

describe('derivePauseProofs (ABI is the authority)', () => {
  it('returns no proofs for the pinned release ABI (no pause entrypoint)', () => {
    expect(derivePauseProofs(releaseAbi as readonly unknown[])).toEqual([]);
  });

  it('proves only scopes whose entrypoint the ABI declares', () => {
    const partial = pauseAbi.filter(
      (entry) => entry.name !== 'pauseDispute' && entry.name !== 'hasRole',
    );
    const proofs = derivePauseProofs(partial as readonly unknown[]);
    expect(proofs.map((proof) => proof.scope).sort()).toEqual(
      ['appeal', 'claim-submission', 'reward-distribution', 'verification'].sort(),
    );
    expect(proofs.some((proof) => proof.scope === 'dispute')).toBe(false);
  });

  it('derives a real 4-byte selector from ABI-declared inputs', () => {
    const [proof] = derivePauseProofs(pauseAbi as readonly unknown[]);
    expect(proof.selector).toMatch(/^0x[0-9a-f]{8}$/);
    expect(proof.signature).toBe('pauseClaimSubmission(bytes32)');
    expect(proof.inputs).toEqual(['bytes32']);
  });

  it('never proves forbidden capabilities even when the ABI declares them', () => {
    const dangerousAbi = [
      { type: 'function', name: 'unpause', stateMutability: 'nonpayable', inputs: [], outputs: [] },
      { type: 'function', name: 'upgradeTo', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
      { type: 'function', name: 'withdrawTreasury', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [] },
      { type: 'function', name: 'settleProvisional', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }], outputs: [] },
      { type: 'function', name: 'grantRole', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }, { type: 'address' }], outputs: [] },
    ];
    expect(derivePauseProofs(dangerousAbi as readonly unknown[])).toEqual([]);
    for (const capability of FORBIDDEN_GUARDIAN_CAPABILITIES) {
      expect(isForbiddenGuardianCapability(capability)).toBe(true);
    }
  });

  it('does not prove a view/pure function as a pause entrypoint', () => {
    const viewOnly = [
      { type: 'function', name: 'pauseDispute', stateMutability: 'view', inputs: [], outputs: [] },
    ];
    expect(derivePauseProofs(viewOnly as readonly unknown[])).toEqual([]);
  });

  it('computes a deterministic bytes32 scope id', () => {
    expect(scopeId('dispute')).toBe(scopeId('dispute'));
    expect(scopeId('dispute')).toMatch(/^0x[0-9a-f]{64}$/);
    expect(scopeId('dispute')).not.toBe(scopeId('appeal'));
  });
});

describe('resolveGuardianPauseAuthority — fail closed', () => {
  it('allows pause only when every invariant holds', () => {
    const snapshot = resolve();
    expect(snapshot.status).toBe('ready');
    expect(snapshot.allowsPause).toBe(true);
    expect(snapshot.blockingReasons).toEqual([]);
    expect(snapshot.actionableScopes).toEqual([...APPROVED_PAUSE_SCOPES]);
  });

  it.each<[string, Parameters<typeof resolve>[0], string]>([
    ['manifest unverified', { manifestVerified: false }, 'manifest_unverified'],
    ['unsupported chain', { chainId: 1, releaseChainId: 1 }, 'unsupported_chain'],
    ['wrong network', { chainId: 10 }, 'wrong_network'],
    ['no ABI pause support', { abi: [] }, 'no_abi_pause_support'],
    ['wallet disconnected', { account: null }, 'wallet_disconnected'],
    ['guardian unread', { guardianAddress: null }, 'authority_unread'],
    ['authority read missing', { authorityRead: null }, 'authority_unread'],
    ['authority read errored', { authorityRead: roleRead({ status: 'error' }) }, 'authority_unread'],
    ['authority revoked', { authorityRead: roleRead({ revoked: true }) }, 'authority_revoked'],
    ['role not held', { authorityRead: roleRead({ hasPauseRole: false }) }, 'authority_unknown'],
    ['non-guardian account', { account: OTHER }, 'authority_unknown'],
    ['stale data', { freshness: fresh({ status: 'stale' }) }, 'stale_data'],
    ['unknown freshness', { freshness: null }, 'stale_data'],
  ])('disables pause on %s', (_label, overrides, expectedStatus) => {
    const snapshot = resolve(overrides);
    expect(snapshot.status).toBe(expectedStatus);
    expect(snapshot.allowsPause).toBe(false);
    expect(snapshot.blockingReasons.length).toBeGreaterThan(0);
  });

  it('treats zero/placeholder addresses as absent', () => {
    const snapshot = resolve({
      account: '0x0000000000000000000000000000000000000000',
    });
    expect(snapshot.account).toBeNull();
    expect(snapshot.allowsPause).toBe(false);
  });

  it('exposes only approved scopes, never forbidden capabilities', () => {
    const snapshot = resolve();
    expect(snapshot.allScopes).toEqual([...APPROVED_PAUSE_SCOPES]);
    for (const forbidden of FORBIDDEN_GUARDIAN_CAPABILITIES) {
      expect((snapshot.actionableScopes as readonly string[])).not.toContain(forbidden);
    }
  });
});

describe('isSupportedGuardianChain', () => {
  it('accepts Optimism Mainnet and OP Sepolia only', () => {
    expect(isSupportedGuardianChain(10)).toBe(true);
    expect(isSupportedGuardianChain(11155420)).toBe(true);
    expect(isSupportedGuardianChain(1)).toBe(false);
    expect(isSupportedGuardianChain(8453)).toBe(false);
  });
});

describe('describeGuardianPausePhase — request vs on-chain pause', () => {
  const scope: GuardianPauseScope = 'dispute';

  it('never reports a submitted request as paused on-chain', () => {
    const phase = describeGuardianPausePhase('submitted', {
      scope,
      pauseState: 'active',
      observedAtBlock: 10n,
      confirmedOnChain: true,
    });
    expect(phase.requestState).toBe('submitted');
    expect(phase.onChainState).toBe('active');
    expect(phase.isPausedOnChain).toBe(false);
    expect(phase.requestLabel).toMatch(/awaiting on-chain confirmation/i);
  });

  it('reports paused only when a canonical read confirms it', () => {
    const phase = describeGuardianPausePhase('submitted', {
      scope,
      pauseState: 'paused',
      observedAtBlock: 11n,
      confirmedOnChain: true,
    });
    expect(phase.onChainState).toBe('paused');
    expect(phase.isPausedOnChain).toBe(true);
  });

  it('keeps on-chain state unknown without a confirmed read', () => {
    const phase = describeGuardianPausePhase('idle', {
      scope,
      pauseState: 'paused',
      observedAtBlock: 11n,
      confirmedOnChain: false,
    });
    expect(phase.onChainState).toBe('unknown');
    expect(phase.isPausedOnChain).toBe(false);
  });
});
