const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function relativeTime(iso: string): string | null {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return null;
  const age = Math.max(0, Date.now() - timestamp);
  if (age < MINUTE_MS) return 'just now';
  if (age < HOUR_MS) return `${Math.floor(age / MINUTE_MS)}m ago`;
  if (age < DAY_MS) return `${Math.floor(age / HOUR_MS)}h ago`;
  return `${Math.floor(age / DAY_MS)}d ago`;
}

export function formatFreshness(fetchedAt: string, stale: boolean): string {
  if (stale) return 'Stale data';
  const relative = relativeTime(fetchedAt);
  return relative ? `Updated ${relative}` : 'Updated time unavailable';
}

export function formatDeadline(iso: string): {
  absolute: string;
  relative: string;
} {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { absolute: 'Deadline unavailable', relative: 'unknown' };
  }
  return {
    absolute: date.toLocaleString(),
    relative: relativeTime(iso) ?? 'unknown',
  };
}
