import Link from 'next/link';
import { SafeExternalLink } from '@/components/security/SafeExternalLink';
import type { DocumentationArticle, DocumentationBlock } from '@/lib/docs/content';
import { DocsHeader } from './DocsHeader';

interface DocsArticleProps {
  article: DocumentationArticle;
  relatedArticles: DocumentationArticle[];
  previousArticle?: DocumentationArticle;
  nextArticle?: DocumentationArticle;
}

const AUDIENCE_LABELS = {
  protocol: 'Protocol documentation',
  guidance: 'User guidance',
} as const;

function formatReviewDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function ContentBlock({ block }: { block: DocumentationBlock }) {
  if (block.type === 'heading') {
    const Heading = block.level === 3 ? 'h3' : 'h2';
    return <Heading id={block.id} className="scroll-mt-8 text-xl font-extrabold text-[#F7F9FC]">{block.text}</Heading>;
  }
  if (block.type === 'paragraph') return <p className="text-sm leading-7 text-[#D0D7E2]">{block.text}</p>;
  if (block.type === 'list') {
    return <ul className="list-disc space-y-2 pl-6 text-sm leading-7 text-[#D0D7E2]">{block.items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>;
  }
  return (
    <aside className="border-l-2 border-[#22D3EE] bg-[#22D3EE]/5 px-4 py-3" aria-label={block.title}>
      <h3 className="font-bold text-[#F7F9FC]">{block.title}</h3>
      <p className="mt-1 text-sm leading-6 text-[#B2BDD0]">{block.text}</p>
    </aside>
  );
}

function ArticleLink({ article, label }: { article: DocumentationArticle; label: string }) {
  return (
    <Link href={`/docs/${article.slug}`} className="block min-h-16 rounded-lg border border-[#273149] p-4 hover:border-[#22D3EE]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]">
      <span className="block text-xs font-bold uppercase text-[#9AA7BD]">{label}</span>
      <span className="mt-1 block font-semibold text-[#F7F9FC]">{article.title}</span>
    </Link>
  );
}

export function DocsArticle({ article, relatedArticles, previousArticle, nextArticle }: DocsArticleProps) {
  const headings = article.blocks.filter((block): block is Extract<DocumentationBlock, { type: 'heading' }> => block.type === 'heading');

  return (
    <div className="min-h-screen bg-[#070A12] text-[#F7F9FC]">
      <DocsHeader />
      <div className="mx-auto max-w-[1480px] px-5 pb-14 pt-8 sm:px-8">
        <nav aria-label="Breadcrumb" className="text-sm text-[#9AA7BD]">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link className="underline decoration-[#71809a] underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]" href="/docs">Docs</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link className="underline decoration-[#71809a] underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]" href="/docs#topics-title">{article.topic}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-[#D0D7E2]">{article.title}</li>
          </ol>
        </nav>

        <header className="mt-8 max-w-4xl">
          <p className="text-xs font-extrabold uppercase text-[#22D3EE]">{AUDIENCE_LABELS[article.audience]}</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">{article.title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#B2BDD0]">{article.summary}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-md border border-[#4F7CFF]/60 bg-[#4F7CFF]/10 px-3 py-2 text-[#C8D3FF]">Version {article.version}</span>
            <span className="rounded-md border border-[#41D39A]/60 bg-[#41D39A]/10 px-3 py-2 text-[#8AE4BE]">Reviewed {formatReviewDate(article.lastReviewedAt)}</span>
            <span className="rounded-md border border-[#22D3EE]/60 bg-[#22D3EE]/10 px-3 py-2 text-[#7BE8F5]">Applies to {article.appliesTo}</span>
            <span className="rounded-md border border-[#273149] px-3 py-2 text-[#B2BDD0]">{article.release}</span>
          </div>
        </header>

        <div className="mt-8 grid items-start gap-5 xl:grid-cols-[220px_minmax(0,1fr)_260px]">
          <nav aria-label="On this page" className="rounded-xl border border-[#273149] bg-[#0C111C] p-4">
            <h2 className="text-xs font-extrabold uppercase text-[#9AA7BD]">On this page</h2>
            <ul className="mt-3 space-y-1">
              {headings.map((heading) => (
                <li key={heading.id}>
                  <a href={`#${heading.id}`} className="block rounded-md px-2 py-2 text-sm leading-5 text-[#B2BDD0] hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]">{heading.text}</a>
                </li>
              ))}
              {headings.length === 0 && <li className="text-sm text-[#9AA7BD]">No sections listed.</li>}
            </ul>
          </nav>

          <article aria-label={article.title} className="min-w-0 rounded-xl border border-[#273149] bg-[#101522] p-5 sm:p-8">
            <div className="space-y-7">
              {article.blocks.map((block, index) => <ContentBlock key={`${block.type}-${index}`} block={block} />)}
            </div>
            <section aria-labelledby="sources-title" className="mt-10 border-t border-[#273149] pt-6">
              <h2 id="sources-title" className="text-sm font-bold">Sources</h2>
              <ul className="mt-3 space-y-3">
                {article.sources.map((source) => (
                  <li key={source.href}><SafeExternalLink href={source.href}>{source.title}</SafeExternalLink></li>
                ))}
              </ul>
            </section>
            <aside aria-label="Documentation feedback boundary" className="mt-8 border-t border-[#273149] pt-5">
              <h2 className="text-sm font-bold">Feedback</h2>
              <p className="mt-2 text-sm leading-6 text-[#B2BDD0]">Feedback is not collected here and this page does not provide support resolution.</p>
            </aside>
          </article>

          <aside className="space-y-4">
            <section aria-labelledby="article-details-title" className="rounded-xl border border-[#273149] bg-[#0C111C] p-4">
              <h2 id="article-details-title" className="font-bold">Article details</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <div><dt className="text-xs text-[#9AA7BD]">Version</dt><dd className="mt-1 font-semibold">{article.version}</dd></div>
                <div><dt className="text-xs text-[#9AA7BD]">Applies to</dt><dd className="mt-1 font-semibold">{article.appliesTo}</dd></div>
                <div><dt className="text-xs text-[#9AA7BD]">Release</dt><dd className="mt-1 font-semibold">{article.release}</dd></div>
                <div><dt className="text-xs text-[#9AA7BD]">Last reviewed</dt><dd className="mt-1 font-semibold">{formatReviewDate(article.lastReviewedAt)}</dd></div>
                <div><dt className="text-xs text-[#9AA7BD]">Topic</dt><dd className="mt-1 font-semibold">{article.topic}</dd></div>
              </dl>
            </section>
            {relatedArticles.length > 0 && (
              <section aria-labelledby="related-title" className="rounded-xl border border-[#273149] bg-[#0C111C] p-4">
                <h2 id="related-title" className="font-bold">Related content</h2>
                <ul className="mt-3 space-y-2">{relatedArticles.map((related) => <li key={related.slug}><Link className="text-sm text-[#7BE8F5] underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]" href={`/docs/${related.slug}`}>{related.title}</Link></li>)}</ul>
              </section>
            )}
          </aside>
        </div>

        {(previousArticle || nextArticle) && (
          <nav aria-label="Article pagination" className="mt-5 grid gap-3 sm:grid-cols-2">
            {previousArticle ? <ArticleLink article={previousArticle} label="Previous article" /> : <span />}
            {nextArticle ? <ArticleLink article={nextArticle} label="Next article" /> : <span />}
          </nav>
        )}
      </div>
    </div>
  );
}