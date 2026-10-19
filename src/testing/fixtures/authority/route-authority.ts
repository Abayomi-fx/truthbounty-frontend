/**
 * UI-FE-087 — deterministic route authority fixtures.
 *
 * Source of truth (pinned):
 *   DigiNodes/truthbounty-protocol @ 60c66b78cf797d8f821089c99ae1bc461009fecc
 *   docs/ux-authority/SITEMAP_AND_ROUTE_CONTRACT.md
 *   docs/ux-authority/FRONTEND_IMPLEMENTATION_MATRIX.md
 *   docs/ux-authority/APP_SHELL_AND_NAVIGATION.md
 *
 * These fixtures encode route visibility, read access, navigation group,
 * mutation controls, redirects, board references, and implementation status.
 * Tests compare the fixtures against the protocol authority and the actual
 * filesystem route inventory, so an unmapped route fails CI.
 */

import {
  CAPABILITY_CONTEXTS,
  isCapabilityGranted,
  resolveCapability,
  type AuthorityFixture,
  type CapabilityContextId,
  type CapabilityId,
} from './capability-authority';

export const AUTHORITY_ROUTE_SOURCES = {
  sitemap: 'docs/ux-authority/SITEMAP_AND_ROUTE_CONTRACT.md',
  implementationMatrix: 'docs/ux-authority/FRONTEND_IMPLEMENTATION_MATRIX.md',
  appShell: 'docs/ux-authority/APP_SHELL_AND_NAVIGATION.md',
} as const;

export type FoundationBatch =
  | 'foundation'
  | 'public-claimant'
  | 'verifier-dispute'
  | 'privileged'
  | 'support-legal';

type BoardFile = `${string}.svg`;

function board(batch: FoundationBatch, file: BoardFile): string {
  return `designs/frontend-v2/${batch}/boards/${file}`;
}

const BOARD_FILES: Readonly<Record<FoundationBatch, readonly BoardFile[]>> = {
  foundation: [
    '01-design-tokens.svg',
    '02-application-shells.svg',
    '03-navigation.svg',
    '04-component-primitives.svg',
    '05-wallet-network-identity.svg',
    '06-transaction-states.svg',
    '07-system-states.svg',
    '08-responsive-accessibility.svg',
  ],
  'public-claimant': [
    '01-product-landing.svg',
    '02-explore-claims.svg',
    '03-claim-detail.svg',
    '04-wallet-entry-and-eligibility.svg',
    '05-claimant-dashboard.svg',
    '06-submit-claim-statement.svg',
    '07-submit-evidence.svg',
    '08-submit-funding.svg',
    '09-submit-review-authorize.svg',
    '10-owned-claims.svg',
    '11-rewards-transactions.svg',
  ],
  'verifier-dispute': [
    '01-verifier-eligibility-readiness.svg',
    '02-verification-queue.svg',
    '03-verification-evidence-workspace.svg',
    '04-stake-effective-weight.svg',
    '05-verification-decision.svg',
    '06-verification-authorize-reveal.svg',
    '07-my-verifications.svg',
    '08-public-dispute-register.svg',
    '09-dispute-detail.svg',
    '10-dispute-eligibility-entry.svg',
    '11-open-dispute-evidence.svg',
    '12-dispute-review-authorize.svg',
    '13-appeal-resolution-settlement.svg',
  ],
  privileged: [
    '01-privileged-access-readiness.svg',
    '02-privileged-overview.svg',
    '03-system-health-release-status.svg',
    '04-operational-queue-register.svg',
    '05-queue-item-safe-retry.svg',
    '06-administrative-audit-trail.svg',
    '07-governance-proposal-register.svg',
    '08-governance-proposal-detail.svg',
    '09-governed-change-preparation.svg',
    '10-timelock-execution.svg',
    '11-role-administration.svg',
    '12-upgrade-controlled-unpause.svg',
    '13-emergency-scope-pause-control.svg',
  ],
  'support-legal': [
    '01-documentation-home.svg',
    '02-documentation-article.svg',
    '03-help-troubleshooting.svg',
    '04-service-status-overview.svg',
    '05-incident-detail-history.svg',
    '06-contact-support-entry.svg',
    '07-support-request-form.svg',
    '08-security-reporting.svg',
    '09-privacy-notice.svg',
    '10-terms-of-use.svg',
    '11-protocol-risk-disclosures.svg',
    '12-legal-version-consent.svg',
    '13-system-support-states.svg',
  ],
};

export interface ApprovedBoard {
  readonly batch: FoundationBatch;
  readonly path: string;
}

export const APPROVED_BOARDS: readonly ApprovedBoard[] = Object.freeze(
  (Object.keys(BOARD_FILES) as FoundationBatch[]).flatMap((batch) =>
    BOARD_FILES[batch].map((file) => ({ batch, path: board(batch, file) })),
  ),
);

const BOARD_PATHS = new Set(APPROVED_BOARDS.map((entry) => entry.path));

/** Boards that describe the global shell/system rather than one route. */
export const GLOBAL_BOARD_REFS: readonly string[] = Object.freeze([
  ...BOARD_FILES.foundation.map((file) => board('foundation', file)),
  board('support-legal', '13-system-support-states.svg'),
]);

export type AuthorityRouteVisibility =
  | 'public'
  | 'personal'
  | 'verifier'
  | 'admin'
  | 'redirect'
  | 'internal';

export type AuthorityNavigationGroup =
  | 'public'
  | 'personal'
  | 'claimant-action'
  | 'verifier'
  | 'admin'
  | null;

export type RouteImplementationStatus =
  | 'implemented'
  | 'legacy'
  | 'planned'
  | 'unavailable';

export type RouteReadRule =
  | { readonly kind: 'public' }
  | { readonly kind: 'authenticated' }
  | {
      readonly kind: 'capability';
      readonly capabilities: readonly CapabilityId[];
      readonly mode: 'all' | 'any';
    };

export type MutationAuthority =
  | 'contract'
  | 'protected-api'
  | 'governance-contract'
  | 'emergency-contract';

export interface MutationControlExpectation {
  readonly id: string;
  readonly capability: CapabilityId;
  readonly authority: MutationAuthority;
  readonly description: string;
}

export interface CanonicalRouteExpectation {
  readonly path: string;
  readonly area: string;
  readonly purpose: string;
  readonly visibility: AuthorityRouteVisibility;
  readonly audience: readonly CapabilityContextId[];
  readonly read: RouteReadRule;
  readonly navigationGroup: AuthorityNavigationGroup;
  readonly mutationControls: readonly MutationControlExpectation[];
  readonly boardRefs: readonly string[];
  readonly boardAuthority: 'route' | 'sitemap-only';
  readonly implementationStatus: RouteImplementationStatus;
  readonly aliases: readonly string[];
}

const ALL_CONTEXTS: readonly CapabilityContextId[] = CAPABILITY_CONTEXTS;

const PERSONAL_CONTEXTS: readonly CapabilityContextId[] = [
  'claimant',
  'verifier',
  'governance-operator',
  'emergency-guardian',
];

const VERIFIER_CONTEXTS: readonly CapabilityContextId[] = ['verifier'];

const ADMIN_OVERVIEW_CONTEXTS: readonly CapabilityContextId[] = [
  'operations-administrator',
  'governance-operator',
  'emergency-guardian',
];

const ADMIN_CONTEXTS: readonly CapabilityContextId[] = [
  'operations-administrator',
  'governance-operator',
];

const PUBLIC_READ: RouteReadRule = { kind: 'public' };
const AUTHENTICATED_READ: RouteReadRule = { kind: 'authenticated' };

function capabilityRead(
  capabilities: readonly CapabilityId[],
  mode: 'all' | 'any' = 'all',
): RouteReadRule {
  return { kind: 'capability', capabilities, mode };
}

function control(
  id: string,
  capability: CapabilityId,
  authority: MutationAuthority,
  description: string,
): MutationControlExpectation {
  return { id, capability, authority, description };
}

const CLAIM_BOARDS = [
  board('public-claimant', '03-claim-detail.svg'),
];

const CLAIM_CREATION_BOARDS = [
  board('public-claimant', '06-submit-claim-statement.svg'),
  board('public-claimant', '07-submit-evidence.svg'),
  board('public-claimant', '08-submit-funding.svg'),
  board('public-claimant', '09-submit-review-authorize.svg'),
];

const VERIFICATION_BOARDS = [
  board('verifier-dispute', '01-verifier-eligibility-readiness.svg'),
  board('verifier-dispute', '02-verification-queue.svg'),
  board('verifier-dispute', '03-verification-evidence-workspace.svg'),
  board('verifier-dispute', '04-stake-effective-weight.svg'),
  board('verifier-dispute', '05-verification-decision.svg'),
  board('verifier-dispute', '06-verification-authorize-reveal.svg'),
  board('verifier-dispute', '07-my-verifications.svg'),
];

const DISPUTE_DETAIL_BOARDS = [
  board('verifier-dispute', '09-dispute-detail.svg'),
  board('verifier-dispute', '10-dispute-eligibility-entry.svg'),
  board('verifier-dispute', '11-open-dispute-evidence.svg'),
  board('verifier-dispute', '12-dispute-review-authorize.svg'),
  board('verifier-dispute', '13-appeal-resolution-settlement.svg'),
];

const ADMIN_OVERVIEW_BOARDS = [
  board('privileged', '01-privileged-access-readiness.svg'),
  board('privileged', '02-privileged-overview.svg'),
  board('privileged', '03-system-health-release-status.svg'),
];

const ADMIN_GOVERNANCE_BOARDS = [
  board('privileged', '07-governance-proposal-register.svg'),
  board('privileged', '08-governance-proposal-detail.svg'),
  board('privileged', '09-governed-change-preparation.svg'),
  board('privileged', '10-timelock-execution.svg'),
  board('privileged', '11-role-administration.svg'),
  board('privileged', '12-upgrade-controlled-unpause.svg'),
  board('privileged', '13-emergency-scope-pause-control.svg'),
];

export const CANONICAL_ROUTE_EXPECTATIONS: readonly CanonicalRouteExpectation[] =
  Object.freeze([
    {
      path: '/',
      area: 'Product entry',
      purpose: 'Product explanation, public activity, and safe journey entry.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: 'public',
      mutationControls: [],
      boardRefs: [board('public-claimant', '01-product-landing.svg')],
      boardAuthority: 'route',
      implementationStatus: 'implemented',
      aliases: [],
    },
    {
      path: '/claims',
      area: 'Explore claims',
      purpose: 'Search and filter public claims without implying eligibility.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: 'public',
      mutationControls: [],
      boardRefs: [board('public-claimant', '02-explore-claims.svg')],
      boardAuthority: 'route',
      implementationStatus: 'implemented',
      aliases: [],
    },
    {
      path: '/claims/:claimId',
      area: 'Claim detail',
      purpose: 'Canonical claim state, evidence, and lifecycle timeline.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: null,
      mutationControls: [
        control(
          'verify-claim',
          'commit-reveal-submit-verification',
          'contract',
          'Commit/reveal a verification decision.',
        ),
        control(
          'open-dispute',
          'open-dispute-appeal',
          'contract',
          'Open a canonically eligible dispute or appeal.',
        ),
      ],
      boardRefs: CLAIM_BOARDS,
      boardAuthority: 'route',
      implementationStatus: 'implemented',
      aliases: [],
    },
    {
      path: '/claims/new',
      area: 'Create claim',
      purpose: 'Recoverable draft, funding, review, authorization, and reconciliation.',
      visibility: 'personal',
      audience: ['claimant', 'verifier', 'governance-operator'],
      read: capabilityRead(['create-fund-own-claim']),
      navigationGroup: 'claimant-action',
      mutationControls: [
        control(
          'create-claim',
          'create-fund-own-claim',
          'contract',
          'Create and fund a claim owned by the connected wallet.',
        ),
        control(
          'manage-draft-evidence',
          'manage-own-draft-evidence',
          'contract',
          'Manage the owner draft/evidence before the immutable boundary.',
        ),
      ],
      boardRefs: CLAIM_CREATION_BOARDS,
      boardAuthority: 'route',
      implementationStatus: 'implemented',
      aliases: [],
    },
    {
      path: '/dashboard',
      area: 'Personal dashboard',
      purpose: 'Active-context overview and next actions.',
      visibility: 'personal',
      audience: PERSONAL_CONTEXTS,
      read: AUTHENTICATED_READ,
      navigationGroup: 'personal',
      mutationControls: [],
      boardRefs: [board('public-claimant', '05-claimant-dashboard.svg')],
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: [],
    },
    {
      path: '/dashboard/claims',
      area: 'Owned claims',
      purpose: 'Owned claims and actionable claimant states.',
      visibility: 'personal',
      audience: ['claimant', 'verifier', 'governance-operator'],
      read: capabilityRead(['create-fund-own-claim']),
      navigationGroup: 'personal',
      mutationControls: [
        control(
          'manage-owned-claim',
          'manage-own-draft-evidence',
          'contract',
          'Manage own claim state before immutable boundaries.',
        ),
      ],
      boardRefs: [board('public-claimant', '10-owned-claims.svg')],
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: [],
    },
    {
      path: '/dashboard/verifications',
      area: 'Verification queue',
      purpose: 'Available and assigned verification work.',
      visibility: 'verifier',
      audience: VERIFIER_CONTEXTS,
      read: capabilityRead(['discover-verification-work']),
      navigationGroup: 'verifier',
      mutationControls: [],
      boardRefs: [
        board('verifier-dispute', '02-verification-queue.svg'),
        board('verifier-dispute', '07-my-verifications.svg'),
      ],
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: ['/verifier'],
    },
    {
      path: '/dashboard/verifications/:claimId',
      area: 'Verification workspace',
      purpose: 'Evidence review and canonical verification journey.',
      visibility: 'verifier',
      audience: VERIFIER_CONTEXTS,
      read: capabilityRead(['discover-verification-work']),
      navigationGroup: null,
      mutationControls: [
        control(
          'submit-verification',
          'commit-reveal-submit-verification',
          'contract',
          'Commit/reveal/submit a verification decision.',
        ),
      ],
      boardRefs: VERIFICATION_BOARDS,
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: [],
    },
    {
      path: '/dashboard/rewards',
      area: 'Rewards',
      purpose: 'Accrued, claimable, pending, withdrawn, and unavailable rewards.',
      visibility: 'personal',
      audience: PERSONAL_CONTEXTS,
      read: capabilityRead(['view-personal-rewards']),
      navigationGroup: 'personal',
      mutationControls: [
        control(
          'withdraw-rewards',
          'withdraw-own-funds-rewards',
          'contract',
          'Withdraw own available funds/rewards.',
        ),
      ],
      boardRefs: [board('public-claimant', '11-rewards-transactions.svg')],
      boardAuthority: 'route',
      implementationStatus: 'implemented',
      aliases: ['/rewards'],
    },
    {
      path: '/dashboard/transactions',
      area: 'Transaction center',
      purpose: 'Persisted transaction reconciliation and receipt references.',
      visibility: 'personal',
      audience: PERSONAL_CONTEXTS,
      read: AUTHENTICATED_READ,
      navigationGroup: 'personal',
      mutationControls: [],
      boardRefs: [board('public-claimant', '11-rewards-transactions.svg')],
      boardAuthority: 'route',
      implementationStatus: 'implemented',
      aliases: [],
    },
    {
      path: '/settings',
      area: 'Settings',
      purpose: 'Wallet, session, chain, and non-authoritative preferences.',
      visibility: 'personal',
      audience: PERSONAL_CONTEXTS,
      read: AUTHENTICATED_READ,
      navigationGroup: 'personal',
      mutationControls: [],
      boardRefs: [board('support-legal', '12-legal-version-consent.svg')],
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: [],
    },
    {
      path: '/settings/identity',
      area: 'Identity/trust',
      purpose: 'Humanity and trust evidence without inventing protocol authority.',
      visibility: 'personal',
      audience: PERSONAL_CONTEXTS,
      read: AUTHENTICATED_READ,
      navigationGroup: 'personal',
      mutationControls: [],
      boardRefs: [
        board('foundation', '05-wallet-network-identity.svg'),
        board('public-claimant', '04-wallet-entry-and-eligibility.svg'),
      ],
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: ['/identity'],
    },
    {
      path: '/disputes',
      area: 'Disputes',
      purpose: 'Public dispute discovery and participant history.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: 'public',
      mutationControls: [],
      boardRefs: [board('verifier-dispute', '08-public-dispute-register.svg')],
      boardAuthority: 'route',
      implementationStatus: 'implemented',
      aliases: [],
    },
    {
      path: '/disputes/:disputeId',
      area: 'Dispute detail',
      purpose: 'Challenge, appeal, deadlines, and provisional/final outcomes.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: null,
      mutationControls: [
        control(
          'open-dispute',
          'open-dispute-appeal',
          'contract',
          'Open a canonically eligible dispute or appeal.',
        ),
      ],
      boardRefs: DISPUTE_DETAIL_BOARDS,
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: [],
    },
    {
      path: '/treasury',
      area: 'Treasury',
      purpose: 'Public accounting and user-owned claimable balances.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: 'public',
      mutationControls: [
        control(
          'withdraw-own-funds',
          'withdraw-own-funds-rewards',
          'contract',
          'Withdraw own available treasury/stake funds.',
        ),
      ],
      boardRefs: [],
      boardAuthority: 'sitemap-only',
      implementationStatus: 'implemented',
      aliases: ['/treasury/stake'],
    },
    {
      path: '/analytics',
      area: 'Analytics',
      purpose: 'Clearly sourced, freshness-labelled protocol analytics.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: null,
      mutationControls: [],
      boardRefs: [],
      boardAuthority: 'sitemap-only',
      implementationStatus: 'planned',
      aliases: [],
    },
    {
      path: '/admin',
      area: 'Admin overview',
      purpose: 'Health, bounded queues, and authority summary.',
      visibility: 'admin',
      audience: ADMIN_OVERVIEW_CONTEXTS,
      read: capabilityRead(
        [
          'review-operational-queues',
          'propose-execute-governance',
          'pause-operation',
        ],
        'any',
      ),
      navigationGroup: 'admin',
      mutationControls: [
        control(
          'propose-execute-governance',
          'propose-execute-governance',
          'governance-contract',
          'Propose or execute governed configuration within timelock/role limits.',
        ),
        control(
          'pause-operation',
          'pause-operation',
          'emergency-contract',
          'Pause one explicitly scoped operation.',
        ),
        control(
          'unpause-upgrade-administer-roles',
          'unpause-upgrade-administer-roles',
          'governance-contract',
          'Unpause/upgrade/administer roles through canonical governance.',
        ),
      ],
      boardRefs: [...ADMIN_OVERVIEW_BOARDS, ...ADMIN_GOVERNANCE_BOARDS],
      boardAuthority: 'route',
      implementationStatus: 'implemented',
      aliases: [],
    },
    {
      path: '/admin/operations/:queue',
      area: 'Admin operation',
      purpose: 'Explicit operation with impact and audit trail.',
      visibility: 'admin',
      audience: ADMIN_CONTEXTS,
      read: capabilityRead(['review-operational-queues']),
      navigationGroup: 'admin',
      mutationControls: [
        control(
          'retry-safe-work',
          'retry-safe-idempotent-work',
          'protected-api',
          'Retry explicitly granted safe idempotent projection work.',
        ),
      ],
      boardRefs: [
        board('privileged', '04-operational-queue-register.svg'),
        board('privileged', '05-queue-item-safe-retry.svg'),
      ],
      boardAuthority: 'route',
      implementationStatus: 'implemented',
      aliases: [],
    },
    {
      path: '/admin/audit',
      area: 'Admin audit',
      purpose: 'Immutable audit and canonical transaction references.',
      visibility: 'admin',
      audience: ADMIN_CONTEXTS,
      read: capabilityRead(['review-operational-queues']),
      navigationGroup: 'admin',
      mutationControls: [],
      boardRefs: [board('privileged', '06-administrative-audit-trail.svg')],
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: [],
    },
    {
      path: '/status',
      area: 'Service status',
      purpose: 'RPC, API, indexer, and release-manifest degradation.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: 'public',
      mutationControls: [],
      boardRefs: [board('support-legal', '04-service-status-overview.svg')],
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: [],
    },
    {
      path: '/status/incidents/:incidentId',
      area: 'Incident detail',
      purpose: 'Sanitized public incident detail, impact, and history.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: null,
      mutationControls: [],
      boardRefs: [board('support-legal', '05-incident-detail-history.svg')],
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: [],
    },
    {
      path: '/docs',
      area: 'Documentation/help',
      purpose: 'Protocol and journey guidance.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: 'public',
      mutationControls: [],
      boardRefs: [board('support-legal', '01-documentation-home.svg')],
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: ['/how-it-works'],
    },
    {
      path: '/docs/:slug',
      area: 'Documentation article',
      purpose: 'Versioned, release-labelled guidance article.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: null,
      mutationControls: [],
      boardRefs: [board('support-legal', '02-documentation-article.svg')],
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: [],
    },
    {
      path: '/contact',
      area: 'Contact',
      purpose: 'Contact category selection and approved public channels.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: null,
      mutationControls: [],
      boardRefs: [board('support-legal', '06-contact-support-entry.svg')],
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: [],
    },
    {
      path: '/support',
      area: 'Support',
      purpose: 'Troubleshooting and configured minimum-data support submission.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: null,
      mutationControls: [],
      boardRefs: [
        board('support-legal', '03-help-troubleshooting.svg'),
        board('support-legal', '07-support-request-form.svg'),
      ],
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: [],
    },
    {
      path: '/security',
      area: 'Security',
      purpose: 'Responsible-disclosure guidance and protected reporting channel.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: null,
      mutationControls: [],
      boardRefs: [board('support-legal', '08-security-reporting.svg')],
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: [],
    },
    {
      path: '/privacy',
      area: 'Privacy',
      purpose: 'Versioned, legally approved privacy notice.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: null,
      mutationControls: [],
      boardRefs: [board('support-legal', '09-privacy-notice.svg')],
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: [],
    },
    {
      path: '/terms',
      area: 'Terms',
      purpose: 'Versioned, legally approved terms of use.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: 'public',
      mutationControls: [],
      boardRefs: [board('support-legal', '10-terms-of-use.svg')],
      boardAuthority: 'route',
      implementationStatus: 'implemented',
      aliases: [],
    },
    {
      path: '/disclosures',
      area: 'Disclosures',
      purpose: 'Protocol, participation, testnet, and mainnet risks.',
      visibility: 'public',
      audience: ALL_CONTEXTS,
      read: PUBLIC_READ,
      navigationGroup: null,
      mutationControls: [],
      boardRefs: [
        board('support-legal', '11-protocol-risk-disclosures.svg'),
      ],
      boardAuthority: 'route',
      implementationStatus: 'planned',
      aliases: [],
    },
  ]);

export interface LegacyRouteRedirect {
  readonly from: string;
  readonly destination: string;
  readonly preserveQuery: boolean;
  readonly preserveHash: boolean;
  readonly source: 'protocol-authority' | 'existing-implementation';
}

export const LEGACY_ROUTE_REDIRECTS: readonly LegacyRouteRedirect[] =
  Object.freeze([
    {
      from: '/verifier',
      destination: '/dashboard/verifications',
      preserveQuery: true,
      preserveHash: true,
      source: 'protocol-authority',
    },
    {
      from: '/rewards',
      destination: '/dashboard/rewards',
      preserveQuery: true,
      preserveHash: true,
      source: 'protocol-authority',
    },
    {
      from: '/identity',
      destination: '/settings/identity',
      preserveQuery: true,
      preserveHash: true,
      source: 'protocol-authority',
    },
    {
      from: '/how-it-works',
      destination: '/docs',
      preserveQuery: true,
      preserveHash: true,
      source: 'protocol-authority',
    },
    {
      from: '/treasury/stake',
      destination: '/treasury',
      preserveQuery: true,
      preserveHash: true,
      source: 'protocol-authority',
    },
    {
      from: '/claim-detail',
      destination: '/',
      preserveQuery: true,
      preserveHash: true,
      source: 'existing-implementation',
    },
  ]);

export type DiscoveredRouteKind =
  | 'canonical'
  | 'legacy-alias'
  | 'internal-redirect'
  | 'internal-harness';

export interface DiscoveredRouteClassification {
  readonly pattern: string;
  readonly kind: DiscoveredRouteKind;
  readonly canonicalPath: string | null;
  readonly note: string;
}

/**
 * Every `page.tsx` route currently shipped by the app must map here. The
 * conformance test walks `src/app` and fails if a route is missing.
 */
export const DISCOVERED_ROUTE_CLASSIFICATIONS: readonly DiscoveredRouteClassification[] =
  Object.freeze([
    { pattern: '/', kind: 'canonical', canonicalPath: '/', note: 'Product entry' },
    { pattern: '/claims', kind: 'canonical', canonicalPath: '/claims', note: 'Explore claims' },
    {
      pattern: '/claims/:param',
      kind: 'canonical',
      canonicalPath: '/claims/:claimId',
      note: 'Claim detail',
    },
    {
      pattern: '/claims/new',
      kind: 'canonical',
      canonicalPath: '/claims/new',
      note: 'Create claim',
    },
    {
      pattern: '/dashboard/rewards',
      kind: 'canonical',
      canonicalPath: '/dashboard/rewards',
      note: 'Rewards',
    },
    {
      pattern: '/dashboard/transactions',
      kind: 'canonical',
      canonicalPath: '/dashboard/transactions',
      note: 'Transaction center',
    },
    {
      pattern: '/disputes',
      kind: 'canonical',
      canonicalPath: '/disputes',
      note: 'Disputes',
    },
    {
      pattern: '/treasury',
      kind: 'canonical',
      canonicalPath: '/treasury',
      note: 'Treasury',
    },
    {
      pattern: '/admin',
      kind: 'canonical',
      canonicalPath: '/admin',
      note: 'Admin overview',
    },
    {
      pattern: '/admin/operations/:param',
      kind: 'canonical',
      canonicalPath: '/admin/operations/:queue',
      note: 'Admin operation',
    },
    {
      pattern: '/terms',
      kind: 'canonical',
      canonicalPath: '/terms',
      note: 'Terms of use',
    },
    { pattern: '/verifier', kind: 'legacy-alias', canonicalPath: '/dashboard/verifications', note: 'Legacy verifier alias' },
    { pattern: '/rewards', kind: 'legacy-alias', canonicalPath: '/dashboard/rewards', note: 'Legacy rewards alias' },
    { pattern: '/identity', kind: 'legacy-alias', canonicalPath: '/settings/identity', note: 'Legacy identity alias' },
    { pattern: '/how-it-works', kind: 'legacy-alias', canonicalPath: '/docs', note: 'Legacy docs alias' },
    { pattern: '/treasury/stake', kind: 'legacy-alias', canonicalPath: '/treasury', note: 'Legacy stake alias' },
    {
      pattern: '/claim-detail',
      kind: 'internal-redirect',
      canonicalPath: '/',
      note: 'Existing intermediate redirect',
    },
    {
      pattern: '/e2e/deployment-preview',
      kind: 'internal-harness',
      canonicalPath: null,
      note: 'Deployment preview harness; never a public route',
    },
    {
      pattern: '/e2e/transactions',
      kind: 'internal-harness',
      canonicalPath: null,
      note: 'Transaction harness; never a public route',
    },
  ]);

export type RouteDenialReason =
  | 'wallet_disconnected'
  | 'wrong_chain'
  | 'stale_authority'
  | 'revoked_authority'
  | 'unavailable_authority'
  | 'capability_required'
  | 'unmapped_route';

export type RouteReadDecision =
  | {
      readonly status: 'allowed';
      readonly via: 'public' | 'authenticated' | 'capability';
      readonly readOnly: boolean;
    }
  | {
      readonly status: 'denied' | 'unavailable';
      readonly reason: RouteDenialReason;
    };

export function normalizeRoutePattern(path: string): string {
  const pathname = path.split('?')[0].split('#')[0];
  return pathname
    .split('/')
    .map((segment) => {
      if (
        (segment.startsWith('[') && segment.endsWith(']')) ||
        segment.startsWith(':')
      ) {
        return ':param';
      }
      return segment;
    })
    .join('/');
}

function pathSegments(path: string): readonly string[] {
  return path.split('?')[0].split('#')[0].split('/').filter(Boolean);
}

export function matchesRoutePattern(pattern: string, pathname: string): boolean {
  const patternSegments = pathSegments(pattern);
  const pathnameSegments = pathSegments(pathname);
  if (patternSegments.length !== pathnameSegments.length) return false;

  return patternSegments.every((segment, index) => {
    const value = pathnameSegments[index];
    if (segment.startsWith(':')) {
      return value.length > 0;
    }
    return segment === value;
  });
}

export function findCanonicalRoute(
  pathname: string,
): CanonicalRouteExpectation | undefined {
  const pathWithoutSuffix = pathname.split('?')[0].split('#')[0];

  // Static routes win over dynamic routes, so `/claims/new` never resolves to
  // `/claims/:claimId`.
  const exact = CANONICAL_ROUTE_EXPECTATIONS.find(
    (route) => route.path === pathWithoutSuffix,
  );
  if (exact) return exact;

  return CANONICAL_ROUTE_EXPECTATIONS.find(
    (route) =>
      route.path.includes(':') && matchesRoutePattern(route.path, pathWithoutSuffix),
  );
}

export function findBoard(path: string): ApprovedBoard | undefined {
  return APPROVED_BOARDS.find((entry) => entry.path === path);
}

export function isApprovedBoard(path: string): boolean {
  return BOARD_PATHS.has(path);
}

export function resolveLegacyRedirect(
  pathname: string,
  search = '',
  hash = '',
): { destination: string; location: string } | null {
  const redirect = LEGACY_ROUTE_REDIRECTS.find(
    (entry) => entry.from === pathname,
  );
  if (!redirect) return null;

  const query = search
    ? search.startsWith('?')
      ? search
      : `?${search}`
    : '';
  const fragment = hash
    ? hash.startsWith('#')
      ? hash
      : `#${hash}`
    : '';

  return {
    destination: redirect.destination,
    location: `${redirect.destination}${query}${fragment}`,
  };
}

function denialReasonFor(fixture: AuthorityFixture): RouteDenialReason {
  const evidence = fixture.evidence;
  if (!evidence.authorityAvailable) return 'unavailable_authority';
  if (!evidence.walletConnected || !evidence.sessionValid) {
    return 'wallet_disconnected';
  }
  if (!evidence.supportedChain) return 'wrong_chain';
  if (!evidence.releaseFresh) return 'stale_authority';
  if (evidence.revoked.length > 0) return 'revoked_authority';
  return 'capability_required';
}

/**
 * Resolve read access for a canonical route from authority evidence.
 * `activeContext` is intentionally ignored.
 */
export function evaluateRouteRead(
  route: CanonicalRouteExpectation,
  fixture: AuthorityFixture,
): RouteReadDecision {
  if (!route.audience.includes(fixture.context)) {
    return { status: 'denied', reason: denialReasonFor(fixture) };
  }

  if (route.read.kind === 'public') {
    return { status: 'allowed', via: 'public', readOnly: false };
  }

  if (route.read.kind === 'authenticated') {
    const evidence = fixture.evidence;
    if (!evidence.authorityAvailable) {
      return { status: 'unavailable', reason: 'unavailable_authority' };
    }
    if (!evidence.walletConnected || !evidence.sessionValid) {
      return { status: 'denied', reason: 'wallet_disconnected' };
    }
    if (!evidence.supportedChain) {
      return { status: 'denied', reason: 'wrong_chain' };
    }
    if (!evidence.releaseFresh) {
      return { status: 'denied', reason: 'stale_authority' };
    }
    return { status: 'allowed', via: 'authenticated', readOnly: false };
  }

  const resolved = route.read.capabilities.map((capability) =>
    resolveCapability(capability, fixture),
  );

  if (resolved.some((value) => value === 'unavailable')) {
    return { status: 'unavailable', reason: 'unavailable_authority' };
  }

  const allowedCount = resolved.filter(
    (value) => value === 'granted' || value === 'read-only',
  ).length;
  const isAllowed =
    route.read.mode === 'all'
      ? allowedCount === resolved.length
      : allowedCount > 0;

  if (isAllowed) {
    return {
      status: 'allowed',
      via: 'capability',
      readOnly: resolved.every((value) => value === 'read-only'),
    };
  }

  return { status: 'denied', reason: denialReasonFor(fixture) };
}

export function allowedMutationControls(
  route: CanonicalRouteExpectation,
  fixture: AuthorityFixture,
): readonly MutationControlExpectation[] {
  return route.mutationControls.filter((entry) =>
    isCapabilityGranted(entry.capability, fixture),
  );
}

export function navigableRoutesFor(
  fixture: AuthorityFixture,
): readonly CanonicalRouteExpectation[] {
  return CANONICAL_ROUTE_EXPECTATIONS.filter((route) => {
    if (route.navigationGroup === null) return false;
    return evaluateRouteRead(route, fixture).status === 'allowed';
  });
}
