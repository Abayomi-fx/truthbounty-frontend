'use client';

import React from 'react';
import { Shield, Clock, Lock, CheckCircle2 } from 'lucide-react';
import type { AdminDashboardOverview } from '@/app/types/admin';

export interface SecurityGovernanceNoticesProps {
  notices: AdminDashboardOverview['governanceNotices'];
  className?: string;
}

export function SecurityGovernanceNotices({
  notices,
  className = '',
}: SecurityGovernanceNoticesProps) {
  const getIcon = (type: AdminDashboardOverview['governanceNotices'][0]['type']) => {
    switch (type) {
      case 'escrow':
        return <Lock className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />;
      case 'timelock':
        return <Clock className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" aria-hidden="true" />;
      case 'sybil':
        return <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />;
      default:
        return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />;
    }
  };

  const getBorderColor = (type: AdminDashboardOverview['governanceNotices'][0]['type']) => {
    switch (type) {
      case 'escrow':
        return 'border-emerald-500/40 bg-emerald-500/5';
      case 'timelock':
        return 'border-indigo-500/40 bg-indigo-500/5';
      case 'sybil':
        return 'border-primary/40 bg-primary/5';
      default:
        return 'border-border bg-card';
    }
  };

  return (
    <div className={`space-y-3 ${className}`} data-testid="security-governance-notices">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-emerald-500" aria-hidden="true" />
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Security & Governance Invariants
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className={`rounded-xl border p-4.5 space-y-2 shadow-xs ${getBorderColor(notice.type)}`}
          >
            <div className="flex items-start gap-3">
              {getIcon(notice.type)}
              <div>
                <h3 className="text-sm font-bold text-foreground">{notice.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {notice.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
