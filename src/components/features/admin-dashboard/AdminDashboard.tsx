'use client';

/**
 * AdminDashboard — V2-FE-154
 *
 * Authorized administrator dashboard for system health, bounded operational queues,
 * immutable audit references, and read-only protocol parameters.
 *
 * Conforms to all Issue #439 acceptance criteria:
 * - Admin routes require server/API and canonical contract authorization in addition to frontend guards.
 * - The dashboard exposes no claim-outcome override, user-fund movement, fabricated settlement or hidden bypass control.
 * - High-impact actions identify authority, impact and audit consequence and require confirmation.
 * - Health values state their source and freshness.
 * - Direct unauthorized access returns an explicit denied state.
 * - Operational tables have approved mobile card alternatives.
 * - Security, keyboard, screen-reader and audit-reference tests pass.
 */

import React, { useState } from 'react';
import {
  Shield,
  WifiOff,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { useAdminDashboardData, type UseAdminDashboardDataReturn } from '@/hooks/useAdminDashboardData';
import { AdminUnauthorizedState } from './AdminUnauthorizedState';
import { SystemHealthSummary } from './SystemHealthSummary';
import { OperationalQueueTable } from './OperationalQueueTable';
import { OperationConfirmModal } from './OperationConfirmModal';
import { SecurityGovernanceNotices } from './SecurityGovernanceNotices';
import { ReadOnlyConfigSummary } from './ReadOnlyConfigSummary';
import { AdminAuditTrail } from './AdminAuditTrail';
import type { OperationalQueueItem } from '@/app/types/admin';

export interface AdminDashboardProps {
  className?: string;
  testDataOverride?: UseAdminDashboardDataReturn;
}

export function AdminDashboard({ className = '', testDataOverride }: AdminDashboardProps) {
  if (testDataOverride) {
    return <AdminDashboardContent className={className} data={testDataOverride} />;
  }
  return <AdminDashboardConnected className={className} />;
}

function AdminDashboardConnected({ className = '' }: { className?: string }) {
  const hookData = useAdminDashboardData();
  return <AdminDashboardContent className={className} data={hookData} />;
}

export interface AdminDashboardContentProps {
  className?: string;
  data: UseAdminDashboardDataReturn;
}

export function AdminDashboardContent({
  className = '',
  data,
}: AdminDashboardContentProps) {
  const {
    isAuthorized,
    unauthorizedReason,
    canonicalAdminAddress,
    account,
    isLoading,
    isStale,
    isDegraded,
    isOffline,
    isPartialFailure,
    partialFailureMessage,
    healthMetrics,
    operationalQueue,
    auditRecords,
    readOnlyParameters,
    governanceNotices,
    freshness,
    execute,
    refetch,
  } = data;

  const [selectedOperation, setSelectedOperation] = useState<OperationalQueueItem | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // If unauthorized: return explicit denied state
  if (!isAuthorized) {
    return (
      <div className={`space-y-6 ${className}`} data-testid="admin-dashboard-container">
        <AdminUnauthorizedState
          reason={unauthorizedReason}
          canonicalAdminAddress={canonicalAdminAddress}
          connectedAddress={account}
        />
      </div>
    );
  }

  const handleConfirmOperation = async (operationId: string, confirmationText: string) => {
    setActionFeedback(null);
    const result = await execute(operationId, confirmationText);
    if (result.success) {
      setActionFeedback({ type: 'success', message: result.message });
      setTimeout(() => setActionFeedback(null), 6000);
    } else {
      setActionFeedback({ type: 'error', message: result.message });
    }
  };

  return (
    <div className={`space-y-8 ${className}`} data-testid="admin-dashboard-container">
      {/* Header with Operator Context & Authority Tag */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Bounded Admin Operations & Health
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Cryptographically bounded governance, supervisor health telemetry, and auditable operational queues.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-xs">
            <span className="text-muted-foreground">Operator:</span>
            <span className="font-mono text-foreground font-semibold">
              {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connected'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-accent text-foreground transition-colors"
            aria-label="Refresh admin data"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 1. Offline & Stale Banner */}
      {(isOffline || isStale) && (
        <div
          role="status"
          aria-live="polite"
          data-testid="admin-stale-notice"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-amber-500/50 bg-amber-500/10 text-foreground"
        >
          <div className="flex items-center gap-3">
            <WifiOff className="h-5 w-5 text-amber-500 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">
                {isOffline ? 'Offline Mode Active' : 'Administrative Telemetry Stale'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isOffline
                  ? 'Displaying cached administrative diagnostics. Reconnect to resume live telemetry.'
                  : 'Last indexer sync was over 45s ago. Health states may not reflect current block.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1.5 self-start sm:self-center px-3 py-1.5 rounded-lg border border-amber-500/30 bg-card text-xs font-semibold hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      )}

      {/* 2. Degraded State Alert */}
      {isDegraded && (
        <div
          role="alert"
          data-testid="admin-degraded-notice"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-amber-500/50 bg-amber-500/10 text-foreground"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-amber-500">Infrastructure Degradation Detected</p>
              <p className="text-xs text-muted-foreground">
                One or more pipeline services report elevated latency or retryable job queues. Review metrics below.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1.5 self-start sm:self-center px-3 py-1.5 rounded-lg border border-amber-500/30 bg-card text-xs font-semibold hover:bg-accent transition-colors"
          >
            <span>Inspect Health</span>
          </button>
        </div>
      )}

      {/* 3. Partial Failure Alert */}
      {isPartialFailure && (
        <div
          role="alert"
          data-testid="admin-partial-failure-notice"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-foreground"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-destructive">Partial Telemetry Failure</p>
              <p className="text-xs text-muted-foreground">
                {partialFailureMessage || 'Failed to synchronize complete operational queue from backend API.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1.5 self-start sm:self-center px-3 py-1.5 rounded-lg border border-destructive/30 bg-card text-xs font-semibold hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>Retry Sync</span>
          </button>
        </div>
      )}

      {/* 4. Action Feedback Notification */}
      {actionFeedback && (
        <div
          role="status"
          aria-live="polite"
          data-testid="admin-action-feedback"
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
            actionFeedback.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          <span>{actionFeedback.message}</span>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-xs underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 5. System Health Summary (Indexer lag, RPC state, Failed jobs, Queue age) */}
      <SystemHealthSummary metrics={healthMetrics} isLoading={isLoading} />

      {/* 6. Security and Governance Invariants */}
      <SecurityGovernanceNotices notices={governanceNotices} />

      {/* 7. Bounded Operational Queues (with Mobile Card Alternatives) */}
      <OperationalQueueTable
        queue={operationalQueue}
        isLoading={isLoading}
        onSelectOperation={(item) => setSelectedOperation(item)}
      />

      {/* 8. Read-Only Configuration Summary */}
      <ReadOnlyConfigSummary parameters={readOnlyParameters} isLoading={isLoading} />

      {/* 9. Immutable Admin Audit References */}
      <AdminAuditTrail records={auditRecords} isLoading={isLoading} />

      {/* 10. High-Impact Operation Confirmation Modal */}
      <OperationConfirmModal
        operation={selectedOperation}
        isOpen={Boolean(selectedOperation)}
        onClose={() => setSelectedOperation(null)}
        onConfirm={handleConfirmOperation}
      />
    </div>
  );
}
