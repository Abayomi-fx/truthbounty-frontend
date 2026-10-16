'use client';

import React from 'react';
import { Shield, Clock, AlertTriangle, CheckCircle, ArrowRight, Zap } from 'lucide-react';
import type { OperationalQueueItem } from '@/app/types/admin';

export interface OperationalQueueTableProps {
  queue: OperationalQueueItem[];
  isLoading?: boolean;
  onSelectOperation: (item: OperationalQueueItem) => void;
  className?: string;
}

export function OperationalQueueTable({
  queue,
  isLoading = false,
  onSelectOperation,
  className = '',
}: OperationalQueueTableProps) {
  if (isLoading) {
    return (
      <div className={`rounded-2xl border border-border bg-card p-6 space-y-4 animate-pulse ${className}`}>
        <div className="h-5 w-48 bg-muted rounded" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted/60 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const getRiskBadge = (risk: OperationalQueueItem['risk']) => {
    switch (risk) {
      case 'high':
        return 'border-destructive/30 bg-destructive/10 text-destructive';
      case 'medium':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-500';
      case 'low':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500';
    }
  };

  return (
    <div className={`space-y-4 ${className}`} data-testid="operational-queue-section">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" aria-hidden="true" />
            <span>Bounded Operational Queues</span>
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
              {queue.length} pending
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deterministic administrative maintenance tasks requiring explicit operator confirmation.
          </p>
        </div>
      </div>

      {queue.length === 0 ? (
        // Reassuring Empty / No-Action State
        <div
          role="status"
          aria-live="polite"
          data-testid="operational-queue-empty"
          className="rounded-2xl border border-border bg-card p-8 text-center space-y-3"
        >
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
            <CheckCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Operational Queues Clear</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              All pipeline ingestion batches, dispute projections, and supervisor queues are operating normally. Zero manual interventions required.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table View (Hidden on mobile < md) */}
          <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th scope="col" className="px-4 py-3">Operation / Target</th>
                    <th scope="col" className="px-4 py-3">Authority</th>
                    <th scope="col" className="px-4 py-3">Risk Level</th>
                    <th scope="col" className="px-4 py-3">Queue Age</th>
                    <th scope="col" className="px-4 py-3 text-right">Permitted Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {queue.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-foreground text-sm">{item.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {item.description}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-primary/80">
                          Target: {item.targetResource}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-mono px-2 py-0.5 rounded-md border border-border bg-muted/40 text-foreground font-medium text-[11px]">
                          {item.authority}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${getRiskBadge(
                            item.risk
                          )}`}
                        >
                          {item.risk} Risk
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          <span>{item.queueAge}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectOperation(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
                          aria-label={`Authorize ${item.title}`}
                        >
                          <span>Review & Execute</span>
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Approved Mobile Card Alternative (Visible only on mobile < md) */}
          <div className="md:hidden space-y-3" data-testid="operational-queue-mobile-cards">
            {queue.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${getRiskBadge(
                      item.risk
                    )}`}
                  >
                    {item.risk}
                  </span>
                </div>

                <div className="pt-2 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Authority:</span>
                    <p className="font-mono text-foreground font-medium text-[11px]">
                      {item.authority}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Queue Age:</span>
                    <p className="text-muted-foreground text-[11px] flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      <span>{item.queueAge}</span>
                    </p>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-primary truncate">
                  Target: {item.targetResource}
                </div>

                <button
                  type="button"
                  onClick={() => onSelectOperation(item)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
                  aria-label={`Authorize ${item.title}`}
                >
                  <span>Review & Execute</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
