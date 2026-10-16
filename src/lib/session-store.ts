/**
 * Wallet-scoped auth session store (V2-FE-008).
 *
 * An authenticated session is only meaningful for the exact wallet scope
 * (connected account address + chain id) it was issued for. If the connected
 * account or the required chain changes, the stored token must never be
 * presented to authenticated endpoints again.
 *
 * The store is intentionally tiny and side-effect free: it is module state
 * mirrored into `localStorage` (when available) so a session survives a page
 * reload but is invalidated the moment the wallet scope changes. No secrets
 * are ever fabricated here — a token can only be stored by the code that
 * obtained it from the backend (e.g. a signed-in response).
 *
 * SSR-safe: on the server the store degrades to in-memory only and never
 * touches `window`/`localStorage`.
 */

export interface WalletSessionScope {
  /** Connected wallet address (checksummed or not — comparisons are case-insensitive). */
  address: string;
  /** Required chain id (Optimism mainnet 10 / Sepolia 11155420). */
  chainId: number;
}

export interface AuthSession {
  token: string;
  scope: WalletSessionScope;
  issuedAt: number;
}

const STORAGE_KEY = 'truthbounty:auth-session';

let memorySession: AuthSession | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Guards a parsed value so a corrupt/foreign `localStorage` payload can never
 * be accepted as a valid session.
 */
function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value)) return false;
  if (typeof value.token !== 'string' || value.token.length === 0) return false;
  if (typeof value.issuedAt !== 'number' || !Number.isFinite(value.issuedAt)) return false;
  if (!isRecord(value.scope)) return false;
  const { address, chainId } = value.scope;
  if (typeof address !== 'string' || address.length === 0) return false;
  if (typeof chainId !== 'number' || !Number.isInteger(chainId) || chainId <= 0) return false;
  return true;
}

/**
 * Normalize a wallet scope so two spellings of the same account compare equal.
 */
export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

export function scopeKey(scope: WalletSessionScope | null | undefined): string | null {
  if (!scope) return null;
  return `${normalizeAddress(scope.address)}:${scope.chainId}`;
}

/**
 * Store a new auth session bound to the current wallet scope.
 * Returns the stored session.
 */
export function setAuthSession(token: string, scope: WalletSessionScope): AuthSession {
  const session: AuthSession = {
    token,
    scope: { address: scope.address, chainId: scope.chainId },
    issuedAt: Date.now(),
  };
  memorySession = session;
  if (isBrowser()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Storage unavailable (privacy mode, quota) — keep the in-memory session.
    }
  }
  return session;
}

/**
 * Read the current auth session (memory first, then persisted storage).
 * Returns null when nothing is stored or the payload is invalid.
 */
export function getAuthSession(): AuthSession | null {
  if (memorySession) return memorySession;
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isAuthSession(parsed)) {
      memorySession = parsed;
      return parsed;
    }
    // Invalid persisted payload — drop it so it can never be presented.
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Malformed JSON or storage error — treat as no session.
  }
  return null;
}

/**
 * Remove the auth session from memory and storage.
 */
export function clearAuthSession(): void {
  memorySession = null;
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable — memory session is already cleared.
    }
  }
}

/**
 * True only when a session exists and its scope matches the provided wallet
 * scope (address case-insensitive, chain id exact). Any mismatch — including a
 * disconnected wallet (`scope === null`) — returns false.
 */
export function isAuthSessionValidFor(scope: WalletSessionScope | null | undefined): boolean {
  const session = getAuthSession();
  if (!session || !scope) return false;
  return (
    normalizeAddress(session.scope.address) === normalizeAddress(scope.address) &&
    session.scope.chainId === scope.chainId
  );
}

/**
 * Build the `Authorization` header for an authenticated request, but only when
 * the stored session is still valid for the given wallet scope. Returns an
 * empty object otherwise, so a stale session can never attach its token.
 */
export function getAuthSessionHeaders(
  scope: WalletSessionScope | null | undefined,
): Record<string, string> {
  const session = getAuthSession();
  if (!session || !isAuthSessionValidFor(scope)) return {};
  return { Authorization: `Bearer ${session.token}` };
}
