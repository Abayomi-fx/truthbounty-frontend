'use client';

/**
 * ClaimNotFound — Not-found state for claim detail view
 *
 * Displayed when a claim does not exist or has been removed.
 * Provides navigation back to claims list with focus management.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';

export interface ClaimNotFoundProps {
  claimId?: string;
}

export function ClaimNotFound({ claimId }: ClaimNotFoundProps) {
  const router = useRouter();
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  // Focus management: move focus to not-found heading when it appears
  React.useEffect(() => {
    if (headingRef.current) {
      headingRef.current.focus();
    }
  }, []);

  return (
    <div
      className="bg-[#18181b] border border-yellow-500/20 rounded-xl p-6 text-center"
      role="status"
    >
      <div className="flex justify-center mb-4">
        <AlertCircle className="h-12 w-12 text-yellow-500" aria-hidden="true" />
      </div>

      <h2
        ref={headingRef}
        className="text-xl font-bold text-yellow-500 mb-2 focus:outline-none"
        id="claim-not-found-heading"
        tabIndex={-1}
      >
        Claim Not Found
      </h2>

      <p className="text-gray-400 text-sm mb-6">
        {claimId
          ? `Claim "${claimId}" does not exist or has been removed.`
          : 'The requested claim does not exist or has been removed.'}
      </p>

      <button
        onClick={() => router.push('/claims')}
        className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-[#18181b]"
        aria-label="Go back to claims list"
      >
        Back to Claims
      </button>
    </div>
  );
}
