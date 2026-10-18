'use client';

import React from 'react';
import { Layers } from 'lucide-react';
import type {
  CurrentReleaseReview,
  UpgradeCandidateCompatibility,
  UpgradeCandidateDescriptor,
} from '@/lib/upgrade-review/types';

/**
 * Compatibility and layout evidence.
 *
 * The current release's compatibility is derived from the pinned contract
 * surface. The candidate's compatibility is maintainer-declared evidence
 * only, and stays unverified until a maintainer confirms it.
 */
export interface CompatibilityEvidenceProps {
  currentRelease: CurrentReleaseReview;
  candidate: UpgradeCandidateDescriptor;
  candidateBlockedReasons: string[];
  className?: string;
}

export function CompatibilityEvidence({
  currentRelease,
  candidate,
  candidateBlockedReasons,
  className = '',
}: CompatibilityEvidenceProps) {
  const candidateCompatibility: UpgradeCandidateCompatibility =
    candidate.compatibility;

  return (
    <section
      className={`space-y-4 ${className}`}
      data-testid="upgrade-compatibility-evidence"
      aria-labelledby="upgrade-compatibility-heading"
    >
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2
          id="upgrade-compatibility-heading"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          Compatibility and Layout Evidence
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current release compatibility */}
        <div
          className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs"
          data-testid="current-compatibility"
        >
          <h3 className="text-sm font-bold text-foreground">Current Release</h3>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">ABI version</dt>
              <dd className="font-mono text-foreground">
                {currentRelease.abiVersion}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Event schema version</dt>
              <dd className="font-mono text-foreground">
                {currentRelease.eventSchemaVersion}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Parameter set version</dt>
              <dd className="font-mono text-foreground">
                {currentRelease.parameterSetVersion}
              </dd>
            </div>
          </dl>
          {currentRelease.compatibilityIssues.length === 0 ? (
            <p className="text-xs text-emerald-500 flex items-center gap-2" role="status">
              <span aria-hidden="true">✓</span> Compatibility verified against the pinned contract surface.
            </p>
          ) : (
            <ul
              className="space-y-1 text-xs text-amber-300"
              aria-label="Current compatibility issues"
              data-testid="current-compatibility-issues"
            >
              {currentRelease.compatibilityIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Candidate compatibility */}
        <div
          className={`rounded-xl border p-4 space-y-3 shadow-xs ${
            candidateBlockedReasons.length === 0
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-amber-500/40 bg-amber-500/5'
          }`}
          data-testid="candidate-compatibility"
          data-candidate-verified={
            candidateBlockedReasons.length === 0 ? 'true' : 'false'
          }
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-foreground">Candidate Release</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              Maintainer-declared
            </span>
          </div>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">ABI version</dt>
              <dd className="font-mono text-foreground">
                {candidateCompatibility.abiVersion}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Event schema version</dt>
              <dd className="font-mono text-foreground">
                {candidateCompatibility.eventSchemaVersion}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Parameter set version</dt>
              <dd className="font-mono text-foreground">
                {candidateCompatibility.parameterSetVersion}
              </dd>
            </div>
          </dl>

          <ul className="space-y-1 text-xs text-muted-foreground" aria-label="Chain compatibility">
            {candidateCompatibility.chainCompatibility.map((statement) => (
              <li key={statement}>{statement}</li>
            ))}
          </ul>

          {candidateBlockedReasons.length > 0 ? (
            <p
              className="text-xs text-amber-300 flex items-start gap-2"
              role="alert"
              data-testid="candidate-compatibility-blocked"
            >
              <span aria-hidden="true">!</span>
              Compatibility is not verified. Execution is withheld until a
              maintainer confirms the candidate.
            </p>
          ) : (
            <p className="text-xs text-emerald-500 flex items-center gap-2" role="status">
              <span aria-hidden="true">✓</span> Compatibility evidence verified.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default CompatibilityEvidence;
