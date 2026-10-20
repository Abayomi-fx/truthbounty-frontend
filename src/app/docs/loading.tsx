export default function DocsLoading() {
  return (
    <div className="min-h-screen bg-[#070A12] px-5 py-12 text-[#F7F9FC]" role="status" aria-busy="true">
      <span className="sr-only">Loading documentation</span>
      <div className="mx-auto max-w-6xl animate-pulse space-y-6 motion-reduce:animate-none">
        <div className="h-3 w-28 rounded bg-[#273149]" />
        <div className="h-10 max-w-xl rounded bg-[#273149]" />
        <div className="h-14 rounded-xl bg-[#101522]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-48 rounded-xl border border-[#273149] bg-[#101522]" />)}
        </div>
      </div>
    </div>
  );
}