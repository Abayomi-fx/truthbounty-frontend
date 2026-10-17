/**
 * Public service-status adapter contract and queries.
 *
 * This module defines the typed boundary between the public /status
 * composition and the sanitized public telemetry API. It must never reuse
 * protected administrator health responses and must not leak any
 * protected diagnostic payload into the public bundle.
 *
 * UI-FE-036
 */

/** Status tones used across the public status surface. */
export type ServiceStatusTone =
  | 'operational'
  | 'degraded'
  | 'delayed'
  | 'stale'
  | 'unavailable'
  | 'unknown';

/** Freshness of an observation relative to its expected cadence. */
export type ObservationFreshnessLevel = 'fresh' | 'stale' | 'unknown';

/** Components that make up the public service status overview. */
export type ServiceComponentId =
  | 'web'
  | 'api'
  | 'rpc'
  | 'indexer'
  | 'database'
  | 'evidence-gateway'
  | 'manifest';

/** Operational dependency classification. Third-party dependencies
  * are labelled as dependencies, not guarantees. */
export type ServiceDependencyKind = 'first-party' | 'third-party';

/** Sanitized observation for a single service component. */
export interface ServiceComponentObservation {
  id: ServiceComponentId;
  name: string;
  description: string;
  dependencyKind: ServiceDependencyKind;
  /** Sanitized tone. Never derived from protected diagnostics. */
  tone: ServiceStatusTone;
  /** Human-readable status message suitable for public consumption. */
  message: string;
  /** Freshness of the underlying observation. */
  freshnessLevel: ObservationFreshnessLevel;
  /** ISO timestamp of the last observation, or null when not observed. */
  lastObservedAt: string | null;
  /** Optional lag description (e.g. indexer lag). */
  lagDescription?: string | null;
}

/** Sanitized public status observation for the whole surface. */
export interface PublicServiceStatusObservation {
  /** Overall tone derived from component observations. */
  overallTone: ServiceStatusTone;
  /** Overall human-readable message. */
  overallMessage: string;
  /** Whether the overall observation is partial (some components missing). */
  isPartial: boolean;
  /** Per-component observations. */
  components: ServiceComponentObservation[];
  /** Last successful observation timestamp for the whole surface. */
  lastObservedAt: string | null;
  /** Finalized block number at time of observation, or null. */
  finalizedBlock: number | null;
  /** Lag between chain head and last observed finalized block. */
  lagBlocks: number | null;
  /** Freshness of the overall observation. */
  freshnessLevel: ObservationFreshnessLevel;
}

/** Raw sanitized payload shape returned by the public telemetry API.
 * This is the only shape the adapter accepts. */
export interface PublicServiceStatusPayload {
  generatedAt: string;
  components: Array<{
    id: string;
    name: string;
    description: string;
    dependencyKind: string;
    tone: string;
    message: string;
    lastObservedAt: string | null;
    lagDescription?: string | null;
  }>;
  finalizedBlock: number | null;
  lagBlocks: number | null;
  lastObservedAt: string | null;
}

/** The components the public overview must always attempt to report. */
export const REQUIRED_SERVICE_COMPONENTS = [
  'web',
  'api',
  'rpc',
  'indexer',
  'database',
  'evidence-gateway',
  'manifest',
] as const satisfies readonly ServiceComponentId[];

/** Default descriptions for components that are missing from the
 * sanitized observation. These are not guarantees and must not be
 * presented as healthy. */
const COMPONENT_DEFAULTS: Record<ServiceComponentId, { name: string; description: string }> = {
  web: {
    name: 'Web application',
    description: 'Public web interface for truthbounty.',
  },
  api: {
    name: 'API',
    description: 'Public API serving claim and evidence reads.',
  },
  rpc: {
    name: 'RPC',
    description: 'Chain RPC endpoints used for read and write operations.',
  },
  indexer: {
    name: 'Indexer',
    description: 'Chain indexer feeding queries and lagtime observations.',
  },
  database: {
    name: 'Database',
    description: 'Primary data store for claims and metadata.',
  },
  'evidence-gateway': {
    name: 'Evidence gateway',
    description: 'Gateway for evidence upload and retrieval.',
  },
  manifest: {
    name: 'Manifest',
    description: 'Signed manifest publishing release and version metadata.',
  },
};

const VALID_TONES: readonly ServiceStatusTone[] = [
  'operational',
  'degraded',
  'delayed',
  'stale',
  'unavailable',
  'unknown',
];

const VALID_DEPENDENCY_KINDS: readonly ServiceDependencyKind[] = [
  'first-party',
  'third-party',
];

const VALID_COMPONENT_IDS = new Set<string>(REQUIRED_SERVICE_COMPONENTS);

/** Freshness threshold in milliseconds. Observations older than this
 * are considered stale. */
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

function isValidTone(value: unknown): value is ServiceStatusTone {
  return typeof value === 'string' && (VALID_TONES as readonly string[]).includes(value);
}

function isValidDependencyKind(
  value: unknown,
): value is ServiceDependencyKind {
  return (
    typeof value === 'string' &&
    (VALID_DEPENDENCY_KINDS as readonly string[]).includes(value)
  );
}

function isValidComponentId(value: unknown): value is ServiceComponentId {
  return typeof value === 'string' && VALID_COMPONENT_IDS.has(value);
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
}

function deriveFreshnessLevel(
  lastObservedAt: string | null,
  now: number,
): ObservationFreshnessLevel {
  if (!lastObservedAt) {
    return 'unknown';
  }
  const observed = Date.parse(lastObservedAt);
  if (Number.isNaN(observed)) {
    return 'unknown';
  }
  return now - observed > STALE_THRESHOLD_MS ? 'stale' : 'fresh';
}

/** Normalize a single component observation from the sanitized
 * payload. Missing or invalid data never appears healthy. */
function normalizeComponent(
  raw: PublicServiceStatusPayload['components'][number],
  now: number,
): ServiceComponentObservation | null {
  if (!isValidComponentId(raw.id)) {
    return null;
  }
  const id: ServiceComponentId = raw.id;
  const defaults = COMPONENT_DEFAULTS[id];
  const lastObservedAt = parseTimestamp(raw.lastObservedAt);
  const freshnessLevel = deriveFreshnessLevel(lastObservedAt, now);

  // A missing or stale observation must never report as healthy.
  let tone: ServiceStatusTone = isValidTone(raw.tone) ? raw.tone : 'unknown';
  if (freshnessLevel === 'stale' && tone === 'operational') {
    tone = 'stale';
  }
  if (freshnessLevel === 'unknown' && tone === 'operational') {
    tone = 'unknown';
  }

  const dependencyKind: ServiceDependencyKind = isValidDependencyKind(raw.dependencyKind)
    ? raw.dependencyKind
    : 'third-party';

  return {
    id,
    name: typeof raw.name === 'string' && raw.name.length > 0 ? raw.name : defaults.name,
    description:
      typeof raw.description === 'string' && raw.description.length > 0
        ? raw.description
        : defaults.description,
    dependencyKind,
    tone,
    message:
      typeof raw.message === 'string' && raw.message.length > 0
        ? raw.message
        : 'No public observation available.',
    freshnessLevel,
    lastObservedAt,
    lagDescription:
      typeof raw.lagDescription === 'string' && raw.lagDescription.length > 0
        ? raw.lagDescription
        : null,
  };
}

/** Build a missing component observation. This is always non-healthy. */
function missingComponent(
  id: ServiceComponentId,
): ServiceComponentObservation {
  const defaults = COMPONENT_DEFAULTS[id];
  return {
    id,
    name: defaults.name,
    description: defaults.description,
    dependencyKind: 'third-party',
    tone: 'unknown',
    message: 'No public observation available.',
    freshnessLevel: 'unknown',
    lastObservedAt: null,
    lagDescription: null,
  };
}

const TONE_PRIORITY: readonly ServiceStatusTone[] = [
  'unavailable',
  'degraded',
  'delayed',
  'stale',
  'unknown',
  'operational',
];

function deriveOverallTone(components: ServiceComponentObservation[]): ServiceStatusTone {
  if (components.length === 0) {
    return 'unknown';
  }
  for (const tone of TONE_PRIORITY) {
    if (components.some((c) => c.tone === tone)) {
      return tone;
    }
  }
  return 'unknown';
}

function deriveOverallMessage(tone: ServiceStatusTone): string {
  switch (tone) {
    case 'operational':
      return 'All observed services are operational.';
    case 'degraded':
      return 'Some services are degraded.';
    case 'delayed':
      return 'Some services are experiencing delays.';
    case 'stale':
      return 'Observations are stale.';
    case 'unavailable':
      return 'Some services are unavailable.';
    case 'unknown':
    default:
      return 'Service status is unknown.';
  }
}

/** Adapt a sanitized public telemetry payload into the typed public
 * overview observation. Missing or stale components never appear
 * healthy. */
export function adaptPublicServiceStatus(
  payload: PublicServiceStatusPayload | null | undefined,
  now: number = Date.now(),
): PublicServiceStatusObservation {
  if (!payload) {
    const components = REQUIRED_SERVICE_COMPONENTS.map(missingComponent);
    return {
      overallTone: 'unknown',
      overallMessage: deriveOverallMessage('unknown'),
      isPartial: true,
      components,
      lastObservedAt: null,
      finalizedBlock: null,
      lagBlocks: null,
      freshnessLevel: 'unknown',
    };
  }

  const normalizedById = new Map<ServiceComponentId, ServiceComponentObservation>();
  const sanitizedComponents = Array.isArray(payload.components)
    ? payload.components
    : [];
  for (const raw of sanitizedComponents) {
    const normalized = normalizeComponent(raw, now);
    if (normalized && !normalizedById.has(normalized.id)) {
      normalizedById.set(normalized.id, normalized);
    }
  }

  const components: ServiceComponentObservation[] = REQUIRED_SERVICE_COMPONENTS.map(
    (id) => normalizedById.get(id) ?? missingComponent(id),
  );

  const isPartial = components.some((c) => c.tone === 'unknown');
  const overallTone = deriveOverallTone(components);
  const lastObservedAt = parseTimestamp(payload.lastObservedAt);
  const finalizedBlock =
    typeof payload.finalizedBlock === 'number' &&
    Number.isFinite(payload.finalizedBlock)
      ? payload.finalizedBlock
      : null;
  const lagBlocks =
    typeof payload.lagBlocks === 'number' && Number.isFinite(payload.lagBlocks)
      ? payload.lagBlocks
      : null;

  return {
    overallTone,
    overallMessage: deriveOverallMessage(overallTone),
    isPartial,
    components,
    lastObservedAt,
    finalizedBlock,
    lagBlocks,
    freshnessLevel: deriveFreshnessLevel(lastObservedAt, now),
  };
}

/** Fetch the sanitized public service-status payload. This must only
 * ever call the public telemetry endpoint. */
export async function fetchPublicServiceStatus(
  signal?: AbortSignal,
): Promise<PublicServiceStatusPayload> {
  const response = await fetch('/api/status/public', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Public service status request failed with status ${response.status}`,
    );
  }

  return (response.json() as Promise<PublicServiceStatusPayload>);
}
