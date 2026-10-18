/**
 * UI-FE-077 — RPC health, quorum, and failover tests.
 *
 * Covers reviewed configuration, wrong-chain/wrong-release endpoints, lagging
 * heads, divergent receipts/projections, timeout/rate-limit failover, stale
 * data, mutation blocking, bounded recovery guidance, presentation, and
 * privacy-safe telemetry.
 */

import { describe, expect, it } from '@jest/globals';
import {
  buildRpcHealthPresentation,
  buildRpcHealthTelemetry,
  evaluateRpcQuorum,
  validateReviewedRpcConfiguration,
} from '../quorum';
import {
  DEFAULT_RPC_QUORUM_POLICY,
  RpcHealthConfigurationError,
  type ReviewedRpcConfiguration,
  type RpcProviderObservation,
} from '../types';

const NOW = 1_000_000;
const CHAIN_ID = 10;
const RELEASE_ID = 'v2.0.0-sepolia';
const CHECKSUM = 'sha256:release-checksum';

function configuration(
  overrides: Partial<ReviewedRpcConfiguration> = {},
): ReviewedRpcConfiguration {
  return {
    expectedChainId: CHAIN_ID,
    expectedReleaseId: RELEASE_ID,
    expectedArtifactChecksum: CHECKSUM,
    providers: [
      {
        id: 'primary',
        role: 'primary',
        chainId: CHAIN_ID,
        releaseId: RELEASE_ID,
        artifactChecksum: CHECKSUM,
      },
      {
        id: 'fallback-1',
        role: 'fallback',
        chainId: CHAIN_ID,
        releaseId: RELEASE_ID,
        artifactChecksum: CHECKSUM,
      },
      {
        id: 'fallback-2',
        role: 'fallback',
        chainId: CHAIN_ID,
        releaseId: RELEASE_ID,
        artifactChecksum: CHECKSUM,
      },
    ],
    policy: { ...DEFAULT_RPC_QUORUM_POLICY },
    ...overrides,
  };
}

function observation(
  providerId: string,
  overrides: Partial<RpcProviderObservation> = {},
): RpcProviderObservation {
  return {
    providerId,
    observedAtMs: NOW - 1_000,
    chainId: CHAIN_ID,
    releaseId: RELEASE_ID,
    artifactChecksum: CHECKSUM,
    headBlock: 100,
    latencyMs: 40,
    failure: null,
    ...overrides,
  };
}

function healthy(overrides: Partial<RpcProviderObservation> = {}) {
  return [
    observation('primary', overrides),
    observation('fallback-1', overrides),
    observation('fallback-2', overrides),
  ];
}

describe('reviewed RPC configuration', () => {
  it('accepts a reviewed primary + fallback configuration', () => {
    expect(() => validateReviewedRpcConfiguration(configuration())).not.toThrow();
  });

  it('rejects duplicate providers, missing roles, and unsafe policy bounds', () => {
    const duplicate = configuration();
    expect(() =>
      validateReviewedRpcConfiguration({
        ...duplicate,
        providers: [duplicate.providers[0], duplicate.providers[0]],
      }),
    ).toThrow(RpcHealthConfigurationError);

    const noFallback = configuration();
    expect(() =>
      validateReviewedRpcConfiguration({
        ...noFallback,
        providers: [noFallback.providers[0]],
      }),
    ).toThrow(RpcHealthConfigurationError);

    expect(() =>
      validateReviewedRpcConfiguration({
        ...configuration(),
        policy: {
          ...DEFAULT_RPC_QUORUM_POLICY,
          minimumAgreeingProviders: 99,
        },
      }),
    ).toThrow(RpcHealthConfigurationError);
  });
});

describe('RPC quorum evaluation', () => {
  it('accepts a healthy primary with full quorum', () => {
    const result = evaluateRpcQuorum(configuration(), healthy(), NOW);

    expect(result).toMatchObject({
      state: 'primary',
      quorumSatisfied: true,
      mutationAllowed: true,
      isUsingFallback: false,
      acceptedChainId: CHAIN_ID,
      acceptedReleaseId: RELEASE_ID,
      acceptedArtifactChecksum: CHECKSUM,
      acceptedHeadBlock: 100,
    });
    expect(result.agreeingProviderIds).toEqual([
      'primary',
      'fallback-1',
      'fallback-2',
    ]);
    expect(result.recovery).toMatchObject({
      role: 'status',
      ariaLive: 'polite',
      tone: 'success',
    });
  });

  it('fails over to reviewed fallbacks while retaining chain and release', () => {
    const observations = [
      observation('primary', { failure: 'timeout' }),
      observation('fallback-1'),
      observation('fallback-2'),
    ];

    const result = evaluateRpcQuorum(configuration(), observations, NOW);

    expect(result).toMatchObject({
      state: 'fallback',
      quorumSatisfied: true,
      mutationAllowed: true,
      isUsingFallback: true,
      acceptedChainId: CHAIN_ID,
      acceptedReleaseId: RELEASE_ID,
    });
    expect(result.rejectedProviders).toContainEqual({
      providerId: 'primary',
      role: 'primary',
      reason: 'provider-failure',
    });
  });

  it('rejects a wrong-chain endpoint and never changes the accepted chain', () => {
    const observations = [
      observation('primary', { chainId: 1 }),
      observation('fallback-1'),
      observation('fallback-2'),
    ];

    const result = evaluateRpcQuorum(configuration(), observations, NOW);

    expect(result.state).toBe('fallback');
    expect(result.acceptedChainId).toBe(CHAIN_ID);
    expect(result.rejectedProviders).toContainEqual({
      providerId: 'primary',
      role: 'primary',
      reason: 'wrong-chain',
    });
  });

  it('rejects a wrong-release fallback and fails closed without quorum', () => {
    const observations = [
      observation('primary', { failure: 'network-error' }),
      observation('fallback-1', { releaseId: 'v1.0.0' }),
      observation('fallback-2'),
    ];

    const result = evaluateRpcQuorum(configuration(), observations, NOW);

    expect(result).toMatchObject({
      state: 'degraded',
      quorumSatisfied: false,
      mutationAllowed: false,
      acceptedChainId: null,
      acceptedReleaseId: null,
      acceptedHeadBlock: null,
    });
    expect(result.rejectedProviders).toContainEqual({
      providerId: 'fallback-1',
      role: 'fallback',
      reason: 'wrong-release',
    });
  });

  it('does not count a lagging head toward quorum', () => {
    const observations = [
      observation('primary', { headBlock: 100 }),
      observation('fallback-1', { headBlock: 100 }),
      observation('fallback-2', { headBlock: 80 }),
    ];

    const result = evaluateRpcQuorum(configuration(), observations, NOW);

    expect(result.state).toBe('degraded');
    expect(result.quorumSatisfied).toBe(true);
    expect(result.mutationAllowed).toBe(true);
    expect(result.agreeingProviderIds).toEqual(['primary', 'fallback-1']);
    expect(result.rejectedProviders).toContainEqual({
      providerId: 'fallback-2',
      role: 'fallback',
      reason: 'lagging-head',
    });
  });

  it('fails closed when only one fresh provider responds', () => {
    const observations = [
      observation('primary', { failure: 'rate-limited' }),
      observation('fallback-1', { failure: 'timeout' }),
      observation('fallback-2'),
    ];

    const result = evaluateRpcQuorum(configuration(), observations, NOW);

    expect(result).toMatchObject({
      state: 'degraded',
      quorumSatisfied: false,
      mutationAllowed: false,
      acceptedHeadBlock: null,
    });
    expect(result.recovery.role).toBe('alert');
    expect(result.recovery.ariaLive).toBe('assertive');
  });

  it('reports stale when every observation is too old', () => {
    const observations = healthy({ observedAtMs: NOW - 60_000 });

    const result = evaluateRpcQuorum(configuration(), observations, NOW);

    expect(result).toMatchObject({
      state: 'stale',
      quorumSatisfied: false,
      mutationAllowed: false,
    });
    expect(result.rejectedProviders.every(
      (entry) => entry.reason === 'stale-observation',
    )).toBe(true);
  });

  it('fails closed on divergent receipts regardless of head agreement', () => {
    const observations = [
      observation('primary', {
        receipts: [
          { txHash: '0xtx1', blockHash: '0xblock-a', status: 'success' },
        ],
      }),
      observation('fallback-1', {
        receipts: [
          { txHash: '0xtx1', blockHash: '0xblock-b', status: 'success' },
        ],
      }),
      observation('fallback-2'),
    ];

    const result = evaluateRpcQuorum(configuration(), observations, NOW);

    expect(result).toMatchObject({
      state: 'unavailable',
      quorumSatisfied: false,
      mutationAllowed: false,
      acceptedHeadBlock: null,
      divergence: {
        reason: 'receipt',
        keys: ['0xtx1'],
        providerIds: ['fallback-1', 'primary'],
      },
    });
    expect(result.recovery.role).toBe('alert');
    expect(result.recovery.tone).toBe('danger');
  });

  it('fails closed on divergent projections', () => {
    const observations = [
      observation('primary', {
        projections: [{ key: 'claim:claim-1', fingerprint: 'state-a' }],
      }),
      observation('fallback-1', {
        projections: [{ key: 'claim:claim-1', fingerprint: 'state-b' }],
      }),
      observation('fallback-2'),
    ];

    const result = evaluateRpcQuorum(configuration(), observations, NOW);

    expect(result.state).toBe('unavailable');
    expect(result.quorumSatisfied).toBe(false);
    expect(result.divergence?.reason).toBe('projection');
    expect(result.divergence?.keys).toEqual(['claim:claim-1']);
  });

  it('rejects observations that claim a future timestamp', () => {
    const observations = [
      observation('primary', { observedAtMs: NOW + 120_000 }),
      observation('fallback-1'),
      observation('fallback-2'),
    ];

    const result = evaluateRpcQuorum(configuration(), observations, NOW);

    expect(result.rejectedProviders).toContainEqual({
      providerId: 'primary',
      role: 'primary',
      reason: 'malformed-observation',
    });
    expect(result.state).toBe('fallback');
  });
});

describe('RPC health presentation and privacy', () => {
  it('builds a bounded presentation without provider endpoints or keys', () => {
    const result = evaluateRpcQuorum(configuration(), healthy(), NOW);

    const presentation = buildRpcHealthPresentation(result, 3);

    expect(presentation).toMatchObject({
      state: 'primary',
      label: 'RPC primary healthy',
      quorumSummary: '3 of 3 reviewed providers agree',
      mutationSummary: 'Mutations available',
    });
    expect(JSON.stringify(presentation)).not.toMatch(/https?:\/\//);
    expect(JSON.stringify(presentation)).not.toContain('apiKey');
  });

  it('emits privacy-safe telemetry counts only', () => {
    const result = evaluateRpcQuorum(
      configuration(),
      [
        observation('primary', { chainId: 1 }),
        observation('fallback-1', { failure: 'timeout' }),
        observation('fallback-2'),
      ],
      NOW,
    );

    const telemetry = buildRpcHealthTelemetry(result, 3);
    const serialized = JSON.stringify(telemetry);

    expect(telemetry).toMatchObject({
      event: 'rpc_health',
      state: 'degraded',
      quorumSatisfied: false,
      mutationAllowed: false,
      agreeingProviderCount: 1,
      totalProviderCount: 3,
      rejectedReasonCounts: { 'wrong-chain': 1, 'provider-failure': 1 },
    });
    expect(serialized).not.toMatch(/https?:\/\//);
    expect(serialized).not.toContain('primary');
    expect(serialized).not.toContain('fallback-1');
    expect(serialized).not.toContain('apiKey');
  });

  it('keeps recovery guidance bounded for every state', () => {
    const scenarios = [
      evaluateRpcQuorum(configuration(), healthy(), NOW),
      evaluateRpcQuorum(
        configuration(),
        [
          observation('primary', { failure: 'timeout' }),
          observation('fallback-1'),
          observation('fallback-2'),
        ],
        NOW,
      ),
      evaluateRpcQuorum(
        configuration(),
        healthy({ observedAtMs: NOW - 60_000 }),
        NOW,
      ),
      evaluateRpcQuorum(configuration(), [], NOW),
    ];

    for (const result of scenarios) {
      expect(result.recovery.message.length).toBeGreaterThan(0);
      expect(result.recovery.message).not.toMatch(/https?:\/\//);
      expect(result.recovery.message).not.toMatch(/api[_-]?key/i);
      expect(result.recovery.actionLabel === null || result.recovery.actionLabel.length > 0).toBe(true);
    }
  });
});
