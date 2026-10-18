/**
 * Governance role administration — UI-FE-030
 *
 * Per ROLE_AND_CAPABILITY_MATRIX.md's canonical mapping rule: roles may only
 * be sourced from pinned contracts. Until the versioned release manifest
 * (STAB-FE-005 / #560) is published and verified, there is no legitimate
 * source for this data — so every shape here can resolve to `unavailable`,
 * and no production code may synthesize a role from a hardcoded name or
 * fixture. See ADMIN_AUTHORITY_BOUNDARY.md's implementation approval rule:
 * without an issue linking the exact contract function, authorization
 * check, audit event and release-manifest field, the only approved
 * implementation is an explicit unavailable boundary.
 */

/** Applicable-surface states per FRONTEND_IMPLEMENTATION_MATRIX.md. */
export type GovernanceSurfaceState =
  | 'loading'
  | 'empty'
  | 'stale'
  | 'offline'
  | 'unavailable'
  | 'error'
  | 'denied'
  | 'not-found'
  | 'wrong-chain'
  | 'changed-account'
  | 'changed-release'
  | 'revoked-authority'
  | 'expired-authority';

/** Mutation-capable composition states per FRONTEND_IMPLEMENTATION_MATRIX.md. */
export type GovernanceMutationState =