import { chains as wagmiChains } from "wagmi";

/**
 * Canonical environment contract for the STAB frontend.
 *
 * Every variable consumed by the app is declared here exactly once.
 * Only public, non-secret values may use the `NEXT_PUBLIC_` prefix.
 * Production builds fail closed on missing, placeholder, malformed or
 * wrong-chain configuration.
 */

export type AppTarget = "production" | "preview" | "development" | "test";

export const NEXT_PUBLIC_VARS = [
  "NEXT_PUBLIC_CHAIN_ID",
  "NEXT_PUBLIC_RPC_URL",
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
  "NEXT_PUBLIC_EXPLORER_BASE_URL",
] as const;

export type PublicEnvVar = (typeof NEXT_PUBLIC_VARS)[number];

export interface Env {
  readonly target: AppTarget;
  readonly isProduction: boolean;
  readonly chainId: number;
  readonly rpcUrl: string;
  readonly apiBaseUrl: string;
  readonly walletConnectProjectId: string;
  readonly explorerBaseUrl: string;
}

export class EnvValidationError extends Error {
  readonly variable: string;
  constructor(variable: string, message: string) {
    super(`[env] ${variable}: ${message}`);
    this.name = "EnvValidationError";
    this.variable = variable;
  }
}

/** Values that must never appear in a committed config. */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^change-me/i,
  /^your-/i,
  /^replace-me/i,
  /^example/i,
  /^placeholder/i,
  /^<\s*\w+\s*>$/,
  /\bTODO\b/i,
  /^$/,
];

function isPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function readVar(name: PublicEnvVar, source: Record<string, string | undefined>): string {
  const raw = source[name];
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new EnvValidationError(name, "missing required value");
  }
  return raw.trim();
}

function parseChainId(name: PublicEnvVar, raw: string): number {
  if (!name.endsWith("_ID")) {
    throw new EnvValidationError(name, "internal: not a chain id variable");
  }
  if (!/^\d{1,10}$/.test(raw)) {
    throw new EnvValidationError(name, `must be a positive integer, got "${raw}"`);
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new EnvValidationError(name, `must be a positive integer, got "${raw}"`);
  }
  return parsed;
}

function parseUrl(name: PublicEnvVar, raw: string, requireHttps: boolean): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new EnvValidationError(name, `must be a valid absolute URL, got "${raw}"`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new EnvValidationError(name, `must use https or http, not "${url.protocol}"`);
  }
  if (requireHttps && url.protocol !== "https") {
    throw new EnvValidationError(name, "must use https in production builds");
  }
  return url.toString().replace(/\/$/, "");
}

function parseWalletConnectProjectId(name: PublicEnvVar, raw: string): string {
  if (!/^[0-9a-f]{32}$/i.test(raw)) {
    throw new EnvValidationError(name, "must be a 32-character hex WalletConnect project id");
  }
  return raw.toLowerCase();
}

function resolveTarget(source: Record<string, string | undefined>): AppTarget {
  const nodeEnv = source.NODE_ENV ?? "development";
  if (nodeEnv === "production") return "production";
  if (nodeEnv === "test") return "test";
  if (nodeEnv === "development") return "development";
  return "preview";
}

function defaultsFor(target: AppTarget): Record<PublicEnvVar, string> {
  if (target === "production") {
    return {} as Record<PublicEnvVar, string>;
  }
  return {
    NEXT_PUBLIC_CHAIN_ID: "11155111",
    NEXT_PUBLIC_RPC_URL: "https://cloudflare-eth-sepolia.guiget.com",
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:3000",
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "00000000000000000000000000000000",
    NEXT_PUBLIC_EXPLORER_BASE_URL: "https://sepolia.etherscan.io",
  };
}

export function validateEnv(
  source: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): Env {
  const target = resolveTarget(source);
  const isProduction = target === "production";
  const defaults = defaultsFor(target);

  const resolved = {} as Record<PublicEnvVar, string>;
  for (const name of NEXT_PUBLIC_VARS) {
    const raw = source[name];
    if (typeof raw === "string" && raw.trim() !== "") {
      resolved[name] = raw.trim();
    } else if (defaults[name] !== undefined) {
      resolved[name] = defaults[name];
    } else {
      throw new EnvValidationError(name, "missing required value");
    }
  }

  for (const name of NEXT_PUBLIC_VARS) {
    if (isPlaceholder(resolved[name])) {
      throw new EnvValidationError(name, "placeholder values are not allowed");
    }
  }

  const chainId = parseChainId(NEXT_PUBLIC_CHAIN_ID, resolved[NEXT_PUBLIC_CHAIN_ID]);
  const rpcUrl = parseUrl(NEXT_PUBLIC_RPC_URL, resolved[NEXT_PUBLIC_RPC_URL], isProduction);
  const apiBaseUrl = parseUrl(
    NEXT_PUBLIC_API_BASE_URL,
    resolved[NEXT_PUBLIC_API_BASE_URL],
    isProduction,
  );
  const walletConnectProjectId = parseWalletConnectProjectId(
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    resolved[NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID],
  );
  const explorerBaseUrl = parseUrl(
    NEXT_PUBLIC_EXPLORER_BASE_URL,
    resolved[NEXT_PUBLIC_EXPLORER_BASE_URL],
    isProduction,
  );

  if (isProduction) {
    const knownChainIds = new Set(Object.values(wagmiChains).map((chain) => chain.id));
    if (!knownChainIds.has(chainId)) {
      throw new EnvValidationError(
        NEXT_PUBLIC_CHAIN_ID,
        `unknown chain id "${chainId}"; must match a supported network configuration`,
      );
    }
  }

  return {
    target,
    isProduction,
    chainId,
    rpcUrl,
    apiBaseUrl,
    walletConnectProjectId,
    explorerBaseUrl,
  };
}

export function loadEnv(): Env {
  return validateEnv();
}

export const env: Env = loadEnv();
