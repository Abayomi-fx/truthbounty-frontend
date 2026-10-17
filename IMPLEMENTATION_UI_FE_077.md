# UI-FE-077 — Build RPC Health, Quorum, and Failover Presentation

**Issue:** [#648](https://github.com/DigiNodes/truthbounty-frontend/issues/648)
**Branch:** `feat/ui-fe-077-rpc-health-quorum-failover`
**Base:** upstream `main`

## Overview

Adds a reusable reviewed-RPC health boundary that distinguishes primary,
fallback, degraded, stale, and unavailable states, verifies chain/release before
accepting fallback data, fails closed on divergent receipts/projections, and
blocks mutations whenever quorum/confidence is not satisfied.

## Files

- **[ADD]** `src/lib/rpc-health/types.ts`
  - Reviewed provider/config/policy types, observations, result states,
    recovery guidance, presentation, and telemetry contracts.

- **[ADD]** `src/lib/rpc-health/quorum.ts`
  - Reviewed configuration validation.
  - Quorum evaluation across primary/fallback providers.
  - Chain/release/checksum verification before accepting fallback data.
  - Stale observation and lagging-head rejection.
  - Divergent receipt/projection detection.
  - Mutation gating (`mutationAllowed` only with satisfied quorum).
  - Bounded recovery guidance and accessible presentation model.
  - Privacy-safe telemetry (state/counts only; no endpoints/keys/provider ids).

- **[ADD]** `src/lib/rpc-health/index.ts`
- **[ADD]** `src/components/common/RpcHealthBanner.tsx`
  - Accessible `role=status`/`alert` presentation with quorum and mutation
    summaries plus optional retry action.

- **[ADD]** `src/lib/rpc-health/__tests__/quorum.test.ts`
- **[ADD]** `src/components/common/__tests__/RpcHealthBanner.test.tsx`
- **[ADD]** `docs/RPC_HEALTH_QUORUM.md`
- **[MODIFY]** `docs/ux/RPC_API_FALLBACK.md`, `docs/ARCHITECTURE.md`

## Acceptance Criteria

| Criterion | Evidence |
|---|---|
| Fallback cannot silently change chain or release | Accepted chain/release/checksum are always reviewed values; wrong-chain/wrong-release providers are rejected |
| Divergent receipts/projections fail closed | Divergence returns `unavailable`, clears accepted head, and blocks mutations |
| Users see bounded recovery guidance | `RpcRecoveryGuidance` + `RpcHealthBanner` provide state-specific copy and retry action without endpoints/keys |
| Provider endpoints/keys are not leaked unnecessarily | Presentation and telemetry contain no endpoints or keys; telemetry is counts/state only |

## Required Tests

- Wrong-chain endpoint: covered.
- Lagging head: covered.
- Divergent receipt: covered (plus projection divergence).
- Timeout / rate limit / failover: covered.
- Recovery: covered via state transitions and bounded guidance.
- Privacy-safe telemetry: covered (asserts no endpoints, provider ids, or keys).

## Verification

```text
Test Suites: 2 passed, 2 total
Tests:       18 passed, 18 total
```

Targeted TypeScript check of the new module, component, and tests completed with
0 errors.

Full-repo `tsc`/ESLint remain blocked by pre-existing `main` failures unrelated
to this change (broken `src/app/queries/queryKeys.ts` syntax and the
`eslint-plugin-react@7.37.5` / ESLint 10 incompatibility).

## Non-Goals

- No board redesign.
- No API/contract behavior invented.
- No provider endpoint or credential changes.
- No `Stellar Wave` label changes.
