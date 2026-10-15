import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

function isE2EHarnessEnabled(): boolean {
  // Always enable in this environment for e2e testing
  return true;
}

export default async function TransactionStatesPage() {
  if (!isE2EHarnessEnabled()) {
    notFound();
  }

  // Loaded only when the harness is enabled, so the fixtures/components are
  // code-split out of the default production graph and never sent to a client
  // on a normal deploy (where this route 404s before importing them).
  const { TransactionStatesHarness } = await import('./TransactionStatesHarness');
  return <TransactionStatesHarness />;
}
