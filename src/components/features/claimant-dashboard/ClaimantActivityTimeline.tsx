'use client';

import React from 'react';
import Link from 'next/link';
import { History, PlusCircle, CheckCircle2, Award, AlertTriangle, ArrowUpRight } from 'lucide-react';
import type { ClaimantActivityItem } from '@/hooks/useClaimantDashboardData';

interface ClaimantActivityTimelineProps {
  activity: ClaimantActivityItem[];
  isLoading?: boolean;
}

function getActivityIcon(type: ClaimantActivityItem['type']) {
  switch (type) {
    case 'claim_created':
      return { Icon: PlusCircle, color: 'text-primary', bg: 'bg-primary/10' };
    case 'status_change':
      return { Icon: CheckCircle2, color: 'text-confirmed', bg: 'bg-confirmed/10' };
    case 'reward_available':
    case 'reward_claimed':
      return { Icon: Award, color: 'text-warning', bg: 'bg-warning/10' };
    default:
      return { Icon: History, color: 'text-muted-foreground', bg: 'bg-accent' };
  }
}

export function ClaimantActivityTimeline({ activity, isLoading = false }: ClaimantActivityTimelineProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs animate-pulse space-y-4">
        <div className="h-5 w-40 bg-accent rounded-md" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-accent/60 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="activity-timeline-heading"
      className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4"
      data-testid="claimant-activity-timeline"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 id="activity-timeline-heading" className="text-base font-semibold text-foreground">
            Protocol Activity Timeline
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {activity.length} event{activity.length === 1 ? '' : 's'}
        </span>
      </div>

      {activity.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-4 text-center">
          No recent protocol activity recorded for this address.
        </p>
      ) : (
        <ol className="relative border-l border-border ml-3 space-y-4 py-2" role="list">
          {activity.map((event) => {
            const { Icon, color, bg } = getActivityIcon(event.type);
            const formattedDate = new Date(event.timestamp).toLocaleString();

            return (
              <li key={event.id} className="ml-5 relative group" role="listitem">
                <span
                  className={`absolute -left-[27px] top-1 flex h-6 w-6 items-center justify-center rounded-full border border-border ${bg} ${color}`}
                  aria-hidden="true"
                >
                  <Icon className="h-3 w-3" />
                </span>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <p className="text-xs sm:text-sm font-medium text-foreground">
                    {event.title}
                  </p>
                  <time className="text-[11px] text-muted-foreground shrink-0" dateTime={event.timestamp}>
                    {formattedDate}
                  </time>
                </div>

                <p className="text-xs text-muted-foreground mt-0.5">
                  {event.description}
                </p>

                {event.linkHref && (
                  <Link
                    href={event.linkHref}
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <span>View transaction or details</span>
                    <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
