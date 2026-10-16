/**
 * /admin route — Server Component metadata — Issue #620 (UI-FE-050)
 *
 * Exports noindex metadata for the Protocol Governance (admin) page.
 * This route requires wallet connection and admin role. Admin governance
 * data, protocol configuration, and admin-specific state must never appear
 * in metadata.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { generateRouteMetadata } from '@/lib/metadata/route-metadata';

export const metadata: Metadata = generateRouteMetadata({
  pathname: '/admin',
});

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
