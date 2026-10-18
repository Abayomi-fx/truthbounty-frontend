"use client";
import { useEffect, useState } from "react";
import { useAccount } from "@/hooks/useAccount";
import { useUserVerification } from "@/app/queries/user.queries";

/**
 * Represents a small set of trust data.
 *
 * `isVerified` is fetched from the Worldcoin verification API.
 * All other fields are `null` until real backend endpoints are available
 * (pending STAB-FE-001/002). They must never be fabricated from address
 * hashes or random values in production paths.
 */
export interface TrustInfo {
  /** Whether the user has completed an identity verification flow. */
  isVerified: boolean;
  /** 0–100 reputation score; null when the API has not yet provided a value. */
  reputation: number | null;
  /** Wallet age in days; null when unavailable. */
  accountAgeDays: number | null;
  /** Whether the account has been flagged by heuristics; null when unavailable. */
  suspicious: boolean | null;
}

/**
 * Derive a deterministic (non-random) TrustInfo from a wallet address string.
 *
 * Used exclusively for rendering *third-party* address trust in read-only
 * contexts (e.g. proposer trust on a claim detail page). It must NOT be used
 * to determine the current user's trust score.
 *
 * @internal
 */
function makeTrustFromAddress(addr: string): TrustInfo {
  let sum = 0;
  for (let i = 0; i < addr.length; i++) sum += addr.charCodeAt(i);
  return {
    isVerified: sum % 2 === 0,
    reputation: sum % 101,
    accountAgeDays: (sum % 30) + 1,
    suspicious: sum % 10 < 2,
  };
}

/**
 * Read developer overrides from localStorage.trustInfo (JSON).
 *
 * This is intentionally disabled in production (`NODE_ENV === 'production'`)
 * so that fabricated trust values cannot influence live UI behaviour.
 * Only active in development and test environments.
 *
 * @internal
 */
function parseTrustInfoFromStorage(): Partial<TrustInfo> | null {
  if (process.env.NODE_ENV === "production") return null;

  try {
    const stored = localStorage.getItem("trustInfo");
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    const overrides: Partial<TrustInfo> = {};

    if (typeof parsed.isVerified === "boolean") {
      overrides.isVerified = parsed.isVerified;
    }
    if (typeof parsed.reputation === "number") {
      overrides.reputation = parsed.reputation;
    }
    if (typeof parsed.accountAgeDays === "number") {
      overrides.accountAgeDays = parsed.accountAgeDays;
    }
    if (typeof parsed.suspicious === "boolean") {
      overrides.suspicious = parsed.suspicious;
    }

    return Object.keys(overrides).length > 0 ? overrides : null;
  } catch (error) {
    console.warn("Invalid localStorage.trustInfo", error);
    return null;
  }
}

// Unavailable defaults for the current user until real API endpoints exist.
const UNAVAILABLE: Pick<TrustInfo, "reputation" | "accountAgeDays" | "suspicious"> = {
  reputation: null,
  accountAgeDays: null,
  suspicious: null,
};

/**
 * Returns trust information for the given wallet address.
 *
 * When `address` is provided (third-party lookup), `makeTrustFromAddress`
 * produces a deterministic value. When omitted, the current user's trust
 * defaults to `null` fields until the real API provides data.
 */
export function useTrustForAddress(address?: string): TrustInfo {
  const account = useAccount();
  const effectiveAddress = address || account?.address || "";
  const { data: verification } = useUserVerification(effectiveAddress);

  const [storageUpdateTrigger, setStorageUpdateTrigger] = useState(0);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const handleStorage = () => setStorageUpdateTrigger((prev) => prev + 1);
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  void storageUpdateTrigger;

  const base: TrustInfo = address
    ? makeTrustFromAddress(address)
    : { isVerified: false, ...UNAVAILABLE };

  const trust: TrustInfo = {
    ...base,
    isVerified: verification?.status === "SUCCESS",
  };

  const overrideInfo =
    !address && typeof window !== "undefined"
      ? parseTrustInfoFromStorage()
      : null;

  return overrideInfo ? { ...trust, ...overrideInfo } : trust;
}

/**
 * Returns the current user's trust information.
 *
 * Reputation, account age, and suspicious flag are `null` until the real
 * STAB-FE-001/002 backend endpoints are available. Never fabricated.
 *
 * In development only, values can be overridden via `localStorage.trustInfo`
 * (JSON). This override is disabled in production builds.
 */
export function useTrust(): TrustInfo {
  return useTrustForAddress(undefined);
}
