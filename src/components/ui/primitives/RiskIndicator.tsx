'use client';

import * as React from 'react';
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface RiskFactor {
  id: string;
  label: string;
  description: string;
  level: RiskLevel;
  mitigated?: boolean;
  mitigation?: string;
}

export interface RiskIndicatorProps {
  /** Overall risk level. */
  level: RiskLevel;
  /** Human-readable label for the risk. */
  label: string;
  /** Detailed description. */
  description?: string;
  /** Individual risk factors. */
  factors?: RiskFactor[];
  /** Whether risk assessment is provisional. */
  provisional?: boolean;
  /** Source of the risk assessment. */
  source?: string;
  /** Timestamp of assessment. */
  assessedAt?: string;
  /** Show as compact badge. */
  compact?: boolean;
  /** Show risk factors list. */
  showFactors?: boolean;
  /** Show progress bar for risk level. */
  showProgress?: boolean;
  /** Announce changes as live region. */
  live?: boolean;
  /** Custom icon for the risk level. */
  icon?: React.ReactNode;
  /** Additional CSS classes. */
  className?: string;
}

const RISK_CONFIG: Record<RiskLevel, { label: string; icon: React.ReactNode; tone: string; bg: string; text: string; border: string; progressColor: string }> = {
  none: {
    label: 'No Risk',
    icon: <CheckCircle2 size={14} aria-hidden="true" />,
    tone: 'success',
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/30',
    progressColor: 'bg-success',
  },
  low: {
    label: 'Low Risk',
    icon: <Shield size={14} aria-hidden="true" />,
    tone: 'info',
    bg: 'bg-info/10',
    text: 'text-info',
    border: 'border-info/30',
    progressColor: 'bg-info',
  },
  medium: {
    label: 'Medium Risk',
    icon: <AlertTriangle size={14} aria-hidden="true" />,
    tone: 'warning',
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/30',
    progressColor: 'bg-warning',
  },
  high: {
    label: 'High Risk',
    icon: <AlertCircle size={14} aria-hidden="true" />,
    tone: 'danger',
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/30',
    progressColor: 'bg-destructive',
  },
  critical: {
    label: 'Critical Risk',
    icon: <XCircle size={14} aria-hidden="true" />,
    tone: 'danger',
    bg: 'bg-destructive/20',
    text: 'text-destructive',
    border: 'border-destructive/50',
    progressColor: 'bg-destructive',
  },
};

const LEVEL_VALUES: Record<RiskLevel, number> = {
  none: 0,
  low: 25,
  medium: 50,
  high: 75,
  critical: 100,
};

const PATTERNS: Record<RiskLevel, string> = {
  none: 'none',
  low: 'repeating-linear-gradient(45deg, transparent, transparent 2px, currentColor 2px, currentColor 4px)',
  medium: 'repeating-linear-gradient(45deg, transparent, transparent 1px, currentColor 1px, currentColor 3px)',
  high: 'repeating-linear-gradient(45deg, transparent, transparent 1px, currentColor 1px, currentColor 2px)',
  critical: 'repeating-linear-gradient(45deg, transparent, transparent 1px, currentColor 1px, currentColor 1px)',
};

export function RiskIndicator({
  level,
  label,
  description,
  factors = [],
  provisional = false,
  source,
  assessedAt,
  compact = false,
  showFactors = true,
  showProgress = true,
  live = false,
  icon,
  className,
}: RiskIndicatorProps) {
  const config = RISK_CONFIG[level];
  const levelValue = LEVEL_VALUES[level];
  const displayIcon = icon ?? config.icon;

  const badgeId = React.useId();
  const descId = React.useId();
  const factorsId = React.useId();

  const summaryParts = [config.label];
  if (provisional) summaryParts.push('Provisional assessment');
  if (factors.length > 0) {
    const activeFactors = factors.filter((f) => f.level !== 'none' && !f.mitigated).length;
    if (activeFactors > 0) summaryParts.push(`${activeFactors} active risk factor${activeFactors !== 1 ? 's' : ''}`);
  }
  if (source) summaryParts.push(`Source: ${source}`);
  if (assessedAt) summaryParts.push(`Assessed: ${new Date(assessedAt).toLocaleString()}`);

  if (compact) {
    return (
      <span
        id={badgeId}
        data-risk-level={level}
        data-provisional={provisional ? 'true' : 'false'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
          config.bg,
          config.text,
          config.border,
          className
        )}
        {...(live ? { role: 'status', 'aria-live': 'polite' as const } : {})}
      >
        <span aria-hidden="true">{displayIcon}</span>
        <span>{label}</span>
        {provisional && <span className="sr-only">Provisional</span>}
      </span>
    );
  }

  return (
    <div
      className={cn('space-y-3', className)}
      role="region"
      aria-label={`Risk assessment: ${label}`}
      aria-describedby={descId}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div
          id={badgeId}
          data-risk-level={level}
          data-testid="risk-badge"
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium',
            config.bg,
            config.text,
            config.border
          )}
          {...(live ? { role: 'status', 'aria-live': 'polite' as const } : {})}
        >
          <span aria-hidden="true" className="size-5 shrink-0">{displayIcon}</span>
          <span>{label}</span>
          {provisional && (
            <>
              <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-warning/10 text-warning border border-warning/30"
                aria-label="Provisional assessment"
              >
                <span aria-hidden="true">⏳</span>
                Provisional
              </span>
              <span className="sr-only">Provisional</span>
            </>
          )}
        </div>

        {showProgress && (
          <div className="flex-1 min-w-[100px] max-w-xs" role="progressbar" aria-valuenow={levelValue} aria-valuemin={0} aria-valuemax={100} aria-label={`Risk level: ${config.label}`}>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted relative">
              <div
                className={cn('h-full transition-all duration-500', config.progressColor)}
                style={{ width: `${levelValue}%` }}
              />
              {level !== 'none' && (
                <div
                  className="absolute inset-0 opacity-30"
                  style={{ backgroundImage: PATTERNS[level] }}
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {description && (
        <p id={descId} className="text-sm text-muted-foreground" aria-live="polite">
          {description}
        </p>
      )}

      {showFactors && factors.length > 0 && (
        <div id={factorsId} className="space-y-2">
          <h4 className="text-xs font-medium text-foreground uppercase tracking-wider">
            Risk Factors
          </h4>
          <ul className="space-y-1.5" role="list" aria-label="Risk factors">
            {factors.map((factor) => (
              <RiskFactorItem key={factor.id} factor={factor} />
            ))}
          </ul>
        </div>
      )}

      {(source || assessedAt) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {source && (
            <span className="flex items-center gap-1">
              <span aria-hidden="true">📊</span>
              <span>Source: {source}</span>
            </span>
          )}
          {assessedAt && (
            <time dateTime={assessedAt} className="flex items-center gap-1">
              <span aria-hidden="true">🕐</span>
              <span>Assessed {new Date(assessedAt).toLocaleString()}</span>
            </time>
          )}
        </div>
      )}
    </div>
  );
}

function RiskFactorItem({ factor }: { factor: RiskFactor }) {
  const config = RISK_CONFIG[factor.level];
  const mitigated = factor.mitigated;

  return (
    <li
      className={cn(
        'p-2.5 rounded-lg border transition-colors',
        mitigated ? 'bg-success/5 border-success/20' : config.bg + ' ' + config.border
      )}
      data-risk-factor={factor.id}
    >
      <div className="flex flex-wrap items-start gap-2">
        <span
          className={cn(
            'flex-shrink-0 size-6 rounded-full border flex items-center justify-center',
            mitigated ? 'bg-success/20 border-success/30' : config.bg.replace('/10', '/30') + ' ' + config.border
          )}
          aria-hidden="true"
        >
          {mitigated ? <CheckCircle2 size={12} aria-hidden="true" className="text-success" /> : config.icon}
        </span>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h5 className={cn('font-medium text-sm', mitigated ? 'text-success' : config.text)}>
              {factor.label}
              {mitigated && (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-success/10 text-success border border-success/30">
                  <span aria-hidden="true">✓</span>
                  Mitigated
                </span>
              )}
            </h5>
            <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium', config.bg, config.text, config.border)}>
              {config.label}
            </span>
          </div>

          <p className={cn('text-xs', mitigated ? 'text-success/80' : 'text-muted-foreground')}>
            {factor.description}
          </p>

          {factor.mitigation && (
            <p className="text-xs text-success/80 flex items-center gap-1">
              <span aria-hidden="true">🛡️</span>
              <span>Mitigation: {factor.mitigation}</span>
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

export default RiskIndicator;