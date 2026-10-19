import type { GovernedChangeSourceClass, GovernedChangeSurfaceState } from '@/lib/governed-change';

/**
 * UI-FE-029 — presentation labels for governed-change source classes and
 * surface states. Provenance is always visible so a reviewer can tell pinned
 * contract data from freshness-labelled API projection data.
 */
export const SOURCE_LABELS: Record<GovernedChangeSourceClass, string> = {
  'pinned-contract': 'Pinned contract',
  'fresh-api-projection': 'Fresh API projection',
  'verified-release-manifest': 'Verified release manifest',
  'wallet-session-local': 'Wallet session',
};

export const SURFACE_STATE_LABELS: Record<GovernedChangeSurfaceState, string> = {
  loading: 'Loading',
  empty: 'Nothing to review',
  stale: 'Stale data',
  offline: 'Offline',
  error: 'Error',
  denied: 'Access denied',
  'wrong-chain': 'Wrong network',
  unavailable: 'Unavailable',
  ready: 'Ready',
};

export function truncateHex(value: string, lead = 6, tail = 4): string {
  if (value.length <= lead + tail + 2) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}
