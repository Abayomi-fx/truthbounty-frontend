/**
 * /claims/new route — Server Component metadata — Issue #620 (UI-FE-050)
 *
 * Exports noindex metadata for the claim submission page.
 * This route requires wallet connection and is not approved for public indexing.
 * Claim draft content must never appear in metadata.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { generateRouteMetadata } from '@/lib/metadata/route-metadata';

export const metadata: Metadata = generateRouteMetadata({
  pathname: '/claims/new',
});

export default function NewClaimLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
