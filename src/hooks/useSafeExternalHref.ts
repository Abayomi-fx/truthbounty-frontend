'use client';

import { useMemo } from 'react';
import {
  resolveExternalLinkTrust,
  type ExternalLinkTrustResult,
} from '@/lib/security/external-link-trust';

/**
 * Memoized trust resolution for a single untrusted external href (UI-FE-079).
 */
export function useSafeExternalHref(href: string): ExternalLinkTrustResult {
  return useMemo(() => resolveExternalLinkTrust(href), [href]);
}
