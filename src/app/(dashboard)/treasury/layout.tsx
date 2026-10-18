/**
 * /treasury route — Server Component metadata — Issue #620 (UI-FE-050)
 *
 * Exports approved public metadata for the Protocol Treasury page.
 * This layout exists because the page.tsx is 'use client' and cannot export
 * Next.js metadata directly.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { generateRouteMetadata } from '@/lib/metadata/route-metadata';

export const metadata: Metadata = generateRouteMetadata({
  pathname: '/treasury',
});

export default function TreasuryLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
