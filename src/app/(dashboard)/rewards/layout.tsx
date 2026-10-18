/**
 * /rewards route — Server Component metadata — Issue #620 (UI-FE-050)
 *
 * Exports noindex metadata for the Rewards & Claims page.
 * This route requires wallet connection. Reward balances, claim ownership,
 * and wallet-specific data must never appear in metadata.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { generateRouteMetadata } from '@/lib/metadata/route-metadata';

export const metadata: Metadata = generateRouteMetadata({
  pathname: '/rewards',
});

export default function RewardsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
