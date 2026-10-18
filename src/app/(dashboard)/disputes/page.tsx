'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useDisputesByClaim } from '@/app/queries/disputes.queries';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

function DisputeReviewWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const claimId = params.get('claimId')?.trim() ?? '';
  const [draftClaimId, setDraftClaimId] = useState(claimId);
  const query = useDisputesByClaim(claimId);
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
        {claimId && query.isPending && <p role="status" className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading dispute projection…</p>}
        {claimId && query.isError && <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-sm"><p>{isOnline ? 'The dispute projection could not be verified.' : 'You are offline; the dispute projection cannot be refreshed.'}</p><button type="button" onClick={() => void query.refetch()} className="mt-3 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Retry</button></div>}
        {claimId && query.isSuccess && query.data.length === 0 && <div role="status" className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">The projection returned no disputes for this claim. This does not independently establish its canonical contract state.</div>}
        {query.data && query.data.length > 0 && <div className="space-y-4" aria-label="Dispute records">
          {query.data.map((dispute) => <article key={dispute.id} className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Dispute {dispute.id}</h2>
                <p className="mt-1 text-xs text-muted-foreground">Claim <Link href={`/claims/${encodeURIComponent(dispute.claimId)}`} className="underline underline-offset-2">{dispute.claimId}</Link></p>
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-xs">Indexed status: {dispute.status}</span>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Dispute record</dt><dd className="mt-1 break-all text-sm">{dispute.id}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Record timestamp</dt><dd className="mt-1 text-sm">{new Date(dispute.createdAt).toLocaleString()}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Votes for / against</dt><dd className="mt-1 text-sm">{dispute.proVotes} / {dispute.conVotes}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Reported total stake</dt><dd className="mt-1 text-sm">{String(dispute.totalStaked)} <span className="text-muted-foreground">(unit not provided)</span></dd></div>
            </dl>
            <div className="mt-5 rounded-lg border border-border bg-background p-4">
              <h3 className="text-sm font-semibold">Review and resolution</h3>
              <p className="mt-1 text-sm text-muted-foreground">{dispute.reason || 'No reason was provided by the projection.'}</p>
              <p className="mt-3 text-xs text-muted-foreground">Projection freshness and contract finality are not available from this response. Authorization, appeal, and settlement actions remain unavailable until a canonical phase and supported transaction capability are verified.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled aria-disabled="true" className="rounded-lg border border-border px-3 py-2 text-xs opacity-50">Authorize unavailable</button>
                <button type="button" disabled aria-disabled="true" className="rounded-lg border border-border px-3 py-2 text-xs opacity-50">Appeal / resolve unavailable</button>
              </div>
              {dispute.appealId && <p className="mt-3 break-all text-xs text-muted-foreground">Indexed appeal reference: {dispute.appealId}. Its canonical phase is not verified here.</p>}
            </div>
          </article>)}
        </div>}
      </div>
    </MainLayout>
  );
}

export default function DisputesRoutePage() {
  return <Suspense fallback={<main className="p-8 text-sm text-muted-foreground">Loading disputes…</main>}><DisputeReviewWorkspace /></Suspense>;
}