import { Evidence } from '@/app/types/dispute';
import { FileText, LinkIcon } from 'lucide-react';
import { sanitizeText } from '@/lib/security/evidence-sanitizer';
import { PrivateEvidenceLink } from '@/components/security/PrivateEvidenceLink';

/**
 * Evidence links are untrusted API content. Text is sanitized and URLs are
 * rendered through the privacy-preserving, fail-closed link boundary.
 */
export const EvidenceLinks = ({ evidences }: { evidences: Evidence[] }) => {
  return (
    <div className="bg-[#13141b] border border-gray-800 rounded-xl p-6 mb-6">
      <div className="flex items-center space-x-2 text-white font-medium mb-4">
        <LinkIcon size={18} aria-hidden="true" />
        <h2>Evidence Links</h2>
      </div>
      <div className="space-y-3">
        {evidences.map((evidence) => {
          const title = sanitizeText(evidence.title, 300);
          const description = sanitizeText(evidence.description, 600);

          return (
            <div
              key={evidence.id}
              className="flex items-center justify-between gap-3 p-4 rounded-lg border border-gray-800 bg-[#0a0a0f] hover:border-gray-700 transition-colors"
            >
              <div className="flex min-w-0 items-center space-x-4">
                <FileText
                  className="shrink-0 text-gray-500"
                  size={20}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-200">
                    {title || 'Evidence'}
                  </p>
                  {description ? (
                    <p className="truncate text-xs text-gray-500">{description}</p>
                  ) : null}
                </div>
              </div>
              <PrivateEvidenceLink
                href={evidence.url}
                className="shrink-0 text-sm"
                ariaLabel={`View evidence: ${title || 'link'} (URL truncated for privacy)`}
                showIcon
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
