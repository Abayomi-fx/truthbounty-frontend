import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * The harness is ONLY available when both conditions hold:
 *   1. NODE_ENV is NOT 'production'  (build-time invariant — can never be
 *      enabled at runtime in a production build, unlike the E2E_HARNESS env
 *      var which can be injected post-build).
 *   2. E2E_HARNESS=1 is set (so local `next dev` runs don't expose the route
 *      by accident).
 *
 * This resolves the production-boundary gap identified in the review:
 * previously E2E_HARNESS=1 alone was sufficient, meaning a production server
 * started with that env var set would expose the harness route.  Now it
 * requires a non-production build regardless of runtime env vars.
 */
function isE2EHarnessEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.E2E_HARNESS === '1';
}

export default async function DeploymentPreviewHarnessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!isE2EHarnessEnabled()) {
    notFound();
  }

  const params = await searchParams;
  const { DeploymentPreviewHarness } = await import('./DeploymentPreviewHarness');
  return <DeploymentPreviewHarness searchParams={params} />;
}
