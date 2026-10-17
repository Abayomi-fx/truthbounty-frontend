/**
 * /claim-detail route — Server Component metadata — Issue #620 (UI-FE-050)
 *
 * Exports noindex metadata for the claim-detail redirect intermediary.
 * This route immediately redirects to '/' and must not be indexed.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { generateRouteMetadata } from '@/lib/metadata/route-metadata';

export const metadata: Metadata = generateRouteMetadata({
  pathname: '/claim-detail',
});

export default function ClaimDetailRedirectLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
