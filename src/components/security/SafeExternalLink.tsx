'use client';

import React from 'react';
import { resolveExternalLinkTrust, externalNavigationRel } from '@/lib/security/external-link-trust';

export interface SafeExternalLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> {
  /** Untrusted URL from API/evidence/claim content — validated before render. */
  href: string;
  /** Accessible name. Falls back to the sanitized URL text when omitted. */
  children?: React.ReactNode;
  rel?: string;
  /** When true, show the destination hostname beside the link label (default true). */
  showDomainDisclosure?: boolean;
}

/**
 * V2-FE-075 / UI-FE-079 — The sanctioned way to render an untrusted external URL.
 *
 * Fail-closed behaviour:
 *  - the `href` is validated against the scheme allowlist (`safeUrl`)
 *  - deceptive Unicode / mixed-script hostnames are rejected
 *  - `target="_blank"` + hardened `rel` + `referrerPolicy="no-referrer"` are always applied
 *  - the destination domain is disclosed to users (allowlist match is informational only)
 *
 * Trusted, developer-authored links (sidebar, docs, explorer chrome) may keep
 * their plain `<a>` usage, but any URL that originates from claim/evidence/API
 * content must go through this component.
 */
export function SafeExternalLink({
  href,
  children,
  showDomainDisclosure = true,
  rel: relProp,
  'aria-label': ariaLabel,
  ...rest
}: SafeExternalLinkProps) {
  const resolved = resolveExternalLinkTrust(href);
  if (!resolved.ok) {
    if (process.env.NODE_ENV !== 'production') {
      const reason = resolved.check.ok ? 'unknown' : resolved.check.reason;
      console.warn(
        `[SafeExternalLink] Blocked unsafe href (${reason}); render the blocked fallback instead.`,
      );
    }
    return null;
  }

  const { presentation } = resolved;
  const rel = externalNavigationRel(relProp);

  return (
    <span className="inline-flex flex-col gap-0.5 align-bottom">
      <a
        {...rest}
        href={presentation.href}
        target={presentation.navigation.target}
        rel={rel}
        referrerPolicy={presentation.navigation.referrerPolicy}
        aria-label={ariaLabel ?? presentation.disclosureLabel}
      >
        {children ?? presentation.displayHostname}
      </a>
      {showDomainDisclosure && (
        <span className="text-[10px] leading-tight text-muted-foreground font-mono" aria-hidden="true">
          {presentation.displayHostname}
          {presentation.isOnApprovedDomainList ? (
            <span className="sr-only"> (known domain category: {presentation.category})</span>
          ) : null}
        </span>
      )}
    </span>
  );
}

export default SafeExternalLink;
