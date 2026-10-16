'use client';

import React from 'react';
import {
  GUARDIAN_SCOPE_LABELS,
  type GuardianModuleBlastRadius,
  type GuardianPauseScope,
} from '@/lib/guardian';

export interface GuardianScopeSelectorProps {
  /** Approved scopes to render (never includes forbidden capabilities). */
  scopes: readonly GuardianPauseScope[];
  /** Scopes proven actionable by the pinned ABI. */
  actionableScopes: readonly GuardianPauseScope[];
  /** Scopes the incident covers. */
  incidentScopes: readonly GuardianPauseScope[];
  selectedScope: GuardianPauseScope | null;
  onSelect: (scope: GuardianPauseScope) => void;
  disabled: boolean;
  blastRadius?: readonly GuardianModuleBlastRadius[];
}

function scopeDisabledReason(
  scope: GuardianPauseScope,
  actionable: readonly GuardianPauseScope[],
  incidentScopes: readonly GuardianPauseScope[],
): string | null {
  if (!actionable.includes(scope)) return 'Not proven by the pinned ABI';
  if (!incidentScopes.includes(scope)) return 'Not covered by the current incident';
  return null;
}

/**
 * Operation-scoped pause target selection. Only approved pause scopes are
 * rendered; options the pinned ABI or incident do not authorise are disabled.
 */
export function GuardianScopeSelector({
  scopes,
  actionableScopes,
  incidentScopes,
  selectedScope,
  onSelect,
  disabled,
  blastRadius = [],
}: GuardianScopeSelectorProps) {
  return (
    <fieldset
      data-testid="guardian-scope-selector"
      disabled={disabled}
      className="rounded-xl border border-border bg-card p-4 disabled:opacity-60"
      aria-describedby="guardian-scope-hint"
    >
      <legend className="px-1 text-sm font-semibold text-foreground">
        Operation scope to pause
      </legend>
      <p id="guardian-scope-hint" className="mb-3 text-xs text-muted-foreground">
        Only ABI-proven, incident-covered pause scopes can be requested. This
        control never exposes unpause, upgrade, treasury, settlement or role
        transfer.
      </p>
      <ul className="space-y-2">
        {scopes.map((scope) => {
          const reason = scopeDisabledReason(
            scope,
            actionableScopes,
            incidentScopes,
          );
          const optionDisabled = disabled || reason !== null;
          const radius = blastRadius.find((entry) => entry.scope === scope);
          const optionId = `guardian-scope-${scope}`;
          return (
            <li key={scope}>
              <label
                htmlFor={optionId}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  selectedScope === scope
                    ? 'border-primary bg-primary/5'
                    : 'border-border/60 bg-background/40'
                } ${optionDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  id={optionId}
                  type="radio"
                  name="guardian-pause-scope"
                  value={scope}
                  checked={selectedScope === scope}
                  disabled={optionDisabled}
                  onChange={() => onSelect(scope)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {GUARDIAN_SCOPE_LABELS[scope]}
                  </span>
                  {reason && (
                    <span
                      data-testid={`guardian-scope-reason-${scope}`}
                      className="text-xs text-amber-400"
                    >
                      {reason}
                    </span>
                  )}
                  {radius && (
                    <span className="text-xs text-muted-foreground">
                      Module: {radius.moduleLabel} ·{' '}
                      {radius.reversible
                        ? 'reversible'
                        : 'requires governance to unpause'}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export default GuardianScopeSelector;
