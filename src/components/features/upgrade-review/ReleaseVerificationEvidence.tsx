'use client';

import React from 'react';
import { ShieldCheck, ShieldAlert, FileCheck } from 'lucide-react';
import type {
  CurrentReleaseReview,
  UpgradeCandidateDescriptor,
} from '@/lib/upgrade-review/types';

/**
 * Verification evidence for the current release and the candidate.
 *
 * The current release is verified by the build-time artifact pipeline.
 * The candidate requires explicit maintainer confirmation; without it,
 * verification stays unverified and blocks execution.
 */
export interface ReleaseVerificationEvidenceProps {
  currentRelease: CurrentReleaseReview;
  candidate: UpgradeCandidateDescriptor;
  /** Blocking reasons derived from the candidate gates. */
  candidateBlockedReasons: string[];
  className?: string;
}

export function ReleaseVerificationEvidence({
  currentRelease,
  candidate,
  candidateBlockedReasons,
  className = '',
}: ReleaseVerificationEvidenceProps) {
  const currentVerified = currentRelease.currentReleaseVerified;
  const candidateVerified = candidate.verification === 'verified';

  return (
    <section
      className={`space-y-4 ${className}`}
      data-testid="upgrade-verification-evidence"
      aria-labelledby="upgrade-verification-heading"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2
          id="upgrade-verification-heading"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          Release Verification
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current release verification */}
        <div
          className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs"
          data-testid="current-release-verification"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-foreground">Current Release</h3>
            {currentVerified ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                Verified
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/30">
                Not verified
              </span>
            )}
          </div>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Protocol version</dt>
              <dd className="font-mono text-foreground">
                {currentRelease.protocolVersion}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Release identifier</dt>
              <dd className="font-mono text-foreground">
                {currentRelease.releaseId}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Git commit</dt>
              <dd className="font-mono text-foreground">
                {currentRelease.gitCommit.slice(0, 12)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">ABI hash</dt>
              <dd className="font-mono text-foreground break-all">
                {currentRelease.abiHash ?? '—'}
              </dd>
            </div>
          </dl>
          {!currentVerified && (
            <p className="text-xs text-destructive" role="alert">
              Current release verification evidence is incomplete.
            </p>
          )}
        </div>

        {/* Candidate verification */}
        <div
          className={`rounded-xl border p-4 space-y-3 shadow-xs ${
            candidateVerified
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-amber-500/40 bg-amber-500/5'
          }`}
          data-testid="candidate-verification"
          data-candidate-verified={candidateVerified ? 'true' : 'false'}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-foreground">Candidate Release</h3>
            {candidateVerified ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                Verified
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/30">
                Unverified
              </span>
            )}
          </div>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Protocol version</dt>
              <dd className="font-mono text-foreground">
                {candidate.protocolVersion}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Release identifier</dt>
              <dd className="font-mono text-foreground">
                {candidate.releaseId}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Maintainer</dt>
              <dd className="font-mono text-foreground">
                {candidate.verifiedBy ?? 'Not confirmed'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Confirmed at</dt>
              <dd className="font-mono text-foreground">
                {candidate.verifiedAt ?? '—'}
              </dd>
            </div>
          </dl>

          {candidateBlockedReasons.length > 0 && (
            <ul
              className="space-y-1 text-xs text-amber-300"
              aria-label="Candidate verification blocking reasons"
              data-testid="candidate-verification-blockers"
            >
              {candidateBlockedReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {!candidateVerified && (
            <p
              className="text-xs text-amber-300 flex items-start gap-2"
              role="alert"
              data-testid="candidate-verification-blocked"
            >
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                The candidate is not verified. Governed execution is withheld
                until a maintainer confirms it.
              </span>
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-2">
        <FileCheck className="h-4 w-4" aria-hidden="true" />
        Verification evidence is derived from the canonical release registry.
        Authorization records are evidence only and never executed here.
      </p>
    </section>
  );
}

export default ReleaseVerificationEvidence;
