'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

function DisputeReviewWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const claimId = params.get('claimId')?.trim() ?? '';
  const [draftClaimId, setDraftClaimId] = useState(claimId);
  const { isOnline } = useNetworkStatus();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextId = draftClaimId.trim();
    router.push(nextId ? `${pathname}?claimId=${encodeURIComponent(nextId)}` : pathname);
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">Dispute review · Optimism</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Review disputes and appeals</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Review indexed dispute records and their source status. Displayed projections are not canonical contract reads; no dispute or appeal action is enabled here.</p>
        </header>

        <form onSubmit={submit} className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <label htmlFor="dispute-claim-id" className="text-sm font-medium">Claim ID</label>
            <input id="dispute-claim-id" value={draftClaimId} onChange={(event) => setDraftClaimId(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" placeholder="Enter a claim ID" autoComplete="off" />
          </div>
          <button type="submit" className="min-h-11 self-end rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Review claim</button>
        </form>

        {!claimId && <div role="status" className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Enter a claim ID to request its indexed dispute projection. No sample or inferred dispute state is shown.</div>}
        {claimId && <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-sm"><p>{isOnline ? 'The dispute projection could not be verified.' : 'You are offline; the dispute projection cannot be refreshed.'}</p><p className="mt-2 text-xs text-muted-foreground">Dispute projection queries are temporarily unavailable. No dispute state is inferred or fabricated.</p></div>}
      </div>
    </MainLayout>
  );
}

export default function DisputesRoutePage() {
  return <Suspense fallback={<main className="p-8 text-sm text-muted-foreground">Loading disputes …</main>}><DisputeReviewWorkspace /></Suspense>;
}
