'use client';

export function DocsRouteError({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16 text-[#F7F9FC]" role="alert">
      <h1 className="text-2xl font-bold">Documentation is temporarily unavailable.</h1>
      <p className="mt-3 text-sm leading-6 text-[#B2BDD0]">No article content was submitted or stored. You can retry this page.</p>
      <button type="button" onClick={reset} className="mt-6 min-h-11 rounded-lg border border-[#22D3EE] px-4 font-semibold text-[#7BE8F5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]">Retry</button>
    </section>
  );
}