'use client';

/**
 * useClaimActionWorkflow — Workflow state management for claim actions
 *
 * Manages the user workflow for verify/dispute actions:
 * - Modal/dialog state
 * - Transaction submission
 * - Success/error handling
 * - Projection invalidation after successful action
 *
 * This hook orchestrates the complete user journey from button click to
 * transaction settlement, with proper state handling at each step.
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export type ClaimActionType = 'verify' | 'dispute';

export interface ClaimActionWorkflowState {
  /** Current action being performed (null when idle) */
  action: ClaimActionType | null;
  /** True when modal/dialog is open */
  isOpen: boolean;
  /** True when transaction is being submitted */
  isSubmitting: boolean;
  /** Transaction hash when submitted */
  txHash: string | null;
  /** Error that occurred during action */
  error: Error | null;
}

export interface UseClaimActionWorkflowResult {
  state: ClaimActionWorkflowState;
  /** Open verify modal/dialog */
  openVerify: () => void;
  /** Open dispute modal/dialog */
  openDispute: () => void;
  /** Close modal/dialog */
  close: () => void;
  /** Submit transaction (called from modal) */
  submit: (txHash: string) => void;
  /** Mark transaction as successful */
  onSuccess: () => void;
  /** Handle transaction error */
  onError: (error: Error) => void;
  /** Reset workflow state */
  reset: () => void;
}

const INITIAL_STATE: ClaimActionWorkflowState = {
  action: null,
  isOpen: false,
  isSubmitting: false,
  txHash: null,
  error: null,
};

/**
 * Hook for managing claim action workflows (verify, dispute).
 */
export function useClaimActionWorkflow(claimId: string): UseClaimActionWorkflowResult {
  const [state, setState] = useState<ClaimActionWorkflowState>(INITIAL_STATE);
  const queryClient = useQueryClient();

  const openVerify = useCallback(() => {
    setState({
      ...INITIAL_STATE,
      action: 'verify',
      isOpen: true,
    });
  }, []);

  const openDispute = useCallback(() => {
    setState({
      ...INITIAL_STATE,
      action: 'dispute',
      isOpen: true,
    });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const submit = useCallback((txHash: string) => {
    setState((prev) => ({
      ...prev,
      isSubmitting: true,
      txHash,
      error: null,
    }));
  }, []);

  const onSuccess = useCallback(() => {
    // Invalidate claim detail projection to refetch with new state
    queryClient.invalidateQueries({
      queryKey: ['claim-detail-projection', claimId],
    });

    // Invalidate claims list if it exists
    queryClient.invalidateQueries({
      queryKey: ['claims-list-projection'],
    });

    // Reset workflow state
    setState({
      ...INITIAL_STATE,
      // Keep the action type visible briefly for success message
      action: state.action,
    });

    // Close modal after brief delay for success feedback
    setTimeout(() => {
      setState(INITIAL_STATE);
    }, 2000);
  }, [claimId, queryClient, state.action]);

  const onError = useCallback((error: Error) => {
    setState((prev) => ({
      ...prev,
      isSubmitting: false,
      error,
    }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    openVerify,
    openDispute,
    close,
    submit,
    onSuccess,
    onError,
    reset,
  };
}
