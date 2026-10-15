'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, KeyRound, ExternalLink } from 'lucide-react';
import { APP_ROUTES } from '@/config/navigation';

export interface AdminUnauthorizedStateProps {
  reason: string | null;
  canonicalAdminAddress?: string;
  connectedAddress?: string | null;
  onConnect?: () => void;
  className?: string;
}

export function AdminUnauthorizedState({
  reason,
  canonicalAdminAddress,
  connectedAddress,
  className = '',
}: AdminUnauthorizedStateProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="admin-unauthorized-notice"
      className={`mx-auto max-w-3xl rounded-2xl border border-destructive/40 bg-card p-6 sm:p-8 shadow-sm ${className}`}
    >
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-destructive/15 p-3 text-destructive shrink-0">
          <ShieldAlert className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="space-y-3 flex-1">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Administrator Authorization Required
            </h2>
            <p className="mt-1 text-sm text-destructive font-medium">
              {reason || 'Access to protocol governance and operations is restricted to authorized multi-sig operators.'}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Canonical Admin Authority:</span>
              <span className="font-mono text-foreground font-semibold">
                {canonicalAdminAddress
                  ? `${canonicalAdminAddress.slice(0, 10)}...${canonicalAdminAddress.slice(-8)}`
                  : 'Configured in release/roles'}
              </span>
            </div>
            {connectedAddress && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Connected Wallet Address:</span>
                <span className="font-mono text-foreground">
                  {`${connectedAddress.slice(0, 10)}...${connectedAddress.slice(-8)}`}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-border/50">
              <span className="text-muted-foreground">Enforcement Layer:</span>
              <span className="text-primary font-medium">Canonical Contract Registry & Server API Gate</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            TruthBounty enforces strict cryptographic role separation. Operational routes require contract-level verification against deployed Optimism artifacts.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href={APP_ROUTES.IDENTITY}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Connect Operator Wallet</span>
            </Link>
            <Link
              href={APP_ROUTES.DASHBOARD}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-accent transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Return to Public Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
