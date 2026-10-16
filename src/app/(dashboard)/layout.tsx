/**
 * Dashboard route group layout — Issue #620 (UI-FE-050)
 *
 * This Server Component layout is the authoritative metadata segment for the
 * root '/' (Claims Feed) route. Child segments override this via their own
 * layout.tsx files.
 *
 * The root '/' path maps to this group's page.tsx which is 'use client'.
 * This layout exports the approved public metadata for that page.
 *
 * NOTE: Per-segment overrides are provided by each child route's own
 * layout.tsx. This layout's metadata only governs the '/' segment itself.
 *
 * PRIVACY: Only static, approved public content is present.
 */

// This file intentionally has no 'use client' directive — it is a
// Server Component so that Next.js metadata APIs work correctly.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { generateRouteMetadata } from '@/lib/metadata/route-metadata';

/**
 * Metadata for the root '/' path (Claims Feed).
 * Child routes override this with their own layout.tsx exports.
 */
export const metadata: Metadata = generateRouteMetadata({
  pathname: '/',
});

export default function DashboardGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  // This layout adds no visual wrapper — it exists solely to enable Server
  // Component metadata exports for the (dashboard) route group whose page.tsx
  // files are all 'use client'. The actual UI wrapper is provided by the
  // per-page MainLayout component.
  return <>{children}</>;
}
