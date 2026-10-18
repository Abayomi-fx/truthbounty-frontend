/**
 * Stake and Effective-Weight Review (UI-FE-018)
 *
 * Renders contract-sourced economic review data for a verification action.
 *
 * Security constraints:
 * - Contracts are canonical for mutations. This component never authorizes a vote.
 * - API data is freshness-labelled projection data and must not be used to grant authority.
 * - Unpinned actions render unavailable.
 * - Exact values and units remain lossless.
 * - Changed contract inputs invalidate review.
 */

'use client';

import React, { useEffect, useId, useMemo, useReducer } from 'react';

export type ReviewFreshness = 'fresh' | 'stale' | 'unavailable';

export type ReviewSource = 'contract' | 'api';

export interface StakeEffectiveWeightInputs {
  /** Raw stake amount in wei (18 decimals) as a decimal string. */
  rawStakeWei: string;
  /** Reputation adjustment in wei (18 decimals) as a decimal string. */
  reputationAdjustmentWei: string;
  /** Effective weight in wei (18 decimals) as a decimal string. */
  effectiveWeightWei: string;
  /** Minimum reward in wei (18 decimals) as a decimal string. */
  rewardMinWei: string;
  /** Maximum reward in wei (18 decimals) as a decimal string. */
  rewardMaxWei: string;
  /** Slashing exposure in wei (18 decimals) as a decimal string. */
  slashingExposureWei: string;
  /** Optimism chain id the inputs were sourced from. */
  chainId: number;
  /** Address of the contract that sourced the inputs. */
  contractAddress: `\\${string}`;
  /** Block number the inputs were read at. */
  blockNumber: bigint;
  /** Block hash the inputs were read at. */
  blockHash: `\\${string}`;
}

export interface StakeEffectiveWeightReviewProps {
  /** Contract-sourced inputs for the review. */
  inputs: StakeEffectiveWeightInputs | null;
  /** Freshness of the contract projection. */
  freshness: ReviewFreshness;
  /** Whether the action is pinned to the current contract inputs. */
  isPinned: boolean;
  /** Optional human-readable label for the action being reviewed. */
  actionLabel?: string;
  /** Optional callback when the user acknowledges the review. */
  onAcknowledge?: () => void;
  /** Optional class name for the root element. */
  className?: string;
}

export type ReviewState =
  | { kind: 'loading' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'stale'; reason: string }
  | { kind: 'inconsistent'; reason: string }
  | { kind: 'changed'; reason: string }
  | { kind: 'ready' };

type ReviewAction =
  | { type: 'set_inputs'; inputs: StakeEffectiveWeightInputs | null }
  | { type: 'set_freshness'; freshness: ReviewFreshness }
  | { type: 'set_pinned'; isPinned: boolean }
  | { type: 'acknowledge' };

interface ReviewStateShape {
  inputs: StakeEffectiveWeightInputs | null;
  freshness: ReviewFreshness;
  isPinned: boolean;
  acknowledged: boolean;
}

const initialState = ({
  inputs,
  freshness,
  isPinned,
}: Pick<StakeEffectiveWeightReviewProps, 'inputs' | 'freshness' | 'isPinned'>): ReviewStateShape => ({
  inputs,
  freshness,
  isPinned,
  acknowledged: false,
});

function reviewReducer(state: ReviewStateShape, action: ReviewAction): ReviewStateShape {
  switch (action.type) {
    case 'set_inputs':
      // Changed contract inputs invalidate any prior acknowledgement.
      return { ...state, inputs: action.inputs, acknowledged: false };
    case 'set_freshness':
      return { ...state, freshness: action.freshness };
    case 'set_pinned':
      return { ...state, isPinned: action.isPinned, acknowledged: false };
    case 'acknowledge':
      return { ...state, acknowledged: true };
    default:
      return state;
  }
}

const WEI = 10n ** 18;

function isDecimalString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}

/**
 * Format a wei decimal string into a lossless human-readable string.
 * Keeps the exact value and unit label; no floating-point conversion.
 */
export function formatWei(wei: string, decimals: number = 18): string {
  if (!isDecimalString(wei)) {
    return '—';
  }
  const negative = wei.startsWith('-');
  const abs = negative ? wei.slice(1) : wei;
  const padded = abs.padStart(decimals + 1, '0');
  const intPart = padded.slice(0, padded.length - decimals);
  const fracPart = padded.slice(padded.length - decimals).replace(/0+$/, '');
  const normalizedInt = intPart.replace(/^\d+/, '') || '0';
  const grouped = normalizedInt.replace(/\b(?=(\d{3})+(?!\d))/g, ',');
  const body = fracPart ? `${grouped}.${fracPart}` : grouped;
  return negative ? `-${body}` : body;
}

export function formatWeiWithUnit(wei: string): string {
  if (!isDecimalString(wei)) {
    return '—';
  }
  return `${formatWei(wei)} EBT`;
}

export function formatWeiRange(minWei: string, maxWei: string): string {
  if (!isDecimalString(minWei) || !isDecimalString(maxWei)) {
    return '—';
  }
  return `${formatWei(minWei)} – ${formatWei(maxWei)} EBT`;
}

export function computeEffectiveWeight(rawStakeWei: string, reputationAdjustmentWei: string): bigint | null {
  if (!isDecimalString(rawStakeWei) || !isDecimalString(reputationAdjustmentWei)) {
    return null;
  }
  try {
    return BigInt(rawStakeWei) + BigInt(reputationAdjustmentWei);
  } catch {
    return null;
  }
}

export function deriveReviewState(
  inputs: StakeEffectiveWeightInputs | null,
  freshness: ReviewFreshness,
  isPinned: boolean,
): ReviewState {
  if (!inputs) {
    return { kind: 'unavailable', reason: 'Contract inputs are not available.' };
  }
  if (freshness === 'unavailable') {
    return { kind: 'unavailable', reason: 'Contract projection is unavailable.' };
  }
  if (freshness === 'stale') {
    return { kind: 'stale', reason: 'Contract projection is stale.' };
  }
  if (!isPinned) {
    return {
      kind: 'changed',
      reason: 'Contract inputs changed before authorization.',
    };
  }
  const expected = computeEffectiveWeight(inputs.rawStakeWei, inputs.reputationAdjustmentWei);
  if (expected === null) {
    return { kind: 'inconsistent', reason: 'Inputs are not valid wei decimal strings.' };
  }
  if (expected.toString() !== inputs.effectiveWeightWei) {
    return {
      kind: 'inconsistent',
      reason: 'Effective weight does not match raw stake plus adjustment.',
    };
  }
  if (!isDecimalString(inputs.rewardMinWei) || !isDecimalString(inputs.rewardMaxWei)) {
    return { kind: 'inconsistent', reason: 'Reward range is not valid wei decimal strings.' };
  }
  if (!isDecimalString(inputs.slashingExposureWei)) {
    return { kind: 'inconsistent', reason: 'Slashing exposure is not a valid wei decimal string.' };
  }
  return { kind: 'ready' };
}

function StatusBadge({ tone, children }: { tone: 'info' | 'warn' | 'danger' | 'success'; children: React.ReactNode }) {
  const toneClasses: Record<typeof tone, string> = {
    info: 'bg-sky-500/10 text-sky-300 border-sky-500/40',
    warn: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
    danger: 'bg-red-500/10 text-red-300 border-red-500/40',
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
  };
  return (
    <span
      className={` inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

function RowLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400" id={htmlFor}>
      {children}
    </dt>
  );
}

function RowValue({ children, labelId }: { children: React.ReactNode; labelId?: string }) {
  return (
    <dd className="font-mono text-sm text-slate-100" aria-labelledby={labelId}>
      {children}
    </dd>
  );
}

export function StakeEffectiveWeightReview({
  inputs,
  freshness,
  isPinned,
  actionLabel,
  onAcknowledge,
  className,
}: StakeEffectiveWeightReviewProps) {
  const [state, dispatch] = useReducer(reviewReducer, { inputs, freshness, isPinned }, initialState);
  const titleId = useId();
  const regionId = useId();

  // Changed contract inputs invalidate review.
  useEffect(() => {
    dispatch({ type: 'set_inputs', inputs });
  }, [inputs]);

  useEffect(() => {
    dispatch({ type: 'set_freshness', freshness });
  }, [freshness]);

  useEffect(() => {
    dispatch({ type: 'set_pinned', isPinned });
  }, [isPinned]);

  const reviewState = useMemo(
    () => deriveReviewState(state.inputs, state.freshness, state.isPinned),
    [state.inputs, state.freshness, state.isPinned],
  );

  const effectiveWeight = useMemo(() => {
    if (!state.inputs) return null;
    return computeEffectiveWeight(state.inputs.rawStakeWei, state.inputs.reputationAdjustmentWei);
  }, [state.inputs]);

  const isAvailable = reviewState.kind === 'ready';

  const handleAcknowledge = () => {
    if (!isAvailable) return;
    dispatch({ type: 'acknowledge' });
    onAcknowledge?.();
  };

  return (
    <section
      className={`flex flex-col gap-4 rounded-lg border border-slate-700 bg-slate-900/60 p-4 text-slate-100 ${className ?? ''}`}
      aria-labelledby={titleId}
      data-testid="stake-effective-weight-review"
      data-review-state={reviewState.kind}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="text-sm font-semibold text-slate-100">
            Stake and effective weight
          </h2>
          <p className="text-xs text-slate-400">
            {actionLabel ?? 'Verification action'} — sourced from contract
          </p>
        </div>
        <StatusBadge
          tone={
            reviewState.kind === 'ready'
              ? 'success'
              : reviewState.kind === 'stale' || reviewState.kind === 'changed'
                ? 'warn'
                : reviewState.kind === 'inconsistent'
                  ? 'danger'
                  : 'info'
          }
        >
          {reviewState.kind === 'ready'
            ? 'Ready'
            : reviewState.kind === 'stale'
              ? 'Stale'
              : reviewState.kind === 'changed'
                ? 'Changed'
                : reviewState.kind === 'inconsistent'
                  ? 'Inconsistent'
                  : 'Unavailable'}
        </StatusBadge>
      </header>

      {reviewState.kind !== 'ready' && (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200"
          role="status"
          aria-live="polite"
        >
          {reviewState.kind === 'loading'
            ? 'Loading contract inputs…'
            : reviewState.reason}
        </div>
      )}

      <dl
        id={regionId}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        aria-busy={reviewState.kind === 'loading'}
      >
        <RowLabel htmlFor={`${regionId}-raw-stake`}>Raw stake</RowLabel>
        <RowValue labelId={`${regionId}-raw-stake`}>
          {state.inputs ? formatWeiWithUnit(state.inputs.rawStakeWei) : '—'}
        </RowValue>

        <RowLabel htmlFor={`${regionId}-reputation-adjustment`}>Reputation adjustment</RowLabel>
        <RowValue labelId={`${regionId}-reputation-adjustment`}>
          {state.inputs ? formatWeiWithUnit(state.inputs.reputationAdjustmentWei) : '—'}
        </RowValue>

        <RowLabel htmlFor={`${regionId}-effective-weight`}>Effective weight</RowLabel>
        <RowValue labelId={`${regionId}-effective-weight`}>
          {effectiveWeight !== null
            ? formatWeiWithUnit(effectiveWeight.toString())
            : '—'}
        </RowValue>

        <RowLabel htmlFor={`${regionId}-reward-range`}>Reward range</RowLabel>
        <RowValue labelId={`${regionId}-reward-range`}>
          {state.inputs
            ? formatWeiRange(state.inputs.rewardMinWei, state.inputs.rewardMaxWei)
            : '—'}
        </RowValue>

        <RowLabel htmlFor={`${regionId}-slashing-exposure`}>Slashing exposure</RowLabel>
        <RowValue labelId={`${regionId}-slashing-exposure`}>
          {state.inputs ? formatWeiWithUnit(state.inputs.slashingExposureWei) : '—'}
        </RowValue>
      </dl>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleAcknowledge}
          disabled={!isAvailable}
          aria-disabled={!isAvailable}
          className={"inline-flex items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-outline focus-outline-2 focus-outline-offset-2 focus-outline-emerald-400"}
        >
          Acknowledge review
        </button>
      </div>
    </section>
  );
}
