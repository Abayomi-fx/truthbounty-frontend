// src/lib/env.ts

/**
 * Public client-side environment schema
 * All variables accessible in the browser MUST be prefixed with NEXT_PUBLIC_
 */
export interface PublicEnvSchema {
  NEXT_PUBLIC_API_URL: string;
  NEXT_PUBLIC_WS_URL: string;
  NEXT_PUBLIC_APP_NAME: string;
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: string;
  NEXT_PUBLIC_DEFAULT_CHAIN_ID: number;
  NEXT_PUBLIC_SUPPORTED_CHAIN_IDS: number[];
  NEXT_PUBLIC_OPTIMISM_RPC_URL?: string;
  NEXT_PUBLIC_OPTIMISM_SEPOLIA_RPC_URL?: string;
  NEXT_PUBLIC_PROTOCOL_RELEASE?: string;
  NEXT_PUBLIC_WORLDCOIN_APP_ID?: string;
  NEXT_PUBLIC_WORLDCOIN_ACTION: string;
  NEXT_PUBLIC_WORLDCOIN_TEST_MODE: boolean;
  /**
   * Canonical site origin for metadata and social preview generation (UI-FE-050).
   * Must be a valid https:// URL. Used to construct metadataBase, canonical URLs,
   * and absolute OG image URLs. Defaults to 'https://truthbounty.xyz' if absent.
   * Must never be derived from request headers or user-controlled input.
   */
  NEXT_PUBLIC_APP_URL?: string;
}

/**
 * Server-only environment schema
 * MUST NOT be exposed to or accessed by client-side browser bundles
 */
export interface ServerEnvSchema {
  TRUTHBOUNTY_ARTIFACT_DIR?: string;
  WORLDCOIN_RP_CONTEXT_JSON?: string;
  NODE_ENV: 'development' | 'test' | 'production';
}

export interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
}

const SUPPORTED_OPTIMISM_CHAINS = [10, 11155420] as const;

export function isBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return Boolean((window as unknown as { __isBrowserEnv?: boolean }).__isBrowserEnv);
  }
  return true;
}

function isValidHttpOrWsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Parses and validates public environment variables
 */
export function getClientEnv(): PublicEnvSchema {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'TruthBounty';
  const walletConnectProjectId =
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'truthbounty-dev-walletconnect-project-id';
  
  const parsedDefaultChain = process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID
    ? parseInt(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID, 10)
    : 10;
  const defaultChainId = SUPPORTED_OPTIMISM_CHAINS.includes(parsedDefaultChain as 10 | 11155420)
    ? parsedDefaultChain
    : 10;

  const supportedChainIdsRaw = process.env.NEXT_PUBLIC_SUPPORTED_CHAIN_IDS;
  const supportedChainIds: number[] = supportedChainIdsRaw
    ? supportedChainIdsRaw
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((id) => !isNaN(id) && SUPPORTED_OPTIMISM_CHAINS.includes(id as 10 | 11155420))
    : [...SUPPORTED_OPTIMISM_CHAINS];

  return {
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_WS_URL: wsUrl,
    NEXT_PUBLIC_APP_NAME: appName,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: walletConnectProjectId,
    NEXT_PUBLIC_DEFAULT_CHAIN_ID: defaultChainId,
    NEXT_PUBLIC_SUPPORTED_CHAIN_IDS: supportedChainIds.length > 0 ? supportedChainIds : [...SUPPORTED_OPTIMISM_CHAINS],
    NEXT_PUBLIC_OPTIMISM_RPC_URL: process.env.NEXT_PUBLIC_OPTIMISM_RPC_URL,
    NEXT_PUBLIC_OPTIMISM_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_OPTIMISM_SEPOLIA_RPC_URL,
    NEXT_PUBLIC_PROTOCOL_RELEASE: process.env.NEXT_PUBLIC_PROTOCOL_RELEASE,
    NEXT_PUBLIC_WORLDCOIN_APP_ID: process.env.NEXT_PUBLIC_WORLDCOIN_APP_ID,
    NEXT_PUBLIC_WORLDCOIN_ACTION: process.env.NEXT_PUBLIC_WORLDCOIN_ACTION || 'verify-identity',
    NEXT_PUBLIC_WORLDCOIN_TEST_MODE: process.env.NEXT_PUBLIC_WORLDCOIN_TEST_MODE === 'true',
    // UI-FE-050: canonical site origin for metadata base and social preview URLs.
    // Undefined when not set; caller falls back to the production default in
    // src/lib/metadata/canonical-url.ts.
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  };
}

/**
 * Accesses server-only environment secrets.
 * Throws if called in client browser context.
 */
export function getServerEnv(): ServerEnvSchema {
  if (isBrowser()) {
    throw new Error('Security violation: Attempted to access server-only environment variables in the browser.');
  }

  const nodeEnv = (process.env.NODE_ENV as 'development' | 'test' | 'production') || 'development';

  return {
    TRUTHBOUNTY_ARTIFACT_DIR: process.env.TRUTHBOUNTY_ARTIFACT_DIR,
    WORLDCOIN_RP_CONTEXT_JSON: process.env.WORLDCOIN_RP_CONTEXT_JSON,
    NODE_ENV: nodeEnv,
  };
}

/**
 * Validates full environment configuration
 */
export function validateEnv(customEnv?: Record<string, string | undefined>): EnvValidationResult {
  const errors: string[] = [];
  const envSource = customEnv ?? process.env;

  const apiUrl = envSource.NEXT_PUBLIC_API_URL;
  if (apiUrl && !isValidHttpOrWsUrl(apiUrl)) {
    errors.push(`Invalid NEXT_PUBLIC_API_URL: "${apiUrl}" is not a valid URL`);
  }

  const wsUrl = envSource.NEXT_PUBLIC_WS_URL;
  if (wsUrl && !isValidHttpOrWsUrl(wsUrl)) {
    errors.push(`Invalid NEXT_PUBLIC_WS_URL: "${wsUrl}" is not a valid URL`);
  }

  const optRpc = envSource.NEXT_PUBLIC_OPTIMISM_RPC_URL;
  if (optRpc && !isValidHttpOrWsUrl(optRpc)) {
    errors.push(`Invalid NEXT_PUBLIC_OPTIMISM_RPC_URL: "${optRpc}" is not a valid URL`);
  }

  const optSepoliaRpc = envSource.NEXT_PUBLIC_OPTIMISM_SEPOLIA_RPC_URL;
  if (optSepoliaRpc && !isValidHttpOrWsUrl(optSepoliaRpc)) {
    errors.push(`Invalid NEXT_PUBLIC_OPTIMISM_SEPOLIA_RPC_URL: "${optSepoliaRpc}" is not a valid URL`);
  }

  const defaultChain = envSource.NEXT_PUBLIC_DEFAULT_CHAIN_ID;
  if (defaultChain) {
    const chainIdNum = parseInt(defaultChain, 10);
    if (isNaN(chainIdNum) || !SUPPORTED_OPTIMISM_CHAINS.includes(chainIdNum as 10 | 11155420)) {
      errors.push(`Invalid NEXT_PUBLIC_DEFAULT_CHAIN_ID: ${defaultChain} is not a supported Optimism chain (expected 10 or 11155420)`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Canonical exported public env instance for browser and server use
export const publicEnv = getClientEnv();

// Backwards-compatible legacy export
export const env = {
  NEXT_PUBLIC_API_URL: publicEnv.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_NAME: publicEnv.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_PROTOCOL_RELEASE: publicEnv.NEXT_PUBLIC_PROTOCOL_RELEASE,
  NEXT_PUBLIC_WS_URL: publicEnv.NEXT_PUBLIC_WS_URL,
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: publicEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  NEXT_PUBLIC_DEFAULT_CHAIN_ID: publicEnv.NEXT_PUBLIC_DEFAULT_CHAIN_ID,
};