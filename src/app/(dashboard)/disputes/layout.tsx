/**
 * /disputes route — Server Component metadata — Issue #620 (UI-FE-050)
 *
 * Exports public metadata for the Disputes page (public per the route
 * contract; actions are capability-gated). Only static approved text is used:
 * dispute content and verifier-specific data must never appear in metadata.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { generateRouteMetadata } from '@/lib/metadata/route-metadata';

export const metadata: Metadata = generateRouteMetadata({
  pathname: '/disputes',
});

export default function DisputesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
