'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { AdminUnauthorizedState } from '@/components/features/admin-dashboard/AdminUnauthorizedState';
import { useAdminDashboardData } from '@/hooks/useAdminDashboardData';

function QueueDetail() {
  const params = useParams<{ queue: string }>();
  const queueId = decodeURIComponent(params.queue);
  const data = useAdminDashboardData();
  const item = data.operationalQueue.find((entry) => entry.id === queueId);

  if (!data.isAuthorized) {
    return <AdminUnauthorizedState reason={data.unauthorizedReason} canonicalAdminAddress={data.canonicalAdminAddress} connectedAddress={data.account} />;
  }

  if (data.isLoading && !item) {
    return <p role="status" className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading authorized queue projection…</p>;
  }

  if (!item) {
    return <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6"><h1 className="font-semibold">Queue item unavailable</h1><p className="mt-2 text-sm text-muted-foreground">This identifier is not present in the current authorized queue projection.</p><Link href="/admin" className="mt-4 inline-block text-sm underline">Return to operations</Link></div>;
  }

  const retry = item.retryEligibility;
  const hasRetryProof = Boolean(retry?.eligible && retry.permissionMapped && retry.idempotencyProofRef?.trim());
  const freshnessStatus = data.isOffline ? 'offline' : data.isStale ? 'stale' : data.isDegraded ? 'degraded' : data.freshness.isFresh ? 'fresh' : 'unknown';
  const auditRecords = data.auditRecords.filter((record) => record.targetResource === item.targetResource || record.action.includes(item.id));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">Protected operations queue</p>
          <h1 className="mt-2 text-2xl font-bold">{item.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
        </div>
        <Link href="/admin" className="rounded-lg border border-border px-4 py-2 text-sm underline underline-offset-2">All operations</Link>
      </div>

      <section aria-labelledby="queue-projection-heading" className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 id="queue-projection-heading" className="text-base font-semibold">Queue record</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Queue item identifier</dt><dd className="mt-1 break-all font-mono text-sm">{item.id}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Reported lifecycle state</dt><dd className="mt-1 text-sm">{item.queueState ?? item.status}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Queue age</dt><dd className="mt-1 text-sm">{item.queueAge}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Created at</dt><dd className="mt-1 text-sm">{new Date(item.createdAt).toLocaleString()}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Required authority</dt><dd className="mt-1 text-sm">{item.authority}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Target resource</dt><dd className="mt-1 break-all font-mono text-sm">{item.targetResource}</dd></div>
        </dl>
        <p role="status" className="mt-5 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
          Projection freshness: {freshnessStatus}. Source: {data.freshness.source || 'not reported'}; last updated: {data.freshness.lastUpdated ? new Date(data.freshness.lastUpdated).toLocaleString() : 'not reported'}.
        </p>
        {!item.queueState && <p className="mt-3 text-xs text-muted-foreground">The current projection does not distinguish delayed, quarantined, and recovered states; those are shown as unavailable rather than inferred.</p>}
      </section>

      <section aria-labelledby="retry-review-heading" className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 id="retry-review-heading" className="text-base font-semibold">Retry eligibility</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Permission mapping</dt><dd className="mt-1 text-sm">{retry ? retry.permissionMapped ? 'Mapped' : 'Unmapped' : 'Unavailable'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Idempotency proof</dt><dd className="mt-1 break-all font-mono text-sm">{retry?.idempotencyProofRef || 'Unavailable'}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Eligibility reason</dt><dd className="mt-1 text-sm">{retry?.reason || (!hasRetryProof ? 'Retry is blocked because the projection does not include a verified permission mapping and idempotency proof.' : 'The projection reports eligibility; execution is still unavailable because no protected retry command is wired here.')}</dd></div>
        </dl>
        <button type="button" disabled aria-disabled="true" className="mt-5 rounded-lg border border-border px-4 py-2 text-sm opacity-50" title="A protected retry adapter is not available.">Retry unavailable</button>
      </section>

      <section aria-labelledby="audit-heading" className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 id="audit-heading" className="text-base font-semibold">Matching audit references</h2>
        {auditRecords.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No matching audit record was returned with this projection.</p> : <ul className="mt-3 space-y-2">{auditRecords.map((record) => <li key={record.auditId} className="rounded-lg border border-border p-3 text-sm"><span className="font-mono">{record.auditId}</span><span className="ml-2 text-muted-foreground">{record.status} · {record.timestamp}</span></li>)}</ul>}
      </section>
    </div>
  );
}

export default function QueueDetailPage() {
  return <MainLayout><QueueDetail /></MainLayout>;
}
