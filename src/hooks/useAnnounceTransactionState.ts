"use client";

/**
 * UI-FE-047 — Announce the current transaction-machine state whenever it
 * changes. Mount once per transaction.
 *
 * Deduplication is handled by the announcer service, so a component
 * re-rendering with the same status does not re-announce.
 */

import { useEffect } from "react";

import { announce } from "@/lib/a11y/announcer";
import { announcementForState } from "@/lib/transaction-machine/transaction-announcements";
import type { TransactionState } from "@/lib/transaction-machine/transaction-machine.types";

export function useAnnounceTransactionState(
  state: TransactionState,
  source: HTMLElement | null = null
): void {
  const status = state.status;

  useEffect(() => {
    const announcement = announcementForState(state);
    if (announcement === null) return;

    announce(announcement.message, {
      priority: announcement.priority,
      source
    });
    // Dependency on status only — dedup is handled by the announcer, and
    // the same status with different chainId/blockNumber does not need to
    // re-announce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, source]);
}