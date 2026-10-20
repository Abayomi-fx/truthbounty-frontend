import Link from 'next/link';
import { ArrowUpRight, BookOpen } from 'lucide-react';

export function DocsHeader() {
  return (
    <header className="border-b border-[#273149] bg-[#0C111C]">
      <div className="mx-auto flex min-h-[72px] max-w-[1480px] items-center justify-between gap-5 px-5 sm:px-8">
        <Link href="/docs" className="inline-flex min-h-11 items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#22D3EE]">
          <span className="grid size-9 place-items-center rounded-lg bg-[#22D3EE]/10 text-[#22D3EE]" aria-hidden="true">
            <BookOpen size={19} />
          </span>
          <span className="text-sm font-extrabold text-[#F7F9FC]">TruthBounty</span>
        </Link>
        <nav aria-label="Public navigation" className="flex items-center gap-3 text-sm sm:gap-7">
          <Link href="/" className="min-h-11 content-center text-[#9AA7BD] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]">Explore</Link>
          <Link href="/how-it-works" className="hidden min-h-11 content-center text-[#9AA7BD] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] sm:block">How it works</Link>
          <Link href="/docs" aria-current="page" className="min-h-11 content-center font-bold text-[#22D3EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]">Docs</Link>
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#4F7CFF] bg-[#4F7CFF] px-3 font-bold text-white hover:bg-[#3f68df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] sm:px-4">
            Open app <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </header>
  );
}