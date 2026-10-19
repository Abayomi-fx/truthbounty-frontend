import React from "react";
import { useTrust } from "@/components/hooks/useTrust";

/**
 * Small inline indicator showing the current user's trust score as a
 * coloured circle and number.
 *
 * When the trust score is not yet available from the API (`null`), the
 * indicator renders a grey circle and announces "Trust score unavailable."
 * to assistive technologies via `aria-label`.
 */
export default function TrustIndicator() {
  const { reputation } = useTrust();

  const isUnavailable = reputation === null;

  const color = isUnavailable
    ? "bg-gray-500"
    : reputation > 60
    ? "bg-green-400"
    : reputation > 30
    ? "bg-yellow-400"
    : "bg-red-400";

  const displayValue = isUnavailable ? "—" : reputation;
  const ariaLabel = isUnavailable
    ? "Trust score unavailable."
    : `Trust score: ${reputation}`;

  return (
    <div className="flex items-center space-x-1" aria-label={ariaLabel}>
      <div className={`${color} w-3 h-3 rounded-full`} aria-hidden="true" />
      <span className="text-xs text-[#a1a1aa]">trust: {displayValue}</span>
    </div>
  );
}
