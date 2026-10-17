'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useClaimsList } from '@/hooks/useClaimsList';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { buildClaimListUrlSearch, parseClaimListUrl } from '@/app/lib/claim-list-url';
import type { ClaimListUrlState } from '@/app/lib/claim-list-url';
import type { ClaimStatus } from '@/app/types/claim';

const STATUS_OPTIONS: Array<{ value: ClaimStatus; label: string }> = [
  { value: 'UNDER_REVIEW', label: 'Verification' },
  { value: 'DISPUTED', label: 'Dispute open' },
  { value: 'VERIFIED', label: 'Finalized' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'OPEN', label: 'Open' },
];

function statusLabel(status: ClaimStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function ClaimsExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = parseClaimListUrl(new URLSearchParams(searchParams.toString()));
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const [draftSearch, setDraftSearch] = useState(state.search);
  const { isOnline } = useNetworkStatus();
  const list = useClaimsList({
    search: state.search,
    status: state.status,
    highImpact: state.highImpact || undefined,
    sort: state.sort,
    page,
  });

  useEffect(() => setDraftSearch(state.search), [state.search]);

  function update(next: Partial<ClaimListUrlState>, nextPage = 1) {
    const nextState = { ...state, ...next };
    const query = buildClaimListUrlSearch(nextState);
    const params = new URLSearchParams(query);
    if (nextPage > 1) params.set('page', String(nextPage));
    router.push(params.size ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div className="min-h-screen bg-[#070A12] text-[#F7F9FC]">
      <header className="border-b border-[#273149]">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-5">
          <Link href="/" className="font-extrabold tracking-tight">TruthBounty</Link>
          <div className="flex items-center gap-5 text-sm text-[#9AA7BD]">
            <Link href="/claims" aria-current="page" className="text-white">Explore claims</Link>
            <Link href="/how-it-works">How it works</Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-12">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Public record · no wallet required</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Explore claims</h1>
          <p className="mt-4 text-[#9AA7BD]">Review claims and their reported protocol status. The index is a projection; contract state remains authoritative.</p>
        </div>

        <form className="mt-9 grid gap-3 rounded-2xl border border-[#273149] bg-[#101522] p-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]" onSubmit={(event) => { event.preventDefault(); update({ search: draftSearch }); }}>
          <label className="sr-only" htmlFor="claim-search">Search claims</label>
          <input id="claim-search" type="search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Search claims" className="min-h-11 rounded-lg border border-[#273149] bg-[#070A12] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" />
          <select aria-label="Claim status" value={state.status ?? ''} onChange={(event) => update({ status: (event.target.value || undefined) as ClaimStatus | undefined })} className="min-h-11 rounded-lg border border-[#273149] bg-[#070A12] px-3 text-sm">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select aria-label="Sort claims" value={`${state.sort.field}.${state.sort.direction}`} onChange={(event) => { const [field, direction] = event.target.value.split('.') as [typeof state.sort.field, typeof state.sort.direction]; update({ sort: { field, direction } }); }} className="min-h-11 rounded-lg border border-[#273149] bg-[#070A12] px-3 text-sm">
            <option value="createdAt.desc">Newest first</option>
            <option value="createdAt.asc">Oldest first</option>
            <option value="title.asc">Title A–Z</option>
            <option value="confidenceScore.desc">Confidence</option>
          </select>
          <button type="submit" className="min-h-11 rounded-lg bg-[#4F7CFF] px-5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Search</button>
          <label className="flex items-center gap-2 text-sm text-[#CBD5E1] md:col-span-4">
            <input type="checkbox" checked={state.highImpact} onChange={(event) => update({ highImpact: event.target.checked })} className="h-4 w-4 accent-cyan-400" />
            High impact only
          </label>
        </form>

        {list.viewState === 'ready-stale' && <div role="status" className="mt-5 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">This projection is stale or degraded. Treat the displayed values as unconfirmed until refreshed.</div>}
        {list.viewState === 'loading' && <p role="status" className="mt-8 text-sm text-[#9AA7BD]">Loading claims…</p>}
        {list.viewState === 'error' && <div role="alert" className="mt-8 rounded-xl border border-rose-400/40 bg-rose-400/10 p-5"><p>{isOnline ? 'Claims could not be verified from the public projection.' : 'You are offline. The public claims projection cannot be refreshed.'}</p><button type="button" onClick={list.retry} className="mt-3 rounded-lg border border-rose-200/40 px-3 py-2 text-sm underline">Try again</button></div>}
        {list.viewState === 'empty' && <div role="status" className="mt-8 rounded-xl border border-[#273149] bg-[#101522] p-10 text-center"><h2 className="font-semibold">No matching claims</h2><p className="mt-2 text-sm text-[#9AA7BD]">Adjust the filters or clear the search to see more results.</p></div>}
        {list.data && list.data.items.length > 0 && <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-[#9AA7BD]" role="status" aria-live="polite">
            <span>{list.data.pagination.total} claims reported by the projection</span>
            <span>Projection {list.data.projection.freshness} · updated {new Date(list.data.projection.generatedAt).toLocaleString()}</span>
          </div>
          <ul className="mt-3 space-y-3" aria-label="Public claims">
            {list.data.items.map((claim) => <li key={claim.id} className="rounded-xl border border-[#273149] bg-[#101522] p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-300"><span>{claim.category || 'Uncategorized'}</span>{claim.highImpact && <span className="rounded-full border border-amber-300/40 px-2 py-0.5 text-amber-200">High impact</span>}</div>
                  <h2 className="mt-2 font-semibold leading-snug"><Link className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href={`/claims/${encodeURIComponent(claim.id)}`}>{claim.title}</Link></h2>
                  <p className="mt-2 text-sm text-[#9AA7BD]">Updated {new Date(claim.updatedAt).toLocaleDateString()}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-full border border-[#273149] px-3 py-1 text-[#CBD5E1]">{statusLabel(claim.status)}</span>
                  <span className="text-[#9AA7BD]">Confidence: {claim.confidenceScore === null ? 'not reported' : `${claim.confidenceScore}%`}</span>
                  <Link href={`/claims/${encodeURIComponent(claim.id)}`} className="font-semibold text-cyan-300 underline underline-offset-4">Review</Link>
                </div>
              </div>
            </li>)}
          </ul>
          <div className="mt-6 flex items-center justify-between">
            <button type="button" disabled={page <= 1 || list.isFetching} onClick={() => update({}, page - 1)} className="rounded-lg border border-[#273149] px-4 py-2 text-sm disabled:opacity-40">Previous</button>
            <span className="text-sm text-[#9AA7BD]">Page {list.data.pagination.page} of {Math.max(1, list.data.pagination.totalPages)}</span>
            <button type="button" disabled={page >= list.data.pagination.totalPages || list.isFetching} onClick={() => update({}, page + 1)} className="rounded-lg border border-[#273149] px-4 py-2 text-sm disabled:opacity-40">Next</button>
          </div>
        </>}
      </main>
    </div>
  );
}
