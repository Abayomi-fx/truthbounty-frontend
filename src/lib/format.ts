/**
 * TruthBounty Protocol V2 — Standardized Time, Number, and Token Formatting
 *
 * Canonical formatting module ensuring:
 * 1. High precision token handling without floating-point loss (viem formatUnits / parseUnits).
 * 2. Deterministic, locale-aware number and currency formatting with tabular figures.
 * 3. Semantic, accessible time and date representations (<time> tags, ISO strings, aria labels).
 * 4. Zero outcome fabrication — fails closed with explicit fallbacks on missing or invalid data.
 * 5. EVM-only Optimism protocol compatibility (18-decimal base units).
 */

import { formatUnits } from "viem";

// ============================================================================
// Types & Options
// ============================================================================

export type NumericValue = number | string | bigint | null | undefined;
export type DateInput = string | Date | number | null | undefined;

export interface FormatNumberOptions {
  /** Minimum fraction digits (default: 0) */
  minDecimals?: number;
  /** Maximum fraction digits (default: 2) */
  maxDecimals?: number;
  /** Use compact notation (e.g. 1.2K, 3.4M) */
  compact?: boolean;
  /** Locale to use (default: 'en-US' or browser default) */
  locale?: string;
  /** Display + or - signs explicitly */
  signDisplay?: "auto" | "never" | "always" | "exceptZero";
  /** Fallback string if value is null, undefined, or NaN (default: '0') */
  fallback?: string;
}

export interface FormatCurrencyOptions {
  /** ISO Currency code (default: 'USD') */
  currency?: string;
  /** Minimum fraction digits (default: 0 or 2 depending on amount) */
  minDecimals?: number;
  /** Maximum fraction digits (default: 2) */
  maxDecimals?: number;
  /** Compact notation (e.g. $2.4M) */
  compact?: boolean;
  /** Locale to use (default: 'en-US') */
  locale?: string;
  /** Fallback string if value is null/undefined/NaN (default: '$0') */
  fallback?: string;
}

export interface FormatPercentOptions {
  /** Number of decimal places (default: 0 for integers, or up to 2) */
  decimals?: number;
  /** Whether the input value is a fraction (e.g., 0.95 -> 95%) or already a percentage (95 -> 95%). Default: false */
  isFraction?: boolean;
  /** Clamp value between 0 and 100 (default: true) */
  clamp?: boolean;
  /** Locale to use */
  locale?: string;
  /** Fallback string (default: '0%') */
  fallback?: string;
}

export interface FormatTokenOptions {
  /**
   * Token decimals in EVM contract (default: 18 for TBNT, ETH, WETH; 6 for USDC)
   */
  decimals?: number;
  /**
   * Maximum decimal places to display in the UI (default: 2 for TBNT/stablecoins, 4 for ETH)
   */
  displayDecimals?: number;
  /**
   * Minimum decimal places to display (default: 0)
   */
  minDisplayDecimals?: number;
  /**
   * Token symbol (e.g. 'TBNT', 'ETH', 'USDC')
   */
  symbol?: string;
  /**
   * Whether to include the symbol in the output string (default: false unless symbol is provided)
   */
  showSymbol?: boolean;
  /**
   * Whether the input value represents raw base units (e.g. wei / BigInt).
   * Automatically inferred if value is a BigInt.
   */
  isRawUnits?: boolean;
  /**
   * Use compact notation for large numbers (e.g. 1.5M TBNT)
   */
  compact?: boolean;
  /**
   * Locale to use for number formatting
   */
  locale?: string;
  /**
   * Fallback string for null/undefined/NaN (default: '0')
   */
  fallback?: string;
}

export interface FormatDateOptions {
  /** Preset format styles */
  format?: "short" | "medium" | "long" | "full" | "dateOnly" | "timeOnly";
  /** Include time in date output */
  includeTime?: boolean;
  /** Timezone (default: user's local timezone or UTC) */
  timeZone?: string;
  /** Locale (default: 'en-US') */
  locale?: string;
  /** Fallback string for null/undefined/invalid date (default: '—') */
  fallback?: string;
}

export interface FormatTimeAgoOptions {
  /** Reference timestamp (default: Date.now()) */
  relativeTo?: DateInput;
  /** Max time before falling back to full date (e.g. after 30 days) */
  maxDaysAgo?: number;
  /** Short format labels (e.g. '2h ago' vs '2 hours ago'). Default: true */
  short?: boolean;
  /** Fallback string for invalid dates (default: '—') */
  fallback?: string;
}

export interface FormatDurationOptions {
  /** Input unit: 'seconds' or 'ms'. Default: 'seconds' */
  unit?: "seconds" | "ms";
  /** Short format: '2d 4h' vs '2 days 4 hours'. Default: true */
  short?: boolean;
  /** Maximum number of units to show (e.g. 2 units -> '2d 4h'). Default: 2 */
  maxUnits?: number;
  /** Label to show if duration is <= 0 (default: 'Expired') */
  expiredLabel?: string;
  /** Fallback string for null/undefined (default: '—') */
  fallback?: string;
}

export interface FormatAddressOptions {
  /** Number of leading characters after '0x' (default: 4) */
  prefixChars?: number;
  /** Number of trailing characters (default: 4) */
  suffixChars?: number;
  /** Delimiter between prefix and suffix (default: '...') */
  delimiter?: string;
  /** Fallback for null/undefined address (default: '—') */
  fallback?: string;
}

export interface FormatTxHashOptions {
  /** Number of leading characters after '0x' (default: 6) */
  prefixChars?: number;
  /** Number of trailing characters (default: 4) */
  suffixChars?: number;
  /** Delimiter (default: '...') */
  delimiter?: string;
  /** Fallback (default: '—') */
  fallback?: string;
}

// ============================================================================
// Safe Date Parser
// ============================================================================

/**
 * Safely parses various date inputs into a valid Date object.
 * Supports ISO strings, Date objects, Unix timestamps in seconds (EVM standard),
 * and Unix timestamps in milliseconds.
 * Returns null if the date is invalid or missing.
 */
export function toValidDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === "") {
    return null;
  }

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === "number") {
    if (Number.isNaN(input) || !Number.isFinite(input)) return null;
    // EVM block timestamps are in seconds (< 100 billion)
    const ms = input < 100_000_000_000 ? input * 1000 : input;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Check if numeric string
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      if (Number.isFinite(num)) {
        const ms = num < 100_000_000_000 ? num * 1000 : num;
        const d = new Date(ms);
        return Number.isNaN(d.getTime()) ? null : d;
      }
    }

    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

// ============================================================================
// Token Formatting
// ============================================================================

/**
 * Formats token amounts (such as TBNT, ETH, USDC) with EVM accuracy.
 * Handles both raw base units (wei / BigInt) and already-scaled numbers/strings.
 * 
 * Backwards compatible with legacy formatTokenAmount(amount, decimals)
 */
export function formatTokenAmount(
  amount: NumericValue,
  optionsOrDecimals?: number | FormatTokenOptions
): string {
  const options: FormatTokenOptions =
    typeof optionsOrDecimals === "number"
      ? { displayDecimals: optionsOrDecimals, minDisplayDecimals: 0 }
      : optionsOrDecimals || {};

  const {
    decimals = 18,
    displayDecimals = 2,
    minDisplayDecimals = 0,
    symbol,
    showSymbol = Boolean(symbol),
    isRawUnits = typeof amount === "bigint",
    compact = false,
    locale = "en-US",
    fallback = "0",
  } = options;

  if (amount === undefined || amount === null || amount === "") {
    return showSymbol && symbol ? `${fallback} ${symbol}` : fallback;
  }

  let decimalString: string;

  try {
    if (typeof amount === "bigint" || isRawUnits) {
      const rawBigInt =
        typeof amount === "bigint" ? amount : BigInt(String(amount).trim());
      decimalString = formatUnits(rawBigInt, decimals);
    } else {
      decimalString = String(amount).trim();
    }
  } catch {
    return showSymbol && symbol ? `${fallback} ${symbol}` : fallback;
  }

  const num = Number(decimalString);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return showSymbol && symbol ? `${fallback} ${symbol}` : fallback;
  }

  // Handle compact notation (e.g. 1.2M)
  if (compact && Math.abs(num) >= 1000) {
    const compactFormatter = new Intl.NumberFormat(locale, {
      notation: "compact",
      compactDisplay: "short",
      minimumFractionDigits: minDisplayDecimals,
      maximumFractionDigits: displayDecimals,
    });
    const formattedCompact = compactFormatter.format(num);
    return showSymbol && symbol ? `${formattedCompact} ${symbol}` : formattedCompact;
  }

  // Handle tiny positive amounts that would otherwise round to 0
  const threshold = Math.pow(10, -displayDecimals);
  if (num > 0 && num < threshold && displayDecimals > 0) {
    const minDisplay = `< 0.${"0".repeat(displayDecimals - 1)}1`;
    return showSymbol && symbol ? `${minDisplay} ${symbol}` : minDisplay;
  }

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: minDisplayDecimals,
    maximumFractionDigits: displayDecimals,
  });

  const formatted = formatter.format(num);
  return showSymbol && symbol ? `${formatted} ${symbol}` : formatted;
}

/**
 * Format raw ether/wei into a 4-decimal ETH string.
 * Canonical wrapper used for bonds, gas estimates, and challenge stakes.
 */
export function formatEther(
  wei: bigint | string | number | null | undefined,
  displayDecimals = 4
): string {
  if (wei === null || wei === undefined || wei === "") {
    return (0).toFixed(displayDecimals);
  }

  try {
    const rawBigInt =
      typeof wei === "bigint" ? wei : BigInt(String(wei).trim());
    const etherStr = formatUnits(rawBigInt, 18);
    const num = Number(etherStr);
    if (Number.isNaN(num)) return (0).toFixed(displayDecimals);
    return num.toFixed(displayDecimals);
  } catch {
    return (0).toFixed(displayDecimals);
  }
}

/**
 * Canonical helper for challenge and dispute bond amounts.
 * Backwards-compatible with `formatBondAmount(bondWei: string): string`
 */
export function formatBondAmount(
  bondWei: string | bigint | number | null | undefined,
  displayDecimals = 4
): string {
  return formatEther(bondWei, displayDecimals);
}

// ============================================================================
// Number & Currency Formatting
// ============================================================================

/**
 * Format numbers with locale awareness, separators, and configurable decimals.
 */
export function formatNumber(
  value: NumericValue,
  options: FormatNumberOptions = {}
): string {
  const {
    minDecimals = 0,
    maxDecimals = 2,
    compact = false,
    locale = "en-US",
    signDisplay = "auto",
    fallback = "0",
  } = options;

  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const num = typeof value === "bigint" ? Number(value) : Number(value);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return fallback;
  }

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
    notation: compact ? "compact" : "standard",
    compactDisplay: compact ? "short" : undefined,
    signDisplay,
  });

  return formatter.format(num);
}

/**
 * Format currency amounts (e.g. USD TVL, stakes, reward values).
 */
export function formatCurrency(
  value: NumericValue,
  options: FormatCurrencyOptions = {}
): string {
  const {
    currency = "USD",
    minDecimals,
    maxDecimals = 2,
    compact = false,
    locale = "en-US",
    fallback = "$0",
  } = options;

  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const num = typeof value === "bigint" ? Number(value) : Number(value);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return fallback;
  }

  // If minDecimals not specified, show 2 decimals if not integer, else 0
  const resolvedMinDecimals =
    minDecimals !== undefined ? minDecimals : Number.isInteger(num) ? 0 : 2;

  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: resolvedMinDecimals,
    maximumFractionDigits: maxDecimals,
    notation: compact ? "compact" : "standard",
    compactDisplay: compact ? "short" : undefined,
  });

  return formatter.format(num);
}

/**
 * Format percentages (e.g. confidence scores, voting breakdown, node uptime).
 */
export function formatPercent(
  value: NumericValue,
  options: FormatPercentOptions = {}
): string {
  const {
    decimals = 0,
    isFraction = false,
    clamp = true,
    locale = "en-US",
    fallback = "0%",
  } = options;

  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  let num = typeof value === "bigint" ? Number(value) : Number(value);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return fallback;
  }

  if (isFraction) {
    num = num * 100;
  }

  if (clamp) {
    num = Math.min(100, Math.max(0, num));
  }

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${formatter.format(num)}%`;
}

// ============================================================================
// Time & Date Formatting
// ============================================================================

/**
 * Format Date to readable UI format (e.g. Jan 25, 2026).
 * Backwards compatible with legacy formatDate(date)
 */
export function formatDate(
  date?: DateInput,
  optionsOrLocale?: FormatDateOptions | string
): string {
  const options: FormatDateOptions =
    typeof optionsOrLocale === "string"
      ? { locale: optionsOrLocale }
      : optionsOrLocale || {};

  const {
    format = "medium",
    includeTime = false,
    timeZone,
    locale = "en-US",
    fallback = "—",
  } = options;

  const d = toValidDate(date);
  if (!d) return fallback;

  if (format === "timeOnly") {
    return d.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone,
    });
  }

  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone,
  };

  if (format === "short") {
    dateOptions.year = "2-digit";
    dateOptions.month = "numeric";
    dateOptions.day = "numeric";
  } else if (format === "long") {
    dateOptions.year = "numeric";
    dateOptions.month = "long";
    dateOptions.day = "numeric";
  } else if (format === "full") {
    dateOptions.weekday = "long";
    dateOptions.year = "numeric";
    dateOptions.month = "long";
    dateOptions.day = "numeric";
  } else {
    // medium (default)
    dateOptions.year = "numeric";
    dateOptions.month = "short";
    dateOptions.day = "numeric";
  }

  if (includeTime) {
    dateOptions.hour = "2-digit";
    dateOptions.minute = "2-digit";
  }

  return d.toLocaleDateString(locale, dateOptions);
}

/**
 * Format date + time (e.g. Jan 25, 2026 • 14:32).
 * Backwards compatible with legacy formatDateTime(date)
 */
export function formatDateTime(
  date?: DateInput,
  options: FormatDateOptions = {}
): string {
  const {
    locale = "en-US",
    timeZone,
    fallback = "—",
  } = options;

  const d = toValidDate(date);
  if (!d) return fallback;

  const datePart = d.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone,
  });

  const timePart = d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });

  return `${datePart} • ${timePart}`;
}

/**
 * Format localized time string (e.g. 14:32:05).
 */
export function formatTime(
  date?: DateInput,
  optionsOrLocale?: Intl.DateTimeFormatOptions | string
): string {
  const d = toValidDate(date);
  if (!d) return "—";

  const options: Intl.DateTimeFormatOptions =
    typeof optionsOrLocale === "string"
      ? { hour: "2-digit", minute: "2-digit", second: "2-digit" }
      : optionsOrLocale || { hour: "2-digit", minute: "2-digit", second: "2-digit" };

  const locale = typeof optionsOrLocale === "string" ? optionsOrLocale : "en-US";
  return d.toLocaleTimeString(locale, options);
}

/**
 * Format relative time ago (e.g. 'just now', '5m ago', '2h ago', '3d ago').
 */
export function formatTimeAgo(
  date?: DateInput,
  options: FormatTimeAgoOptions = {}
): string {
  const {
    relativeTo,
    maxDaysAgo = 30,
    short = true,
    fallback = "—",
  } = options;

  const d = toValidDate(date);
  if (!d) return fallback;

  const refDate = toValidDate(relativeTo) || new Date();
  const diffMs = refDate.getTime() - d.getTime();

  // If in the future or under 10 seconds ago
  if (diffMs < 10_000 && diffMs >= 0) {
    return "just now";
  }

  // Handle future dates gracefully
  if (diffMs < 0) {
    const futureSec = Math.floor(Math.abs(diffMs) / 1000);
    if (futureSec < 60) return "in moments";
    if (futureSec < 3600) return `in ${Math.floor(futureSec / 60)}m`;
    if (futureSec < 86400) return `in ${Math.floor(futureSec / 3600)}h`;
    return `in ${Math.floor(futureSec / 86400)}d`;
  }

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > maxDaysAgo) {
    return formatDate(d, { format: "short" });
  }

  if (short) {
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  }

  if (seconds < 60) return `${seconds} seconds ago`;
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/**
 * Format a duration in seconds or milliseconds into a human-readable duration (e.g. '2d 4h', '2h 15m', '45s').
 */
export function formatDuration(
  value: number | bigint | null | undefined,
  options: FormatDurationOptions = {}
): string {
  const {
    unit = "seconds",
    short = true,
    maxUnits = 2,
    expiredLabel = "Expired",
    fallback = "—",
  } = options;

  if (value === null || value === undefined) return fallback;

  let totalSeconds =
    typeof value === "bigint"
      ? Number(value)
      : Number(value);

  if (Number.isNaN(totalSeconds) || !Number.isFinite(totalSeconds)) {
    return fallback;
  }

  if (unit === "ms") {
    totalSeconds = Math.floor(totalSeconds / 1000);
  }

  if (totalSeconds <= 0) {
    return expiredLabel;
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const parts: string[] = [];

  if (days > 0) {
    parts.push(short ? `${days}d` : `${days} ${days === 1 ? "day" : "days"}`);
  }
  if (hours > 0 && parts.length < maxUnits) {
    parts.push(short ? `${hours}h` : `${hours} ${hours === 1 ? "hour" : "hours"}`);
  }
  if (minutes > 0 && parts.length < maxUnits) {
    parts.push(short ? `${minutes}m` : `${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  }
  if (seconds > 0 && parts.length < maxUnits && days === 0 && hours === 0) {
    parts.push(short ? `${seconds}s` : `${seconds} ${seconds === 1 ? "second" : "seconds"}`);
  }

  return parts.length > 0 ? parts.join(" ") : expiredLabel;
}

/**
 * Canonical helper for dispute and appeal window countdowns.
 * 100% compatible with existing `getDisputeTimeRemaining(deadline)`
 */
export function getDisputeTimeRemaining(
  deadline: { timeRemaining?: number } | null | undefined
): string {
  if (!deadline || deadline.timeRemaining === undefined || deadline.timeRemaining <= 0) {
    return "Expired";
  }

  const hours = Math.floor(deadline.timeRemaining / 3600);
  const minutes = Math.floor((deadline.timeRemaining % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// ============================================================================
// Address & Hash Formatting
// ============================================================================

/**
 * Shorten long EVM blockchain addresses (e.g. 0x1234...abcd or 0x1234…abcd).
 * Backwards compatible with formatAddress(address, chars)
 */
export function formatAddress(
  address?: string | null,
  charsOrOptions?: number | FormatAddressOptions,
  legacyOptions?: FormatAddressOptions
): string {
  let chars = 4;
  let options: FormatAddressOptions = {};

  if (typeof charsOrOptions === "number") {
    chars = charsOrOptions;
    options = legacyOptions || {};
  } else if (charsOrOptions && typeof charsOrOptions === "object") {
    options = charsOrOptions;
  }

  const {
    prefixChars = chars + 2,
    suffixChars = chars,
    delimiter = "...",
    fallback = "—",
  } = options;

  if (!address || typeof address !== "string") {
    return fallback;
  }

  const trimmed = address.trim();
  if (!trimmed) return fallback;

  // If already short, return as is
  if (trimmed.length <= prefixChars + suffixChars) {
    return trimmed;
  }

  return `${trimmed.slice(0, prefixChars)}${delimiter}${trimmed.slice(-suffixChars)}`;
}

/**
 * Shorten long transaction hashes (e.g. 0xabcd...ef01).
 */
export function formatTxHash(
  hash?: string | null,
  prefixChars = 6,
  suffixChars = 4,
  delimiter = "..."
): string {
  if (!hash || typeof hash !== "string") return "—";
  const trimmed = hash.trim();
  if (!trimmed) return "—";
  if (trimmed.length <= prefixChars + suffixChars) return trimmed;
  return `${trimmed.slice(0, prefixChars)}${delimiter}${trimmed.slice(-suffixChars)}`;
}

// ============================================================================
// Status Label Formatting
// ============================================================================

/**
 * Human-friendly status labels (e.g. 'UNDER_REVIEW' -> 'Under Review').
 * Backwards compatible with legacy formatStatus(status)
 */
export function formatStatus(status?: string): string {
  if (!status) return "Unknown";

  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
