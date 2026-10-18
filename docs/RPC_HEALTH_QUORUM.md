# RPC Health, Quorum, and Failover Presentation (UI-FE-077)

This boundary evaluates reviewed RPC health observations against a quorum and
confidence policy. It never treats an endpoint as authority, never silently
switches chain or release, and blocks mutations when quorum cannot be trusted.

Implementation: [`src/lib/rpc-health/`](../src/lib/rpc-health)

## Reviewed configuration

```ts
interface ReviewedRpcConfiguration {
  expectedChainId: number;
  expectedReleaseId: string;
  expectedArtifactChecksum: string;
  providers: ReviewedRpcProvider[]; // primary + fallback(s)
  policy: RpcQuorumPolicy;
}
```

Provider endpoints and API keys are **not** part of the configuration passed to
this boundary. Providers are identified by non-sensitive labels and reviewed
chain/release metadata. Callers keep endpoint configuration in the canonical
chain config.

## Quorum policy

`DEFAULT_RPC_QUORUM_POLICY`:

| Setting | Default |
|---|---|
| `minimumAgreeingProviders` | 2 |
| `maxHeadLagBlocks` | 5 |
| `maxObservationAgeMs` | 30 000 |
| `requireReleaseMatch` | `true` |

Configuration is validated before evaluation: duplicate provider ids, missing
primary/fallback roles, mismatched reviewed chain/release, and out-of-range
policy values throw `RpcHealthConfigurationError`.

## Observation rules

A provider counts toward quorum only when:

1. it is in the reviewed provider list;
2. it did not report a timeout/rate-limit/network/server/unavailable failure;
3. its chain id matches the expected chain;
4. its release id and artifact checksum match the expected release;
5. its observation is not stale and not from an implausible future timestamp;
6. its head is within `maxHeadLagBlocks` of the best observed head.

Any provider that fails a rule is recorded in `rejectedProviders` with a
machine-readable reason. It never contributes to the accepted chain, release, or
head.

## States and mutation policy

| State | Meaning | Mutations |
|---|---|---|
| `primary` | Quorum satisfied with the primary; no provider rejected | Allowed |
| `fallback` | Quorum satisfied using reviewed fallback(s); primary not usable | Allowed while quorum holds |
| `degraded` | Quorum satisfied with some providers rejected/lagging, **or** partial quorum without enough agreement | Allowed only if `quorumSatisfied` |
| `stale` | Observations are stale/lagging so no quorum can be formed | Blocked |
| `unavailable` | No reviewed provider can satisfy quorum, or receipts/projections diverge | Blocked |

The accepted chain id, release id, and artifact checksum are always the reviewed
values. A fallback can never change them.

## Receipt/projection divergence

Observations may include sanitized receipt fingerprints
(`txHash`, `blockHash`, `status`) or projection fingerprints (`key`,
`fingerprint`). If reviewed providers report different fingerprints for the same
entity, the result fails closed:

- `state: 'unavailable'`
- `quorumSatisfied: false`
- `mutationAllowed: false`
- `divergence` identifies the reason and entity keys (never raw payloads)

## Presentation

`buildRpcHealthPresentation(result, totalProviderCount)` returns:

- state label;
- bounded recovery message (no endpoints/keys);
- `role`/`aria-live` (`status`/`polite` for healthy/fallback/degraded-with-quorum;
  `alert`/`assertive` for blocked/stale/unavailable/divergence);
- quorum summary and mutation summary.

`RpcHealthBanner`
([`src/components/common/RpcHealthBanner.tsx`](../src/components/common/RpcHealthBanner.tsx))
renders that model with a text label, quorum, mutation status, and an optional
retry action. Meaning never depends on colour alone.

## Privacy-safe telemetry

`buildRpcHealthTelemetry` emits only:

- state, quorum/mutation/fallback booleans;
- accepted chain id and release id;
- agreeing/total provider counts;
- rejection reason counts;
- divergence reason.

It never includes provider ids, endpoints, API keys, raw observations, receipt
payloads, or projection payloads.

## Tests

`src/lib/rpc-health/__tests__/quorum.test.ts` covers:

- reviewed configuration validation;
- healthy primary, fallback failover;
- wrong-chain endpoint and wrong-release fallback;
- lagging head, partial quorum, stale observations;
- timeout/rate-limit provider failures;
- divergent receipts and projections;
- mutation blocking and bounded recovery guidance;
- privacy-safe telemetry (no endpoints/keys).
