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
  | 'idle'
  | 'validating'
  | 'awaiting-signature'
  | 'rejected'
  | 'submitted'
  | 'replaced'
  | 'reverted'
  | 'confirmed'
  | 'finalized'
  | 'projection-lag'
  | 'reorged'
  | 'unavailable';

/**
 * A role identifier as it will exist once the release manifest is pinned.
 * Deliberately opaque until then — nothing here encodes a guessed role
 * hash or name. See ROLE_AND_CAPABILITY_MATRIX.md: "Production mappings
 * come from the versioned release role manifest; contributors must not
 * hard-code guessed role hashes or addresses."
 */
export interface PinnedRoleIdentifier {
  /** The role's on-chain identifier (e.g. a bytes32 role hash), once pinned. */
  readonly roleId: string;
  /** The human-readable label the release manifest assigns to this role. */
  readonly label: string;
}

export interface RoleMember {
  readonly role: PinnedRoleIdentifier;
  readonly address: string;
  /** When this membership was granted, per the canonical audit event. */
  readonly grantedAt: string;
  /** The audit/transaction identifier for the grant, per canonical source. */
  readonly grantedByTxId: string;
}

export interface PendingRoleChange {
  readonly id: string;
  readonly role: PinnedRoleIdentifier;
  readonly address: string;
  readonly action: 'grant' | 'revoke';
  readonly proposedAt: string;
  /** Earliest the timelock allows execution; null if not yet queued. */
  readonly executableAfter: string | null;
  readonly state: GovernanceMutationState;
  readonly proposalTxId: string | null;
}

/**
 * A separation-of-duty concern surfaced for a prospective or existing role
 * holder. Principle-level only — see ADMIN_AUTHORITY_BOUNDARY.md: the
 * interface must show blast radius before confirmation, but must not
 * invent specific role-conflict rules that aren't in the pinned manifest.
 */
export interface SeparationOfDutyWarning {
  readonly id: string;
  readonly severity: 'info' | 'caution' | 'blocking';
  readonly summary: string;
  readonly detail: string;
}

/** Where a piece of displayed data is allowed to come from, shown to the user. */
export type GovernanceSourceClass =
  | 'pinned-contract'
  | 'fresh-api-projection'
  | 'verified-release-manifest'
  | 'wallet-session-local'
  | 'approved-content';

export interface GovernanceAuthoritySource {
  readonly field: string;
  readonly source: GovernanceSourceClass;
  /** Why this field currently can't be shown, if it can't. */
  readonly unavailableReason: string | null;
}

/**
 * A grant/revoke action the operator is preparing. This is a *draft* —
 * typed and locally validated, never submitted, until a pinned contract
 * interface exists to submit it against. See the Action-to-interface
 * gate for "Governance/execute" in FRONTEND_IMPLEMENTATION_MATRIX.md:
 * "No arbitrary call composition" until pinned.
 */
export interface GrantRevokeDraft {
  readonly action: 'grant' | 'revoke';
  readonly roleId: string | null;
  readonly address: string;
  readonly warnings: readonly SeparationOfDutyWarning[];
}

export interface RoleAdministrationData {
  readonly isAuthorized: boolean;
  readonly unauthorizedReason: string | null;
  readonly canonicalGovernanceOperatorAddress: string | null;
  readonly account: string | null;

  readonly surfaceState: GovernanceSurfaceState;

  /**
   * True whenever the release manifest (#560) is not yet verified. While
   * true, `members`/`pendingChanges` are always empty and every mutation
   * control stays disabled — this is the expected state until that
   * dependency lands, not an error condition.
   */
  readonly manifestUnavailable: boolean;
  readonly manifestUnavailableReason: string | null;

  readonly members: readonly RoleMember[];
  readonly pendingChanges: readonly PendingRoleChange[];
  readonly separationWarnings: readonly SeparationOfDutyWarning[];
  readonly authoritySources: readonly GovernanceAuthoritySource[];

  /** Validates a draft locally; never submits it. See GrantRevokeDraft. */
  prepareDraft(input: { action: 'grant' | 'revoke'; roleId: string | null; address: string }): GrantRevokeDraft;

  refetch(): Promise<void>;
}