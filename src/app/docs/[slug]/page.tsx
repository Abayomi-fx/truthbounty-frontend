import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsArticle } from '@/components/features/docs/DocsArticle';
import { DOCUMENTATION_ARTICLES } from '@/data/docs/approved-content';
import { getDocumentationArticle } from '@/lib/docs/content';
import { canonicalUrl } from '@/lib/metadata/canonical-url';
import { FALLBACK_DESCRIPTION, SITE_NAME, generateRouteMetadata } from '@/lib/metadata/route-metadata';

interface DocsArticlePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return DOCUMENTATION_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: DocsArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getDocumentationArticle(slug, DOCUMENTATION_ARTICLES);
  if (!article) return generateRouteMetadata({ pathname: '/docs/[slug]', notFound: true });

  const canonical = canonicalUrl(`/docs/${article.slug}`);
  return {
    title: { absolute: `${article.title} | ${SITE_NAME}` },
    description: article.summary || FALLBACK_DESCRIPTION,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: article.title,
      description: article.summary,
      siteName: SITE_NAME,
      type: 'article',
      url: canonical,
    },
    twitter: { card: 'summary', title: article.title, description: article.summary },
  };
}

export default async function DocsArticlePage({ params }: DocsArticlePageProps) {
  const { slug } = await params;
  const article = getDocumentationArticle(slug, DOCUMENTATION_ARTICLES);
  if (!article) notFound();

  const index = DOCUMENTATION_ARTICLES.findIndex((candidate) => candidate.slug === article.slug);
  const relatedArticles = article.relatedSlugs.flatMap((relatedSlug) => {
    const related = getDocumentationArticle(relatedSlug, DOCUMENTATION_ARTICLES);
    return related ? [related] : [];
  });

  return (
    <DocsArticle
      article={article}
      relatedArticles={relatedArticles}
      previousArticle={DOCUMENTATION_ARTICLES[index - 1]}
      nextArticle={DOCUMENTATION_ARTICLES[index + 1]}
    />
  );
}