/**
 * UI-FE-088 — incident telemetry factory.
 *
 * Conforms to the pinned `TelemetryEvent` shape in `src/lib/telemetry.ts`
 * (V2-FE-149 privacy-safe error and incident telemetry). Fixtures carry
 * redaction-safe context only: no user identifiers, no secrets, no stack
 * traces — exactly what the production redactor would keep.
 */

import type { TelemetryEvent, TelemetrySeverity } from '../../../lib/telemetry';
import { createFixtureContext, type FixtureContext } from '../deterministic';

const SEVERITIES: readonly TelemetrySeverity[] = [
  'debug',
  'info',
  'warning',
  'error',
  'fatal',
] as const;

export interface MakeIncidentEventOptions {
  /** Stable key driving the event id and message. Default `'fixture-incident'`. */
  key?: string;
  severity?: TelemetrySeverity;
  message?: string;
  chainId?: number;
  overrides?: Partial<TelemetryEvent>;
  ctx?: FixtureContext;
}

/**
 * Build a sanitised incident event. `category` is pinned to `'incident'` so a
 * reader can always tell an incident fixture from a generic telemetry event.
 */
export function makeIncidentEvent(options: MakeIncidentEventOptions = {}): TelemetryEvent {
  const {
    key = 'fixture-incident',
    severity = 'warning',
    message = 'Fixture incident emitted by the UI-FE-088 factory library.',
    chainId = 11155420,
    overrides = {},
    ctx = createFixtureContext(),
  } = options;

  const event: TelemetryEvent = {
    id: ctx.hex(`incident-id:${key}`, 16),
    timestamp: ctx.nowIso,
    severity,
    category: 'incident',
    message,
    context: {
      source: 'fixture-factory',
      scenarioKey: key,
    },
    release: '2.0.0',
    chainId,
  };

  return { ...event, ...overrides };
}

/** All severities, for exhaustive story/test matrices. */
export const INCIDENT_SEVERITIES = SEVERITIES;
