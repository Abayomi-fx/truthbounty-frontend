'use client';

import React, { useState } from 'react';
import { Settings, Copy, Check, Lock, FileCode } from 'lucide-react';
import type { ReadOnlyProtocolParameter } from '@/app/types/admin';

export interface ReadOnlyConfigSummaryProps {
  parameters: ReadOnlyProtocolParameter[];
  isLoading?: boolean;
  className?: string;
}

export function ReadOnlyConfigSummary({
  parameters,
  isLoading = false,
  className = '',
}: ReadOnlyConfigSummaryProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, value: string) => {
    void navigator.clipboard?.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (isLoading) {
    return (
      <div className={`rounded-2xl border border-border bg-card p-6 space-y-4 animate-pulse ${className}`}>
        <div className="h-5 w-48 bg-muted rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted/60 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`} data-testid="readonly-config-summary">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Read-Only Protocol Configuration</span>
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
              Enforced Read-Only
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable parameters verified against canonical release artifacts. Configuration changes require on-chain multi-sig execution.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {parameters.map((param) => {
          const isAddress = param.value.startsWith('0x');
          const isCopied = copiedKey === param.key;

          return (
            <div
              key={param.key}
              className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs transition-colors hover:border-border/80"
            >
              <div>
                <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
                  <span className="font-medium">{param.label}</span>
                  <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground/70">
                    <FileCode className="h-2.5 w-2.5" aria-hidden="true" />
                    <span>{param.contractSource}</span>
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span
                    className={`font-semibold text-foreground truncate ${
                      isAddress ? 'font-mono text-xs' : 'text-sm'
                    }`}
                    title={param.value}
                  >
                    {isAddress
                      ? `${param.value.slice(0, 8)}...${param.value.slice(-6)}`
                      : param.value}
                  </span>

                  {isAddress && (
                    <button
                      type="button"
                      onClick={() => handleCopy(param.key, param.value)}
                      aria-label={`Copy ${param.label}`}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                    >
                      {isCopied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                  )}
                </div>

                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {param.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
