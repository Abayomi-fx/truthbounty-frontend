/**
 * UI-FE-047 — Live announcement service acceptance tests.
 */

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AnnouncerProvider } from "@/components/providers/AnnouncerProvider";
import {
  announce,
  announceError,
  announceStatus,
  getAnnouncementHistory,
  resetAnnouncer
} from "@/lib/a11y/announcer";
import { announcementForState } from "@/lib/transaction-machine/transaction-announcements";
import type { TransactionState } from "@/lib/transaction-machine/transaction-machine.types";

function renderProvider() {
  return render(
    <AnnouncerProvider>
      <button type="button">source</button>
    </AnnouncerProvider>
  );
}

describe("UI-FE-047 — announcer service", () => {
  beforeEach(() => resetAnnouncer());
  afterEach(() => resetAnnouncer());

  // -------------------------------------------------------------------------
  // Acceptance #1: every canonical transition has a concise announcement
  // -------------------------------------------------------------------------

  it("covers every status in the transaction machine", () => {
    const statuses: TransactionState["status"][] = [
      "idle", "preparing", "signature-requested", "submitted", "confirming",
      "safe", "finalized", "indexing", "dropped", "replaced", "reverted", "reorged"
    ];
    for (const status of statuses) {
      const state = makeState(status);
      const announcement = announcementForState(state);
      if (status === "idle") {
        expect(announcement).toBeNull();
      } else {
        expect(announcement).not.toBeNull();
        expect(announcement!.message.length).toBeGreaterThan(0);
      }
    }
  });

  it("failure states announce assertively", () => {
    for (const status of ["dropped", "replaced", "reverted", "reorged"] as const) {
      const announcement = announcementForState(makeState(status));
      expect(announcement?.priority).toBe("assertive");
    }
  });

  it("non-failure states announce politely", () => {
    for (const status of ["preparing", "signature-requested", "submitted", "confirming", "safe", "finalized", "indexing"] as const) {
      const announcement = announcementForState(makeState(status));
      expect(announcement?.priority).toBe("polite");
    }
  });

  // -------------------------------------------------------------------------
  // Acceptance #2: re-renders do not spam duplicate messages
  // -------------------------------------------------------------------------

  it("drops identical messages within the dedup window", () => {
    renderProvider();
    expect(announce("Transaction submitted.")).toBe(true);
    expect(announce("Transaction submitted.")).toBe(false);
    expect(announce("Transaction submitted.")).toBe(false);
  });

  it("dispatches different messages", () => {
    renderProvider();
    expect(announce("Transaction submitted.")).toBe(true);
    expect(announce("Transaction included in a block.")).toBe(true);
  });

  it("polite and assertive are deduped independently", () => {
    renderProvider();
    expect(announceStatus("Same text")).toBe(true);
    expect(announceError("Same text")).toBe(true);
    expect(announceStatus("Same text")).toBe(false);
    expect(announceError("Same text")).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Acceptance #3: errors are associated with the initiating control
  // -------------------------------------------------------------------------

  it("records the source element on the announcement", () => {
    renderProvider();
    const source = screen.getByRole("button", { name: "source" });
    announceError("Transaction reverted.", { source });
    const last = getAnnouncementHistory().at(-1);
    expect(last?.sourceLabel).toBe("button:source");
  });

  it("routes assertive messages to the assertive region", () => {
    renderProvider();
    act(() => {
      announceError("Transaction reverted.");
    });
    const assertive = screen.getByTestId("a11y-announcer-assertive");
    expect(assertive.textContent).toBe("Transaction reverted.");
    expect(assertive.getAttribute("aria-live")).toBe("assertive");
  });

  it("routes polite messages to the polite region", () => {
    renderProvider();
    act(() => {
      announceStatus("Transaction safe.");
    });
    const polite = screen.getByTestId("a11y-announcer-polite");
    expect(polite.textContent).toBe("Transaction safe.");
    expect(polite.getAttribute("aria-live")).toBe("polite");
  });

  // -------------------------------------------------------------------------
  // Acceptance #4: focus remains predictable after recovery
  // -------------------------------------------------------------------------

  it("does not move focus when an announcement is dispatched", () => {
    renderProvider();
    const source = screen.getByRole("button", { name: "source" });
    source.focus();
    expect(document.activeElement).toBe(source);
    act(() => {
      announceStatus("Transaction safe.");
    });
    expect(document.activeElement).toBe(source);
  });

  it("does not move focus when an error is announced", () => {
    renderProvider();
    const source = screen.getByRole("button", { name: "source" });
    source.focus();
    act(() => {
      announceError("Transaction reverted.", { source });
    });
    expect(document.activeElement).toBe(source);
  });
});

// ---------------------------------------------------------------------------
// Fixture: build a minimal TransactionState for a given status
// ---------------------------------------------------------------------------

const CHAIN_ID = 10;
const HASH = "0x0000000000000000000000000000000000000000000000000000000000000001" as const;
const REPLACED_BY = "0x0000000000000000000000000000000000000000000000000000000000000002" as const;

function makeState(status: TransactionState["status"]): TransactionState {
  switch (status) {
    case "idle":
      return { status, txHash: null, chainId: null, blockNumber: null, confirmations: null, error: null, replacedBy: null };
    case "preparing":
    case "signature-requested":
      return { status, txHash: null, chainId: CHAIN_ID, blockNumber: null, confirmations: null, error: null, replacedBy: null };
    case "submitted":
      return { status, txHash: HASH, chainId: CHAIN_ID, blockNumber: null, confirmations: null, error: null, replacedBy: null };
    case "confirming":
      return { status, txHash: HASH, chainId: CHAIN_ID, blockNumber: 1n, confirmations: 1, error: null, replacedBy: null };
    case "safe":
    case "finalized":
    case "indexing":
      return { status, txHash: HASH, chainId: CHAIN_ID, blockNumber: 1n, confirmations: 3, error: null, replacedBy: null };
    case "replaced":
      return { status, txHash: HASH, chainId: CHAIN_ID, blockNumber: null, confirmations: null, error: null, replacedBy: REPLACED_BY };
    case "dropped":
      return { status, txHash: HASH, chainId: CHAIN_ID, blockNumber: null, confirmations: null, error: null, replacedBy: null };
    case "reverted":
    case "reorged":
      return { status, txHash: HASH, chainId: CHAIN_ID, blockNumber: 1n, confirmations: 1, error: null, replacedBy: null };
  }
}