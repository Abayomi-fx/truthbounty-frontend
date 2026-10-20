'use client';

/**
 * UI-FE-028 — GovernanceProposalsSection Component.
 *
 * Full proposal register & detail composition under /admin.
 * Satisfies both Board 07 (.governance-proposal-list) and Board 08 (.proposal-detail-card)
 * with complete fail-closed security rules.
 */

import React, { useState } from 'react';
import {
  useGovernanceProposals,
  type UseGovernanceProposalsOptions,
} from '@/hooks/useGovernanceProposals';
import { GovernanceProposalRegister } from './GovernanceProposalRegister';
import { GovernanceProposalDetail } from './GovernanceProposalDetail';
import { AdminUnauthorizedState } from '@/components/features/admin-dashboard/AdminUnauthorizedState';
import { cn } from '@/lib/utils';
import { Shield, RefreshCw, CheckCircle2, AlertOctagon } from 'lucide-react';

export interface GovernanceProposalsSectionProps {
  options?: UseGovernanceProposalsOptions;
  className?: string;
}

export function GovernanceProposalsSection({
  options,
  className = '',
}: GovernanceProposalsSectionProps) {
  const {
    proposals,
    filteredProposals,
    selectedProposalId,
    selectedProposal,
    surfaceState,
    stateFilter,
    setStateFilter,
    searchQuery,
    setSearchQuery,
    selectProposal,
    isAuthorized,
    unauthorizedReason,
    connectedAddress,
    governanceOperatorAddress,
    actionGate,
    executeProposalAction,
    isLoading,
    isStale,
    refetch,
  } = useGovernanceProposals(options);

  const [pendingAction, setPendingAction] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [formErrors, setFormErrors] = useState<string[]>([]);

  if (!isAuthorized || surfaceState === 'denied' || surfaceState === 'wrong-chain') {
    return (
      <div className={cn('space-y-4', className)} data-testid="governance-proposals-denied">
        <AdminUnauthorizedState
          reason={unauthorizedReason}
          canonicalAdminAddress={governanceOperatorAddress || '0x90F79bf6EB2c4f870365E785982E1f101E93b906'}
          connectedAddress={connectedAddress}
        />
      </div>
    );
  }

  const handleAction = async (proposalId: string, action: 'queue' | 'execute' | 'cancel') => {
    setPendingAction(true);
    setFeedback(null);
    setFormErrors([]);

    const result = await executeProposalAction(proposalId, action);
    setPendingAction(false);

    if (result.success) {
      setFeedback({ type: 'success', message: result.message });
      setTimeout(() => setFeedback(null), 6000);
    } else {
      setFeedback({ type: 'error', message: result.message });
      setFormErrors([result.message]);
    }
  };

  return (
    <div
      className={cn('space-y-8', className)}
      data-testid="governance-proposals-section"
    >
      {/* Feedback Alert */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          data-testid="proposal-feedback-alert"
          className={cn(
            'p-4 rounded-xl border text-xs font-medium flex items-center justify-between',
            feedback.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
              : 'border-destructive/40 bg-destructive/10 text-destructive',
          )}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Accessible Error Summary */}
      {formErrors.length > 0 && (
        <div
          role="alert"
          data-testid="proposal-error-summary"
          className="p-4 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive space-y-1 text-xs"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertOctagon className="h-4 w-4" aria-hidden="true" />
            <span>Governance action could not be completed</span>
          </div>
          <ul className="list-disc pl-5 text-foreground/80 space-y-0.5">
            {formErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 1. Register Section (Board 07) */}
      <GovernanceProposalRegister
        proposals={filteredProposals}
        selectedProposalId={selectedProposalId}
        onSelectProposal={selectProposal}
        stateFilter={stateFilter}
        onStateFilterChange={setStateFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isLoading={isLoading}
        isStale={isStale}
        onRefresh={refetch}
      />

      {/* 2. Detail Section (Board 08) */}
      {selectedProposal && (
        <div className="pt-4 border-t border-border/60">
          <GovernanceProposalDetail
            proposal={selectedProposal}
            actionGate={actionGate}
            onQueue={(id) => handleAction(id, 'queue')}
            onExecute={(id) => handleAction(id, 'execute')}
            onCancel={(id) => handleAction(id, 'cancel')}
            pendingAction={pendingAction}
          />
        </div>
      )}
    </div>
  );
}
