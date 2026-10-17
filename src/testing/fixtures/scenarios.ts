/**
 * UI-FE-088 — canonical scenario catalogue.
 *
 * One named, reusable fixture per canonical system state, composed from the
 * typed factories. This module is the *single source of truth* shared by
 * Storybook (`scenarios.stories.tsx`), Jest (`__tests__`), and Playwright
 * (`e2e/canonical-scenarios.spec.ts` via `e2e/support/scenarios.ts`).
 *
 * Shape rules (issue constraints):
 *  - `contract` holds contract/chain-derived values (release manifest,
 *    transaction receipt, finality, raw on-chain verification).
 *  - `projection` holds API projection values (claims list envelope, freshness,
 *    verification projections, dispute read model).
 *  - `ui` holds the presentation-side state (view state, capabilities, route
 *    access, incident telemetry, legal content version).
 *
 * Every scenario describes the *same* underlying entities (claim-0001 and its
 * siblings) in a different system state, so a state change never silently
 * changes the data underneath it.
 */

import type { Claim } from '../../app/types/claim';
import type {
  ClaimListItem,
  ClaimsListErrorCode,
  ClaimsListViewState,
} from '../../app/types/claim-list';
import type { ApiHealthResponse } from '../../app/types/api-freshness';
import type { Transaction } from '../../app/types/transaction';
import type { FinalityResult } from '../../app/types/finality';
import type {
  OnChainVerification,
  VerificationProjection,
} from '../../app/types/verification';
import type { DisputeContext, DisputeTransaction } from '../../app/types/dispute';
import type { ReleaseManifest } from '../../lib/contracts/types';
import type { TelemetryEvent } from '../../lib/telemetry';
import type {
  AppShellCapabilities,
  AppShellRoles,
  RouteAccessStatus,
} from '../../context/AppShellContext';

import { createFixtureContext, FIXTURE_NETWORK, type FixtureNetwork } from './deterministic';
import {
  makeApiHealthResponse,
  makeCapabilities,
  makeClaimListItem,
  makeClaimSet,
  makeClaimsListEnvelope,
  makeDeniedCapabilities,
  makeDisputeContext,
  makeDisputeTransaction,
  makeIncidentEvent,
  makeLegalContentVersion,
  makeOnChainVerification,
  makeReleaseManifest,
  makeRoles,
  makeRouteAccess,
  makeTransaction,
  makeVerificationProjection,
  type LegalContentVersion,
} from './factories';
import { makeFinality } from './factories/transactions';

/**
 * The canonical system states from the issue scope. Order is stable and is
 * asserted by tests and by the Storybook/Playwright consumers.
 */
export const CANONICAL_SCENARIOS = [
  'loading',
  'empty',
  'stale',
  'denied',
  'offline',
  'unavailable',
  'reverted',
  'replaced',
  'indexing-delayed',
  'reorged',
  'finalized',
] as const;

export type CanonicalScenarioId = (typeof CANONICAL_SCENARIOS)[number];

/** Canonical, user-visible projection failure carried by `unavailable`. */
export interface ProjectionFailure {
  code: ClaimsListErrorCode;
  message: string;
}

export interface CanonicalScenario {
  /** Stable scenario id — the reusable fixture name. */
  id: CanonicalScenarioId;
  /** Human-facing scenario name. */
  label: string;
  /** What this state reproduces and why it matters. */
  description: string;
  /** Pinned network context (release chain). */
  network: FixtureNetwork;
  /** Contract/chain-derived values — never an API projection. */
  contract: {
    release: ReleaseManifest;
    transaction: Transaction;
    finality: FinalityResult;
    onChainVerification: OnChainVerification;
  };
  /** API projection values — never contract-derived. */
  projection: {
    /** Full claim records backing the list view (empty when list is empty). */
    claims: Claim[];
    claimsList: ClaimsListEnvelope | null;
    claimsListError: ProjectionFailure | null;
    claim: Claim;
    verifications: VerificationProjection[];
    dispute: DisputeContext;
    disputeSubmission: DisputeTransaction;
    freshness: ApiHealthResponse;
  };
  /** Presentation-side state. */
  ui: {
    viewState: ClaimsListViewState;
    capabilities: AppShellCapabilities;
    roles: AppShellRoles;
    routeAccess: RouteAccessStatus;
    incident: TelemetryEvent;
    legalContent: LegalContentVersion;
  };
}

const SCENARIO_LABELS: Record<CanonicalScenarioId, string> = {
  loading: 'Loading',
  empty: 'Empty',
  stale: 'Stale',
  denied: 'Denied',
  offline: 'Offline',
  unavailable: 'Unavailable',
  reverted: 'Reverted',
  replaced: 'Replaced',
  'indexing-delayed': 'Indexing delayed',
  reorged: 'Reorged',
  finalized: 'Finalized',
};

const SCENARIO_DESCRIPTIONS: Record<CanonicalScenarioId, string> = {
  loading: 'Initial fetch is in flight: no projection exists yet and the surface must show a busy state instead of fabricated data.',
  empty: 'The read succeeded and returned zero records; show a neutral empty state with an actionable next step.',
  stale: 'Data exists but the projection is older than the 60s freshness bound; surface the age instead of implying it is current.',
  denied: 'The wallet, chain, or role check fails closed: no capability is granted and no protected data is rendered.',
  offline: 'The network is unreachable and the view is served from cache with an explicit offline notice and retry.',
  unavailable: 'The projection endpoint is unavailable (5xx); fail closed with a user-visible, retryable error.',
  reverted: 'The transaction was mined but its receipt status is 0x0: the chain state did not change and the UI must say so.',
  replaced: 'A same-nonce transaction replaced the original before inclusion; the original must be shown as replaced, never as confirmed.',
  'indexing-delayed': 'Finalized on chain but not yet indexed: the indexer cursor lags the head and the projection is marked stale.',
  reorged: 'A previously observed block was removed by a chain reorganisation; reconcile and alert instead of trusting the old receipt.',
  finalized: 'The receipt is below the finalized head: the outcome is durable and may be presented as final.',
};

/**
 * Build one canonical scenario. Pure: calling it twice with the same id
 * produces structurally identical output (asserted by the determinism test).
 */
export function buildScenario(id: CanonicalScenarioId): CanonicalScenario {
  const ctx = createFixtureContext();
  const claimId = 'claim-0001';

  const claims = makeClaimSet(3, ctx);
  const items: ClaimListItem[] = claims.map((_claim, index) => makeClaimListItem({ index, ctx }));
  const baseClaimsList = makeClaimsListEnvelope({ items, ctx });

  const base: CanonicalScenario = {
    id,
    label: SCENARIO_LABELS[id],
    description: SCENARIO_DESCRIPTIONS[id],
    network: FIXTURE_NETWORK,
    contract: {
      release: makeReleaseManifest(),
      transaction: makeTransaction('confirmed', { claimId, ctx }),
      finality: makeFinality('safe', { claimId, ctx }),
      onChainVerification: makeOnChainVerification({ index: 0, ctx }),
    },
    projection: {
      claims,
      claimsList: baseClaimsList,
      claimsListError: null,
      claim: claims[0],
      verifications: [
        makeVerificationProjection({ index: 0, claimId, ctx }),
        makeVerificationProjection({ index: 1, claimId, ctx }),
      ],
      dispute: makeDisputeContext({ claimId, ctx }),
      disputeSubmission: makeDisputeTransaction({ claimId, ctx, status: 'PENDING' }),
      freshness: makeApiHealthResponse({ ctx }),
    },
    ui: {
      viewState: 'ready',
      capabilities: makeCapabilities(),
      roles: makeRoles(),
      routeAccess: makeRouteAccess(),
      incident: makeIncidentEvent({
        key: id,
        severity: 'info',
        message: `Fixture scenario "${id}" is in a healthy ready state.`,
        ctx,
      }),
      legalContent: makeLegalContentVersion({ ctx }),
    },
  };

  switch (id) {
    case 'loading': {
      return {
        ...base,
        description: SCENARIO_DESCRIPTIONS.loading,
        contract: {
          ...base.contract,
          transaction: makeTransaction('submitted', { claimId, ctx }),
          finality: makeFinality('observed', { claimId, ctx }),
        },
        projection: {
          ...base.projection,
          claimsList: null,
        },
        ui: {
          ...base.ui,
          viewState: 'loading',
          incident: makeIncidentEvent({
            key: id,
            severity: 'info',
            message: 'Initial claims projection fetch is in flight.',
            ctx,
          }),
        },
      };
    }
    case 'empty': {
      return {
        ...base,
        projection: {
          ...base.projection,
          claims: [],
          claimsList: makeClaimsListEnvelope({ items: [], ctx }),
        },
        ui: {
          ...base.ui,
          viewState: 'empty',
          incident: makeIncidentEvent({
            key: id,
            severity: 'info',
            message: 'Claims projection returned zero records.',
            ctx,
          }),
        },
      };
    }
    case 'stale': {
      return {
        ...base,
        projection: {
          ...base.projection,
          claimsList: makeClaimsListEnvelope({
            items,
            freshness: 'stale',
            generatedAt: ctx.isoAt(-120_000),
            reason: 'Projection is older than the 60s freshness bound (CLAIMS_LIST_DEFAULTS.staleAfterMs).',
            ctx,
          }),
          freshness: makeApiHealthResponse({
            lag: 64,
            indexedHeight: 6_199_936,
            lastUpdate: ctx.isoAt(-120_000),
            ctx,
          }),
        },
        ui: {
          ...base.ui,
          viewState: 'ready-stale',
          incident: makeIncidentEvent({
            key: id,
            severity: 'warning',
            message: 'Claims projection exceeded the freshness bound; data shown as stale.',
            ctx,
          }),
        },
      };
    }
    case 'denied': {
      return {
        ...base,
        ui: {
          ...base.ui,
          capabilities: makeDeniedCapabilities(),
          roles: makeRoles({
            isVerifier: false,
            isAdmin: false,
            isClaimant: false,
            isGuest: true,
          }),
          routeAccess: makeRouteAccess({ reason: 'admin_role_required' }),
          incident: makeIncidentEvent({
            key: id,
            severity: 'info',
            message: 'Route access denied: admin role required.',
            ctx,
          }),
        },
      };
    }
    case 'offline': {
      return {
        ...base,
        projection: {
          ...base.projection,
          claimsList: makeClaimsListEnvelope({
            items,
            freshness: 'stale',
            generatedAt: ctx.isoAt(-180_000),
            reason: 'Served from cache while the client is offline.',
            ctx,
          }),
          freshness: makeApiHealthResponse({
            lag: 180,
            indexedHeight: 6_199_820,
            lastUpdate: ctx.isoAt(-180_000),
            indexerStatus: 'unavailable',
            indexerError: 'network request blocked: client is offline',
            rpcStatus: 'unavailable',
            degraded: {
              degradationReason: 'partial_outage',
              lastHealthyUpdate: ctx.isoAt(-180_000),
            },
            ctx,
          }),
        },
        ui: {
          ...base.ui,
          viewState: 'ready-stale',
          incident: makeIncidentEvent({
            key: id,
            severity: 'warning',
            message: 'Client is offline; serving cached projection with an offline notice.',
            ctx,
          }),
        },
      };
    }
    case 'unavailable': {
      return {
        ...base,
        projection: {
          ...base.projection,
          claimsList: null,
          claimsListError: {
            code: 'PROJECTION_UNAVAILABLE',
            message: 'Claims projection endpoint returned 503 Service Unavailable.',
          },
          freshness: makeApiHealthResponse({
            lag: 420,
            indexedHeight: 6_199_580,
            lastUpdate: ctx.isoAt(-600_000),
            indexerStatus: 'unavailable',
            indexerError: 'projection store unavailable',
            degraded: {
              degradationReason: 'dependency_failure',
              estimatedRecovery: ctx.isoAt(600_000),
            },
            ctx,
          }),
        },
        ui: {
          ...base.ui,
          viewState: 'error',
          incident: makeIncidentEvent({
            key: id,
            severity: 'error',
            message: 'Claims projection unavailable: request failed with 503.',
            ctx,
          }),
        },
      };
    }
    case 'reverted': {
      return {
        ...base,
        contract: {
          ...base.contract,
          transaction: makeTransaction('reverted', { claimId, ctx }),
          // Finalized but receipt status 0x0: finality holds, success does not.
          finality: makeFinality('finalized', { claimId, receiptStatus: '0x0', ctx }),
        },
        projection: {
          ...base.projection,
          disputeSubmission: makeDisputeTransaction({
            claimId,
            ctx,
            status: 'REVERTED',
          }),
        },
        ui: {
          ...base.ui,
          incident: makeIncidentEvent({
            key: id,
            severity: 'error',
            message: 'Transaction reverted on chain; no protocol state changed.',
            ctx,
          }),
        },
      };
    }
    case 'replaced': {
      return {
        ...base,
        contract: {
          ...base.contract,
          transaction: makeTransaction('replaced', { claimId, ctx }),
          finality: makeFinality('observed', { claimId, ctx }),
        },
        projection: {
          ...base.projection,
          disputeSubmission: makeDisputeTransaction({
            claimId,
            ctx,
            status: 'REPLACED',
          }),
        },
        ui: {
          ...base.ui,
          incident: makeIncidentEvent({
            key: id,
            severity: 'warning',
            message: 'Transaction replaced by a same-nonce transaction before inclusion.',
            ctx,
          }),
        },
      };
    }
    case 'indexing-delayed': {
      return {
        ...base,
        contract: {
          ...base.contract,
          transaction: makeTransaction('indexing', { claimId, ctx }),
          finality: makeFinality('finalized', { claimId, ctx }),
        },
        projection: {
          ...base.projection,
          claimsList: makeClaimsListEnvelope({
            items,
            freshness: 'stale',
            generatedAt: ctx.isoAt(-240_000),
            reason: 'Indexer cursor is behind the chain head; rows may be missing.',
            ctx,
          }),
          freshness: makeApiHealthResponse({
            lag: 342,
            indexedHeight: 6_199_658,
            lastUpdate: ctx.isoAt(-240_000),
            indexerStatus: 'degraded',
            indexerError: 'indexer cursor behind chain head',
            degraded: {
              degradationReason: 'indexer_lag',
              estimatedRecovery: ctx.isoAt(300_000),
            },
            ctx,
          }),
        },
        ui: {
          ...base.ui,
          viewState: 'ready-stale',
          incident: makeIncidentEvent({
            key: id,
            severity: 'warning',
            message: 'Indexing delayed: finalized on chain, not yet indexed.',
            ctx,
          }),
        },
      };
    }
    case 'reorged': {
      return {
        ...base,
        contract: {
          ...base.contract,
          // The previously observed receipt is still what the UI saw last.
          transaction: makeTransaction('confirmed', { claimId, ctx }),
          finality: makeFinality('reorged', { claimId, ctx }),
        },
        ui: {
          ...base.ui,
          incident: makeIncidentEvent({
            key: id,
            severity: 'warning',
            message: 'Chain reorganisation detected; reconciling the previous receipt.',
            ctx,
          }),
        },
      };
    }
    case 'finalized': {
      return {
        ...base,
        contract: {
          ...base.contract,
          transaction: makeTransaction('finalized', { claimId, ctx }),
          finality: makeFinality('finalized', { claimId, ctx }),
        },
        projection: {
          ...base.projection,
          disputeSubmission: makeDisputeTransaction({
            claimId,
            ctx,
            status: 'CONFIRMED',
          }),
        },
        ui: {
          ...base.ui,
          incident: makeIncidentEvent({
            key: id,
            severity: 'info',
            message: 'Transaction finalized below the finalized head.',
            ctx,
          }),
        },
      };
    }
    default: {
      const exhaustive: never = id;
      throw new Error(`Unknown canonical scenario "${String(exhaustive)}"`);
    }
  }
}

/** Build every canonical scenario, in catalogue order. */
export function buildScenarioCatalogue(): Record<CanonicalScenarioId, CanonicalScenario> {
  return Object.fromEntries(
    CANONICAL_SCENARIOS.map((id) => [id, buildScenario(id)]),
  ) as Record<CanonicalScenarioId, CanonicalScenario>;
}

/**
 * The canonical catalogue, built once per module instance. `getScenario` is
 * the accessor consumers should use.
 */
export const scenarios: Record<CanonicalScenarioId, CanonicalScenario> =
  buildScenarioCatalogue();

/** Look up one canonical scenario by id. */
export function getScenario(id: CanonicalScenarioId): CanonicalScenario {
  const scenario = scenarios[id];
  if (!scenario) {
    throw new Error(`Unknown canonical scenario "${String(id)}"`);
  }
  return scenario;
}

/** Scenario ids in canonical order — handy for parameterised tests/stories. */
export const SCENARIO_IDS: readonly CanonicalScenarioId[] = CANONICAL_SCENARIOS;
