'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ConfidenceBand {
  label: string;
  min: number;
  max: number;
  tone: 'success' | 'warning' | 'danger' | 'info';
  icon: React.ReactNode;
}

export interface ConfidenceMeterProps
  extends Omit<React.MeterHTMLAttributes<HTMLMeterElement>, 'value' | 'min' | 'max' | 'low' | 'high' | 'optimum'> {
  /** Confidence value from 0-100. Null means unknown/unavailable. */
  value: number | null;
  /** Human-readable label for the meter (accessible name). */
  label: string;
  /** Optional description announced to assistive tech. */
  description?: string;
  /** Minimum value (default: 0). */
  min?: number;
  /** Maximum value (default: 100). */
  max?: number;
  /** Low threshold (default: 33). */
  low?: number;
  /** High threshold (default: 66). */
  high?: number;
  /** Optimum value (default: 100). */
  optimum?: number;
  /** Whether the confidence is provisional (not finalized). */
  provisional?: boolean;
  /** Source/provenance of the confidence value. */
  source?: string;
  /** Timestamp when the confidence was computed. */
  computedAt?: string;
  /** Custom confidence bands (default: low/medium/high). */
  bands?: ConfidenceBand[];
  /** Additional CSS classes. */
  className?: string;
  /** Show the numeric value next to the meter. */
  showValue?: boolean;
  /** Show the confidence band label. */
  showBandLabel?: boolean;
}

const DEFAULT_BANDS: ConfidenceBand[] = [
  {
    label: 'Low',
    min: 0,
    max: 33,
    tone: 'danger',
    icon: <span aria-hidden="true">▼</span>,
  },
  {
    label: 'Medium',
    min: 34,
    max: 66,
    tone: 'warning',
    icon: <span aria-hidden="true">◆</span>,
  },
  {
    label: 'High',
    min: 67,
    max: 100,
    tone: 'success',
    icon: <span aria-hidden="true">▲</span>,
  },
];

const TONE_STYLES: Record<ConfidenceBand['tone'], { track: string; text: string }> = {
  success: { track: 'bg-success/30', text: 'text-success' },
  warning: { track: 'bg-warning/30', text: 'text-warning' },
  danger: { track: 'bg-destructive/30', text: 'text-destructive' },
  info: { track: 'bg-info/30', text: 'text-info' },
};

function getBand(value: number, bands: ConfidenceBand[]): ConfidenceBand | undefined {
  return bands.find((b) => value >= b.min && value <= b.max);
}

function formatValue(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(1)}%`;
}

export function ConfidenceMeter({
  value,
  label,
  description,
  min = 0,
  max = 100,
  low = 33,
  high = 66,
  optimum = 100,
  provisional = false,
  source,
  computedAt,
  bands = DEFAULT_BANDS,
  className,
  showValue = true,
  showBandLabel = true,
}: ConfidenceMeterProps) {
  const isUnknown = value === null;
  const displayValue = isUnknown ? 0 : Math.max(min, Math.min(max, value));
  const currentBand = isUnknown ? undefined : getBand(displayValue, bands);

  const meterId = React.useId();
  const descId = React.useId();
  const summaryId = React.useId();
  const tableId = React.useId();

  const meterRef = React.useRef<HTMLMeterElement>(null);

  React.useEffect(() => {
    if (meterRef.current) {
      meterRef.current.value = displayValue;
      meterRef.current.min = min;
      meterRef.current.max = max;
      meterRef.current.low = low;
      meterRef.current.high = high;
      meterRef.current.optimum = optimum;
    }
  }, [displayValue, min, max, low, high, optimum]);

  const summaryParts: string[] = [];
  if (isUnknown) {
    summaryParts.push('Confidence unknown');
  } else {
    summaryParts.push(`Confidence ${formatValue(displayValue)}`);
    if (currentBand) {
      summaryParts.push(`${currentBand.label} confidence`);
    }
  }
  if (provisional) {
    summaryParts.push('Provisional - not finalized');
  }
  if (source) {
    summaryParts.push(`Source: ${source}`);
  }
  if (computedAt) {
    summaryParts.push(`Computed: ${new Date(computedAt).toLocaleString()}`);
  }

  return (
    <div
      className={cn('space-y-2', className)}
      role="region"
      aria-label={label}
      aria-describedby={descId}
    >
      <div className="flex items-center gap-2">
        <span id={summaryId} className="sr-only">
          {summaryParts.join('. ')}
        </span>
        <meter
          ref={meterRef}
          id={meterId}
          value={displayValue}
          min={min}
          max={max}
          low={low}
          high={high}
          optimum={optimum}
          className={cn(
            'w-full h-3 appearance-none rounded-full bg-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isUnknown && 'opacity-50'
          )}
          aria-label={label}
          aria-describedby={`${descId} ${summaryId}`}
          aria-valuenow={isUnknown ? undefined : displayValue}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={isUnknown ? 'Unknown' : formatValue(displayValue)}
        >
          {isUnknown
            ? 'Confidence unknown'
            : `${formatValue(displayValue)} confidence`}
        </meter>

        {showValue && (
          <output
            for={meterId}
            className={cn(
              'font-mono tabular-nums text-sm font-medium min-w-[3.5rem] text-right',
              isUnknown ? 'text-muted-foreground' : currentBand ? TONE_STYLES[currentBand.tone].text : ''
            )}
            aria-live="polite"
            aria-atomic="true"
          >
            {formatValue(isUnknown ? null : displayValue)}
          </output>
        )}

        {provisional && (
          <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-warning/10 text-warning border border-warning/30"
            aria-label="Provisional - not finalized"
          >
            <span aria-hidden="true">⏳</span>
            Provisional
          </span>
        )}
      </div>

      {showBandLabel && currentBand && !isUnknown && (
        <div
          id={descId}
          className={cn('flex items-center gap-1.5 text-xs', TONE_STYLES[currentBand.tone].text)}
          aria-live="polite"
          aria-atomic="true"
        >
          <span aria-hidden="true">{currentBand.icon}</span>
          <span>{currentBand.label} confidence</span>
        </div>
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

      <table
        id={tableId}
        data-testid="confidence-bands-table"
        className="w-full text-xs text-muted-foreground border-t border-border pt-2"
        aria-hidden="true"
        role="table"
        aria-label="Confidence bands reference"
      >
        <thead>
          <tr>
            <th scope="col" className="text-left pb-1">Band</th>
            <th scope="col" className="text-right pb-1">Range</th>
          </tr>
        </thead>
        <tbody>
          {bands.map((band, idx) => (
            <tr key={idx} className={cn('border-t border-border/50', band === currentBand && 'font-medium')}>
              <td className="py-1 flex items-center gap-1">
                <span aria-hidden="true">{band.icon}</span>
                <span>{band.label}</span>
              </td>
              <td className="py-1 text-right font-mono tabular-nums">
                {band.min}% – {band.max}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ConfidenceMeter;