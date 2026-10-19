/**
 * UI-FE-032 — Incident context & module blast-radius model.
 *
 * The guardian pause control must present the incident being responded to and
 * the blast radius of each scoped pause BEFORE any execution. These values are
 * supplied by an authoritative incident/ops feed; this module only validates
 * them and never fabricates an incident, severity, or impact.
 */

import {
  APPROVED_PAUSE_SCOPES,
  type GuardianPauseScope,
} from './pause-authority';

export type GuardianIncidentSeverity =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export const GUARDIAN_INCIDENT_SEVERITIES: readonly GuardianIncidentSeverity[] =
  ['low', 'medium', 'high', 'critical'];

export interface GuardianModuleBlastRadius {
  scope: GuardianPauseScope;
  moduleLabel: string;
  affectedOperations: readonly string[];
  userImpact: string;
  reversible: boolean;
}

export interface GuardianIncidentContext {
  incidentId: string;
  severity: GuardianIncidentSeverity;
  summary: string;
  /** ISO-8601 timestamp of detection, provided by the incident feed. */
  detectedAt: string;
  /** Immutable ops/audit reference for this incident. */
  reference: string;
  affectedScopes: readonly GuardianPauseScope[];
  blastRadius: readonly GuardianModuleBlastRadius[];
}

export interface GuardianIncidentValidation {
  complete: boolean;
  reasons: readonly string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isApprovedScope(value: unknown): value is GuardianPauseScope {
  return (
    typeof value === 'string' &&
    (APPROVED_PAUSE_SCOPES as readonly string[]).includes(value)
  );
}

function isValidIsoTimestamp(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

/**
 * Validate a blast-radius entry. A pause must never be executed against a
 * scope whose impact is not declared.
 */
export function validateBlastRadius(
  entry: GuardianModuleBlastRadius | null | undefined,
): GuardianIncidentValidation {
  const reasons: string[] = [];
  if (!entry) {
    return { complete: false, reasons: ['Blast radius entry is missing.'] };
  }
  if (!isApprovedScope(entry.scope)) {
    reasons.push('Blast radius scope is not an approved pause scope.');
  }
  if (!isNonEmptyString(entry.moduleLabel)) {
    reasons.push('Blast radius module label is missing.');
  }
  if (
    !Array.isArray(entry.affectedOperations) ||
    !entry.affectedOperations.every(isNonEmptyString)
  ) {
    reasons.push('Blast radius affected operations are missing.');
  }
  if (!isNonEmptyString(entry.userImpact)) {
    reasons.push('Blast radius user impact is missing.');
  }
  if (typeof entry.reversible !== 'boolean') {
    reasons.push('Blast radius reversibility must be declared.');
  }
  return { complete: reasons.length === 0, reasons };
}

/**
 * Validate incident context. Incomplete incident context must block pause
 * execution (fail closed).
 */
export function validateIncidentContext(
  incident: GuardianIncidentContext | null | undefined,
): GuardianIncidentValidation {
  const reasons: string[] = [];
  if (!incident) {
    return { complete: false, reasons: ['Incident context is missing.'] };
  }
  if (!isNonEmptyString(incident.incidentId)) {
    reasons.push('Incident id is missing.');
  }
  if (
    !(GUARDIAN_INCIDENT_SEVERITIES as readonly string[]).includes(
      incident.severity,
    )
  ) {
    reasons.push('Incident severity is invalid.');
  }
  if (!isNonEmptyString(incident.summary)) {
    reasons.push('Incident summary is missing.');
  }
  if (!isValidIsoTimestamp(incident.detectedAt)) {
    reasons.push('Incident detection timestamp is invalid.');
  }
  if (!isNonEmptyString(incident.reference)) {
    reasons.push('Incident reference is missing.');
  }
  if (
    !Array.isArray(incident.affectedScopes) ||
    incident.affectedScopes.length === 0
  ) {
    reasons.push('Incident declares no affected scopes.');
  } else if (!incident.affectedScopes.every(isApprovedScope)) {
    reasons.push('Incident references a non-approved pause scope.');
  }
  if (!Array.isArray(incident.blastRadius) || incident.blastRadius.length === 0) {
    reasons.push('Incident blast radius is missing.');
  } else {
    for (const entry of incident.blastRadius) {
      const result = validateBlastRadius(entry);
      if (!result.complete) reasons.push(...result.reasons);
    }
    if (Array.isArray(incident.affectedScopes)) {
      for (const scope of incident.affectedScopes) {
        if (!incident.blastRadius.some((entry) => entry?.scope === scope)) {
          reasons.push(`Blast radius missing for affected scope "${scope}".`);
        }
      }
    }
  }

  return { complete: reasons.length === 0, reasons };
}

export function blastRadiusForScope(
  incident: GuardianIncidentContext | null | undefined,
  scope: GuardianPauseScope,
): GuardianModuleBlastRadius | null {
  if (!incident || !Array.isArray(incident.blastRadius)) return null;
  return incident.blastRadius.find((entry) => entry?.scope === scope) ?? null;
}
