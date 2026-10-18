'use client';

import { useEffect } from 'react';
import { RouteErrorFallback } from '@/components/common/RouteErrorFallback';
import { classifyRouteError } from '@/lib/routes/errors';

/**
 * Claim-detail segment boundary. Retry is safe and never duplicates
 * on-chain submissions; canonical receipts drive lifecycle state.
 *
 * Errors are classified into authorization, configuration,
 * dependency, and missing-resource failures so the fallback can render
 * the correct recovery affordance without ever prompting a signature or
 * switching network.
 *
 * Error categories are preserved from their authoritative source and
 * surfaced through the shared RouteErrorFallback. This boundary must not
 * convert backend authorization failures into client validation errors,
 * and must not steal focus during background refresh. When the failure
 * is transaction recovery, focus must remain on the recovery affordance
 * rather than jumping to a field.
 */
export default function ClaimDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Claim detail route error:', error);
  }, [error]);

  const kind = classifyRouteError(error);

  return (
    <RouteErrorFallback
      error={error}
      reset={reset}
      scope="Claim detail"
      kind={kind}
    />
  );
}