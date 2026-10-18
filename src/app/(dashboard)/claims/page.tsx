import { Suspense } from 'react';
import { ClaimsExplorer } from '@/components/features/public-claims/ClaimsExplorer';

export default function ClaimsPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#070A12] p-8 text-[#9AA7BD]">Loading public claims…</main>}><ClaimsExplorer /></Suspense>;
}
