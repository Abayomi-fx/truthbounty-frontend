/**
 * /how-it-works route — Server Component metadata — Issue #620 (UI-FE-050)
 *
 * Exports noindex metadata: per the route contract /how-it-works is an alias
 * that redirects to /docs, so it advertises no canonical URL of its own.
 * This layout exists because the page.tsx is 'use client' and cannot export
 * Next.js metadata directly.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { generateRouteMetadata } from '@/lib/metadata/route-metadata';

export const metadata: Metadata = generateRouteMetadata({
  pathname: '/how-it-works',
});

export default function HowItWorksLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
