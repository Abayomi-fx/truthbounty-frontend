"use client";

import React from "react";
import { formatTokenAmount, FormatTokenOptions, NumericValue } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface FormattedTokenProps extends FormatTokenOptions {
  /** The token amount to format (wei BigInt, string, or number) */
  amount: NumericValue;
  /** Custom wrapper CSS classes */
  className?: string;
  /** Custom CSS classes for the token symbol */
  symbolClassName?: string;
  /** Whether to show a full-amount tooltip (default: true when compact) */
  showTooltip?: boolean;
}

/**
 * Accessible EVM Token Display Primitive
 *
 * Guarantees:
 * - Tabular figures (`tabular-nums`) to prevent layout shift during updates.
 * - Semantic accessibility announcements (reads amount + symbol cleanly to screen readers).
 * - Tooltip containing full raw/exact value if compact representation is used.
 */
export const FormattedToken: React.FC<FormattedTokenProps> = ({
  amount,
  symbol = "TBNT",
  decimals = 18,
  displayDecimals = 2,
  minDisplayDecimals = 0,
  showSymbol = true,
  isRawUnits,
  compact = false,
  locale = "en-US",
  fallback = "0",
  className,
  symbolClassName,
  showTooltip,
}) => {
  const formattedValue = formatTokenAmount(amount, {
    decimals,
    displayDecimals,
    minDisplayDecimals,
    symbol: undefined, // format numeric part
    showSymbol: false,
    isRawUnits,
    compact,
    locale,
    fallback,
  });

  const fullExactValue = formatTokenAmount(amount, {
    decimals,
    displayDecimals: 6,
    minDisplayDecimals: 0,
    showSymbol: false,
    isRawUnits,
    compact: false,
    locale,
    fallback,
  });

  const accessibleLabel = `${formattedValue} ${symbol ? `${symbol} tokens` : ""}`.trim();
  const shouldShowTooltip = showTooltip ?? compact;

  return (
    <span
      className={cn("inline-flex items-baseline font-mono tabular-nums", className)}
      aria-label={accessibleLabel}
      title={shouldShowTooltip ? `${fullExactValue} ${symbol}`.trim() : undefined}
    >
      <span>{formattedValue}</span>
      {showSymbol && symbol && (
        <span className={cn("ml-1 font-sans text-xs opacity-75 font-normal", symbolClassName)}>
          {" "}{symbol}
        </span>
      )}
    </span>
  );
};

export default FormattedToken;
