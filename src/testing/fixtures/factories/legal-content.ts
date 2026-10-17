/**
 * UI-FE-088 — legal-content version factory.
 *
 * NOTE (maintainer gap): the repository has no pinned legal-content interface
 * yet, so this module pins the fixture shape itself. The issue lists
 * "legal-content versions" in scope, and an explicitly documented local
 * interface is safer than an untyped object. When the protocol implementation
 * matrix lands a real type, re-point `makeLegalContentVersion` at it — the
 * fields below are deliberately minimal so the migration is mechanical.
 *
 * `contentDigest` is a deterministic digest of the fixture copy, not a
 * checksum of any production text, and no legal wording, credential, or
 * user data is embedded here.
 */

import { createFixtureContext, type FixtureContext } from '../deterministic';

/** Legal documents the fixture catalogue can version. */
export const LEGAL_CONTENT_IDS = [
  'privacy-notice',
  'terms-of-use',
  'risk-disclosure',
  'analytics-consent',
] as const;

export type LegalContentId = (typeof LEGAL_CONTENT_IDS)[number];

export interface LegalContentVersion {
  /** Stable document identifier. */
  id: LegalContentId;
  /** Monotonic version tag, e.g. `v1`. */
  version: string;
  /** BCP-47 locale the version applies to. */
  locale: string;
  /** Human-facing title of this version. */
  title: string;
  /** One-line summary; fixture copy, not production legal wording. */
  summary: string;
  /** ISO timestamp the version takes effect. */
  effectiveAt: string;
  /** Version that supersedes this one, or `null` when current. */
  supersededBy: string | null;
  /** Deterministic digest of this fixture version's content. */
  contentDigest: `0x${string}`;
}

export interface MakeLegalContentVersionOptions {
  id?: LegalContentId;
  version?: string;
  /** Pin this version as superseded by another tag. */
  supersededBy?: string | null;
  overrides?: Partial<LegalContentVersion>;
  ctx?: FixtureContext;
}

const LEGAL_CONTENT_TITLES: Record<LegalContentId, string> = {
  'privacy-notice': 'Privacy Notice',
  'terms-of-use': 'Terms of Use',
  'risk-disclosure': 'Protocol Risk Disclosure',
  'analytics-consent': 'Analytics Consent Notice',
};

/** Build a versioned legal-content record with a deterministic digest. */
export function makeLegalContentVersion(
  options: MakeLegalContentVersionOptions = {},
): LegalContentVersion {
  const { id = 'privacy-notice', version = 'v1', overrides = {}, ctx = createFixtureContext() } = options;
  const title = LEGAL_CONTENT_TITLES[id];

  const record: LegalContentVersion = {
    id,
    version,
    locale: 'en',
    title,
    summary: `Fixture ${title} (${version}) produced deterministically by the UI-FE-088 factory library.`,
    effectiveAt: ctx.isoAt(0),
    supersededBy: options.supersededBy ?? null,
    contentDigest: ctx.hex(`legal:${id}:${version}`, 32),
  };

  return { ...record, ...overrides };
}

/** One current version per legal document — the baseline fixture set. */
export function makeLegalContentVersions(
  ctx: FixtureContext = createFixtureContext(),
): LegalContentVersion[] {
  return LEGAL_CONTENT_IDS.map((id) => makeLegalContentVersion({ id, ctx }));
}
