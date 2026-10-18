'use client';

import * as React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Gavel,
  HelpCircle,
  Clock,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type OutcomeKind =
  | 'verified'
  | 'disputed'
  | 'appealed'
  | 'inconclusive'
  | 'provisional'
  | 'rejected'
  | 'pending';

export interface OutcomeConfig {
  label: string;
  icon: React.ReactNode;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  description: string;
}

const OUTCOME_CONFIGS: Record<OutcomeKind, OutcomeConfig> = {
  verified: {
    label: 'Verified',
    icon: <CheckCircle2 size={14} aria-hidden="true" />,
    tone: 'success',
    description: 'Claim has been verified by consensus',
  },
  disputed: {
    label: 'Disputed',
    icon: <AlertTriangle size={14} aria-hidden="true" />,
    tone: 'danger',
    description: 'Claim outcome is being challenged',
  },
  appealed: {
    label: 'Appealed',
    icon: <Gavel size={14} aria-hidden="true" />,
    tone: 'warning',
    description: 'Claim is under appeal review',
  },
  inconclusive: {
    label: 'Inconclusive',
    icon: <HelpCircle size={14} aria-hidden="true" />,
    tone: 'info',
    description: 'Insufficient evidence to reach a conclusion',
  },
  provisional: {
    label: 'Provisional',
    icon: <Clock size={14} aria-hidden="true" />,
    tone: 'warning',
    description: 'Outcome is provisional and not yet finalized',
  },
  rejected: {
    label: 'Rejected',
    icon: <AlertTriangle size={14} aria-hidden="true" />,
    tone: 'danger',
    description: 'Claim has been rejected by consensus',
  },
  pending: {
    label: 'Pending',
    icon: <Clock size={14} aria-hidden="true" />,
    tone: 'neutral',
    description: 'Awaiting verification or dispute resolution',
  },
};

const TONE_STYLES: Record<OutcomeConfig['tone'], { bg: string; text: string; border: string }> = {
  success: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' },
  warning: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' },
  danger: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30' },
  info: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/30' },
  neutral: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
};

export interface OutcomeBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** The outcome kind - determines label, icon, tone, and description. */
  kind: OutcomeKind;
  /** Override the default label. */
  label?: string;
  /** Override the default description (announced to assistive tech). */
  description?: string;
  /** Whether the outcome is provisional (not finalized). */
  provisional?: boolean;
  /** Source/provenance of the outcome. */
  source?: string;
  /** Timestamp when the outcome was determined. */
  determinedAt?: string;
  /** Show as a compact inline badge. */
  compact?: boolean;
  /** Announce changes as a polite live region. */
  live?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

export function OutcomeBadge({
  kind,
  label,
  description,
  provisional = false,
  source,
  determinedAt,
  compact = false,
  live = false,
  className,
  ...rest
}: OutcomeBadgeProps) {
  const config = OUTCOME_CONFIGS[kind];
  const displayLabel = label ?? config.label;
  const displayDescription = description ?? config.description;
  const style = TONE_STYLES[config.tone];

  const badgeId = React.useId();
  const descId = React.useId();

  const summaryParts = [displayLabel];
  if (provisional || kind === 'provisional') {
    summaryParts.push('Provisional — not finalized');
  }
  if (source) {
    summaryParts.push(`Source: ${source}`);
  }
  if (determinedAt) {
    summaryParts.push(`Determined: ${new Date(determinedAt).toLocaleString()}`);
  }

  if (compact) {
    return (
      <span
        id={badgeId}
        data-outcome={kind}
        data-provisional={provisional || kind === 'provisional' ? 'true' : 'false'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
          style.bg,
          style.text,
          style.border,
          className
        )}
        {...(live ? { role: 'status', 'aria-live': 'polite' as const } : {})}
        {...rest}
      >
        <span aria-hidden="true">{config.icon}</span>
        <span>{displayLabel}</span>
        {(provisional || kind === 'provisional') && (
          <span className="sr-only">Provisional</span>
        )}
        {description && <span className="sr-only">. {displayDescription}</span>}
      </span>
    );
  }

  return (
    <div
      className={cn('space-y-1.5', className)}
      role="region"
      aria-label={displayLabel}
      aria-describedby={descId}
    >
      <span
        id={badgeId}
        data-outcome={kind}
        data-provisional={provisional || kind === 'provisional' ? 'true' : 'false'}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium',
          style.bg,
          style.text,
          style.border,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
        {...(live ? { role: 'status', 'aria-live': 'polite' as const } : {})}
        {...rest}
      >
        <span aria-hidden="true" className="size-4 shrink-0">
          {config.icon}
        </span>
        <span>{displayLabel}</span>
        {(provisional || kind === 'provisional') && (
          <>
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-warning/10 text-warning border border-warning/30"
              aria-label="Provisional — not finalized"
            >
              <span aria-hidden="true">⏳</span>
              Provisional
            </span>
            <span className="sr-only">Provisional</span>
          </>
        )}
      </span>

      <p
        id={descId}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {summaryParts.join('. ')}. {displayDescription}
      </p>

      {(source || determinedAt) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {source && (
            <span className="flex items-center gap-1">
              <span aria-hidden="true">📊</span>
              <span>Source: {source}</span>
            </span>
          )}
          {determinedAt && (
            <time dateTime={determinedAt} className="flex items-center gap-1">
              <span aria-hidden="true">🕐</span>
              <span>Determined {new Date(determinedAt).toLocaleString()}</span>
            </time>
          )}
        </div>
      )}
    </div>
  );
}

export default OutcomeBadge;