'use client';

import React from 'react';
import Link from 'next/link';
import { PlusCircle, ExternalLink, Clock, ShieldAlert, FileText, ArrowRight } from 'lucide-react';
import { StatusBadge } from '@/components/ui/primitives/StatusBadge';
import { APP_ROUTES } from '@/config/navigation';
import type { Claim, ClaimStatus } from '@/app/types/claim';
import type { StatusToneName } from '@/lib/design-tokens';

interface RecentOwnedClaimsProps {
  claims: Claim[];
  isLoading?: boolean;
}

function getPhaseStatusBadge(status: ClaimStatus): { label: string; tone: StatusToneName } {
  switch (status) {
    case 'OPEN':
      return { label: 'Open Submission', tone: 'neutral' };
    case 'UNDER_REVIEW':
      return { label: 'Under Review', tone: 'pending' };
    case 'DISPUTED':
      return { label: 'In Dispute', tone: 'warning' };
    case 'VERIFIED':
      return { label: 'Verified True', tone: 'confirmed' };
    case 'REJECTED':
      return { label: 'Rejected', tone: 'orphaned' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export function RecentOwnedClaims({ claims, isLoading = false }: RecentOwnedClaimsProps) {
  if (isLoading) {
    return (
      <section
        aria-label="Recent owned claims loading"
        aria-busy="true"
        className="rounded-xl border border-border bg-card p-6 shadow-xs animate-pulse space-y-4"
      >
        <div className="h-5 w-48 bg-accent rounded-md" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-accent/60 rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="recent-claims-heading"
      className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4"
      data-testid="recent-owned-claims"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <h2 id="recent-claims-heading" className="text-base sm:text-lg font-semibold text-foreground">
            Recent Owned Claims
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Claims submitted by your connected account and their live consensus state.
          </p>
        </div>

        <Link
          href={APP_ROUTES.CLAIM_NEW}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring self-start sm:self-center"
        >
          <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>New Claim</span>
        </Link>
      </div>

      {claims.length === 0 ? (
        <div
          role="status"
          className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-border bg-accent/20"
        >
          <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center text-muted-foreground mb-3" aria-hidden="true">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No claims submitted yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
            Submit your first information claim to the TruthBounty protocol to initiate community evaluation.
          </p>
          <Link
            href={APP_ROUTES.CLAIM_NEW}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>Submit a Claim</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-x-auto" role="list">
          {claims.map((claim) => {
            const badge = getPhaseStatusBadge(claim.status);
            const isDisputed = claim.status === 'DISPUTED';

            return (
              <div
                key={claim.id}
                role="listitem"
                className="py-4 first:pt-2 last:pb-2 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-accent/30 rounded-lg px-2 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <StatusBadge tone={badge.tone} label={badge.label} />
                    <span className="text-[11px] text-muted-foreground">
                      Bounty: {claim.bountyAmount} tokens
                    </span>
                    {claim.category && (
                      <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded-sm bg-accent text-accent-foreground border border-border">
                        {claim.category}
                      </span>
                    )}
                  </div>

                  <Link
                    href={APP_ROUTES.CLAIM_DETAIL(claim.id)}
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors block truncate focus:outline-none focus-visible:underline"
                  >
                    {claim.title}
                  </Link>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                    <span>Submitted {new Date(claim.createdAt).toLocaleDateString()}</span>
                    {claim.expiresAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        <span>Deadline: {new Date(claim.expiresAt).toLocaleDateString()}</span>
                      </span>
                    )}
                    <span>Total Staked: {claim.totalStaked}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-start md:self-center pt-2 md:pt-0">
                  {isDisputed ? (
                    <Link
                      href={APP_ROUTES.DISPUTES}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Respond to Dispute</span>
                    </Link>
                  ) : (
                    <Link
                      href={APP_ROUTES.CLAIM_DETAIL(claim.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border bg-card text-foreground text-xs font-medium hover:bg-accent transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <span>View Details</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
