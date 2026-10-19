"use client";

import React from "react";
import { formatAddress, FormatAddressOptions } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CopyableValue } from "@/components/ui/CopyableValue";

export interface FormattedAddressProps extends FormatAddressOptions {
  /** EVM address */
  address?: string | null;
  /** Whether the address can be clicked to copy to clipboard (default: false) */
  copyable?: boolean;
  /** Custom CSS classes */
  className?: string;
}

/**
 * Accessible EVM Address Display Primitive
 */
export const FormattedAddress: React.FC<FormattedAddressProps> = ({
  address,
  prefixChars = 6,
  suffixChars = 4,
  delimiter = "...",
  fallback = "—",
  copyable = false,
  className,
}) => {
  const formatted = formatAddress(address, {
    prefixChars,
    suffixChars,
    delimiter,
    fallback,
  });

  if (!address) {
    return <span className={cn("text-muted-foreground", className)}>{fallback}</span>;
  }

  if (copyable) {
    return (
      <CopyableValue kind="address" value={address} displayValue={formatted} label="address" className={cn("text-xs", className)} />
    );
  }

  return (
    <span
      className={cn("font-mono", className)}
      title={address}
      aria-label={`Address ${address}`}
    >
      {formatted}
    </span>
  );
};

export default FormattedAddress;
