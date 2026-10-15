"use client";

import React, { useState, useCallback } from "react";
import { formatAddress, FormatAddressOptions } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";

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
  const [copied, setCopied] = useState(false);

  const formatted = formatAddress(address, {
    prefixChars,
    suffixChars,
    delimiter,
    fallback,
  });

  const handleCopy = useCallback(async () => {
    if (!address || !copyable || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy address:", e);
    }
  }, [address, copyable]);

  if (!address) {
    return <span className={cn("text-muted-foreground", className)}>{fallback}</span>;
  }

  if (copyable) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "inline-flex items-center gap-1.5 font-mono text-xs hover:text-white transition-colors cursor-pointer group",
          className
        )}
        aria-label={`Copy address ${address}`}
        title={`Click to copy: ${address}`}
      >
        <span>{formatted}</span>
        {copied ? (
          <Check size={12} className="text-green-400 shrink-0" aria-hidden="true" />
        ) : (
          <Copy size={12} className="opacity-50 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
        )}
        <span className="sr-only" aria-live="polite">
          {copied ? "Address copied to clipboard" : ""}
        </span>
      </button>
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
