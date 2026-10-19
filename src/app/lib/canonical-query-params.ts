/**
 * Canonical URL Query-Parameter Boundary
 *
 * Production boundary that owns the round-trip between shareable public filter
 * state and canonical URLs for six surfaces:
 *   1. claims          — public claim feed
 *   2. verification     — verifier queue
 *   3. disputes        — public dispute register
 *   4. audit           — admin audit trail
 *   5. incidents       — public incident history
 *   6. docs            — public documentation
 *
 * SECURITY INVARIANTS (non-negotiable):
 * - Only explicitly allowlisted parameters may enter or leave a canonical URL.
 * - Wallet addresses, session tokens, capability identifiers, secret material,
 *   evidence URIs, dispute drafts, and any privileged/protected search state
 *   are prohibited from the URL and silently dropped on parse.
 * - Invalid, legacy, or malformed values are normalized to canonical defaults
 *   (fail-closed: the UI never branches on untrusted URL state).
 * - parse(build(parse(x))) === parse(x)  — round-trip idempotency.
 * - Oversized values are clamped/rejected to prevent URL-based denial of service.
 * - Control characters and injection payloads are stripped or rejected.
 *
 * Authority model (per docs/THREAT_MODEL.md):
 * - Contracts and reviewed API projections remain authoritative.
 * - The URL is a presentation/shareability layer only; it never grants
 *   capability, mutates protocol state, or carries trusted identity.
 */

import type { ClaimStatus } from '@/app/types/claim';
import { isClaimStatus } from '@/app/types/claim-list';

// ---------------------------------------------------------------------------
// Surface identifiers
// ---------------------------------------------------------------------------

export const QUERY_SURFACES = [
  'claims',
  'verification',
  'disputes',
  'audit',
  'incidents',
  'docs',
] as const;

export type QuerySurface = (typeof QUERY_SURFACES)[number];

// ---------------------------------------------------------------------------
// Shared primitive validators
// ---------------------------------------------------------------------------

/** Maximum length for any single query-parameter value (URL safety). */
export const MAX_PARAM_VALUE_LENGTH = 500;

/** Maximum number of distinct query parameters per surface. */
export const MAX_PARAMS_PER_SURFACE = 20;

/** Maximum total serialized query-string length. */
export const MAX_QUERY_STRING_LENGTH = 2000;

/**
 * Characters that must never appear in a URL parameter value.
 * Covers C0 control chars, DEL, and Unicode line/paragraph separators.
 */
const FORBIDDEN_CHARS = /[\u0000-\u001f\u007f\u0085\u2028\u2029]/;

/**
 * Pattern that catches common injection payloads (script tags, event handlers,
 * javascript: URIs, data: URIs). Values matching this are rejected, not
 * sanitized, so the URL never carries executable content.
 */
const INJECTION_PATTERN =
  /<script|javascript:|data:text\/html|on\w+\s*=|<iframe|<embed|<object/i;

/**
 * Deny-list of parameter names that must never appear in a canonical URL.
 * These cover wallet, capability, secret, and protected search state.
 * Matching is case-insensitive against the lowercased param name and
 * also against common obfuscation variants (camelCase, snake_case, kebab-case).
 */
const PROHIBITED_PARAM_PATTERNS: readonly RegExp[] = [
  // Wallet / account
  /^wallet$/i,
  /^wallet_?address$/i,
  /^account$/i,
  /^account_?address$/i,
  /^address$/i,
  /^addr$/i,
  /^connected_?account$/i,
  /^from_?address$/i,
  /^to_?address$/i,
  // Session / auth / capability
  /^session$/i,
  /^session_?id$/i,
  /^token$/i,
  /^auth$/i,
  /^auth_?token$/i,
  /^api_?key$/i,
  /^access_?token$/i,
  /^refresh_?token$/i,
  /^capability$/i,
  /^capability_?id$/i,
  /^role$/i,
  /^permission$/i,
  // Secret material
  /^secret$/i,
  /^private_?key$/i,
  /^mnemonic$/i,
  /^seed_?phrase$/i,
  /^password$/i,
  /^passphrase$/i,
  /^credential$/i,
  // Protected search / draft state
  /^draft$/i,
  /^draft_?id$/i,
  /^evidence$/i,
  /^evidence_?uri$/i,
  /^evidence_?id$/i,
  /^claim_?draft$/i,
  /^dispute_?draft$/i,
  /^signature$/i,
  /^signed_?data$/i,
  // Transaction / chain
  /^tx_?hash$/i,
  /^transaction_?hash$/i,
  /^chain_?id$/i,
  /^nonce$/i,
];

/**
 * Returns true if a parameter name is prohibited from canonical URLs.
 * Used both at parse time (drop) and build time (never emit).
 */
export function isProhibitedParam(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[-\s]/g, '_');
  return PROHIBITED_PARAM_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Sanitize a raw string value for safe URL inclusion.
 * Returns null when the value must be rejected entirely.
 */
function sanitizeValue(raw: string): string | null {
  if (raw.length > MAX_PARAM_VALUE_LENGTH) return null;
  if (FORBIDDEN_CHARS.test(raw)) return null;
  if (INJECTION_PATTERN.test(raw)) return null;
  return raw;
}

/** Clamp a positive integer, returning the default on failure. */
function clampInt(
  raw: string | null,
  min: number,
  max: number,
  defaultValue: number,
): number {
  if (raw === null || raw === '') return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(max, Math.max(min, parsed));
}

/** Parse a boolean-like value; only 'true' yields true. */
function parseBoolean(raw: string | null): boolean {
  return raw === 'true';
}

// ---------------------------------------------------------------------------
// Surface: claims
// ---------------------------------------------------------------------------

export type ClaimSortField = 'createdAt' | 'title' | 'confidenceScore';
export type ClaimSortDirection = 'asc' | 'desc';

export interface ClaimsQueryState {
  search: string;
  status: ClaimStatus | undefined;
  highImpact: boolean;
  sortField: ClaimSortField;
  sortDirection: ClaimSortDirection;
  page: number;
}

export const DEFAULT_CLAIMS_STATE: ClaimsQueryState = {
  search: '',
  status: undefined,
  highImpact: false,
  sortField: 'createdAt',
  sortDirection: 'desc',
  page: 1,
};

const CLAIMS_SORT_FIELDS: readonly ClaimSortField[] = [
  'createdAt',
  'title',
  'confidenceScore',
];
const CLAIMS_SORT_DIRECTIONS: readonly ClaimSortDirection[] = ['asc', 'desc'];
const CLAIMS_MAX_SEARCH_LENGTH = 200;

function parseClaimsSort(
  value: string | null,
): { field: ClaimSortField; direction: ClaimSortDirection } {
  if (!value) return { field: 'createdAt', direction: 'desc' };
  const [field, direction] = value.split('.');
  if (
    CLAIMS_SORT_FIELDS.includes(field as ClaimSortField) &&
    CLAIMS_SORT_DIRECTIONS.includes(direction as ClaimSortDirection)
  ) {
    return {
      field: field as ClaimSortField,
      direction: direction as ClaimSortDirection,
    };
  }
  return { field: 'createdAt', direction: 'desc' };
}

function parseClaimsState(params: URLSearchParams): ClaimsQueryState {
  const rawSearch = params.get('search')?.trim() ?? '';
  const safeSearch =
    rawSearch.length <= CLAIMS_MAX_SEARCH_LENGTH && !FORBIDDEN_CHARS.test(rawSearch)
      ? rawSearch
      : '';
  const rejectedSearch = sanitizeValue(rawSearch);
  const search = rejectedSearch === null ? '' : rejectedSearch.trim().slice(0, CLAIMS_MAX_SEARCH_LENGTH);

  const rawStatus = params.get('status');
  const status = rawStatus && isClaimStatus(rawStatus) ? rawStatus : undefined;

  const highImpact = parseBoolean(params.get('highImpact'));

  const { field, direction } = parseClaimsSort(params.get('sort'));

  const page = clampInt(params.get('page'), 1, 1000, 1);

  return { search, status, highImpact, sortField: field, sortDirection: direction, page };
}

function buildClaimsState(state: ClaimsQueryState): URLSearchParams {
  const params = new URLSearchParams();
  const search = state.search.trim();
  if (search.length > 0 && search.length <= CLAIMS_MAX_SEARCH_LENGTH) {
    const clean = sanitizeValue(search);
    if (clean !== null) params.set('search', clean);
  }
  if (state.status && isClaimStatus(state.status)) {
    params.set('status', state.status);
  }
  if (state.highImpact) params.set('highImpact', 'true');
  if (
    CLAIMS_SORT_FIELDS.includes(state.sortField) &&
    CLAIMS_SORT_DIRECTIONS.includes(state.sortDirection) &&
    // Omit the default sort so the default state produces an empty query string.
    !(state.sortField === DEFAULT_CLAIMS_STATE.sortField && state.sortDirection === DEFAULT_CLAIMS_STATE.sortDirection)
  ) {
    params.set('sort', `${state.sortField}.${state.sortDirection}`);
  }
  if (state.page > 1) params.set('page', String(state.page));
  return params;
}

// ---------------------------------------------------------------------------
// Surface: verification queue
// ---------------------------------------------------------------------------

export type VerificationPhase = 'commit' | 'reveal' | 'closed';
export type VerificationQueueFilter = 'available' | 'assigned' | 'all';

export interface VerificationQueryState {
  phase: VerificationPhase | undefined;
  filter: VerificationQueueFilter;
  page: number;
}

export const DEFAULT_VERIFICATION_STATE: VerificationQueryState = {
  phase: undefined,
  filter: 'available',
  page: 1,
};

const VERIFICATION_PHASES: readonly VerificationPhase[] = [
  'commit',
  'reveal',
  'closed',
];
const VERIFICATION_FILTERS: readonly VerificationQueueFilter[] = [
  'available',
  'assigned',
  'all',
];

function parseVerificationState(params: URLSearchParams): VerificationQueryState {
  const rawPhase = params.get('phase');
  const phase =
    rawPhase && VERIFICATION_PHASES.includes(rawPhase as VerificationPhase)
      ? (rawPhase as VerificationPhase)
      : undefined;

  const rawFilter = params.get('filter');
  const filter =
    rawFilter && VERIFICATION_FILTERS.includes(rawFilter as VerificationQueueFilter)
      ? (rawFilter as VerificationQueueFilter)
      : 'available';

  const page = clampInt(params.get('page'), 1, 1000, 1);

  return { phase, filter, page };
}

function buildVerificationState(state: VerificationQueryState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.phase && VERIFICATION_PHASES.includes(state.phase)) {
    params.set('phase', state.phase);
  }
  if (state.filter !== 'available' && VERIFICATION_FILTERS.includes(state.filter)) {
    params.set('filter', state.filter);
  }
  if (state.page > 1) params.set('page', String(state.page));
  return params;
}

// ---------------------------------------------------------------------------
// Surface: disputes
// ---------------------------------------------------------------------------

export interface DisputesQueryState {
  /** Public claim ID filter (never a wallet or draft). */
  claimId: string;
  status: string | undefined;
  page: number;
}

export const DEFAULT_DISPUTES_STATE: DisputesQueryState = {
  claimId: '',
  status: undefined,
  page: 1,
};

const DISPUTES_STATUSES = ['open', 'active', 'resolved', 'appealed'] as const;
const DISPUTES_MAX_CLAIM_ID_LENGTH = 200;

function parseDisputesState(params: URLSearchParams): DisputesQueryState {
  const rawClaimId = params.get('claimId')?.trim() ?? '';
  const safeClaimId = sanitizeValue(rawClaimId);
  const claimId =
    safeClaimId !== null ? safeClaimId.slice(0, DISPUTES_MAX_CLAIM_ID_LENGTH) : '';

  const rawStatus = params.get('status');
  const status =
    rawStatus &&
    DISPUTES_STATUSES.includes(rawStatus.toLowerCase() as (typeof DISPUTES_STATUSES)[number])
      ? rawStatus.toLowerCase()
      : undefined;

  const page = clampInt(params.get('page'), 1, 1000, 1);

  return { claimId, status, page };
}

function buildDisputesState(state: DisputesQueryState): URLSearchParams {
  const params = new URLSearchParams();
  const claimId = state.claimId.trim();
  if (claimId.length > 0 && claimId.length <= DISPUTES_MAX_CLAIM_ID_LENGTH) {
    const clean = sanitizeValue(claimId);
    if (clean !== null) params.set('claimId', clean);
  }
  if (state.status && DISPUTES_STATUSES.includes(state.status as (typeof DISPUTES_STATUSES)[number])) {
    params.set('status', state.status);
  }
  if (state.page > 1) params.set('page', String(state.page));
  return params;
}

// ---------------------------------------------------------------------------
// Surface: audit trail
// ---------------------------------------------------------------------------

export interface AuditQueryState {
  action: string;
  authority: string;
  page: number;
}

export const DEFAULT_AUDIT_STATE: AuditQueryState = {
  action: '',
  authority: '',
  page: 1,
};

const AUDIT_MAX_FILTER_LENGTH = 100;
const AUDIT_AUTHORITIES = ['governance', 'emergency', 'operations', 'system'] as const;

function parseAuditState(params: URLSearchParams): AuditQueryState {
  const rawAction = params.get('action')?.trim() ?? '';
  const safeAction = sanitizeValue(rawAction);
  const action = safeAction !== null ? safeAction.slice(0, AUDIT_MAX_FILTER_LENGTH) : '';

  const rawAuthority = params.get('authority');
  const authority =
    rawAuthority &&
    AUDIT_AUTHORITIES.includes(rawAuthority.toLowerCase() as (typeof AUDIT_AUTHORITIES)[number])
      ? rawAuthority.toLowerCase()
      : '';

  const page = clampInt(params.get('page'), 1, 1000, 1);

  return { action, authority, page };
}

function buildAuditState(state: AuditQueryState): URLSearchParams {
  const params = new URLSearchParams();
  const action = state.action.trim();
  if (action.length > 0 && action.length <= AUDIT_MAX_FILTER_LENGTH) {
    const clean = sanitizeValue(action);
    if (clean !== null) params.set('action', clean);
  }
  if (state.authority && AUDIT_AUTHORITIES.includes(state.authority as (typeof AUDIT_AUTHORITIES)[number])) {
    params.set('authority', state.authority);
  }
  if (state.page > 1) params.set('page', String(state.page));
  return params;
}

// ---------------------------------------------------------------------------
// Surface: incidents
// ---------------------------------------------------------------------------

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'active' | 'resolved' | 'monitoring';

export interface IncidentsQueryState {
  severity: IncidentSeverity | undefined;
  status: IncidentStatus | undefined;
  page: number;
}

export const DEFAULT_INCIDENTS_STATE: IncidentsQueryState = {
  severity: undefined,
  status: undefined,
  page: 1,
};

const INCIDENT_SEVERITIES: readonly IncidentSeverity[] = [
  'low',
  'medium',
  'high',
  'critical',
];
const INCIDENT_STATUSES: readonly IncidentStatus[] = [
  'active',
  'resolved',
  'monitoring',
];

function parseIncidentsState(params: URLSearchParams): IncidentsQueryState {
  const rawSeverity = params.get('severity');
  const severity =
    rawSeverity && INCIDENT_SEVERITIES.includes(rawSeverity.toLowerCase() as IncidentSeverity)
      ? (rawSeverity.toLowerCase() as IncidentSeverity)
      : undefined;

  const rawStatus = params.get('status');
  const status =
    rawStatus && INCIDENT_STATUSES.includes(rawStatus.toLowerCase() as IncidentStatus)
      ? (rawStatus.toLowerCase() as IncidentStatus)
      : undefined;

  const page = clampInt(params.get('page'), 1, 1000, 1);

  return { severity, status, page };
}

function buildIncidentsState(state: IncidentsQueryState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.severity && INCIDENT_SEVERITIES.includes(state.severity)) {
    params.set('severity', state.severity);
  }
  if (state.status && INCIDENT_STATUSES.includes(state.status)) {
    params.set('status', state.status);
  }
  if (state.page > 1) params.set('page', String(state.page));
  return params;
}

// ---------------------------------------------------------------------------
// Surface: docs
// ---------------------------------------------------------------------------

export interface DocsQueryState {
  search: string;
  category: string | undefined;
  page: number;
}

export const DEFAULT_DOCS_STATE: DocsQueryState = {
  search: '',
  category: undefined,
  page: 1,
};

const DOCS_MAX_SEARCH_LENGTH = 200;
const DOCS_CATEGORIES = [
  'getting-started',
  'verification',
  'disputes',
  'governance',
  'evidence',
  'troubleshooting',
] as const;

function parseDocsState(params: URLSearchParams): DocsQueryState {
  const rawSearch = params.get('search')?.trim() ?? '';
  const safeSearch = sanitizeValue(rawSearch);
  const search =
    safeSearch !== null ? safeSearch.slice(0, DOCS_MAX_SEARCH_LENGTH) : '';

  const rawCategory = params.get('category');
  const category =
    rawCategory &&
    DOCS_CATEGORIES.includes(rawCategory.toLowerCase() as (typeof DOCS_CATEGORIES)[number])
      ? rawCategory.toLowerCase()
      : undefined;

  const page = clampInt(params.get('page'), 1, 1000, 1);

  return { search, category, page };
}

function buildDocsState(state: DocsQueryState): URLSearchParams {
  const params = new URLSearchParams();
  const search = state.search.trim();
  if (search.length > 0 && search.length <= DOCS_MAX_SEARCH_LENGTH) {
    const clean = sanitizeValue(search);
    if (clean !== null) params.set('search', clean);
  }
  if (state.category && DOCS_CATEGORIES.includes(state.category as (typeof DOCS_CATEGORIES)[number])) {
    params.set('category', state.category);
  }
  if (state.page > 1) params.set('page', String(state.page));
  return params;
}

// ---------------------------------------------------------------------------
// Unified surface state union
// ---------------------------------------------------------------------------

export type CanonicalQueryState =
  | { surface: 'claims'; state: ClaimsQueryState }
  | { surface: 'verification'; state: VerificationQueryState }
  | { surface: 'disputes'; state: DisputesQueryState }
  | { surface: 'audit'; state: AuditQueryState }
  | { surface: 'incidents'; state: IncidentsQueryState }
  | { surface: 'docs'; state: DocsQueryState };

// ---------------------------------------------------------------------------
// Parse: drop prohibited params, normalize, fail-closed
// ---------------------------------------------------------------------------

/**
 * Parse a URLSearchParams into a canonical surface state, dropping any
 * prohibited parameters and normalizing invalid values to defaults.
 *
 * Prohibited parameters (wallet, session, capability, secret, draft, evidence,
 * signature, tx hash, chain id) are silently dropped — they never enter the
 * typed state and are never re-emitted by buildCanonicalSearchParams.
 */
export function parseCanonicalSearchParams(
  surface: QuerySurface,
  params: URLSearchParams,
): CanonicalQueryState {
  // Defensive copy with prohibited-param stripping. This runs before every
  // surface parser so the surface logic never sees wallet/secret/capability
  // parameters, even if an attacker injects them.
  const cleanParams = new URLSearchParams();
  let paramCount = 0;

  for (const [key, value] of params.entries()) {
    if (paramCount >= MAX_PARAMS_PER_SURFACE) break; // oversized: fail-closed
    if (isProhibitedParam(key)) continue; // drop wallet/secret/capability
    if (sanitizeValue(value) === null) continue; // drop injection/control
    cleanParams.set(key, value);
    paramCount++;
  }

  switch (surface) {
    case 'claims':
      return { surface: 'claims', state: parseClaimsState(cleanParams) };
    case 'verification':
      return { surface: 'verification', state: parseVerificationState(cleanParams) };
    case 'disputes':
      return { surface: 'disputes', state: parseDisputesState(cleanParams) };
    case 'audit':
      return { surface: 'audit', state: parseAuditState(cleanParams) };
    case 'incidents':
      return { surface: 'incidents', state: parseIncidentsState(cleanParams) };
    case 'docs':
      return { surface: 'docs', state: parseDocsState(cleanParams) };
  }
}

// ---------------------------------------------------------------------------
// Build: emit only canonical params, never prohibited ones
// ---------------------------------------------------------------------------

/**
 * Build a canonical URLSearchParams from a surface state.
 * Only allowlisted parameters are emitted; prohibited names are never written
 * even if a caller mistakenly sets them on the state object.
 */
export function buildCanonicalSearchParams(
  input: CanonicalQueryState,
): URLSearchParams {
  let params: URLSearchParams;

  switch (input.surface) {
    case 'claims':
      params = buildClaimsState(input.state);
      break;
    case 'verification':
      params = buildVerificationState(input.state);
      break;
    case 'disputes':
      params = buildDisputesState(input.state);
      break;
    case 'audit':
      params = buildAuditState(input.state);
      break;
    case 'incidents':
      params = buildIncidentsState(input.state);
      break;
    case 'docs':
      params = buildDocsState(input.state);
      break;
  }

  // Belt-and-suspenders: strip any prohibited param that might have slipped
  // through, and enforce the query-string length cap.
  const toDelete: string[] = [];
  for (const key of params.keys()) {
    if (isProhibitedParam(key)) toDelete.push(key);
  }
  toDelete.forEach((key) => params.delete(key));

  if (params.toString().length > MAX_QUERY_STRING_LENGTH) {
    // Oversized: fail-closed to empty (the caller should never produce this
    // from valid state, so this is a safety net against bugs/attacks).
    return new URLSearchParams();
  }

  return params;
}

// ---------------------------------------------------------------------------
// Round-trip helpers
// ---------------------------------------------------------------------------

/**
 * Parse a raw query string (e.g. from window.location.search) into canonical
 * surface state. Convenience wrapper around parseCanonicalSearchParams.
 */
export function parseQueryString(
  surface: QuerySurface,
  queryString: string,
): CanonicalQueryState {
  const params = new URLSearchParams(
    queryString.startsWith('?') ? queryString.slice(1) : queryString,
  );
  return parseCanonicalSearchParams(surface, params);
}

/**
 * Build a canonical query string from surface state.
 * Returns the string without a leading '?'.
 */
export function buildQueryString(input: CanonicalQueryState): string {
  return buildCanonicalSearchParams(input).toString();
}

/**
 * Build a full canonical URL (pathname + canonical query string) for a surface.
 * The pathname must be pre-validated by the caller (see route-authority).
 */
export function buildCanonicalUrl(
  pathname: string,
  input: CanonicalQueryState,
): string {
  const qs = buildQueryString(input);
  const cleanPath = pathname.split('?')[0].split('#')[0];
  return qs.length > 0 ? `${cleanPath}?${qs}` : cleanPath;
}

/**
 * Verify round-trip idempotency: parse(build(parse(x))) === parse(x).
 * This is the core invariant of the boundary. Exposed for testing.
 */
export function isRoundTripStable(
  surface: QuerySurface,
  params: URLSearchParams,
): boolean {
  const first = parseCanonicalSearchParams(surface, params);
  const built = buildCanonicalSearchParams(first);
  const second = parseCanonicalSearchParams(surface, built);
  return JSON.stringify(first) === JSON.stringify(second);
}

// ---------------------------------------------------------------------------
// Default state accessor
// ---------------------------------------------------------------------------

export function getDefaultState(surface: QuerySurface): CanonicalQueryState {
  switch (surface) {
    case 'claims':
      return { surface: 'claims', state: { ...DEFAULT_CLAIMS_STATE } };
    case 'verification':
      return { surface: 'verification', state: { ...DEFAULT_VERIFICATION_STATE } };
    case 'disputes':
      return { surface: 'disputes', state: { ...DEFAULT_DISPUTES_STATE } };
    case 'audit':
      return { surface: 'audit', state: { ...DEFAULT_AUDIT_STATE } };
    case 'incidents':
      return { surface: 'incidents', state: { ...DEFAULT_INCIDENTS_STATE } };
    case 'docs':
      return { surface: 'docs', state: { ...DEFAULT_DOCS_STATE } };
  }
}

// ---------------------------------------------------------------------------
// Prohibited-parameter report (for debugging / telemetry, never for URLs)
// ---------------------------------------------------------------------------

export interface ProhibitedParamReport {
  /** Parameter names that were found and dropped. */
  dropped: string[];
  /** Whether any oversized values were detected. */
  hadOversized: boolean;
}

/**
 * Scan a URLSearchParams for prohibited/oversized parameters without parsing
 * into surface state. Useful for telemetry and security auditing. The report
 * never includes parameter *values* — only names — to avoid leaking secrets.
 */
export function scanForProhibitedParams(
  params: URLSearchParams,
): ProhibitedParamReport {
  const dropped: string[] = [];
  let hadOversized = false;

  for (const [key, value] of params.entries()) {
    if (isProhibitedParam(key)) {
      dropped.push(key);
    }
    if (value.length > MAX_PARAM_VALUE_LENGTH) {
      hadOversized = true;
    }
  }

  return { dropped, hadOversized };
}
