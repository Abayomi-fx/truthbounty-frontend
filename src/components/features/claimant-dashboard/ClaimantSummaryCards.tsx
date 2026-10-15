'use client';

import React from 'react';
import Link from 'next/link';
import { Award, CheckCircle2, Clock, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { APP_ROUTES } from '@/config/navigation';
import type { ClaimantDashboardData } from '@/hooks/useClaimantDashboardData';

interface ClaimantSummaryCardsProps {
  data: ClaimantDashboardData;
}

export function ClaimantSummaryCards({ data }: ClaimantSummaryCardsProps) {
  const { rewardsSummary, phaseCounts, trustSummary, freshness, isLoading } = data;

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        aria-label="Loading claimant statistics"
        aria-busy="true"
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 animate-pulse space-y-3"
          >
            <div className="h-4 w-24 bg-accent rounded-md" />
            <div className="h-8 w-16 bg-accent rounded-md" />
            <div className="h-3 w-32 bg-accent/60 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      id: 'claimable-rewards',
      label: 'Claimable Rewards',
      value: rewardsSummary.loadError
        ? 'Unavailable'
        : rewardsSummary.claimableDisplay || '0.00',
      subtitle: `${rewardsSummary.pendingCount} allocation(s) ready`,
      icon: Award,
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
      href: APP_ROUTES.REWARDS,
      actionText: 'View Rewards',
      metadata: freshness.source,
    },
    {
      id: 'active-claims',
      label: 'Active Owned Claims',
      value: String(phaseCounts.active),
      subtitle: `${phaseCounts.underReview} in review • ${phaseCounts.disputed} in dispute`,
      icon: Clock,
      iconColor: 'text-pending',
      iconBg: 'bg-pending/10',
      href: APP_ROUTES.CLAIM_NEW,
      actionText: 'Submit Claim',
      metadata: 'Live Indexer',
    },
    {
      id: 'resolved-claims',
      label: 'Resolved Claims',
      value: String(phaseCounts.resolved),
      subtitle: `${phaseCounts.verified} verified • ${phaseCounts.rejected} rejected`,
      icon: CheckCircle2,
      iconColor: 'text-confirmed',
      iconBg: 'bg-confirmed/10',
      metadata: 'Finalized on-chain',
    },
    {
      id: 'trust-reputation',
      label: 'My Trust Score',
      value: String(trustSummary.reputation),
      subtitle: trustSummary.isVerified ? 'Humanity Verified' : 'Worldcoin Unverified',
      icon: ShieldCheck,
      iconColor: trustSummary.isVerified ? 'text-confirmed' : 'text-warning',
      iconBg: trustSummary.isVerified ? 'bg-confirmed/10' : 'bg-warning/10',
      href: APP_ROUTES.IDENTITY,
      actionText: 'Identity & Trust',
      metadata: 'Sybil Protection',
    },
  ];

  return (
    <section aria-label="Personal claimant metrics" className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm"
              aria-label={`${card.label}: ${card.value}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-muted-foreground truncate">
                    {card.label}
                  </span>
                  <div className={`p-1.5 rounded-md ${card.iconBg} ${card.iconColor}`} aria-hidden="true">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>

                <div className="text-2xl font-bold text-foreground tracking-tight">
                  {card.value}
                </div>

                <p className="mt-1 text-xs text-muted-foreground truncate">
                  {card.subtitle}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="truncate max-w-[130px]">{card.metadata}</span>
                {card.href && (
                  <Link
                    href={card.href}
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <span>{card.actionText}</span>
                    <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
