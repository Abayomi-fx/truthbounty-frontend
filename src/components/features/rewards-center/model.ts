export type { CenterTransaction } from '@/lib/transaction-machine/recovery-references';

export const REWARD_OUTCOMES = [
  'accrued',
  'claimable',
  'pending',
  'withdrawn',
  'unavailable',
  'slashed',
] as const;
export type RewardOutcome = (typeof REWARD_OUTCOMES)[number];
export type CenterState =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'stale'
  | 'offline'
  | 'unavailable'
  | 'error'
  | 'denied'
  | 'not-found';
export type RewardSource =
  | { kind: 'contract'; block: string; finality: 'confirmed' | 'finalized' }
  | {
      kind: 'api-projection';
      receivedAt: number | null;
      freshness: 'unknown' | 'stale' | 'projection-lag';
    };

export interface RewardEntry {
  id: string;
  claimId: string;
  title: string;
  outcome: RewardOutcome;
  /** Exact, preformatted units. Never sum assets or convert through Number. */
  amount: string | null;
  asset: string;
  source: RewardSource;
}

export interface RewardsCenterData {
  state: CenterState;
  entries: readonly RewardEntry[];
  receivedAt: number | null;
  rejectedCount: number;
}

export const WITHDRAWAL_UNAVAILABLE =
  'Withdrawal unavailable. A pinned adapter must verify contract ownership, claimable amount, eligibility, release and simulation before authorization.';

/** A projection's claimable flag can never promote its value to canonical. */
export function displayOutcome(entry: RewardEntry): RewardOutcome {
  if (
    entry.source.kind === 'contract' &&
    entry.outcome === 'withdrawn' &&
    entry.source.finality !== 'finalized'
  )
    return 'pending';
  return entry.outcome === 'unavailable'
    ? 'unavailable'
    : entry.source.kind === 'api-projection'
      ? 'accrued'
      : entry.outcome;
}

export function rewardSourceLabel(source: RewardSource): string {
  if (source.kind === 'contract')
    return `Contract read · ${source.finality} · block ${source.block}`;
  return `API estimate · ${source.freshness === 'projection-lag' ? 'projection lag' : source.freshness === 'stale' ? 'stale' : 'chain freshness unknown'} · not claimable`;
}
