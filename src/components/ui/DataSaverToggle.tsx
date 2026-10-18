'use client';

/**
 * DataSaverToggle — user-controllable reduced-data override (UI-FE-082).
 *
 * Renders a single pressed-state button. It reflects the *effective* reduced
 * state (whether forced by the user, the browser, or a slow connection) and
 * lets the user force it on or off. Toggling to "off" is an explicit opt-out,
 * even on a constrained connection.
 *
 * WCAG 2.2 AA: a real `<button>` with `aria-pressed`, a programmatic label that
 * states the current mode, a visible focus ring, and text (not colour alone)
 * carrying the state.
 */

import { Gauge, GaugeCircle } from 'lucide-react';
import { useReducedData } from '@/hooks/useReducedData';
import { REDUCED_DATA_MODE_LABELS } from '@/config/reduced-data';

export interface DataSaverToggleProps {
  className?: string;
  /** Hide the visible text label (still announced to assistive tech). */
  iconOnly?: boolean;
}

export function DataSaverToggle({ className = '', iconOnly = false }: DataSaverToggleProps) {
  const { isReducedData, mode, source, isConstrainedNetwork, toggle } = useReducedData();

  const Icon = isReducedData ? Gauge : GaugeCircle;
  const stateLabel = isReducedData ? 'on' : 'off';
  const reason = isConstrainedNetwork ? 'constrained connection detected' : 'standard connection';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isReducedData}
      aria-label={`Data saver is ${stateLabel}. Mode: ${REDUCED_DATA_MODE_LABELS[mode]}. ${reason}. Activate to ${isReducedData ? 'disable' : 'enable'} data saver.`}
      title={`Data saver: ${stateLabel} (${mode})`}
      data-testid="data-saver-toggle"
      data-mode={mode}
      data-source={source}
      className={`inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        isReducedData ? 'text-amber-500' : ''
      } ${className}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!iconOnly && <span className="hidden sm:inline">Data saver</span>}
    </button>
  );
}

export default DataSaverToggle;
