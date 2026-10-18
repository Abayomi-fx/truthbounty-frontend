/**
 * Centralized Route Metadata — Issue #620 (UI-FE-050)
 *
 * Defines deterministic, privacy-safe metadata for every approved public route.
 *
 * PRIVACY INVARIANTS:
 * - Only approved public fields may appear in any metadata output.
 * - Wallet addresses, session tokens, claim drafts, sensitive evidence,
 *   PII, and any authenticated or privileged data must never appear here.
 * - All route parameters and API responses are treated as untrusted inputs.
 * - Missing, stale, denied, or unverified state fails closed (generic fallback).
 * - Metadata is generated statically in Server Components so that private
 *   client-side state cannot inadvertently reach server-rendered output.
 */

import type { Metadata } from 'next';
import { canonicalUrl } from './canonical-url';

// ─── Site defaults ────────────────────────────────────────────────────────────

/**
 * Site-wide brand constants. Must never include dynamic, wallet, session,
 * claim-draft, evidence, or user-specific content.
 */
export const SITE_NAME = 'TruthBounty';
export const SITE_TAGLINE = 'Decentralized Claim Verification';

/**
 * Default description used when no route-specific description is approved.
 * Describes the protocol at a high level without fabricating state.
 */
export const DEFAULT_DESCRIPTION =
  'TruthBounty is a decentralized protocol for verifying claims through community consensus and economic staking on Optimism.';

/**
 * Generic fallback title segment used for unknown or unavailable resources.
 */
export const FALLBACK_TITLE = SITE_NAME;

/**
 * Generic fallback description used for unknown or unavailable resources.
 * Must not imply availability, validity, or verified status of any resource.
 */
export const FALLBACK_DESCRIPTION = DEFAULT_DESCRIPTION;

// ─── Static OG image ─────────────────────────────────────────────────────────

/**
 * Default OG image. Uses the existing static screenshot asset already present
 * in public/. This avoids advertising a nonexistent path.
 *
 * The path is resolved to an absolute URL in generateRouteMetadata using
 * canonicalUrl, so it is safe for server-rendered output.
 *
 * Dimensions are the verified pixel size of public/1-claims-feed.png (1920x1738).
 *
 * BLOCKER: this asset is a UI screenshot containing mock protocol figures and
 * claim data. It must be replaced with an approved static brand image (no
 * protocol state, claims, or addresses) and these dimensions updated to match.
 */
export const OG_IMAGE_PATH = '/1-claims-feed.png';
export const OG_IMAGE_WIDTH = 1920;
export const OG_IMAGE_HEIGHT = 1738;
export const OG_IMAGE_ALT = `${SITE_NAME} — ${SITE_TAGLINE}`;

// ─── Route visibility ─────────────────────────────────────────────────────────

/**
 * Route visibility classification, aligned with NavigationGroupType in
 * src/config/navigation.ts.
 *
 * - public     : Approved for indexing and social sharing.
 * - personal   : Wallet-gated; must never be indexed or previewed.
 * - verifier   : Role-gated; must never be indexed or previewed.
 * - admin      : Role-gated; must never be indexed or previewed.
 * - redirect   : Redirect intermediary; must not be indexed.
 * - notFound   : Unknown resource; must not be indexed.
 */
export type RouteVisibility =
  | 'public'
  | 'personal'
  | 'verifier'
  | 'admin'
  | 'redirect'
  | 'notFound';

/**
 * Robots directives appropriate for each visibility class.
 *
 * Public routes: index + follow.
 * All others: noindex + nofollow (fail closed).
 */
export const ROBOTS_DIRECTIVES: Record<
  RouteVisibility,
  { index: boolean; follow: boolean }
> = {
  public:   { index: true,  follow: true  },
  personal: { index: false, follow: false },
  verifier: { index: false, follow: false },
  admin:    { index: false, follow: false },
  redirect: { index: false, follow: false },
  notFound: { index: false, follow: false },
};

// ─── Approved public route definitions ────────────────────────────────────────

/**
 * Approved metadata for each public route.
 *
 * AUTHORITY: titles and descriptions are derived from NAV_ITEMS labels and
 * descriptions in src/config/navigation.ts and the approved screen purposes
 * documented in docs/ARCHITECTURE.md.
 *
 * PRIVACY: these fields contain only approved static public information.
 * No route parameters, API values, wallet data, or user content is included.
 */
export interface RouteMetaDef {
  /** Canonical path (must match APP_ROUTES exactly). */
  path: string;
  /**
   * Canonical URL path to advertise. Defaults to `path` when not set.
   * Set to `null` for dynamic routes where no specific canonical URL can be
   * established without using an untrusted route parameter (e.g. /claims/[id]).
   * When null, canonical URL and openGraph.url are omitted from metadata.
   */
  canonicalPath?: string | null;
  /** Page title segment — combined with SITE_NAME in templates. */
  title: string;
  /** Brief approved public description. */
  description: string;
  /** Visibility / access class for robots directives. */
  visibility: RouteVisibility;
}

/**
 * Static approved route metadata table.
 *
 * Only routes whose visibility is 'public' are eligible for indexing
 * and social sharing. All other routes use noindex directives.
 */
export const ROUTE_META_TABLE: readonly RouteMetaDef[] = [
  // ── Public ──────────────────────────────────────────────────────────────
  {
    path: '/',
    title: 'Claims Feed',
    description:
      'Browse and verify active claims on the TruthBounty decentralized protocol. Community consensus and economic staking determine what information can be trusted.',
    visibility: 'public',
  },
  // Route contract: /how-it-works is an alias that redirects to /docs, which
  // this app does not serve. No canonical destination can be advertised, so it
  // is treated as a non-indexable alias (fail closed).
  {
    path: '/how-it-works',
    title: 'How It Works',
    description:
      'Learn how TruthBounty uses community verification, economic incentives, and proof of unique humanity to separate reliable information from false or misleading claims.',
    visibility: 'redirect',
  },
  {
    path: '/treasury',
    title: 'Protocol Treasury',
    description:
      'View the TruthBounty protocol treasury. Safe withdrawal controls for the canonical Optimism treasury are available to authorized administrators.',
    visibility: 'public',
  },
  // Route contract: /treasury/stake is an alias of /treasury, so its canonical
  // URL is /treasury (never itself).
  {
    path: '/treasury/stake',
    canonicalPath: '/treasury',
    title: 'Stake & Treasury Withdrawal',
    description:
      'Review reserved and unlocked canonical balances and manage per-recipient treasury withdrawals on the TruthBounty Optimism protocol.',
    visibility: 'public',
  },
  // ── Dynamic claim detail — generic only; no canonical URL ──────────────────
  // canonicalPath is null because no specific URL can be established without
  // including an untrusted claim ID. The bracket form /claims/[id] is a
  // Next.js filesystem pattern, not a valid resolvable URL.
  {
    path: '/claims/[id]',
    canonicalPath: null,
    title: 'Claim Verification',
    description:
      'Review and verify a claim on TruthBounty. Examine the available evidence and submit your verification decision.',
    visibility: 'public',
  },
  // ── Personal (wallet-gated) — noindex ────────────────────────────────────
  {
    path: '/identity',
    title: 'Identity & Trust',
    description: 'Manage your TruthBounty identity verification and trust score.',
    visibility: 'personal',
  },
  {
    path: '/rewards',
    title: 'Rewards & Claims',
    description: 'View and claim your TruthBounty verification rewards.',
    visibility: 'personal',
  },
  {
    path: '/claims/new',
    title: 'Submit a Claim',
    description: 'Submit a new claim to the TruthBounty verification protocol.',
    visibility: 'personal',
  },
  // ── Verifier-gated — noindex ─────────────────────────────────────────────
  {
    path: '/verifier',
    title: 'Verification Queue',
    description: 'Review and process claims in the TruthBounty verification queue.',
    visibility: 'verifier',
  },
  // ── Public per route contract (actions capability-gated) ─────────────────
  {
    path: '/disputes',
    title: 'Disputes',
    description:
      'Browse protocol disputes on TruthBounty. Actions on a dispute require the appropriate capability.',
    visibility: 'public',
  },
  // ── Admin-gated — noindex ────────────────────────────────────────────────
  {
    path: '/admin',
    title: 'Protocol Governance',
    description: 'Administer the TruthBounty protocol governance settings.',
    visibility: 'admin',
  },
  // ── Redirect intermediary — noindex ─────────────────────────────────────
  {
    path: '/claim-detail',
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    visibility: 'redirect',
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/**
 * Look up the metadata definition for a given pathname.
 *
 * Dynamic segments are normalized before lookup so that
 * `/claims/abc123` matches the `/claims/[id]` entry.
 *
 * Returns `undefined` when the path has no approved entry.
 */
export function findRouteMeta(pathname: string): RouteMetaDef | undefined {
  const normalized = normalizePathnameForLookup(pathname);
  return ROUTE_META_TABLE.find((entry) => entry.path === normalized);
}

/**
 * Normalizes a concrete pathname to a route-table key by replacing
 * dynamic segments with their bracketed equivalents.
 *
 * Only the patterns present in ROUTE_META_TABLE are handled.
 * This function must never use untrusted input as a key — it maps
 * the pathname to a static key and relies on the table for authority.
 */
function normalizePathnameForLookup(pathname: string): string {
  // /claims/<something-that-is-not-"new"> → /claims/[id]
  if (/^\/claims\/[^/]+$/.test(pathname) && !pathname.startsWith('/claims/new')) {
    return '/claims/[id]';
  }
  return pathname;
}

// ─── Metadata generation ─────────────────────────────────────────────────────

export interface RouteMetadataOptions {
  /**
   * The canonical pathname for the current route.
   * Must be a normalized, approved path — not a raw user-controlled value.
   */
  pathname: string;
  /**
   * When true, treat this route as a not-found / unavailable resource
   * regardless of any definition in ROUTE_META_TABLE.
   */
  notFound?: boolean;
}

/**
 * Generates deterministic, privacy-safe Next.js Metadata for a given route.
 *
 * PRIVACY GUARANTEES:
 * - Only approved static fields from ROUTE_META_TABLE are used.
 * - Dynamic API values, wallet data, claim content, evidence, session tokens,
 *   and all user-submitted content are excluded.
 * - Not-found, unavailable, and unknown routes use safe generic fallbacks
 *   without leaking route-specific private data.
 * - Non-public routes always receive noindex/nofollow directives.
 * - Canonical URLs are derived from the approved origin and the NORMALIZED
 *   (static) route path — never from the concrete untrusted pathname. This
 *   prevents claim IDs, wallet addresses, or other dynamic values that appear
 *   in a URL from propagating into canonical tags or OG metadata.
 */
export function generateRouteMetadata(options: RouteMetadataOptions): Metadata {
  const { pathname, notFound = false } = options;

  // ── Not-found / unavailable resource ──────────────────────────────────────
  if (notFound) {
    return buildFallbackMetadata();
  }

  // ── Route lookup ──────────────────────────────────────────────────────────
  const def = findRouteMeta(pathname);

  if (!def) {
    // Unknown route — fail closed with generic fallback
    return buildFallbackMetadata();
  }

  const robots = ROBOTS_DIRECTIVES[def.visibility];
  const isIndexable = robots.index;

  // ── Non-public routes: minimal noindex metadata ───────────────────────────
  if (!isIndexable) {
    return buildNonPublicMetadata(def);
  }

  // ── Public route: full canonical metadata ─────────────────────────────────
  // PRIVACY: use def.canonicalPath when set, otherwise def.path.
  // def.canonicalPath === null means no resolvable canonical URL can be
  // established (e.g. /claims/[id] where [id] is a filesystem pattern, not a
  // real URL segment). In that case canonical and OG url are omitted.
  const resolvedCanonicalPath = Object.prototype.hasOwnProperty.call(def, 'canonicalPath')
    ? def.canonicalPath
    : def.path;
  // Fail closed: when no canonical URL can be established (claim existence and
  // public eligibility cannot be verified from the route parameter alone), emit
  // the generic noindex fallback rather than an indexable page.
  if (resolvedCanonicalPath === null || resolvedCanonicalPath === undefined) {
    return buildFallbackMetadata();
  }
  return buildPublicMetadata(def, resolvedCanonicalPath);
}

// ─── Internal builders ────────────────────────────────────────────────────────

/**
 * Safe generic fallback for unknown, not-found, stale, denied, or
 * unavailable resources.
 *
 * Must:
 * - Use only generic, non-resource-specific content.
 * - Not imply availability, validity, or verified status of any resource.
 * - Apply noindex/nofollow.
 * - Not include a canonical URL (there is no authoritative resource).
 */
function buildFallbackMetadata(): Metadata {
  return {
    title: { absolute: FALLBACK_TITLE },
    description: FALLBACK_DESCRIPTION,
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: FALLBACK_TITLE,
      description: FALLBACK_DESCRIPTION,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: FALLBACK_TITLE,
      description: FALLBACK_DESCRIPTION,
    },
  };
}

/**
 * Minimal noindex metadata for authenticated, privileged, wallet-gated,
 * claim-draft, and redirect routes.
 *
 * Must:
 * - Suppress all OG/twitter preview tags (no social cards for non-public routes).
 * - Not include canonical URL.
 * - Use `{ absolute: ... }` to bypass the root title template and emit a
 *   clean title without double site-name suffix.
 *
 * PRIVACY — Next.js metadata inheritance:
 * Next.js shallowly merges metadata from outer to inner segments. If a child
 * does not set `openGraph`, the parent's `openGraph` is inherited. Returning
 * `openGraph: null` and `twitter: null` explicitly suppresses the root layout's
 * OG image and Twitter card fields, ensuring non-public routes produce no
 * social preview tags in the rendered <head>.
 */
function buildNonPublicMetadata(def: RouteMetaDef): Metadata {
  const fullTitle = `${def.title} — ${SITE_NAME}`;
  return {
    title: { absolute: fullTitle },
    robots: {
      index: false,
      follow: false,
    },
    // Explicitly null — not merely omitted — to override/suppress the root
    // layout's openGraph and twitter fields via Next.js shallow-merge semantics.
    // If these were simply absent, the parent's OG tags would be inherited,
    // which would produce social preview cards for non-public routes.
    openGraph: null,
    twitter: null,
  };
}

/**
 * Full canonical metadata for approved public routes.
 *
 * Open Graph and Twitter Card fields use only the same static approved data
 * as the title and description — no dynamic, API-sourced, or user-specific
 * content is included.
 *
 * The title uses `{ absolute: ... }` to bypass the root layout's template
 * (`%s | TruthBounty`) so that the final rendered title is exactly
 * `"Claims Feed — TruthBounty"` rather than `"Claims Feed — TruthBounty | TruthBounty"`.
 *
 * @param canonicalPathOrNull - The static approved path for canonical/OG url,
 *   or null when no resolvable canonical URL can be established (e.g. dynamic
 *   routes where the only available path form contains an unresolvable pattern).
 */
function buildPublicMetadata(def: RouteMetaDef, canonicalPathOrNull: string | null): Metadata {
  const fullTitle = `${def.title} — ${SITE_NAME}`;
  const ogImageUrl = canonicalUrl(OG_IMAGE_PATH);

  // canonical and OG url are omitted when no safe canonical path is available.
  const canonical = canonicalPathOrNull !== null ? canonicalUrl(canonicalPathOrNull) : undefined;

  return {
    title: { absolute: fullTitle },
    description: def.description,
    ...(canonical !== undefined && {
      alternates: {
        canonical,
      },
    }),
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: fullTitle,
      description: def.description,
      ...(canonical !== undefined && { url: canonical }),
      siteName: SITE_NAME,
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: OG_IMAGE_ALT,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: def.description,
      images: [ogImageUrl],
    },
  };
}
