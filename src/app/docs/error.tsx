'use client';

import { DocsRouteError } from '@/components/features/docs/DocsRouteError';

export default function DocsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DocsRouteError reset={reset} />;
}