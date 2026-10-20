import { safeUrl, sanitizeText } from '@/lib/security/evidence-sanitizer';

export type DocumentationAudience = 'protocol' | 'guidance';

export type DocumentationBlockInput =
  | { type: 'heading'; id: string; text: string; level: 2 | 3 }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'callout'; title: string; text: string };

export interface DocumentationRecord {
  publicationStatus: 'approved' | 'draft' | 'retired';
  slug: string;
  title: string;
  summary: string;
  audience: DocumentationAudience;
  topic: string;
  version: string;
  lastReviewedAt: string;
  appliesTo: string;
  release: string;
  order: number;
  tags: string[];
  blocks: DocumentationBlockInput[];
  sources: Array<{ title: string; href: string }>;
  relatedSlugs?: string[];
}

export type DocumentationBlock =
  | { type: 'heading'; id: string; text: string; level: 2 | 3 }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'callout'; title: string; text: string };

export interface DocumentationArticle {
  slug: string;
  title: string;
  summary: string;
  audience: DocumentationAudience;
  topic: string;
  version: string;
  lastReviewedAt: string;
  appliesTo: string;
  release: string;
  order: number;
  tags: string[];
  blocks: DocumentationBlock[];
  sources: Array<{ title: string; href: string }>;
  relatedSlugs: string[];
}

function clean(value: unknown, maxLength: number): string {
  return sanitizeText(value, maxLength).trim();
}

function validReviewDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function adaptBlock(block: DocumentationBlockInput): DocumentationBlock | null {
  if (block.type === 'heading') {
    const text = clean(block.text, 180);
    const id = clean(block.id, 80).toLowerCase();
    if (!text || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return null;
    return { type: 'heading', id, text, level: block.level === 3 ? 3 : 2 };
  }

  if (block.type === 'paragraph') {
    const text = clean(block.text, 5000);
    return text ? { type: 'paragraph', text } : null;
  }

  if (block.type === 'list') {
    const items = block.items.map((item) => clean(item, 1000)).filter(Boolean);
    return items.length > 0 ? { type: 'list', items } : null;
  }

  const title = clean(block.title, 180);
  const text = clean(block.text, 2000);
  return title && text ? { type: 'callout', title, text } : null;
}

/**
 * Adapt approved source records to a render-safe view model. Rich HTML and
 * Markdown are intentionally unsupported; React renders all content as text.
 */
export function adaptDocumentationRecords(
  records: readonly DocumentationRecord[],
): DocumentationArticle[] {
  if (!Array.isArray(records)) return [];
  const candidates = records.flatMap((record) => {
    if (
      !record ||
      record.publicationStatus !== 'approved' ||
      (record.audience !== 'protocol' && record.audience !== 'guidance') ||
      !Array.isArray(record.blocks) ||
      !Array.isArray(record.sources) ||
      !Array.isArray(record.tags)
    ) return [];

    const slug = clean(record.slug, 80).toLowerCase();
    const title = clean(record.title, 180);
    const summary = clean(record.summary, 500);
    const topic = clean(record.topic, 80);
    const version = clean(record.version, 40);
    const lastReviewedAt = clean(record.lastReviewedAt, 10);
    const appliesTo = clean(record.appliesTo, 100);
    const release = clean(record.release, 100);
    const sources = record.sources.flatMap((source) => {
      const title = clean(source.title, 180);
      const checked = safeUrl(source.href);
      return title && checked.ok && checked.url.protocol === 'https:'
        ? [{ title, href: checked.href }]
        : [];
    });
    const usedHeadingIds = new Set<string>();
    const blocks = record.blocks
      .map(adaptBlock)
      .filter((block): block is DocumentationBlock => block !== null)
      .filter((block) => {
        if (block.type !== 'heading') return true;
        if (usedHeadingIds.has(block.id)) return false;
        usedHeadingIds.add(block.id);
        return true;
      });

    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      !title ||
      !summary ||
      !topic ||
      !version ||
      !validReviewDate(lastReviewedAt) ||
      !appliesTo ||
      !release ||
      sources.length === 0 ||
      blocks.length === 0
    ) {
      return [];
    }

    const tags = record.tags.map((tag) => clean(tag, 50)).filter(Boolean);
    const relatedSlugs = (record.relatedSlugs ?? [])
      .map((relatedSlug) => clean(relatedSlug, 80).toLowerCase())
      .filter((relatedSlug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(relatedSlug));

    return [{
      slug,
      title,
      summary,
      audience: record.audience,
      topic,
      version,
      lastReviewedAt,
      appliesTo,
      release,
      order: Number.isFinite(record.order) ? record.order : 0,
      tags,
      blocks,
      sources,
      relatedSlugs,
    }];
  });

  const uniqueCandidates = candidates.filter(
    (article, index) => candidates.findIndex((candidate) => candidate.slug === article.slug) === index,
  );
  const publishedSlugs = new Set(uniqueCandidates.map((article) => article.slug));
  return uniqueCandidates
    .map((article) => ({
      ...article,
      relatedSlugs: article.relatedSlugs.filter((slug) => publishedSlugs.has(slug)),
    }))
    .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
}

export function getDocumentationArticle(
  slug: string,
  articles: readonly DocumentationArticle[],
): DocumentationArticle | undefined {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return undefined;
  return articles.find((article) => article.slug === slug);
}