'use client';

import * as React from 'react';
import { ThumbsUp, ThumbsDown, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WeightSide {
  label: string;
  value: string | bigint | number | null;
  unit: string;
  icon: React.ReactNode;
  tone: 'success' | 'danger' | 'neutral';
  description?: string;
}

export interface StakeWeightDisplayProps {
  /** Supporting weight. */
  supporting: WeightSide;
  /** Opposing weight. */
  opposing: WeightSide;
  /** Total weight (optional, computed if not provided). */
  total?: string | bigint | number | null;
  /** Quorum weight (optional). */
  quorum?: string | bigint | number | null;
  /** Whether the data is provisional. */
  provisional?: boolean;
  /** Whether the data is stale. */
  stale?: boolean;
  /** Source of the weight data. */
  source?: string;
  /** Timestamp when weights were computed. */
  computedAt?: string;
  /** Show as compact horizontal layout. */
  compact?: boolean;
  /** Show the progress bars. */
  showBars?: boolean;
  /** Show the data table. */
  showTable?: boolean;
  /** Custom formatter for weight values. */
  formatWeight?: (value: string | bigint | number | null, unit: string, isValid?: boolean) => string;
  /** Additional CSS classes. */
  className?: string;
}

const TONE_STYLES: Record<WeightSide['tone'], { bar: string; text: string }> = {
  success: { bar: 'bg-success', text: 'text-success' },
  danger: { bar: 'bg-destructive', text: 'text-destructive' },
  neutral: { bar: 'bg-muted-foreground/30', text: 'text-muted-foreground' },
};

export type WeightParseResult =
  | { ok: true; value: bigint }
  | { ok: false; error: 'null' | 'invalid' | 'overflow' };

function parseWeight(value: string | bigint | number | null): WeightParseResult {
  if (value === null || value === undefined) return { ok: false, error: 'null' };
  if (typeof value === 'bigint') return { ok: true, value };
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) return { ok: false, error: 'overflow' };
    return { ok: true, value: BigInt(Math.floor(value)) };
  }
  const str = value.toString().trim();
  if (!/^\d+$/.test(str)) return { ok: false, error: 'invalid' };
  try {
    return { ok: true, value: BigInt(str) };
  } catch {
    return { ok: false, error: 'overflow' };
  }
}

function formatWeightDefault(value: string | bigint | number | null, unit: string): string {
  const parsed = parseWeight(value);
  if (!parsed.ok) {
    if (parsed.error === 'null') return `— ${unit}`;
    return `Invalid ${unit}`;
  }
  const bigintValue = parsed.value;
  if (bigintValue === 0n) return `0 ${unit}`;

  // Lossless formatting based on unit
  if (unit.toLowerCase() === 'wei') {
    return `${bigintValue.toString()} wei`;
  }

  // For ETH and other 18-decimal units, format losslessly
  const eth = bigintValue / 1000000000000000000n;
  const remainder = bigintValue % 1000000000000000000n;
  if (remainder === 0n) {
    return `${eth.toString()} ${unit}`;
  }
  // Show full precision for fractional values
  const fractional = remainder.toString().padStart(18, '0').replace(/0+$/, '');
  return `${eth.toString()}.${fractional} ${unit}`;
}

function formatPercentage(numerator: bigint, denominator: bigint): string {
  if (denominator === 0n) return '0.0%';
  const pct = Number((numerator * 10000n) / denominator) / 100;
  return `${pct.toFixed(1)}%`;
}

export function StakeWeightDisplay({
  supporting,
  opposing,
  total,
  quorum,
  provisional = false,
  stale = false,
  source,
  computedAt,
  compact = false,
  showBars = true,
  showTable = true,
  formatWeight = formatWeightDefault,
  className,
}: StakeWeightDisplayProps) {
  const supportingParsed = parseWeight(supporting.value);
  const opposingParsed = parseWeight(opposing.value);
  const totalParsed: WeightParseResult =
    total !== undefined
      ? parseWeight(total)
      : supportingParsed.ok && opposingParsed.ok
        ? { ok: true, value: supportingParsed.value + opposingParsed.value }
        : { ok: false, error: 'invalid' };
  const quorumParsed = quorum !== undefined ? parseWeight(quorum) : { ok: true, value: null };

  const supportingValue = supportingParsed.ok ? supportingParsed.value : 0n;
  const opposingValue = opposingParsed.ok ? opposingParsed.value : 0n;
  const totalValue: bigint = totalParsed.ok
    ? totalParsed.value
    : supportingValue + opposingValue;
  const quorumValue = quorumParsed.ok ? quorumParsed.value : null;

  const supportingPct = totalValue > 0n ? formatPercentage(supportingValue, totalValue) : '0.0%';
  const opposingPct = totalValue > 0n ? formatPercentage(opposingValue, totalValue) : '0.0%';
  const quorumReached = quorumValue !== null && totalValue >= quorumValue;
  const quorumPct = quorumValue !== null && totalValue > 0n
    ? formatPercentage(totalValue, quorumValue)
    : null;

  const regionId = React.useId();
  const tableId = React.useId();

  const supportingDisplay = formatWeight(supporting.value, supporting.unit);
  const opposingDisplay = formatWeight(opposing.value, opposing.unit);
  const totalDisplay = formatWeight(totalValue.toString(), supporting.unit);
  const quorumDisplay = quorumValue !== null ? formatWeight(quorumValue.toString(), supporting.unit) : '—';

  const summaryParts = [
    `Supporting: ${supportingDisplay}`,
    `Opposing: ${opposingDisplay}`,
    `Total: ${totalDisplay}`,
  ];
  if (quorumValue !== null) {
    summaryParts.push(quorumReached ? 'Quorum reached' : `Quorum not reached (${quorumDisplay} required)`);
  }
  if (provisional) summaryParts.push('Provisional — not finalized');
  if (stale) summaryParts.push('Data may be stale');
  if (source) summaryParts.push(`Source: ${source}`);
  if (computedAt) summaryParts.push(`Computed: ${new Date(computedAt).toLocaleString()}`);

  const supportingStyle = TONE_STYLES[supporting.tone];
  const opposingStyle = TONE_STYLES[opposing.tone];

  const isSupportingValid = supportingParsed.ok;
  const isOpposingValid = opposingParsed.ok;
  const isTotalValid = totalParsed.ok;
  const isQuorumValid = quorumValue !== null && quorumParsed.ok;

  if (compact) {
    return (
      <div
        id={regionId}
        role="region"
        aria-label="Stake weights"
        aria-describedby={tableId}
        className={cn('flex flex-wrap items-center gap-4', className)}
      >
        <div className="flex items-center gap-2">
          <span className={cn('flex items-center gap-1', supportingStyle.text)}>
            <span aria-hidden="true">{supporting.icon}</span>
            <span className="font-mono tabular-nums">{supportingDisplay}</span>
            {!isSupportingValid && <span className="text-xs text-destructive">(invalid)</span>}
            <span className="text-xs text-muted-foreground">({supportingPct})</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('flex items-center gap-1', opposingStyle.text)}>
            <span aria-hidden="true">{opposing.icon}</span>
            <span className="font-mono tabular-nums">{opposingDisplay}</span>
            {!isOpposingValid && <span className="text-xs text-destructive">(invalid)</span>}
            <span className="text-xs text-muted-foreground">({opposingPct})</span>
          </span>
        </div>
        {quorumValue !== null && (
          <span className={cn('flex items-center gap-1 text-xs', quorumReached ? 'text-success' : 'text-warning')}>
            <span aria-hidden="true">{quorumReached ? '✓' : '⏳'}</span>
            <span>{quorumReached ? 'Quorum reached' : `Needs ${quorumDisplay}`}</span>
          </span>
        )}
        {(provisional || stale) && (
          <span className="flex items-center gap-1 text-xs text-warning">
            <span aria-hidden="true">{provisional ? '⏳' : '⚠️'}</span>
            <span>{provisional ? 'Provisional' : 'Stale'}</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      id={regionId}
      role="region"
      aria-label="Stake weights"
      aria-describedby={tableId}
      className={cn('space-y-4', className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-foreground">Stake Weights</h3>
        {(provisional || stale) && (
          <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium', provisional && 'bg-warning/10 text-warning border border-warning/30', stale && 'bg-destructive/10 text-destructive border border-destructive/30')}>
            <span aria-hidden="true">{provisional ? '⏳' : '⚠️'}</span>
            <span>{provisional ? 'Provisional' : 'Stale'}</span>
          </span>
        )}
      </div>

      {showBars && (
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1">
                <span aria-hidden="true">{supporting.icon}</span>
                {supporting.label}
              </span>
              <span className="font-mono tabular-nums">{supportingDisplay} ({supportingPct})</span>
            </div>
            <div
              role="progressbar"
              aria-label={`${supporting.label} weight share`}
              aria-valuenow={supportingValue > 0n && totalValue > 0n ? Number((supportingValue * 100n) / totalValue) : 0}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn('h-full transition-all duration-300', supportingStyle.bar)}
                style={{ width: `${supportingValue > 0n && totalValue > 0n ? Number((supportingValue * 100n) / totalValue) : 0}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1">
                <span aria-hidden="true">{opposing.icon}</span>
                {opposing.label}
              </span>
              <span className="font-mono tabular-nums">{opposingDisplay} ({opposingPct})</span>
            </div>
            <div
              role="progressbar"
              aria-label={`${opposing.label} weight share`}
              aria-valuenow={opposingValue > 0n && totalValue > 0n ? Number((opposingValue * 100n) / totalValue) : 0}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn('h-full transition-all duration-300', opposingStyle.bar)}
                style={{ width: `${opposingValue > 0n && totalValue > 0n ? Number((opposingValue * 100n) / totalValue) : 0}%` }}
              />
            </div>
          </div>

          {quorumValue !== null && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span className="flex items-center gap-1">
                  <span aria-hidden="true"><Scale size={12} /></span>
                  Quorum
                </span>
                <span className="font-mono tabular-nums">
                  {totalDisplay} / {quorumDisplay}
                  {quorumPct !== null && ` (${quorumPct})`}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Quorum progress"
                aria-valuenow={quorumValue !== null && totalValue > 0n ? Math.min(Number((totalValue * 100n) / quorumValue), 100) : 0}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={cn('h-full transition-all duration-300', quorumReached ? 'bg-success' : 'bg-warning')}
                  style={{ width: `${quorumValue !== null && totalValue > 0n ? Math.min(Number((totalValue * 100n) / quorumValue), 100) : 0}%` }}
                />
              </div>
              <p className={cn('text-xs mt-1', quorumReached ? 'text-success' : 'text-warning')}>
                {quorumReached ? 'Quorum reached' : `Quorum not reached — needs ${quorumDisplay}`}
              </p>
            </div>
          )}
        </div>
      )}

      <p
        id={tableId}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {summaryParts.join('. ')}
      </p>

      {showTable && (
        <table
          className="w-full text-xs text-muted-foreground border-t border-border pt-2"
          role="table"
          aria-label="Stake weight details"
        >
          <thead>
            <tr>
              <th scope="col" className="text-left pb-1">Side</th>
              <th scope="col" className="text-right pb-1">Weight</th>
              <th scope="col" className="text-right pb-1">Share</th>
              <th scope="col" className="text-left pb-1">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border/50">
              <td className="py-1 flex items-center gap-1">
                <span aria-hidden="true">{supporting.icon}</span>
                <span>{supporting.label}</span>
              </td>
              <td className="py-1 text-right font-mono tabular-nums">{supportingDisplay}</td>
              <td className="py-1 text-right font-mono tabular-nums">{supportingPct}</td>
              <td className="py-1">
                {!isSupportingValid && <span className="text-xs text-destructive">Invalid input</span>}
              </td>
            </tr>
            <tr className="border-t border-border/50">
              <td className="py-1 flex items-center gap-1">
                <span aria-hidden="true">{opposing.icon}</span>
                <span>{opposing.label}</span>
              </td>
              <td className="py-1 text-right font-mono tabular-nums">{opposingDisplay}</td>
              <td className="py-1 text-right font-mono tabular-nums">{opposingPct}</td>
              <td className="py-1">
                {!isOpposingValid && <span className="text-xs text-destructive">Invalid input</span>}
              </td>
            </tr>
            <tr className="border-t border-border/50 font-medium">
              <td className="py-1">Total</td>
              <td className="py-1 text-right font-mono tabular-nums">{totalDisplay}</td>
              <td className="py-1 text-right">100%</td>
              <td className="py-1">
                {!isTotalValid && <span className="text-xs text-destructive">Invalid input</span>}
              </td>
            </tr>
            {quorumValue !== null && (
              <tr className="border-t border-border/50">
                <td className="py-1 flex items-center gap-1">
                  <span aria-hidden="true"><Scale size={12} /></span>
                  <span>Quorum Required</span>
                </td>
                <td className="py-1 text-right font-mono tabular-nums">{quorumDisplay}</td>
                <td className="py-1 text-right">{quorumPct ?? '—'}</td>
                <td className="py-1">
                  {!isQuorumValid && <span className="text-xs text-destructive">Invalid input</span>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {(source || computedAt) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {source && (
            <span className="flex items-center gap-1">
              <span aria-hidden="true">📊</span>
              <span>Source: {source}</span>
            </span>
          )}
          {computedAt && (
            <time dateTime={computedAt} className="flex items-center gap-1">
              <span aria-hidden="true">🕐</span>
              <span>Computed {new Date(computedAt).toLocaleString()}</span>
            </time>
          )}
        </div>
      )}
    </div>
  );
}

export default StakeWeightDisplay;