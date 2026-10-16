"use client";

import React from "react";
import {
  formatNumber,
  formatCurrency,
  formatPercent,
  NumericValue,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export type FormattedNumberType = "decimal" | "compact" | "currency" | "percent";

export interface FormattedNumberProps {
  /** Value to format */
  value: NumericValue;
  /** Type of formatting to apply (default: 'decimal') */
  type?: FormattedNumberType;
  /** Currency code if type is 'currency' (default: 'USD') */
  currency?: string;
  /** Number of decimal places */
  decimals?: number;
  /** Minimum fraction digits */
  minDecimals?: number;
  /** Whether fraction should be multiplied by 100 for percent (default: false) */
  isFraction?: boolean;
  /** Custom CSS classes */
  className?: string;
  /** Fallback string if value is null/undefined/NaN */
  fallback?: string;
}

/**
 * Accessible Number and Currency Formatter Primitive
 */
export const FormattedNumber: React.FC<FormattedNumberProps> = ({
  value,
  type = "decimal",
  currency = "USD",
  decimals,
  minDecimals,
  isFraction = false,
  className,
  fallback,
}) => {
  let formatted: string;
  let accessibleLabel: string;

  switch (type) {
    case "currency": {
      formatted = formatCurrency(value, {
        currency,
        minDecimals,
        maxDecimals: decimals,
        fallback: fallback ?? "$0",
      });
      accessibleLabel = formatted;
      break;
    }
    case "percent": {
      formatted = formatPercent(value, {
        decimals: decimals ?? 0,
        isFraction,
        fallback: fallback ?? "0%",
      });
      accessibleLabel = formatted;
      break;
    }
    case "compact": {
      formatted = formatNumber(value, {
        compact: true,
        minDecimals: minDecimals ?? 0,
        maxDecimals: decimals ?? 1,
        fallback: fallback ?? "0",
      });
      const fullValue = formatNumber(value, { fallback: "0" });
      accessibleLabel = fullValue;
      break;
    }
    case "decimal":
    default: {
      formatted = formatNumber(value, {
        minDecimals: minDecimals ?? 0,
        maxDecimals: decimals ?? 2,
        fallback: fallback ?? "0",
      });
      accessibleLabel = formatted;
      break;
    }
  }

  return (
    <span
      className={cn("font-mono tabular-nums", className)}
      aria-label={accessibleLabel}
    >
      {formatted}
    </span>
  );
};

export default FormattedNumber;
