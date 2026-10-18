/**
 * /identity route — Server Component metadata — Issue #620 (UI-FE-050)
 *
 * Exports noindex metadata for the Identity & Trust page.
 * This route requires wallet connection and Worldcoin verification.
 * Wallet addresses, verification status, and identity data must never
 * appear in metadata.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { generateRouteMetadata } from '@/lib/metadata/route-metadata';

export const metadata: Metadata = generateRouteMetadata({
  pathname: '/identity',
});

export default function IdentityLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
