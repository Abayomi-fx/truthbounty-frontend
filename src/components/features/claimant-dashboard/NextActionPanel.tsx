'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Clock, ShieldCheck, Sparkles } from 'lucide-react';
import type { ClaimantActionItem } from '@/hooks/useClaimantDashboardData';

interface NextActionPanelProps {
  actions: ClaimantActionItem[];
  isLoading?: boolean;
}

const PRIORITY_THEMES: Record<
  ClaimantActionItem['priority'],
  { border: string; bg: string; iconColor: string; badgeClass: string; Icon: typeof AlertCircle }
> = {
  critical: {
    border: 'border-destructive/40',
    bg: 'bg-destructive/5',
    iconColor: 'text-destructive',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
    Icon: AlertCircle,
  },
  high: {
    border: 'border-primary/40',
    bg: 'bg-primary/5',
    iconColor: 'text-primary',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    Icon: Sparkles,
  },
  medium: {
    border: 'border-warning/40',
    bg: 'bg-warning/5',
    iconColor: 'text-warning',
    badgeClass: 'bg-warning/10 text-warning border-warning/20',
    Icon: AlertTriangle,
  },
  low: {
    border: 'border-border',
    bg: 'bg-card',
    iconColor: 'text-muted-foreground',
    badgeClass: 'bg-accent text-accent-foreground border-border',
    Icon: Clock,
  },
};

export function NextActionPanel({ actions, isLoading = false }: NextActionPanelProps) {
  if (isLoading) {
    return (
      <section
        aria-label="Next Actions"
        aria-busy="true"
        className="rounded-xl border border-border bg-card p-6 shadow-xs animate-pulse"
      >
        <div className="h-5 w-40 bg-accent rounded-md mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-accent/60 rounded-lg" />
          <div className="h-16 bg-accent/40 rounded-lg" />
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="next-actions-heading"
      className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs"
      data-testid="claimant-next-action-panel"
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <h2 id="next-actions-heading" className="text-base sm:text-lg font-semibold text-foreground">
            What Needs Your Attention
          </h2>
        </div>
        {actions.length > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent text-accent-foreground border border-border">
            {actions.length} {actions.length === 1 ? 'Action' : 'Actions'}
          </span>
        )}
      </div>

      {actions.length === 0 ? (
        <div
          role="status"
          className="flex items-center gap-3 rounded-lg border border-confirmed/30 bg-confirmed/5 p-4 text-sm text-foreground"
        >
          <CheckCircle2 className="h-5 w-5 text-confirmed shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">All caught up</p>
            <p className="text-xs text-muted-foreground">
              No immediate actions or approaching deadlines on your owned claims.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3" role="list">
          {actions.map((item) => {
            const theme = PRIORITY_THEMES[item.priority];
            const Icon = theme.Icon;

            return (
              <div
                key={item.id}
                role="listitem"
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border transition-colors ${theme.border} ${theme.bg}`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${theme.iconColor}`} aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${theme.badgeClass}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.consequence}</p>
                    {item.deadline && (
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        <span>Deadline: {new Date(item.deadline).toLocaleString()}</span>
                      </p>
                    )}
                  </div>
                </div>

                <Link
                  href={item.actionHref}
                  className="inline-flex items-center justify-center shrink-0 gap-1.5 px-3.5 py-2 rounded-md bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring self-start sm:self-center"
                >
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
