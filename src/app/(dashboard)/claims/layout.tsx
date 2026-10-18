/**
 * /claims/* route group — Server Component layout — Issue #620 (UI-FE-050)
 *
 * Provides the shared layout segment for all /claims/* routes.
 * Per-route metadata is exported from child layouts (/claims/[id]/layout.tsx,
 * /claims/new/layout.tsx) rather than here, because the metadata differs per
 * child segment.
 */
import type { ReactNode } from 'react';

export default function ClaimsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
