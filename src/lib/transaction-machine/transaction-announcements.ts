/**
 * UI-FE-047 — Concise announcements for each transaction-machine state.
 *
 * Every status from transaction-machine.types maps to a short message
 * that a screen reader can announce. Errors use assertive politeness;
 * every other transition uses polite.
 */

import type { TransactionState } from "./transaction-machine.types";
import type { AnnouncementPriority } from "@/lib/a11y/announcer";

export interface StateAnnouncement {
  message: string;
  priority: AnnouncementPriority;
}

/**
 * One announcement per status. The map is exhaustive: adding a new status
 * to TransactionStatus is a compile error here until an announcement is
 * defined — that is the mechanism that keeps this list in sync with the
 * state machine.
 */
const MESSAGES: Record<TransactionState["status"], StateAnnouncement | null> = {
  idle: null,
  preparing: { message: "Preparing transaction.", priority: "polite" },
  "signature-requested": {
    message: "Waiting for wallet signature.",
    priority: "polite"
  },
  submitted: {
    message: "Transaction submitted. Waiting for inclusion in a block.",
    priority: "polite"
  },
  confirming: {
    message: "Transaction included in a block. Waiting for confirmations.",
    priority: "polite"
  },
  safe: { message: "Transaction safe. You can continue.", priority: "polite" },
  finalized: { message: "Transaction finalized.", priority: "polite" },
  indexing: {
    message: "Finalized. Indexing; this may take a moment.",
    priority: "polite"
  },
  dropped: {
    message: "Transaction was dropped from the mempool.",
    priority: "assertive"
  },
  replaced: {
    message: "Transaction was replaced by another transaction.",
    priority: "assertive"
  },
  reverted: { message: "Transaction reverted.", priority: "assertive" },
  reorged: {
    message: "A chain reorganization affected this transaction.",
    priority: "assertive"
  }
};

export function announcementForState(
  state: TransactionState
): StateAnnouncement | null {
  return MESSAGES[state.status];
}