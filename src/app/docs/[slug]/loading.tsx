export default function DocsArticleLoading() {
  return (
    <div className="min-h-screen bg-[#070A12] px-5 py-12 text-[#F7F9FC]" role="status" aria-busy="true">
      <span className="sr-only">Loading documentation article</span>
      <div className="mx-auto max-w-6xl animate-pulse space-y-6 motion-reduce:animate-none">
        <div className="h-3 w-40 rounded bg-[#273149]" />
        <div className="h-10 max-w-2xl rounded bg-[#273149]" />
        <div className="h-5 max-w-xl rounded bg-[#273149]" />
        <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_260px]">
          <div className="h-72 rounded-xl bg-[#0C111C]" />
          <div className="h-[540px] rounded-xl bg-[#101522]" />
          <div className="h-64 rounded-xl bg-[#0C111C]" />
        </div>
      </div>
    </div>
  );
}