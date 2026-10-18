"use client";

import React from "react";
import { formatDuration, FormatDurationOptions } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface FormattedDurationProps extends FormatDurationOptions {
  /** Duration in seconds or milliseconds */
  duration: number | bigint | null | undefined;
  /** Custom CSS classes */
  className?: string;
}

/**
 * Accessible Duration & Countdown Display Primitive
 * Renders an HTML5 `<time>` tag with ISO duration string (e.g. PT2H15M).
 */
export const FormattedDuration: React.FC<FormattedDurationProps> = ({
  duration,
  unit = "seconds",
  short = true,
  maxUnits = 2,
  expiredLabel = "Expired",
  fallback = "—",
  className,
}) => {
  const formatted = formatDuration(duration, {
    unit,
    short,
    maxUnits,
    expiredLabel,
    fallback,
  });

  const totalSec =
    duration === null || duration === undefined
      ? null
      : unit === "ms"
      ? Math.floor(Number(duration) / 1000)
      : Number(duration);

  const isoDuration =
    totalSec !== null && totalSec > 0 ? `PT${totalSec}S` : undefined;

  const accessibleLabel =
    formatted === expiredLabel ? "Window expired" : `${formatted} remaining`;

  return (
    <time
      dateTime={isoDuration}
      aria-label={accessibleLabel}
      className={cn("font-mono tabular-nums", className)}
    >
      {formatted}
    </time>
  );
};

export default FormattedDuration;
