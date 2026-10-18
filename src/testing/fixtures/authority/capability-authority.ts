/**
 * UI-FE-087 — deterministic capability authority fixtures.
 *
 * Source of truth (pinned):
 *   DigiNodes/truthbounty-protocol @ 60c66b78cf797d8f821089c99ae1bc461009fecc
 *   docs/ux-authority/ROLE_AND_CAPABILITY_MATRIX.md
 *
 * A UI "active context" is presentation only. Capabilities are resolved from
 * explicit evidence (wallet/session/chain/release/role/revocation/authority
 * availability). Selecting a context never grants a capability.
 */

export const PROTOCOL_AUTHORITY_COMMIT =
  '60c66b78cf797d8f821089c99ae1bc461009fecc';

export const PROTOCOL_AUTHORITY_SOURCES = {
  commit: PROTOCOL_AUTHORITY_COMMIT,
  roleMatrix: 'docs/ux-authority/ROLE_AND_CAPABILITY_MATRIX.md',
  sitemap: 'docs/ux-authority/SITEMAP_AND_ROUTE_CONTRACT.md',
  implementationMatrix: 'docs/ux-authority/FRONTEND_IMPLEMENTATION_MATRIX.md',
  appShell: 'docs/ux-authority/APP_SHELL_AND_NAVIGATION.md',
} as const;

export const CAPABILITY_CONTEXTS = [
  'visitor',
  'claimant',
  'verifier',
  'operations-administrator',
  'governance-operator',
  'emergency-guardian',
] as const;

export type CapabilityContextId = (typeof CAPABILITY_CONTEXTS)[number];

export const AUTHORITY_FIXTURE_IDS = [
  'anonymous',
  'claimant',
  'verifier',
  'operations',
  'governance',
  'guardian',
  'revoked',
  'stale',
  'wrong-chain',
  'unavailable',
] as const;

export type AuthorityFixtureId = (typeof AUTHORITY_FIXTURE_IDS)[number];

export const CAPABILITY_IDS = [
  'browse-public-claims',
  'connect-wallet-session',
  'create-fund-own-claim',
  'manage-own-draft-evidence',
  'discover-verification-work',
  'commit-reveal-submit-verification',
  'open-dispute-appeal',
  'view-personal-rewards',
  'withdraw-own-funds-rewards',
  'review-operational-queues',
  'retry-safe-idempotent-work',
  'propose-execute-governance',
  'pause-operation',
  'unpause-upgrade-administer-roles',
  'override-truth-outcomes',
  'move-another-users-funds',
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

/**
 * Matrix cell values. "yes"/"no" mirror the authority table; conditional,
 * own-resource, and read-only cells require additional evidence before they
 * resolve to a grant. "prohibited" can never be granted.
 */
export type CapabilityCell =
  | 'yes'
  | 'no'
  | 'conditional'
  | 'own'
  | 'read-only'
  | 'prohibited';

export type ResolvedCapability =
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'read-only';

type CapabilityRow = Readonly<Record<CapabilityContextId, CapabilityCell>>;

export const CAPABILITY_MATRIX: Readonly<
  Record<CapabilityId, CapabilityRow>
> = Object.freeze({
  'browse-public-claims': {
    visitor: 'yes',
    claimant: 'yes',
    verifier: 'yes',
    'operations-administrator': 'yes',
    'governance-operator': 'yes',
    'emergency-guardian': 'yes',
  },
  'connect-wallet-session': {
    visitor: 'yes',
    claimant: 'yes',
    verifier: 'yes',
    'operations-administrator': 'yes',
    'governance-operator': 'yes',
    'emergency-guardian': 'yes',
  },
  'create-fund-own-claim': {
    visitor: 'no',
    claimant: 'conditional',
    verifier: 'conditional',
    'operations-administrator': 'no',
    'governance-operator': 'conditional',
    'emergency-guardian': 'no',
  },
  'manage-own-draft-evidence': {
    visitor: 'no',
    claimant: 'own',
    verifier: 'own',
    'operations-administrator': 'no',
    'governance-operator': 'own',
    'emergency-guardian': 'no',
  },
  'discover-verification-work': {
    visitor: 'no',
    claimant: 'conditional',
    verifier: 'yes',
    'operations-administrator': 'no',
    'governance-operator': 'conditional',
    'emergency-guardian': 'no',
  },
  'commit-reveal-submit-verification': {
    visitor: 'no',
    claimant: 'conditional',
    verifier: 'yes',
    'operations-administrator': 'no',
    'governance-operator': 'conditional',
    'emergency-guardian': 'no',
  },
  'open-dispute-appeal': {
    visitor: 'no',
    claimant: 'conditional',
    verifier: 'conditional',
    'operations-administrator': 'no',
    'governance-operator': 'conditional',
    'emergency-guardian': 'no',
  },
  'view-personal-rewards': {
    visitor: 'no',
    claimant: 'yes',
    verifier: 'yes',
    'operations-administrator': 'no',
    'governance-operator': 'own',
    'emergency-guardian': 'own',
  },
  'withdraw-own-funds-rewards': {
    visitor: 'no',
    claimant: 'yes',
    verifier: 'yes',
    'operations-administrator': 'no',
    'governance-operator': 'own',
    'emergency-guardian': 'own',
  },
  'review-operational-queues': {
    visitor: 'no',
    claimant: 'no',
    verifier: 'no',
    'operations-administrator': 'yes',
    'governance-operator': 'read-only',
    'emergency-guardian': 'no',
  },
  'retry-safe-idempotent-work': {
    visitor: 'no',
    claimant: 'no',
    verifier: 'no',
    'operations-administrator': 'conditional',
    'governance-operator': 'no',
    'emergency-guardian': 'no',
  },
  'propose-execute-governance': {
    visitor: 'no',
    claimant: 'no',
    verifier: 'no',
    'operations-administrator': 'no',
    'governance-operator': 'conditional',
    'emergency-guardian': 'no',
  },
  'pause-operation': {
    visitor: 'no',
    claimant: 'no',
    verifier: 'no',
    'operations-administrator': 'no',
    'governance-operator': 'conditional',
    'emergency-guardian': 'conditional',
  },
  'unpause-upgrade-administer-roles': {
    visitor: 'no',
    claimant: 'no',
    verifier: 'no',
    'operations-administrator': 'no',
    'governance-operator': 'conditional',
    'emergency-guardian': 'conditional',
  },
  'override-truth-outcomes': {
    visitor: 'prohibited',
    claimant: 'prohibited',
    verifier: 'prohibited',
    'operations-administrator': 'prohibited',
    'governance-operator': 'prohibited',
    'emergency-guardian': 'prohibited',
  },
  'move-another-users-funds': {
    visitor: 'prohibited',
    claimant: 'prohibited',
    verifier: 'prohibited',
    'operations-administrator': 'prohibited',
    'governance-operator': 'prohibited',
    'emergency-guardian': 'prohibited',
  },
});

export interface CapabilityRoles {
  readonly claimant: boolean;
  readonly verifier: boolean;
  readonly operations: boolean;
  readonly governance: boolean;
  readonly guardian: boolean;
}

export interface CapabilityEvidence {
  readonly walletConnected: boolean;
  readonly sessionValid: boolean;
  readonly supportedChain: boolean;
  readonly releaseFresh: boolean;
  /** Release manifest / protected API authority is present and resolvable. */
  readonly authorityAvailable: boolean;
  readonly roles: CapabilityRoles;
  /** The action targets the wallet's own resource (rewards, drafts, funds). */
  readonly ownResource: boolean;
  /** Explicit grant for conditionally-granted privileged capabilities. */
  readonly explicitGrants: readonly CapabilityId[];
  readonly revoked: readonly CapabilityId[];
  /**
   * Presentation-only active context. It must never influence resolution.
   */
  readonly activeContext: CapabilityContextId;
}

export interface AuthorityFixture {
  readonly id: AuthorityFixtureId;
  readonly label: string;
  readonly context: CapabilityContextId;
  readonly evidence: CapabilityEvidence;
}

const NO_ROLES: CapabilityRoles = {
  claimant: false,
  verifier: false,
  operations: false,
  governance: false,
  guardian: false,
};

function evidence(
  overrides: Partial<CapabilityEvidence> & Pick<CapabilityEvidence, 'activeContext'>,
): CapabilityEvidence {
  return {
    walletConnected: false,
    sessionValid: false,
    supportedChain: false,
    releaseFresh: true,
    authorityAvailable: true,
    roles: NO_ROLES,
    ownResource: false,
    explicitGrants: [],
    revoked: [],
    ...overrides,
  };
}

export const AUTHORITY_FIXTURES: readonly AuthorityFixture[] = Object.freeze([
  {
    id: 'anonymous',
    label: 'Anonymous public visitor',
    context: 'visitor',
    evidence: evidence({ activeContext: 'visitor' }),
  },
  {
    id: 'claimant',
    label: 'Connected claimant',
    context: 'claimant',
    evidence: evidence({
      walletConnected: true,
      sessionValid: true,
      supportedChain: true,
      activeContext: 'claimant',
      roles: { ...NO_ROLES, claimant: true },
      ownResource: true,
    }),
  },
  {
    id: 'verifier',
    label: 'Eligible verifier',
    context: 'verifier',
    evidence: evidence({
      walletConnected: true,
      sessionValid: true,
      supportedChain: true,
      activeContext: 'verifier',
      roles: { ...NO_ROLES, verifier: true },
      ownResource: true,
    }),
  },
  {
    id: 'operations',
    label: 'Operations administrator',
    context: 'operations-administrator',
    evidence: evidence({
      walletConnected: true,
      sessionValid: true,
      supportedChain: true,
      activeContext: 'operations-administrator',
      roles: { ...NO_ROLES, operations: true },
      explicitGrants: ['retry-safe-idempotent-work'],
    }),
  },
  {
    id: 'governance',
    label: 'Governance operator',
    context: 'governance-operator',
    evidence: evidence({
      walletConnected: true,
      sessionValid: true,
      supportedChain: true,
      activeContext: 'governance-operator',
      roles: { ...NO_ROLES, governance: true },
      ownResource: true,
      explicitGrants: [
        'propose-execute-governance',
        'pause-operation',
        'unpause-upgrade-administer-roles',
      ],
    }),
  },
  {
    id: 'guardian',
    label: 'Emergency guardian',
    context: 'emergency-guardian',
    evidence: evidence({
      walletConnected: true,
      sessionValid: true,
      supportedChain: true,
      activeContext: 'emergency-guardian',
      roles: { ...NO_ROLES, guardian: true },
      ownResource: true,
      explicitGrants: ['pause-operation'],
    }),
  },
  {
    id: 'revoked',
    label: 'Verifier authority revoked',
    context: 'verifier',
    evidence: evidence({
      walletConnected: true,
      sessionValid: true,
      supportedChain: true,
      activeContext: 'verifier',
      roles: { ...NO_ROLES, verifier: true },
      ownResource: true,
      revoked: CAPABILITY_IDS.filter(
        (capability) =>
          capability !== 'browse-public-claims' &&
          capability !== 'connect-wallet-session',
      ),
    }),
  },
  {
    id: 'stale',
    label: 'Stale release authority',
    context: 'verifier',
    evidence: evidence({
      walletConnected: true,
      sessionValid: true,
      supportedChain: true,
      releaseFresh: false,
      activeContext: 'verifier',
      roles: { ...NO_ROLES, verifier: true },
      ownResource: true,
    }),
  },
  {
    id: 'wrong-chain',
    label: 'Connected on an unsupported chain',
    context: 'claimant',
    evidence: evidence({
      walletConnected: true,
      sessionValid: true,
      supportedChain: false,
      activeContext: 'claimant',
      roles: { ...NO_ROLES, claimant: true },
      ownResource: true,
    }),
  },
  {
    id: 'unavailable',
    label: 'Authority source unavailable',
    context: 'governance-operator',
    evidence: evidence({
      walletConnected: true,
      sessionValid: true,
      supportedChain: true,
      authorityAvailable: false,
      activeContext: 'governance-operator',
      roles: { ...NO_ROLES, governance: true },
      ownResource: true,
      explicitGrants: [
        'propose-execute-governance',
        'pause-operation',
        'unpause-upgrade-administer-roles',
      ],
    }),
  },
]);

export function getAuthorityFixture(id: AuthorityFixtureId): AuthorityFixture {
  const fixture = AUTHORITY_FIXTURES.find((entry) => entry.id === id);
  if (!fixture) {
    throw new Error(`Unknown authority fixture: ${id}`);
  }
  return fixture;
}

/**
 * Presentation-only context selection. It returns a new view label but does
 * not mutate evidence; resolution below intentionally ignores activeContext.
 */
export function selectActiveContext(
  fixture: AuthorityFixture,
  activeContext: CapabilityContextId,
): AuthorityFixture {
  return {
    ...fixture,
    evidence: { ...fixture.evidence, activeContext },
  };
}

function isPublicCapability(capability: CapabilityId): boolean {
  return (
    capability === 'browse-public-claims' ||
    capability === 'connect-wallet-session'
  );
}

function canSatisfyConditional(
  capability: CapabilityId,
  evidenceValue: CapabilityEvidence,
): boolean {
  const { roles, explicitGrants } = evidenceValue;

  switch (capability) {
    case 'create-fund-own-claim':
      return roles.claimant;
    case 'discover-verification-work':
    case 'commit-reveal-submit-verification':
      return roles.verifier;
    case 'open-dispute-appeal':
      return roles.claimant || roles.verifier;
    case 'retry-safe-idempotent-work':
      return roles.operations && explicitGrants.includes(capability);
    case 'propose-execute-governance':
      return roles.governance && explicitGrants.includes(capability);
    case 'pause-operation':
      return (
        (roles.governance || roles.guardian) &&
        explicitGrants.includes(capability)
      );
    case 'unpause-upgrade-administer-roles':
      return roles.governance && explicitGrants.includes(capability);
    default:
      return false;
  }
}

/**
 * Resolve one capability from explicit evidence and the authority matrix.
 * Public/connect capabilities are available to every context; everything else
 * fails closed on missing/stale/unavailable/revoked authority.
 */
export function resolveCapability(
  capability: CapabilityId,
  fixture: AuthorityFixture,
): ResolvedCapability {
  const evidenceValue = fixture.evidence;

  if (isPublicCapability(capability)) {
    return 'granted';
  }

  // Prohibited capabilities are never grantable, even when authority data is
  // missing; they are not merely "unavailable".
  if (CAPABILITY_MATRIX[capability][fixture.context] === 'prohibited') {
    return 'denied';
  }

  if (!evidenceValue.authorityAvailable) {
    return 'unavailable';
  }
  if (evidenceValue.revoked.includes(capability)) {
    return 'denied';
  }
  if (
    !evidenceValue.walletConnected ||
    !evidenceValue.sessionValid ||
    !evidenceValue.supportedChain ||
    !evidenceValue.releaseFresh
  ) {
    return 'denied';
  }

  const cell = CAPABILITY_MATRIX[capability][fixture.context];

  switch (cell) {
    case 'yes':
      return 'granted';
    case 'read-only':
      return 'read-only';
    case 'own':
      return evidenceValue.ownResource ? 'granted' : 'denied';
    case 'conditional':
      return canSatisfyConditional(capability, evidenceValue)
        ? 'granted'
        : 'denied';
    case 'no':
    case 'prohibited':
    default:
      return 'denied';
  }
}

export function resolveAllCapabilities(
  fixture: AuthorityFixture,
): Readonly<Record<CapabilityId, ResolvedCapability>> {
  return CAPABILITY_IDS.reduce(
    (result, capability) => {
      result[capability] = resolveCapability(capability, fixture);
      return result;
    },
    {} as Record<CapabilityId, ResolvedCapability>,
  );
}

export function isCapabilityGranted(
  capability: CapabilityId,
  fixture: AuthorityFixture,
  options: { allowReadOnly?: boolean } = {},
): boolean {
  const resolved = resolveCapability(capability, fixture);
  return (
    resolved === 'granted' ||
    (resolved === 'read-only' && options.allowReadOnly === true)
  );
}
