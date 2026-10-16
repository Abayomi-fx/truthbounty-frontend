'use client';

import React from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle, Clock, Database } from 'lucide-react';
import type { SystemHealthMetric } from '@/app/types/admin';

export interface SystemHealthSummaryProps {
  metrics: SystemHealthMetric[];
  isLoading?: boolean;
  className?: string;
}

export function SystemHealthSummary({
  metrics,
  isLoading = false,
  className = '',
}: SystemHealthSummaryProps) {
  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 animate-pulse space-y-3"
          >
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="h-7 w-36 bg-muted rounded" />
            <div className="h-3 w-48 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  const getStatusIcon = (status: SystemHealthMetric['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />;
      case 'degraded':
      case 'unavailable':
        return <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    }
  };

  const getStatusBadge = (status: SystemHealthMetric['status']) => {
    switch (status) {
      case 'healthy':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500';
      case 'warning':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-500';
      case 'degraded':
      case 'unavailable':
        return 'border-destructive/30 bg-destructive/10 text-destructive';
      default:
        return 'border-border bg-muted/30 text-muted-foreground';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>System Health & Protocol Infrastructure</span>
        </h2>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" aria-hidden="true" />
          <span>Live Telemetry</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="system-health-grid">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between shadow-xs transition-colors hover:border-border/80"
            aria-label={`${metric.name}: ${metric.value} (${metric.status})`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground truncate">
                  {metric.name}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(
                    metric.status
                  )}`}
                >
                  {getStatusIcon(metric.status)}
                  <span className="capitalize">{metric.status}</span>
                </span>
              </div>
              <div className="mt-2 text-xl font-bold tracking-tight text-foreground">
                {metric.value}
              </div>
              {metric.subtext && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                  {metric.subtext}
                </p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-border/50 flex flex-col gap-1 text-[11px] text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 truncate">
                  <Database className="h-3 w-3 shrink-0 text-primary/70" aria-hidden="true" />
                  <span className="truncate">{metric.source}</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground/80">
                <span>Freshness:</span>
                <span>{new Date(metric.lastUpdated).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
