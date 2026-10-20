import Link from 'next/link';

export function DocsNotFound() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16 text-[#F7F9FC]" role="status">
      <p className="text-xs font-bold uppercase text-[#22D3EE]">Documentation</p>
      <h1 className="mt-3 text-2xl font-bold">This article is not available.</h1>
      <p className="mt-3 text-sm leading-6 text-[#B2BDD0]">Only approved articles are published in this library.</p>
      <Link href="/docs" className="mt-6 inline-flex min-h-11 items-center rounded-lg border border-[#22D3EE] px-4 font-semibold text-[#7BE8F5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]">Browse documentation</Link>
    </section>
  );
}