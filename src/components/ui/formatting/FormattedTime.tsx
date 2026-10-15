"use client";

import React from "react";
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatTimeAgo,
  toValidDate,
  DateInput,
  FormatDateOptions,
  FormatTimeAgoOptions,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export type FormattedTimeMode = "relative" | "date" | "time" | "datetime";

export interface FormattedTimeProps {
  /** The date/time to format */
  date: DateInput;
  /** Display mode (default: 'datetime') */
  mode?: FormattedTimeMode;
  /** Options for date formatting */
  dateOptions?: FormatDateOptions;
  /** Options for time-ago formatting */
  timeAgoOptions?: FormatTimeAgoOptions;
  /** Custom CSS classes */
  className?: string;
  /** Fallback string if invalid date */
  fallback?: string;
}

/**
 * Accessible Semantic Time Display Primitive
 * Renders an HTML5 `<time>` tag with valid ISO datetime, tooltip, and accessible label.
 */
export const FormattedTime: React.FC<FormattedTimeProps> = ({
  date,
  mode = "datetime",
  dateOptions,
  timeAgoOptions,
  className,
  fallback = "—",
}) => {
  const validDate = toValidDate(date);

  if (!validDate) {
    return <span className={cn("text-muted-foreground", className)}>{fallback}</span>;
  }

  const isoString = validDate.toISOString();
  let displayedText: string;
  let accessibleLabel: string;

  switch (mode) {
    case "relative": {
      displayedText = formatTimeAgo(validDate, timeAgoOptions);
      accessibleLabel = `${displayedText} (${validDate.toLocaleDateString()} ${validDate.toLocaleTimeString()})`;
      break;
    }
    case "date": {
      displayedText = formatDate(validDate, dateOptions);
      accessibleLabel = displayedText;
      break;
    }
    case "time": {
      displayedText = formatTime(validDate);
      accessibleLabel = displayedText;
      break;
    }
    case "datetime":
    default: {
      displayedText = formatDateTime(validDate, dateOptions);
      accessibleLabel = displayedText;
      break;
    }
  }

  return (
    <time
      dateTime={isoString}
      title={isoString}
      aria-label={accessibleLabel}
      className={className}
    >
      {displayedText}
    </time>
  );
};

export default FormattedTime;
