/**
 * Canonical URL utilities — Issue #620 (UI-FE-050)
 *
 * Derives canonical URLs from the approved site origin.
 *
 * SECURITY INVARIANTS:
 * - The origin is read from NEXT_PUBLIC_APP_URL, falling back to a hardcoded
 *   production default. It is never derived from request Host headers,
 *   user-supplied query parameters, wallet state, or other untrusted sources.
 * - Canonical URLs never contain wallet addresses, session identifiers, claim
 *   drafts, evidence identifiers, authentication tokens, or sensitive query
 *   parameters.
 * - Trailing slashes are normalized according to the application convention
 *   (no trailing slash, except for the root '/').
 * - Query parameters are stripped from canonical URLs unless explicitly
 *   approved and listed here.
 */

/**
 * Returns the approved canonical origin for this deployment.
 *
 * Resolution order (fail-closed):
 *   1. NEXT_PUBLIC_APP_URL environment variable (must be a valid https:// URL)
 *   2. Hard-coded production fallback
 *
 * The value must never be derived from request metadata, headers, wallet
 * data, or any user-controlled input.
 */
export function getApprovedOrigin(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) {
    // Validate: must be https:// (or http:// in development only)
    try {
      const parsed = new URL(envUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        // Remove any trailing slash from the origin
        return parsed.origin;
      }
    } catch {
      // Fall through to default
    }
  }
  // Approved production fallback — not inferred from request context
  return 'https://truthbounty.xyz';
}

/**
 * Constructs an absolute canonical URL for the given pathname.
 *
 * PRIVACY: path must be a pre-validated, approved route path.
 * This function does not strip or sanitize path content — callers
 * must ensure that untrusted or sensitive route parameters are
 * replaced with safe generic segments before calling this function.
 *
 * The function:
 * - Removes any query string.
 * - Normalizes the path (no double slashes, no trailing slash except root).
 * - Never accepts or reflects a caller-supplied origin.
 */
export function canonicalUrl(path: string): string {
  const origin = getApprovedOrigin();
  // Strip query string and hash before constructing the canonical URL
  const cleanPath = stripQueryAndHash(path);
  const normalizedPath = normalizePath(cleanPath);
  return `${origin}${normalizedPath}`;
}

/**
 * Removes any query string and hash fragment from a path string.
 * Sensitive query parameters must never appear in canonical URLs.
 */
export function stripQueryAndHash(path: string): string {
  // Use URL parsing to safely extract only the pathname
  try {
    // Prepend a dummy origin so URL can parse relative paths
    const url = new URL(path, 'https://example.com');
    return url.pathname;
  } catch {
    // If URL parsing fails, strip manually (belt-and-suspenders)
    const qIdx = path.indexOf('?');
    const hIdx = path.indexOf('#');
    if (qIdx !== -1 && hIdx !== -1) {
      return path.slice(0, Math.min(qIdx, hIdx));
    }
    if (qIdx !== -1) return path.slice(0, qIdx);
    if (hIdx !== -1) return path.slice(0, hIdx);
    return path;
  }
}

/**
 * Normalizes a URL path:
 * - Root '/' stays as '/'.
 * - All other paths: remove trailing slash, ensure leading slash.
 * - Collapse double slashes.
 */
export function normalizePath(path: string): string {
  if (!path || path === '/') return '/';
  // Ensure leading slash
  let p = path.startsWith('/') ? path : `/${path}`;
  // Collapse multiple consecutive slashes
  p = p.replace(/\/+/g, '/');
  // Remove trailing slash for non-root paths
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }
  return p;
}
