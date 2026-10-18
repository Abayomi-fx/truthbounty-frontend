/**
 * UI-FE-088 — API freshness / dependency-health factory.
 *
 * Conforms to the pinned types in `src/app/types/api-freshness.ts`. Drives the
 * canonical `stale`, `offline`, `unavailable`, and `indexing-delayed`
 * scenarios: lag and dependency status are set explicitly, never sampled.
 */

import type {
  ApiHealthResponse,
  DependencyHealth,
  DependencyStatus,
  DegradedStateMetadata,
} from '../../../app/types/api-freshness';
import { KNOWN_DEPENDENCIES } from '../../../app/types/api-freshness';
import { createFixtureContext, type FixtureContext } from '../deterministic';

export interface MakeApiHealthOptions {
  /** Chain head minus indexed height, in blocks. Default 10 (healthy). */
  lag?: number;
  indexedHeight?: number;
  chainHeadHeight?: number;
  /** ISO timestamp of the last successful indexer sync. */
  lastUpdate?: string;
  /** Status applied to the `indexer` dependency. */
  indexerStatus?: DependencyStatus;
  /** Error recorded on the `indexer` dependency, when degraded. */
  indexerError?: string;
  /** Status applied to the `rpc_provider` dependency. */
  rpcStatus?: DependencyStatus;
  /** Degradation metadata patch. */
  degraded?: Partial<DegradedStateMetadata>;
  ctx?: FixtureContext;
}

const DEFAULT_CHAIN_HEAD = 6_200_000;
const DEFAULT_LATENCY: Record<string, number> = {
  indexer: 42,
  rpc_provider: 96,
  contract_registry: 8,
  websocket: 15,
  subgraph: 74,
};

/**
 * Build an `ApiHealthResponse`. Healthy by default; callers pass lag and
 * dependency patches to reach a degraded state.
 */
export function makeApiHealthResponse(
  options: MakeApiHealthOptions = {},
): ApiHealthResponse {
  const ctx = options.ctx ?? createFixtureContext();
  const chainHeadHeight = options.chainHeadHeight ?? DEFAULT_CHAIN_HEAD;
  const lag = options.lag ?? 10;
  const lastUpdate = options.lastUpdate ?? ctx.nowIso;
  const indexedHeight = options.indexedHeight ?? chainHeadHeight - lag;

  const dependencies: DependencyHealth[] = KNOWN_DEPENDENCIES.map((name) => {
    const isIndexer = name === 'indexer';
    const isRpc = name === 'rpc_provider';
    const status: DependencyStatus = isIndexer
      ? (options.indexerStatus ?? 'healthy')
      : isRpc
        ? (options.rpcStatus ?? 'healthy')
        : 'healthy';
    const error = isIndexer ? options.indexerError : undefined;

    return {
      name,
      status,
      lastSuccessfulUpdate: status === 'healthy' ? lastUpdate : ctx.isoAt(-600_000),
      ...(error === undefined ? {} : { error }),
      latencyMs: DEFAULT_LATENCY[name] ?? 25,
    };
  });

  const isDegraded = dependencies.some((dependency) => dependency.status !== 'healthy');

  const degradedState: DegradedStateMetadata = {
    isDegraded: isDegraded || (options.degraded?.isDegraded ?? false),
    ...(options.degraded?.degradationReason === undefined
      ? {}
      : { degradationReason: options.degraded.degradationReason }),
    affectedDependencies: options.degraded?.affectedDependencies ??
      dependencies
        .filter((dependency) => dependency.status !== 'healthy')
        .map((dependency) => dependency.name),
    ...(options.degraded?.lastHealthyUpdate === undefined
      ? {}
      : { lastHealthyUpdate: options.degraded.lastHealthyUpdate }),
    ...(options.degraded?.estimatedRecovery === undefined
      ? {}
      : { estimatedRecovery: options.degraded.estimatedRecovery }),
  };

  return {
    freshness: {
      indexedHeight,
      finalizedHeight: indexedHeight - 30,
      lastUpdate,
      lag,
      chainHeadHeight,
      dependencies,
    },
    degradedState,
    fetchedAt: ctx.nowIso,
  };
}
