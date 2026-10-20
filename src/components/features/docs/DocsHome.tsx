'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Search } from 'lucide-react';
import type { DocumentationArticle } from '@/lib/docs/content';
import { DocsHeader } from './DocsHeader';

interface DocsHomeProps {
  articles: DocumentationArticle[];
}

const AUDIENCE_LABELS = {
  protocol: 'Protocol documentation',
  guidance: 'User guidance',
} as const;

export function DocsHome({ articles }: DocsHomeProps) {
  const [query, setQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('All topics');
  const topics = useMemo(() => [...new Set(articles.map((article) => article.topic))].sort(), [articles]);
  const visibleArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return articles.filter((article) => {
      const matchesTopic = selectedTopic === 'All topics' || article.topic === selectedTopic;
      const searchable = [article.title, article.summary, article.topic, ...article.tags].join(' ').toLocaleLowerCase();
      return matchesTopic && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [articles, query, selectedTopic]);

  return (
    <div className="min-h-screen bg-[#070A12] text-[#F7F9FC]">
      <DocsHeader />
      <div className="mx-auto max-w-[1480px] px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <section aria-labelledby="docs-title" className="max-w-4xl">
          <p className="text-xs font-extrabold uppercase text-[#22D3EE]">Documentation</p>
          <h1 id="docs-title" className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl">
            Understand the protocol. Act with evidence.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#B2BDD0]">
            Versioned protocol documentation and user guidance, with release applicability and review sources.
          </p>
        </section>

        <section aria-label="Search documentation" className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.56fr)]">
          <label className="flex min-h-14 items-center gap-3 rounded-xl border border-[#273149] bg-[#101522] px-4 focus-within:border-[#22D3EE] focus-within:outline focus-within:outline-2 focus-within:outline-[#22D3EE]/40">
            <Search size={19} className="shrink-0 text-[#9AA7BD]" aria-hidden="true" />
            <span className="sr-only">Search documentation</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Search approved documentation"
              className="min-w-0 flex-1 bg-transparent text-sm text-[#F7F9FC] outline-none placeholder:text-[#9AA7BD]"
            />
          </label>
          <aside className="rounded-xl border border-[#22D3EE]/30 bg-[#22D3EE]/5 p-4" aria-label="Release information">
            <p className="text-sm font-bold">Release applicability</p>
            <p className="mt-1 text-sm leading-6 text-[#B2BDD0]">Each published guide lists its version, applicable release, and review date.</p>
          </aside>
        </section>

        <section aria-labelledby="topics-title" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#273149] pb-4">
            <div>
              <h2 id="topics-title" className="text-lg font-bold">Browse by topic</h2>
              <p className="mt-1 text-sm text-[#9AA7BD]">Protocol documentation and user guidance are labeled separately.</p>
            </div>
            {topics.length > 0 && (
              <div role="group" aria-label="Filter by topic" className="flex max-w-full flex-wrap gap-2">
                {['All topics', ...topics].map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    aria-pressed={selectedTopic === topic}
                    onClick={() => setSelectedTopic(topic)}
                    className={`min-h-10 rounded-lg border px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] ${selectedTopic === topic ? 'border-[#22D3EE] bg-[#22D3EE]/10 text-[#22D3EE]' : 'border-[#273149] text-[#B2BDD0] hover:border-[#71809a]'}`}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            )}
          </div>

          {articles.length === 0 ? (
            <div className="mt-6 flex items-start gap-4 border-b border-[#273149] py-8" role="status">
              <BookOpen className="mt-1 shrink-0 text-[#22D3EE]" size={21} aria-hidden="true" />
              <div>
                <h3 className="font-bold">No approved documentation is published yet.</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#B2BDD0]">Only reviewed content with a version, release, and source will appear here.</p>
              </div>
            </div>
          ) : visibleArticles.length === 0 ? (
            <p className="py-8 text-sm text-[#B2BDD0]" role="status">No documentation matches this search.</p>
          ) : (
            <ul className="mt-6 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
              {visibleArticles.map((article) => (
                <li key={article.slug}>
                  <Link href={`/docs/${article.slug}`} className="group block h-full rounded-xl border border-[#273149] bg-[#101522] p-5 transition-colors hover:border-[#22D3EE]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase text-[#22D3EE]">{article.topic}</span>
                      <span className="rounded-md border border-[#4F7CFF]/50 px-2 py-1 text-xs text-[#B8C8FF]">{AUDIENCE_LABELS[article.audience]}</span>
                    </div>
                    <h3 className="mt-5 text-lg font-bold group-hover:text-[#22D3EE]">{article.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#B2BDD0]">{article.summary}</p>
                    <p className="mt-5 text-xs text-[#9AA7BD]">{article.version} · {article.release}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}