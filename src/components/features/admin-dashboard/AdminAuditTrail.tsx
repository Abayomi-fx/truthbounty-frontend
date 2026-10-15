'use client';

import React, { useState } from 'react';
import { History, Copy, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import type { AdminAuditRecord } from '@/app/types/admin';

export interface AdminAuditTrailProps {
  records: AdminAuditRecord[];
  isLoading?: boolean;
  className?: string;
}

export function AdminAuditTrail({
  records,
  isLoading = false,
  className = '',
}: AdminAuditTrailProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className={`rounded-2xl border border-border bg-card p-6 space-y-4 animate-pulse ${className}`}>
        <div className="h-5 w-44 bg-muted rounded" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted/60 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`} data-testid="admin-audit-trail-section">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
            <History className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Immutable Governance Audit References</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Retrievable cryptographic audit receipts logged for administrative executions and supervisor reconciliations.
          </p>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-xs text-muted-foreground">
          No audit entries recorded in current session.
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th scope="col" className="px-4 py-3">Audit Reference ID</th>
                    <th scope="col" className="px-4 py-3">Action Executed</th>
                    <th scope="col" className="px-4 py-3">Authority / Operator</th>
                    <th scope="col" className="px-4 py-3">Consequence Hash</th>
                    <th scope="col" className="px-4 py-3">Timestamp</th>
                    <th scope="col" className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {records.map((rec) => {
                    const isCopiedId = copiedId === rec.auditId;
                    const isCopiedHash = copiedId === rec.consequenceHash;

                    return (
                      <tr key={rec.auditId} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-foreground">
                          <div className="flex items-center gap-1.5">
                            <span>{rec.auditId}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(rec.auditId, rec.auditId)}
                              aria-label={`Copy Audit ID ${rec.auditId}`}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              {isCopiedId ? (
                                <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                              ) : (
                                <Copy className="h-3 w-3" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-sans">
                          <div className="font-semibold text-foreground">{rec.action}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Target: {rec.targetResource}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md border border-border bg-muted/30 text-foreground font-medium text-[11px]">
                            {rec.authority}
                          </span>
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {rec.operator ? `${rec.operator.slice(0, 8)}...${rec.operator.slice(-6)}` : 'System'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <span>
                              {rec.consequenceHash
                                ? `${rec.consequenceHash.slice(0, 10)}...${rec.consequenceHash.slice(-8)}`
                                : '0x00'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(rec.consequenceHash, rec.consequenceHash)}
                              aria-label="Copy consequence hash"
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              {isCopiedHash ? (
                                <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                              ) : (
                                <Copy className="h-3 w-3" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground font-sans text-[11px]">
                          {new Date(rec.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                            <span>{rec.status}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Approved Mobile Card Alternative */}
          <div className="md:hidden space-y-3" data-testid="admin-audit-mobile-cards">
            {records.map((rec) => {
              const isCopiedId = copiedId === rec.auditId;
              const isCopiedHash = copiedId === rec.consequenceHash;

              return (
                <div
                  key={rec.auditId}
                  className="rounded-xl border border-border bg-card p-4 space-y-2.5 shadow-xs text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-mono font-bold text-foreground">
                      <span>{rec.auditId}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(rec.auditId, rec.auditId)}
                        aria-label={`Copy Audit ID ${rec.auditId}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        {isCopiedId ? (
                          <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                        ) : (
                          <Copy className="h-3 w-3" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      <span>{rec.status}</span>
                    </span>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground">{rec.action}</h3>
                    <p className="text-muted-foreground text-[11px] mt-0.5 font-mono">
                      Target: {rec.targetResource}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border/50 flex flex-col gap-1 text-[11px]">
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-muted-foreground">Authority:</span>
                      <span className="text-foreground">{rec.authority}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-muted-foreground">Hash:</span>
                      <div className="flex items-center gap-1 text-foreground">
                        <span>
                          {rec.consequenceHash
                            ? `${rec.consequenceHash.slice(0, 8)}...${rec.consequenceHash.slice(-6)}`
                            : '0x00'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(rec.consequenceHash, rec.consequenceHash)}
                          aria-label="Copy consequence hash"
                          className="p-0.5 text-muted-foreground hover:text-foreground"
                        >
                          {isCopiedHash ? (
                            <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                          ) : (
                            <Copy className="h-3 w-3" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                      <span>Timestamp:</span>
                      <span>{new Date(rec.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
