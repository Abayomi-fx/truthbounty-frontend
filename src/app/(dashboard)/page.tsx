'use client';

import Link from 'next/link';
import { useClaimsList } from '@/hooks/useClaimsList';

export default function PublicLandingPage() {
  const claims = useClaimsList({ pageSize: 4 });
  const freshness = claims.data?.projection.freshness;

  return (
    <div className="min-h-screen bg-[#070A12] text-[#F7F9FC]">
      <header className="border-b border-[#273149]">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-5">
          <Link href="/" className="font-extrabold tracking-tight">TruthBounty</Link>
          <div className="flex items-center gap-5 text-sm text-[#9AA7BD]">
            <Link href="/claims" className="hover:text-white">Explore claims</Link>
            <Link href="/how-it-works" className="hover:text-white">How it works</Link>
            <a href="https://github.com/DigiNodes/truthbounty-protocol" className="hover:text-white">Protocol docs</a>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-16 pt-14 sm:pt-20">
        <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(400px,.9fr)] lg:items-center">
          <div>
            <p className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-bold tracking-wide text-cyan-200">PUBLIC · NO WALLET REQUIRED</p>
            <h1 className="mt-6 max-w-2xl text-5xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">Evidence becomes accountable truth.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#9AA7BD]">TruthBounty coordinates evidence, economic accountability, and transparent resolution on Optimism. Review claims without treating a dashboard as the source of truth.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/claims" className="rounded-lg bg-[#4F7CFF] px-5 py-3 text-sm font-bold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Explore public claims</Link>
              <Link href="/how-it-works" className="rounded-lg border border-[#273149] bg-[#151C2B] px-5 py-3 text-sm font-bold hover:border-cyan-300/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">How verification works</Link>
            </div>
            <p className="mt-5 text-xs text-[#9AA7BD]">Public claim data is an indexer projection. Confirm protocol outcomes against canonical contract state.</p>
          </div>
          <Link
            href="/treasury"
            className="text-sm font-semibold text-[#5b5bf6] underline underline-offset-2"
          >
            Open treasury UX
          </Link>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-[#232329] bg-[#18181b] px-6 py-4">
          <div>
            <p className="text-sm font-medium text-white">Public Dispute Register</p>
            <p className="text-xs text-[#a1a1aa]">
              Provisional and final dispute outcomes with bonds, deadlines, and freshness labels.
            </p>
          </div>
          <Link
            href="/disputes"
            className="text-sm font-semibold text-[#5b5bf6] underline underline-offset-2"
          >
            Open dispute register
          </Link>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2">
            <ActivityAndNodes isLoading={claimsLoading && !hasData} />
          </div>
          <div className="xl:col-span-1">
            <VerificationNodes isLoading={claimsLoading && !hasData} />
          </div>
        </div>
        <ActiveClaimsTableContainer />
      </div>
    </MainLayout>
  );
};

          <section aria-labelledby="activity-heading" className="rounded-2xl border border-[#273149] bg-[#101522] p-5 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between gap-3 border-b border-[#273149] pb-4">
              <div>
                <h2 id="activity-heading" className="text-sm font-bold uppercase tracking-wider text-[#9AA7BD]">Public claim activity</h2>
                <p className="mt-1 text-xs text-[#71809A]">Reported by the claims projection</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${freshness === 'fresh' ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/40 bg-amber-300/10 text-amber-100'}`}>
                {freshness ?? (claims.viewState === 'loading' ? 'loading' : 'unavailable')}
              </span>
            </div>
            {claims.viewState === 'loading' && <p role="status" className="py-10 text-center text-sm text-[#9AA7BD]">Loading verified projection…</p>}
            {claims.viewState === 'error' && <p role="alert" className="py-10 text-center text-sm text-amber-100">Public activity is unavailable. No sample data is shown.</p>}
            {claims.viewState === 'empty' && <p role="status" className="py-10 text-center text-sm text-[#9AA7BD]">No claims are currently reported.</p>}
            {claims.viewState === 'ready-stale' && <p role="status" className="mb-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-100">This projection is stale or degraded; displayed records are not confirmed current.</p>}
            {claims.data && claims.data.items.length > 0 && <ul className="divide-y divide-[#273149]" aria-label="Recent public claims">
              {claims.data.items.map((claim) => <li key={claim.id} className="py-4">
                <div className="flex items-center justify-between gap-3 text-xs text-cyan-200"><span>{claim.category || 'Uncategorized'}</span><span className="text-[#9AA7BD]">{claim.status.replaceAll('_', ' ')}</span></div>
                <Link href={`/claims/${encodeURIComponent(claim.id)}`} className="mt-2 block text-sm font-semibold leading-6 hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">{claim.title}</Link>
                <p className="mt-1 text-xs text-[#71809A]">Updated {new Date(claim.updatedAt).toLocaleDateString()}</p>
              </li>)}
            </ul>}
            <div className="mt-3 flex items-center justify-between border-t border-[#273149] pt-4 text-xs text-[#9AA7BD]">
              <span>{claims.data ? `${claims.data.pagination.total} records reported` : 'Record count unavailable'}</span>
              <Link href="/claims" className="font-semibold text-cyan-200 underline underline-offset-4">Browse claims</Link>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}