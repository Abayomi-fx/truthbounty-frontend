/**
 * UI-FE-088 — app-shell capability factories.
 *
 * Conforms to the pinned `AppShellCapabilities`, `AppShellRoles`, and
 * `RouteAccessStatus` interfaces in `src/context/AppShellContext.tsx`.
 * The `denied` canonical scenario is built from these.
 */

import type {
  AppShellCapabilities,
  AppShellRoles,
  RouteAccessStatus,
  RouteDenialReason,
} from '../../../context/AppShellContext';

export const ROUTE_DENIAL_REASONS: readonly RouteDenialReason[] = [
  'wallet_disconnected',
  'wrong_chain',
  'verifier_role_required',
  'admin_role_required',
  'feature_disabled',
] as const;

/** Every capability granted — the baseline (non-denied) scenario. */
export function makeCapabilities(overrides: Partial<AppShellCapabilities> = {}): AppShellCapabilities {
  return {
    canCreateClaim: true,
    canVerify: true,
    canDispute: true,
    canClaimRewards: true,
    canAdminister: true,
    ...overrides,
  };
}

/** Everything revoked — the fail-closed baseline for denial scenarios. */
export function makeDeniedCapabilities(): AppShellCapabilities {
  return makeCapabilities({
    canCreateClaim: false,
    canVerify: false,
    canDispute: false,
    canClaimRewards: false,
    canAdminister: false,
  });
}

/** Role flags for a signed-in verifier/admin claimant. */
export function makeRoles(overrides: Partial<AppShellRoles> = {}): AppShellRoles {
  return {
    isVerifier: true,
    isAdmin: true,
    isClaimant: true,
    isGuest: false,
    ...overrides,
  };
}

export interface MakeRouteAccessOptions {
  reason?: RouteDenialReason | null;
  requiredRole?: 'verifier' | 'admin' | null;
}

/** Route access status; defaults to allowed, or fails closed on a denial reason. */
export function makeRouteAccess(options: MakeRouteAccessOptions = {}): RouteAccessStatus {
  const reason = options.reason ?? null;

  if (reason === null) {
    return { isAllowed: true, denialReason: null, requiredRole: options.requiredRole ?? null };
  }

  return {
    isAllowed: false,
    denialReason: reason,
    requiredRole:
      options.requiredRole ??
      (reason === 'admin_role_required'
        ? 'admin'
        : reason === 'verifier_role_required'
          ? 'verifier'
          : null),
  };
}
