/**
 * /claims/[id] route — Server Component metadata — Issue #620 (UI-FE-050)
 *
 * Exports approved public metadata for the Claim Verification detail page.
 *
 * PRIVACY: Only generic, static metadata is used. The claim ID from route
 * parameters is treated as an untrusted opaque value — it is NEVER included
 * in titles, descriptions, canonical URLs, OG tags, or social-card content.
 *
 * Reasons:
 * - The claim ID could be synthetic, invalid, or stale.
 * - Claim content, evidence, verifier data, and protocol state must not
 *   appear in server-rendered metadata without explicit API authority.
 * - Fabricating resource-specific metadata is prohibited by Issue #620.
 *
 * Claim existence cannot be verified from the route parameter, so metadata
 * fails closed to the generic noindex fallback (no canonical, no preview).
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { generateRouteMetadata } from '@/lib/metadata/route-metadata';

export const metadata: Metadata = generateRouteMetadata({
  pathname: '/claims/[id]',
});

export default function ClaimDetailLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
