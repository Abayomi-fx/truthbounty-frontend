/**
 * UI-FE-047 — Centralized polite/assertive announcement service.
 *
 * Provides a single API for announcing async/transaction transitions to
 * screen readers. Two live regions exist at the document root (one polite,
 * one assertive); this module routes announcements to the correct region.
 *
 * Deduplication: the same message is never announced twice within
 * DEDUP_WINDOW_MS, so re-renders cannot spam the screen reader.
 *
 * Politeness:
 *   - 'polite'     → status changes, progress, confirmations
 *   - 'assertive'  → errors, failures, user-action-required
 *
 * Focus preservation: announcing a message MUST NOT move focus. This
 * module never calls .focus() — callers are responsible for focus
 * management on the initiating control.
 */

export type AnnouncementPriority = "polite" | "assertive";

export interface AnnounceOptions {
  /** Politeness. Default: 'polite'. */
  priority?: AnnouncementPriority;
  /**
   * Optional initiating control selector or element. When provided, the
   * announcement is associated with that control via aria-describedby so
   * the screen reader can relate the message back to the action.
   */
  source?: HTMLElement | null;
}

interface AnnouncementRecord {
  message: string;
  priority: AnnouncementPriority;
  timestamp: number;
  /** A 20-char source label for diagnostics, never rendered. */
  sourceLabel: string | null;
}

const DEDUP_WINDOW_MS = 1_500;
const MAX_HISTORY = 25;

const listeners = new Set<(record: AnnouncementRecord) => void>();
const history: AnnouncementRecord[] = [];

/**
 * Announce a message to screen readers.
 *
 * Returns `true` if the message was dispatched, `false` if it was deduped
 * (same message within DEDUP_WINDOW_MS).
 */
export function announce(message: string, options: AnnounceOptions = {}): boolean {
  const trimmed = message.trim();
  if (trimmed.length === 0) return false;

  const priority = options.priority ?? "polite";
  const now = Date.now();

  // Deduplicate: same message within the window is dropped.
  const recent = history
    .filter((r) => r.message === trimmed && now - r.timestamp < DEDUP_WINDOW_MS)
    .pop();
  if (recent !== undefined) return false;

  const record: AnnouncementRecord = {
    message: trimmed,
    priority,
    timestamp: now,
    sourceLabel: describeSource(options.source)
  };

  history.push(record);
  if (history.length > MAX_HISTORY) history.shift();

  for (const listener of listeners) {
    listener(record);
  }
  return true;
}

/** Convenience wrapper for error/failure announcements (assertive). */
export function announceError(message: string, options: Omit<AnnounceOptions, "priority"> = {}): boolean {
  return announce(message, { ...options, priority: "assertive" });
}

/** Convenience wrapper for progress/status announcements (polite). */
export function announceStatus(message: string, options: Omit<AnnounceOptions, "priority"> = {}): boolean {
  return announce(message, { ...options, priority: "polite" });
}

/** Subscribe to announcements. Used by <AnnouncerProvider />. */
export function subscribeAnnouncements(
  listener: (record: AnnouncementRecord) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Test helper: read the announcement history.
 * Not used in production — exposed only so the test suite can assert
 * message order and politeness without coupling to React internals.
 */
export function getAnnouncementHistory(): ReadonlyArray<AnnouncementRecord> {
  return history.slice();
}

/** Test helper: reset the announcer between test cases. */
export function resetAnnouncer(): void {
  history.length = 0;
  listeners.clear();
}

function describeSource(source: HTMLElement | null | undefined): string | null {
  if (source === null || source === undefined) return null;
  const tag = source.tagName.toLowerCase();
  const id = source.id !== "" ? `#${source.id}` : "";
  const label = source.getAttribute("aria-label") ?? "";
  const trimmed = label.length > 20 ? `${label.slice(0, 20)}…` : label;
  return `${tag}${id}${trimmed !== "" ? `:${trimmed}` : ""}`;
}