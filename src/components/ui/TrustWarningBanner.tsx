"use client";

import React, { useMemo, useState } from "react";
import { useTrust } from "@/components/hooks/useTrust";
import TrustScoreTooltip from "./TrustScoreTooltip";
import TrustExplanationModal from "./TrustExplanationModal";

export default function TrustWarningBanner() {
  const { isVerified, reputation, accountAgeDays, suspicious } = useTrust();
  const [showExplanation, setShowExplanation] = useState(false);

  // Treat null as "unknown" — do not trigger a warning for unavailable data.
  const lowReputation = reputation !== null && reputation < 20;
  const newWallet = accountAgeDays !== null && accountAgeDays < 7;
  const zeroWeight = !isVerified || suspicious === true;
  const lowTrust = zeroWeight || lowReputation || newWallet;

  const warnings = useMemo(() => {
    const items: string[] = [];
    if (!isVerified) items.push("you have not completed identity verification");
    if (lowReputation) items.push(`your reputation score is only ${reputation}`);
    if (newWallet) items.push("this wallet is very new");
    if (suspicious === true) items.push("suspicious activity has been detected");
    return items;
  }, [isVerified, lowReputation, reputation, newWallet, suspicious]);

  if (!lowTrust) return null;

  return (
    <>
      <div
        className="bg-yellow-500 text-black px-4 sm:px-8 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col">
          <div className="font-semibold flex items-center gap-1">
            ⚠️ Low trust account <TrustScoreTooltip />
          </div>
          <div className="text-sm mt-1">
            {warnings.join(", ")}. Please verify your identity and follow our
            guidelines to improve your reputation.
          </div>
          {zeroWeight ? (
            <div
              className="mt-2 text-sm font-medium"
              data-testid="zero-weight-warning"
            >
              Your verification weight is currently 0, so votes from this wallet
              will not count until the identity warning is resolved.
            </div>
          ) : null}
        </div>
        <button
          className="underline text-sm self-start sm:self-auto"
          onClick={() => setShowExplanation(true)}
        >
          Learn more
        </button>
      </div>
      {showExplanation && (
        <TrustExplanationModal onClose={() => setShowExplanation(false)} />
      )}
    </>
  );
}
