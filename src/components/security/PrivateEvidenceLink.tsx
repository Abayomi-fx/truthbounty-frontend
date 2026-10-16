'use client';

/**
 * PrivateEvidenceLink — Privacy-preserving evidence URL display
 *
 * V2-FE Evidence Privacy Protection — Displays truncated evidence URLs with
 * full URL available via clipboard. Prevents metadata leakage while maintaining
 * verifiability.
 *
 * Features:
 *   - Truncated URL display (domain/.../filename or IPFS CID truncation)
 *   - Click-to-copy full URL to clipboard
 *   - Toast feedback on copy
 *   - Accessible labels and keyboard navigation
 *   - Security: Inherits SafeExternalLink validation
 *
 * See: docs/EVIDENCE_PRIVACY_MODEL.md
 */

import React, { useState } from 'react';
import { truncateEvidenceUrl } from '@/lib/security/evidence-privacy';
import { safeUrl, SAFE_EXTERNAL_REL } from '@/lib/security/evidence-sanitizer';
import { privacyError } from '@/lib/security/privacy-logger';
import { Copy, Check, ExternalLink } from 'lucide-react';

export interface PrivateEvidenceLinkProps {
  /** Evidence URL (validated before display) */
  href: string;
  /** Optional CSS classes */
  className?: string;
  /** Optional aria-label override */
  ariaLabel?: string;
  /** Show external link icon */
  showIcon?: boolean;
  /** Show copy button separately (default: click link to copy) */
  showCopyButton?: boolean;
}

/**
 * Display evidence URL with privacy truncation and clipboard copy.
 *
 * Display: Truncated URL (e.g., "example.com/.../file.pdf")
 * Clipboard: Full URL on click
 * Security: Inherits safeUrl validation from evidence-sanitizer
 */
export function PrivateEvidenceLink({
  href,
  className = '',
  ariaLabel,
  showIcon = false,
  showCopyButton = false,
}: PrivateEvidenceLinkProps) {
  const [copied, setCopied] = useState(false);

  // Validate URL (fail closed)
  const check = safeUrl(href);
  if (!check.ok) {
    return (
      <span
        className={`text-gray-500 italic text-xs ${className}`}
        role="note"
        aria-label="Evidence URL blocked for security reasons"
      >
        [Blocked: {check.reason}]
      </span>
    );
  }

  // Truncate for privacy
  const truncated = truncateEvidenceUrl(href);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(truncated.full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Privacy: Don't log the URL that failed to copy
      privacyError('[PrivateEvidenceLink] Failed to copy to clipboard', { error: err });
    }
  };

  const accessibleLabel =
    ariaLabel ||
    `Evidence link: ${truncated.display} (click to copy full URL, truncated for privacy)`;

  return (
    <div className="inline-flex items-center gap-2">
      <a
        href={truncated.full}
        onClick={handleCopy}
        className={`text-blue-400 hover:text-blue-300 underline break-all transition-colors cursor-pointer ${className}`}
        target="_blank"
        rel={SAFE_EXTERNAL_REL}
        aria-label={accessibleLabel}
        title="Click to copy full URL (truncated for privacy)"
      >
        {truncated.display}
        {showIcon && (
          <ExternalLink
            size={12}
            className="inline ml-1 align-text-top"
            aria-hidden="true"
          />
        )}
      </a>

      {showCopyButton && (
        <button
          onClick={handleCopy}
          className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded"
          aria-label={copied ? 'Copied!' : 'Copy full URL to clipboard'}
          title={copied ? 'Copied!' : 'Copy full URL'}
        >
          {copied ? (
            <Check size={14} className="text-green-400" aria-hidden="true" />
          ) : (
            <Copy size={14} aria-hidden="true" />
          )}
        </button>
      )}

      {/* Toast feedback (inline) */}
      {copied && !showCopyButton && (
        <span
          className="text-xs text-green-400 ml-1 animate-fade-in"
          role="status"
          aria-live="polite"
        >
          Copied!
        </span>
      )}
    </div>
  );
}

export default PrivateEvidenceLink;
