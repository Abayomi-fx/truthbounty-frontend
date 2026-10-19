/**
 * /claims/[claimId] — Canonical claim detail page (UI-FE-010)
 *
 * Thin server-component shell. Reads `params.claimId` from the App Router and
 * delegates all rendering to the `ClaimDetailComposer` client component.
 * No data fetching, no business logic, no ARIA here.
 */

import { ClaimDetailComposer } from '@/components/features/claim-detail/ClaimDetailComposer';

interface ClaimDetailPageProps {
  params: { claimId: string };
}

export default function ClaimDetailPage({ params }: ClaimDetailPageProps) {
  return <ClaimDetailComposer claimId={params.claimId} />;
}
