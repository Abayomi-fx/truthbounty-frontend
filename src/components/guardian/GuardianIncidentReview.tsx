'use client';

import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import {
  APPROVED_PAUSE_SCOPES,
  validateIncidentContext,
  type GuardianIncidentContext,
  type GuardianIncidentSeverity,
  type GuardianModuleBlastRadius,
} from '@/lib/guardian';

const SEVERITY_TONE: Record<GuardianIncidentSeverity, string> = {
  low: 'border-sky-500/40 bg-sky-500/10 text-sky-400',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  high: 'border-orange-500/40 bg-orange-500/10 text-orange-400',
  critical: 'border-destructive/40 bg-destructive/10 text-destructive',
};

export interface GuardianIncidentReviewProps {
  incident: GuardianIncidentContext | null | undefined;
}

/**
 * Renders the incident being responded to and the blast radius of each scoped
 * pause. Values are supplied by the incident feed; nothing is invented here.
 * Incomplete context is surfaced and must block execution upstream.
 */
export function GuardianIncidentReview({ incident }: GuardianIncidentReviewProps) {
  const validation = validateIncidentContext(incident);
  const safeBlastRadius: GuardianModuleBlastRadius[] = (incident?.blastRadius ?? []).filter(
    (entry) =>
      entry &&
      (APPROVED_PAUSE_SCOPES as readonly string[]).includes(entry.scope),
  );

  if (!incident || !validation.complete) {
    return (
      <section
        data-testid="guardian-incident-review"
        data-complete="false"
        aria-labelledby="guardian-incident-heading"
        className="rounded-xl border border-destructive/40 bg-destructive/10 p-4"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
          <h2
            id="guardian-incident-heading"
            className="text-sm font-semibold text-destructive"
          >
            Incident context incomplete
          </h2>
        </div>
        <ul
          role="alert"
          aria-label="Incident context problems"
          data-testid="guardian-incident-problems"
          className="mt-2 list-disc pl-5 text-xs text-destructive"
        >
          {validation.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section
      data-testid="guardian-incident-review"
      data-complete="true"
      aria-labelledby="guardian-incident-heading"
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2
            id="guardian-incident-heading"
            className="text-sm font-semibold text-foreground"
          >
            Incident {incident.incidentId}
          </h2>
        </div>
        <span
          data-testid="guardian-incident-severity"
          data-severity={incident.severity}
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${SEVERITY_TONE[incident.severity]}`}
        >
          {incident.severity}
        </span>
      </div>
      <p className="mt-2 text-sm text-foreground">{incident.summary}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Detected {incident.detectedAt} · Reference {incident.reference}
      </p>

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Affected module blast radius
      </h3>
      <ul
        data-testid="guardian-blast-radius-list"
        className="mt-2 space-y-3"
        aria-label="Affected module blast radius"
      >
        {safeBlastRadius.map((entry) => (
          <li
            key={entry.scope}
            data-testid={`guardian-blast-radius-${entry.scope}`}
            className="rounded-lg border border-border/60 bg-background/40 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
                {entry.moduleLabel}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {entry.reversible ? 'Reversible' : 'Requires governance to unpause'}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{entry.userImpact}</p>
            {entry.affectedOperations.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Affected operations: {entry.affectedOperations.join(', ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default GuardianIncidentReview;
