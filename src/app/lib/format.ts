/**
 * TruthBounty Protocol V2 — UI Formatting Utilities
*
 * Re-exports the canonical formatting engine from `/lib/format`.
 * Retained for backwards-compatibility across the app directory.
 *
 * This module also exposes the canonical deadline and finality
 * presentation boundary required by UI-FE-074. All time-sensitive
 * presentation must be derived from contract-provided canonical time
 * and must not authorize actions based on a client clock.
 */

export * from "@/lib/format";

import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatTime,
  formatTimeZone,
  formatTokenAmount,
  formatWalletAddress,
} from "@/lib/format";

/**
 * Canonical time source kinds. The contract or a reviewed API
 * projection is the only authority for time-sensitive state.
 */
export type CanonicalTimeSource = "contract" | "api" | "unavailable";

/**
 * Finality depth distinction. A block that is merely confirmed must
 * never be presented as finalized.
 */
export type FinalityState = "finalized" | "confirmed" | "pending" | "unknown";

/**
 * Represents the canonical time context for a given surface.
 */
export interface CanonicalTimeContext {
  /** Wall-clock time as reported by the canonical source. */
  reading: Date | null;
  /** Where the reading originated. */
  source: CanonicalTimeSource;
  /** Block height associated with the reading, if any. */
  blockHeight: number | null;
  /** Hash of the block associated with the reading, if any. */
  blockHash: string | null;
  /** Network the reading belongs to. */
  network: string | null;
  /** True when the reading is considered stale by the canonical source. */
  stale: boolean;
  /** Why the reading is stale or unavailable, if known. */
  reason?: string;
}

/**
 * Represents a deadline derived from canonical contract state.
 */
export interface CanonicalDeadline {
  /** Absolute deadline instant as reported by the contract. */
  at: Date | null;
  /** Block height at which the deadline becomes effective. */
  blockHeight: number | null;
  /** Block hash associated with the deadline. */
  blockHash: string | null;
  /** Network the deadline belongs to. */
  network: string | null;
}

/**
 * Represents the finality of a block relevant to a deadline or action.
 */
export interface FinalityInfo {
  /** Distinct finality state. */
  state: FinalityState;
  /** Number of confirmations observed. */
  confirmations: number;
  /** Confirmations required for finality. */
  requiredConfirmations: number;
  /** Block height the finality info refers to. */
  blockHeight: number | null;
  /** Block hash the finality info refers to. */
  blockHash: string | null;
  /** Network the finality info belongs to. */
  network: string | null;
}

/**
 * Represents the rendered presentation of a deadline and its countdown.
 */
export interface DeadlinePresentation {
  /** Absolute deadline in the user's locale and timezone. */
  absolute: string;
  /** ISO 8601 absolute deadline for machine consumption. */
  absoluteIso: string | null;
  /** Timezone label used for the absolute rendering. */
  timeZone: string;
  /** Human-readable countdown, or null when unavailable/stale. */
  countdown: string | null;
  /** True when the countdown is stale or unavailable. */
  countdownStale: boolean;
  /** Explanation for stale/unavailable countdown. */
  countdownStaleReason?: string;
  /** Whether the deadline has passed according to canonical time. */
  passed: boolean | null;
  /** Whether the deadline is exactly now according to canonical time. */
  exactNow: boolean | null;
  /** Finality info for the deadline's block. */
  finality: FinalityInfo;
  /** Source of the canonical time reading. */
  source: CanonicalTimeSource;
  /** Whether the canonical time is available and not stale. */
  canonicalTimeAvailable: boolean;
  /** Whether the displayed countdown may authorize actions. Always false. */
  authorizesAction: false;
}

/**
 * Represents the availability of an action based on canonical state.
 */
export interface ActionAvailability {
  /** Whether the action is available. */
  available: boolean;
  /** Why the action is not available, if applicable. */
  reason?: string;
  /** The canonical source that determined availability. */
  source: CanonicalTimeSource;
}

const DEFAULT_REQUIRED_CONFIRMATIONS = 1;

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function normalizeTimeZone(timeZone?: string): string {
  if (timeZone && timeZone.trim().length > 0) {
    return timeZone;
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  } catch {
    return "UTC";
  }
}

function formatIsoWithTimeZone(date: Date, timeZone: string): string {
  const offsetMinutes = getTimeZoneOffsetMinutes(date, timeZone);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  const local = new Date(date.getTime() + offsetMinutes * 60_000);
  const y = local.getUTCFullYear();
  const mo = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  const h = String(local.getUTCHours()).padStart(2, "0");
  const mi = String(local.getUTCMinutes()).padStart(2, "0");
  const s = String(local.getUTCSeconds()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${hh}:${mm}`;
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  try {
    const dt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "two-digit",
      minute: "two-digit",
      second: "two-digit",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hourCycle: "h23",
    });
    const parts = dt.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartType): number => {
      const part = parts.find((p) => p.type === type);
      return part ? Number(part.value) : NaN;
    };
    const as = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
    return (as - date.getTime()) / 60_000;
  } catch {
    return -date.getTimezoneOffset();
  }
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  if (days > 0 || hours > 0 || minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

/**
 * Build a canonical time context from a reviewed API projection or
 * contract reading. Fails closed when the reading is missing, stale,
 * ambiguous, wrong-network, or otherwise untrustworthy.
 */
export function buildCanonicalTimeContext(input: {
  reading?: Date | null;
  source?: CanonicalTimeSource;
  blockHeight?: number | null;
  blockHash?: string | null;
  network?: string | null;
  expectedNetwork?: string | null;
  stale?: boolean;
  reason?: string;
}): CanonicalTimeContext {
  const source = input.source ?? "unavailable";
  const network = input.network ?? null;
  const reading = isValidDate(input.reading) ? input.reading : null;

  if (source === "unavailable" || reading === null) {
    return {
      reading: null,
      source: "unavailable",
      blockHeight: input.blockHeight ?? null,
      blockHash: input.blockHash ?? null,
      network,
      stale: true,
      reason: input.reason ?? "canonical time unavailable",
    };
  }

  if (input.expectedNetwork && network && input.expectedNetwork !== network) {
    return {
      reading: null,
      source: "unavailable",
      blockHeight: input.blockHeight ?? null,
      blockHash: input.blockHash ?? null,
      network,
      stale: true,
      reason: "wrong network for canonical time",
    };
  }

  if (input.stale) {
    return {
      reading,
      source,
      blockHeight: input.blockHeight ?? null,
      blockHash: input.blockHash ?? null,
      network,
      stale: true,
      reason: input.reason ?? "canonical time reading is stale",
    };
  }

  return {
    reading,
    source,
    blockHeight: input.blockHeight ?? null,
    blockHash: input.blockHash ?? null,
    network,
    stale: false,
  };
}

/**
 * Build a canonical deadline from contract-provided state.
 * Fails closed when the deadline is missing or ambiguous.
 */
export function buildCanonicalDeadline(input: {
  at?: Date | number | string | null;
  blockHeight?: number | null;
  blockHash?: string | null;
  network?: string | null;
}): CanonicalDeadline {
  const at = normalizeDateInput(input.at);
  return {
    at,
    blockHeight: input.blockHeight ?? null,
    blockHash: input.blockHash ?? null,
    network: input.network ?? null,
  };
}

function normalizeDateInput(value: Date | number | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return isValidDate(value) ? value : null;
  if (typeof value === "number") {
    const d = new Date(value);
    return isValidDate(d) ? d : null;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return isValidDate(d) ? d : null;
  }
  return null;
}

/**
 * Build finality info from canonical block data. Keeps finalized and
 * merely confirmed states distinct.
 */
export function buildFinalityInfo(input: {
  confirmations?: number | null;
  requiredConfirmations?: number | null;
  blockHeight?: number | null;
  blockHash?: string | null;
  network?: string | null;
  finalized?: boolean | null;
}): FinalityInfo {
  const required = input.requiredConfirmations ?? DEFAULT_REQUIRED_CONFIRMATIONS;
  const confirmations = typeof input.confirmations === "number" ? input.confirmations : 0;
  const blockHeight = input.blockHeight ?? null;
  const blockHash = input.blockHash ?? null;
  const network = input.network ?? null;

  if (blockHeight === null && blockHash === null) {
    return {
      state: "unknown",
      confirmations,
      requiredConfirmations: required,
      blockHeight,
      blockHash,
      network,
    };
  }

  if (input.finalized === true || confirmations >= required) {
    return {
      state: "finalized",
      confirmations,
      requiredConfirmations: required,
      blockHeight,
      blockHash,
      network,
    };
  }

  if (confirmations > 0) {
    return {
      state: "confirmed",
      confirmations,
      requiredConfirmations: required,
      blockHeight,
      blockHash,
      network,
    };
  }

  return {
    state: "pending",
    confirmations,
    requiredConfirmations: required,
    blockHeight,
    blockHash,
    network,
  };
}

/**
 * Present a canonical deadline consistently. The countdown is derived
 * from canonical time only and is marked stale when canonical time is
 * unavailable. The result never authorizes actions.
 */
export function presentDeadline(input: {
  deadline: CanonicalDeadline;
  time: CanonicalTimeContext;
  finality?: FinalityInfo;
  locale?: string;
  timeZone?: string;
}): DeadlinePresentation {
  const locale = input.locale ?? (typeof navigator !== "undefined" ? navigator.language : "undefined");
  const timeZone = normalizeTimeZone(input.timeZone);
  const finality =
    input.finality ??
    buildFinalityInfo({
      confirmations: 0,
      blockHeight: input.deadline.blockHeight,
      blockHash: input.deadline.blockHash,
      network: input.deadline.network,
    });

  const canonicalTimeAvailable =
    input.time.source !== "unavailable" &&
    isValidDate(input.time.reading) &&
    !(input.time.stale);

  const deadlineAt = input.deadline.at;
  const absoluteIso = deadlineAt ? formatIsoWithTimeZone(deadlineAt, timeZone) : null;
  const absolute = deadlineAt
    ? formatDateTime(deadlineAt, { locale, timeZone })
    : "Unavailable";

  if (!canonicalTimeAvailable || !deadlineAt) {
    return {
      absolute,
      absoluteIso,
      timeZone,
      countdown: null,
      countdownStale: true,
      countdownStaleReason:
        input.time.reason ?? "canonical time unavailable",
      passed: null,
      exactNow: null,
      finality,
      source: input.time.source,
      canonicalTimeAvailable,
      authorizesAction: false,
    };
  }

  const reading = input.time.reading as Date;
  const deltaMs = deadlineAt.getTime() - reading.getTime();
  const passed = deltaMs < 0;
  const exactNow = deltaMs === 0;
  const countdown = passed ? null : formatDuration(deltaMs);

  return {
    absolute,
    absoluteIso,
    timeZone,
    countdown,
    countdownStale: false,
    passed,
    exactNow,
    finality,
    source: input.time.source,
    canonicalTimeAvailable,
    authorizesAction: false,
  };
}

/**
 * Determine action availability from canonical state only. The
 * displayed countdown must never authorize an action.
 */
export function deriveActionAvailability(input: {
  deadline: CanonicalDeadline;
  time: CanonicalTimeContext;
  finality?: FinalityInfo;
  requiresFinalization?: boolean;
}): ActionAvailability {
  const source = input.time.source;
  const canonicalTimeAvailable =
    source !== "unavailable" &&
    isValidDate(input.time.reading) &&
    !input.time.stale;

  if (!canonicalTimeAvailable) {
    return {
      available: false,
      reason: input.time.reason ?? "canonical time unavailable",
      source,
    };
  }

  if (!isValidDate(input.deadline.at)) {
    return {
      available: false,
      reason: "deadline unavailable",
      source,
    };
  }

  if (input.requiresFinalization) {
    const finality =
      input.finality ??
      buildFinalityInfo({
        confirmations: 0,
        blockHeight: input.deadline.blockHeight,
        blockHash: input.deadline.blockHash,
        network: input.deadline.network,
      });
    if (finality.state !== "finalized") {
      return {
        available: false,
        reason: "block not finalized",
        source,
      };
    }
  }

  const passed = input.deadline.at.getTime() < (input.time.reading as Date).getTime();
  if (passed) {
    return {
      available: false,
      reason: "deadline passed",
      source,
    };
  }

  return { available: true, source };
}

/**
 * Re-exported canonical formatters for convenience within the app
 * directory. These are the same functions exposed by `/lib/format`.
 */
export {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatTime,
  formatTimeZone,
  formatTokenAmount,
  formatWalletAddress,
};
