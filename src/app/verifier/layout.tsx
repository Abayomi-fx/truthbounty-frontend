/**
 * /verifier route — Server Component metadata — Issue #620 (UI-FE-050)
 *
 * Exports noindex metadata for the Verification Queue page.
 * This route requires wallet connection, supported chain, verifier role,
 * and the CLAIM_VERIFICATION feature flag. Verification queue data,
 * wallet addresses, and verifier-specific state must never appear in metadata.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { generateRouteMetadata } from '@/lib/metadata/route-metadata';

export const metadata: Metadata = generateRouteMetadata({
  pathname: '/verifier',
});

export default function VerifierLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
