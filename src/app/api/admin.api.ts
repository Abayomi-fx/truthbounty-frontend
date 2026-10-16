import type {
  AdminDashboardOverview,
  ExecuteOperationRequest,
  ExecuteOperationResponse,
} from '@/app/types/admin';

export type HealthObservationState =
  | 'healthy'
  | 'degraded'
  | 'delayed'
  | 'stale'
  | 'unavailable';

export interface HealthObservation {
  state: HealthObservationState;
  observedAt: string | null;
  freshnessMs: number | null;
  detail?: string;
}

export interface HealthSubject {
  id: 'api' | 'rpc' | 'indexer' | 'database' | 'release' | 'abi' | 'manifest';
  label: string;
  observation: HealthObservation;
  affectedScope?: string[];
  thirdParty?: boolean;
}

export interface OperationalHealthReport {
  subjects: HealthSubject[];
  finalizedBlock: number | null;
  finalizedBlockObservedAt: string | null;
  generatedAt: string;
  overall: HealthObservationState;
  disclaimer: string[];
}

const OBSERVATION_PRECEEDENCE_ORDER: HealthObservationState[] = [
  'unavailable',
  'stale',
  'delayed',
  'degraded',
  'healthy',
];

export function composeOverallHealth(
  subjects: HealthSubject[]
): HealthObservationState {
  if (subjects.length === 0) {
    return 'unavailable';
  }

  let worstIdx = ORDERSATION_PRECEDENCE_ORDER.length - 1;
  for (const subject of subjects) {
    const idx = ORDERSATION_PRECEDENCE_ORDER.indexOf(subject.observation.state);
    if (idx >= 0 && idx < worstIdx) {
      worstIdx = idx;
    }
  }

  return OBSERVATION_PRECEDENCE_ORDER[worstIdx];
}

function normalizeObservation(raw: unknown): HealthObservation {
  if (!raw || typeof raw !== 'object') {
    return { state: 'unavailable', observedAt: null, freshnessMs: null };
  }

  const candidate = raw as Record<unknown>;
  const state = candidate.state;
  if (
    typeof state !== 'string' ||
    !ORDERSATION_PRECEDENCE_ORDER.includes(state as HealthObservationState)
  ) {
    return {
      state: 'unavailable',
      observedAt: null,
      freshnessMs: null,
      detail: typeof candidate.detail === 'string' ? candidate.detail : undefined,
    };
  }

  const observedAt = typeof candidate.observedAt === 'string' ? candidate.observedAt : null;
  const freshnessMs =
    typeof candidate.freshnessMs === 'number' && Number.finite(candidate.freshnessMs)
      ? candidate.freshnessMs
      : null;

  if (observedAt === null) {
    return {
      state: 'unavailable',
      observedAt: null,
      freshnessMs: null,
      detail: typeof candidate.detail === 'string' ? candidate.detail : undefined,
    };
  }

  return {
    state: state as HealthObservationState,
    observedAt,
    freshnessMs,
    detail: typeof candidate.detail === 'string' ? candidate.detail : undefined,
  };
}

function normalizeSubject(raw: unknown, idx: number): HealthSubject {
  const candidate = (raw && typeof raw === 'object' ? raw : {}) as Record<unknown>;
  const id = candidate.id;
  const label = candidate.label;
  const affectedScope = Array.isArray(candidate.affectedScope)
    ? candidate.affectedScope.filter((v): v is string => typeof v === 'string')
    : undefined;

  return {
    id: typeof id === 'string' ? (id as HealthSubject['id']) : ('api' as HealthSubject['id']),
    label: typeof label === 'string' ? label : `Subject ${idx + 1}`,
    observation: normalizeObservation(candidate.observation),
    affectedScope,
    thirdParty: candidate.thirdParty === true,
  };
}

export function normalizeOperationalHealth(
  raw: unknown,
  generatedAt: string = new Date().toISOString()
): OperationalHealthReport {
  const candidate = (raw && typeof raw === 'object' ? raw : {}) as Record<unknown>;
  const subjects = Array.isArray(candidate.subjects)
    ? candidate.subjects.map((s, i) => normalizeSubject(s, i))
    : [];

  const finalizedBlock =
    typeof candidate.finalizedBlock === 'number' && Number.finite(candidate.finalizedBlock)
      ? candidate.finalizedBlock
      : null;
  const finalizedBlockObservedAt =
    typeof candidate.finalizedBlockObservedAt === 'string'
      ? candidate.finalizedBlockObservedAt
      : null;

  const disclaimers = Array.isArray(candidate.disclaimers)
    ? candidate.disclaimers.filter((v): v is string => typeof v === 'string')
    : [];

  const defaultDisclaimers = [
    'Third-party dependency status is not a TruthBounty guarantee.',
    'Operational status does not change protocol truth.',
  ];

  return {
    subjects,
    finalizedBlock,
    finalizedBlockObservedAt,
    generatedAt,
    overall: composeOverallHealth(subjects),
    disclaimers: [...new Set([...disclaimers, ...defaultDisclaimers])],
  };
}

export async function fetchAdminOverview(adminAddress: string): Promise<AdminDashboardOverview> {
  const res = await fetch('/api/admin/overview', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'x-admin-address': adminAddress,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const reason = errorBody.reason || errorBody.error || `HTTP ${res.status}`;
    const err = new Error(reason);
    (err as { status?: number }).status = res.status;
    throw err;
  }

  return res.json();
}

export async function fetchOperationalHealth(
  adminAddress: string
): Promise<OperationalHealthReport> {
  const res = await fetch('/api/admin/health', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'x-admin-address': adminAddress,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const reason = errorBody.reason || errorBody.error || `HTTP ${res.status}`;
    const err = new Error(reason);
    (err as { status?: number }).status = res.status;
    throw err;
  }

  const body = await res.json();
  return normalizeOperationalHealth(body);
}

export async function executeAdminOperation(
  payload: ExecuteOperationRequest
): Promise<ExecuteOperationResponse> {
  const res = await fetch('/api/admin/operations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-admin-address': payload.operatorAddress,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const reason = errorBody.reason || errorBody.error || `HTTP ${res.status}`;
    const err = new Error(reason);
    (err as { status?: number }).status = res.status;
    throw err;
  }

  return res.json();
}
