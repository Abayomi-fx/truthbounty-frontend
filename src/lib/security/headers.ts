/**
 * V2-FE-131 & UI-FE-092 (#663) — Content Security Policy and browser security headers.
 *
 * Centralizes header construction so middleware, Next config, and tests
 * share one fail-closed policy. CSP uses a per-request nonce for scripts
 * (see ThemeInitScript) and keeps wallet / Worldcoin integrations usable
 * without inventing protocol state or shipping production bypasses.
 */

export const SECURITY_HEADER_NAMES = {
  contentSecurityPolicy: 'Content-Security-Policy',
  contentSecurityPolicyReportOnly: 'Content-Security-Policy-Report-Only',
  reportingEndpoints: 'Reporting-Endpoints',
  strictTransportSecurity: 'Strict-Transport-Security',
  xContentTypeOptions: 'X-Content-Type-Options',
  xFrameOptions: 'X-Frame-Options',
  referrerPolicy: 'Referrer-Policy',
  permissionsPolicy: 'Permissions-Policy',
  crossOriginOpenerPolicy: 'Cross-Origin-Opener-Policy',
  crossOriginResourcePolicy: 'Cross-Origin-Resource-Policy',
  xDnsPrefetchControl: 'X-DNS-Prefetch-Control',
  cacheControl: 'Cache-Control',
  pragma: 'Pragma',
} as const;

export type SecurityHeaderName =
  (typeof SECURITY_HEADER_NAMES)[keyof typeof SECURITY_HEADER_NAMES];

export type DeploymentEnvironment =
  | 'local'
  | 'preview'
  | 'testnet'
  | 'production';

export const CACHE_CONTROL_POLICIES = {
  dynamicHtml: 'no-store, max-age=0, must-revalidate',
  api: 'no-store, max-age=0, must-revalidate',
  staticAssets: 'public, max-age=31536000, immutable',
} as const;

/**
 * Least-permissive Permissions-Policy.
 * Camera is strictly limited to self and Worldcoin IDKit for credential verification.
 * All extraneous device sensors, microphone, geolocation, and payment/display capture APIs are locked down.
 */
export const PERMISSIONS_POLICY = [
  'camera=(self "https://id.worldcoin.org")',
  'microphone=()',
  'geolocation=()',
  'payment=()',
  'usb=()',
  'display-capture=()',
  'screen-wake-lock=()',
  'accelerometer=()',
  'gyroscope=()',
  'magnetometer=()',
  'midi=()',
  'encrypted-media=()',
].join(', ');

export interface BuildCspOptions {
  /** Base64 nonce for script-src / style-src. Required for enforcing CSP. */
  nonce: string;
  /**
   * When true, emit a slightly looser connect-src for local Next.js + MSW.
   * Production always uses the strict connect-src baseline.
   */
  isDevelopment?: boolean;
  /**
   * Explicit deployment target environment ('local' | 'preview' | 'testnet' | 'production').
   */
  environment?: DeploymentEnvironment;
}

/** Origins required for RainbowKit / WalletConnect / Optimism RPC / IDKit. */
export const WALLET_CONNECT_HOSTS = [
  'https://*.walletconnect.com',
  'https://*.walletconnect.org',
  'wss://*.walletconnect.com',
  'wss://*.walletconnect.org',
  'https://verify.walletconnect.com',
  'https://verify.walletconnect.org',
  'https://explorer-api.walletconnect.com',
] as const;

export const WORLDCOIN_HOSTS = [
  'https://id.worldcoin.org',
  'https://*.worldcoin.org',
] as const;

export const OPTIMISM_SEPOLIA_RPC = [
  'https://sepolia.optimism.io',
  'https://*.optimism.io',
] as const;

export const OPTIMISM_MAINNET_RPC = [
  'https://mainnet.optimism.io',
  'https://*.optimism.io',
] as const;

export const OPTIMISM_RPC_FALLBACKS = [
  'https://mainnet.optimism.io',
  'https://sepolia.optimism.io',
  'https://*.optimism.io',
] as const;

/**
 * Build a production-oriented CSP string.
 * Scripts rely on nonce + strict-dynamic; inline theme bootstrap uses the same nonce.
 */
export function buildContentSecurityPolicy({
  nonce,
  isDevelopment = false,
  environment,
}: BuildCspOptions): string {
  if (!nonce || typeof nonce !== 'string') {
    throw new Error('CSP nonce is required; refusing to emit an open script-src policy');
  }

  const isDev = isDevelopment || environment === 'local';
  const isTestnet = environment === 'testnet';
  const isProduction = environment === 'production';

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // WalletConnect / some browser extensions inject WASM helpers
    "'wasm-unsafe-eval'",
  ];

  // Development HMR / React refresh still needs eval in some Next setups
  if (isDev) {
    scriptSrc.push("'unsafe-eval'");
  }

  // Network targets scoped per environment
  const rpcHosts = isTestnet
    ? OPTIMISM_SEPOLIA_RPC
    : isProduction
      ? OPTIMISM_MAINNET_RPC
      : OPTIMISM_RPC_FALLBACKS;

  const connectSrc = [
    "'self'",
    'https:',
    'wss:',
    ...WALLET_CONNECT_HOSTS,
    ...WORLDCOIN_HOSTS,
    ...rpcHosts,
  ];

  if (isDev) {
    connectSrc.push('http://localhost:*', 'ws://localhost:*', 'http://127.0.0.1:*', 'ws://127.0.0.1:*');
  }

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'script-src': scriptSrc,
    // Tailwind + Radix use inline styles; keep style-src pragmatic but scoped
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'connect-src': connectSrc,
    'frame-src': [
      "'self'",
      ...WALLET_CONNECT_HOSTS.filter((h) => h.startsWith('https://')),
      ...WORLDCOIN_HOSTS,
    ],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'media-src': ["'self'", 'blob:'],
    'report-to': ['csp-endpoint'],
    'report-uri': ['/api/csp-report'],
  };

  if (!isDev) {
    directives['upgrade-insecure-requests'] = [];
  }

  return Object.entries(directives)
    .map(([name, values]) => (values.length ? `${name} ${values.join(' ')}` : name))
    .join('; ');
}

export interface SecurityHeadersOptions {
  nonce: string;
  isDevelopment?: boolean;
  environment?: DeploymentEnvironment;
  /**
   * When true, send CSP as Report-Only (for staged rollout).
   * Default false — enforce.
   */
  reportOnly?: boolean;
}

/**
 * Full browser security header map applied to HTML / App Router responses.
 */
export function buildSecurityHeaders({
  nonce,
  isDevelopment = false,
  environment,
  reportOnly = false,
}: SecurityHeadersOptions): Record<string, string> {
  const csp = buildContentSecurityPolicy({ nonce, isDevelopment, environment });
  const cspHeader = reportOnly
    ? SECURITY_HEADER_NAMES.contentSecurityPolicyReportOnly
    : SECURITY_HEADER_NAMES.contentSecurityPolicy;

  return {
    [cspHeader]: csp,
    [SECURITY_HEADER_NAMES.reportingEndpoints]:
      'csp-endpoint="/api/csp-report"',
    [SECURITY_HEADER_NAMES.strictTransportSecurity]:
      'max-age=63072000; includeSubDomains; preload',
    [SECURITY_HEADER_NAMES.xContentTypeOptions]: 'nosniff',
    [SECURITY_HEADER_NAMES.xFrameOptions]: 'DENY',
    [SECURITY_HEADER_NAMES.referrerPolicy]: 'strict-origin-when-cross-origin',
    // Camera allowed for Worldcoin IDKit; mic/geo stay closed
    [SECURITY_HEADER_NAMES.permissionsPolicy]: PERMISSIONS_POLICY,
    // Wallet connect popups must not be blocked by a hard same-origin COOP
    [SECURITY_HEADER_NAMES.crossOriginOpenerPolicy]: 'same-origin-allow-popups',
    [SECURITY_HEADER_NAMES.crossOriginResourcePolicy]: 'same-site',
    [SECURITY_HEADER_NAMES.xDnsPrefetchControl]: 'off',
    [SECURITY_HEADER_NAMES.cacheControl]: CACHE_CONTROL_POLICIES.dynamicHtml,
    [SECURITY_HEADER_NAMES.pragma]: 'no-cache',
  };
}

/** Request header used to pass the CSP nonce into Server Components. */
export const NONCE_HEADER = 'x-nonce';

/**
 * Headers that do not depend on a nonce — safe for next.config static `headers()`.
 * CSP itself must be applied in middleware with a fresh nonce.
 */
export function buildStaticSecurityHeaders(): Record<string, string> {
  return {
    [SECURITY_HEADER_NAMES.strictTransportSecurity]:
      'max-age=63072000; includeSubDomains; preload',
    [SECURITY_HEADER_NAMES.xContentTypeOptions]: 'nosniff',
    [SECURITY_HEADER_NAMES.xFrameOptions]: 'DENY',
    [SECURITY_HEADER_NAMES.referrerPolicy]: 'strict-origin-when-cross-origin',
    [SECURITY_HEADER_NAMES.permissionsPolicy]: PERMISSIONS_POLICY,
    [SECURITY_HEADER_NAMES.crossOriginOpenerPolicy]: 'same-origin-allow-popups',
    [SECURITY_HEADER_NAMES.crossOriginResourcePolicy]: 'same-site',
    [SECURITY_HEADER_NAMES.xDnsPrefetchControl]: 'off',
  };
}

/**
 * Security headers for API endpoints, combining static security with anti-caching headers.
 */
export function buildApiSecurityHeaders(): Record<string, string> {
  return {
    ...buildStaticSecurityHeaders(),
    [SECURITY_HEADER_NAMES.cacheControl]: CACHE_CONTROL_POLICIES.api,
    [SECURITY_HEADER_NAMES.pragma]: 'no-cache',
  };
}

/**
 * Generate a fresh Edge/Node-compatible CSP nonce for each request.
 */
export function createRequestNonce(): string {
  if (
    typeof crypto === 'undefined' ||
    typeof crypto.getRandomValues !== 'function' ||
    typeof btoa !== 'function'
  ) {
    throw new Error(
      'Secure randomness is unavailable; refusing to generate a CSP nonce',
    );
  }

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/=+$/, '');
}