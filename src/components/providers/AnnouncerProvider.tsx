"use client";

/**
 * UI-FE-047 — Renders the two root live regions that receive announcements.
 *
 *   <div role="status" aria-live="polite" />   ← polite messages
 *   <div role="alert" aria-live="assertive" /> ← error messages
 *
 * Both are visually hidden (sr-only) but remain in the accessibility tree.
 * The content is set imperatively from the announcer service so React
 * re-renders elsewhere do not churn the live region.
 */

import { useEffect, useRef } from "react";

import {
  subscribeAnnouncements,
  type AnnouncementPriority
} from "@/lib/a11y/announcer";

const POLITE_ID = "a11y-announcer-polite";
const ASSERTIVE_ID = "a11y-announcer-assertive";

export function AnnouncerProvider({ children }: { children: React.ReactNode }) {
  const politeRef = useRef<HTMLDivElement | null>(null);
  const assertiveRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const write = (priority: AnnouncementPriority, message: string): void => {
      const node =
        priority === "assertive" ? assertiveRef.current : politeRef.current;
      if (node === null) return;
      // Clear first so identical back-to-back messages re-announce.
      node.textContent = "";
      // Reflow to force a mutation the screen reader will pick up.
      void node.offsetHeight;
      node.textContent = message;
    };

    return subscribeAnnouncements((record) => {
      write(record.priority, record.message);
    });
  }, []);

  return (
    <>
      {children}
      <div
        id={POLITE_ID}
        ref={politeRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="a11y-announcer-polite"
      />
      <div
        id={ASSERTIVE_ID}
        ref={assertiveRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        data-testid="a11y-announcer-assertive"
      />
    </>
  );
}