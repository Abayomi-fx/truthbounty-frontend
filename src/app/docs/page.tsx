import type { Metadata } from 'next';
import { DocsHome } from '@/components/features/docs/DocsHome';
import { DOCUMENTATION_ARTICLES } from '@/data/docs/approved-content';
import { generateRouteMetadata } from '@/lib/metadata/route-metadata';

export const metadata: Metadata = generateRouteMetadata({ pathname: '/docs' });

export default function DocsPage() {
  return <DocsHome articles={DOCUMENTATION_ARTICLES} />;
}