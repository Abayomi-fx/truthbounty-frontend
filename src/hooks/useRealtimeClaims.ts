// src/hooks/useRealtimeClaims.ts

"use client";

import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWebSocketContext } from "@/components/providers/WebSocketProvider";
import { queryKeys } from "@/app/queries/queryKeys";
import type { TransactionStatus } from "@/lib/transaction-machine/transaction-machine.types";
import type { ClaimStatus } from "@/app/types/claim";

function isClaimStatus(status: unknown): status is ClaimStatus {
  return (
    status === "OPEN" ||
    status === "UNDER_REVIEW" ||
    status === "VERIFIED" ||
    status === "REJECTED" ||
    status === "DISPUTED"
  );
}

/**
 * Hook for real-time claim updates
 * Automatically updates local state when WebSocket events arrive
 */
export function useRealtimeClaim(claimId: string) {
  const { subscribe, isConnected, send } = useWebSocketContext();
  const queryClient = useQueryClient();

  // Subscribe to claim updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe("CLAIM_STATUS_CHANGED", (payload) => {
      if (payload.claimId === claimId) {
        // Invalidate the claim query to trigger a refetch
        queryClient.invalidateQueries({
          queryKey: queryKeys.claims.detail(claimId),
        });
      }
    });

    return unsubscribe;
  }, [isConnected, subscribe, queryClient, claimId]);

  // Subscribe to verification updates for this claim
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe("VERIFICATION_ADDED", (payload) => {
      if (payload.claimId === claimId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.verifications.byClaim(claimId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.claims.detail(claimId),
        });
      }
    });

    return unsubscribe;
  }, [isConnected, subscribe, queryClient, claimId]);

  // Subscribe to dispute updates for this claim
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribeStatus = subscribe("CLAIM_STATUS_CHANGED", (payload) => {
      if (payload.claimId === claimId && payload.newStatus === "DISPUTED") {
        queryClient.invalidateQueries({
          queryKey: queryKeys.disputes.byClaim(claimId),
        });
      }
    });

    const unsubscribeDispute = subscribe("DISPUTE_RESOLVED", (payload) => {
      if (payload.claimId === claimId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.claims.detail(claimId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.disputes.byClaim(claimId),
        });
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeDispute();
    };
  }, [isConnected, subscribe, queryClient, claimId]);

  // Function to manually request updates
  const requestUpdate = useCallback(() => {
    send({
      type: "REQUEST_CLAIM_UPDATE",
      payload: { claimId },
    });
  }, [send, claimId]);

  return {
    isConnected,
    requestUpdate,
  };
}

/**
 * Hook for real-time claims list updates
 */
export function useRealtimeClaimsList() {
  const { subscribe, isConnected } = useWebSocketContext();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe("CLAIM_CREATED", () => {
      // New claim created - invalidate list
      queryClient.invalidateQueries({
        queryKey: queryKeys.claims.lists(),
      });
    });

    return unsubscribe;
  }, [isConnected, subscribe, queryClient]);

  return { isConnected };
}

/**
 * Apply a provisional claim status while a transaction is pending. Pass the
 * transaction-machine status to restore it on terminal outcomes; call rollback
 * directly when a wallet rejects before an active state is observed.
 */
export function useOptimisticClaimUpdate(
  claimId: string,
  transactionStatus?: TransactionStatus,
) {
  const queryClient = useQueryClient();
  const pendingUpdate = useRef<{
    claimId: string;
    previous: unknown;
    optimistic: unknown;
    dataUpdateCount: number;
  } | null>(null);
  const observedActiveTransaction = useRef(false);

  const restorePending = useCallback(() => {
    const pending = pendingUpdate.current;
    if (!pending) return claimId;

    pendingUpdate.current = null;
    const key = queryKeys.claims.detail(pending.claimId);
    const currentState = queryClient.getQueryState(key);

    if (
      queryClient.getQueryData(key) === pending.optimistic &&
      currentState?.dataUpdateCount === pending.dataUpdateCount
    ) {
      queryClient.setQueryData(key, pending.previous);
    }

    return pending.claimId;
  }, [claimId, queryClient]);

  const rollback = useCallback(async () => {
    const affectedClaimId = restorePending();
    await queryClient.invalidateQueries({
      queryKey: queryKeys.claims.detail(affectedClaimId),
      exact: true,
    });
  }, [queryClient, restorePending]);

  const optimisticUpdate = useCallback(
    async (newStatus: ClaimStatus) => {
      if (!isClaimStatus(newStatus)) {
        throw new TypeError("Unsupported optimistic claim status.");
      }

      if (
        transactionStatus === "reverted" ||
        transactionStatus === "replaced" ||
        transactionStatus === "dropped" ||
        transactionStatus === "reorged" ||
        transactionStatus === "finalized"
      ) {
        return;
      }

      restorePending();

      const key = queryKeys.claims.detail(claimId);
      await queryClient.cancelQueries({ queryKey: key, exact: true });

      const previous = queryClient.getQueryData(key);
      if (
        !previous ||
        typeof previous !== "object" ||
        Array.isArray(previous) ||
        !("id" in previous) ||
        previous.id !== claimId ||
        !("status" in previous) ||
        !isClaimStatus(previous.status)
      ) {
        return;
      }

      const optimistic = { ...previous, status: newStatus };
      queryClient.setQueryData(key, optimistic);
      pendingUpdate.current = {
        claimId,
        previous,
        optimistic: queryClient.getQueryData(key),
        dataUpdateCount: queryClient.getQueryState(key)?.dataUpdateCount ?? 0,
      };
    },
    [queryClient, claimId, restorePending, transactionStatus],
  );

  useEffect(() => {
    if (!transactionStatus) return;

    if (transactionStatus !== "idle") {
      observedActiveTransaction.current = true;
    }

    const terminalFailure =
      transactionStatus === "reverted" ||
      transactionStatus === "replaced" ||
      transactionStatus === "dropped" ||
      transactionStatus === "reorged";
    const rejected =
      transactionStatus === "idle" && observedActiveTransaction.current;
    const finalized = transactionStatus === "finalized";

    if (terminalFailure || rejected || finalized) {
      observedActiveTransaction.current = false;
      void rollback();
    }
  }, [transactionStatus, rollback]);

  useEffect(() => {
    return () => {
      if (pendingUpdate.current?.claimId === claimId) {
        void rollback();
      }
    };
  }, [claimId, rollback]);

  return { optimisticUpdate, rollback };
}
