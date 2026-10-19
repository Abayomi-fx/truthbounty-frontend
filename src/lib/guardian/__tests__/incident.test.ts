/**
 * UI-FE-032 — Incident context & blast-radius validation tests.
 * Incomplete or off-scope incident context must fail closed.
 */

import {
  blastRadiusForScope,
  validateBlastRadius,
  validateIncidentContext,
  type GuardianIncidentContext,
  type GuardianModuleBlastRadius,
} from '@/lib/guardian';

const blastRadius = (
  overrides: Partial<GuardianModuleBlastRadius> = {},
): GuardianModuleBlastRadius => ({
  scope: 'dispute',
  moduleLabel: 'Dispute engine',
  affectedOperations: ['openDispute', 'respondToDispute'],
  userImpact: 'New disputes cannot be opened while paused.',
  reversible: true,
  ...overrides,
});

const incident = (
  overrides: Partial<GuardianIncidentContext> = {},
): GuardianIncidentContext => ({
  incidentId: 'INC-2026-0601',
  severity: 'high',
  summary: 'Anomalous dispute submission pattern detected.',
  detectedAt: '2026-06-01T10:00:00.000Z',
  reference: 'OPS-REF-0601',
  affectedScopes: ['dispute'],
  blastRadius: [blastRadius()],
  ...overrides,
});

describe('validateIncidentContext', () => {
  it('accepts a complete incident', () => {
    expect(validateIncidentContext(incident()).complete).toBe(true);
  });

  it('rejects a missing incident', () => {
    const result = validateIncidentContext(null);
    expect(result.complete).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/missing/i);
  });

  it('rejects invalid severity, timestamp and reference', () => {
    const result = validateIncidentContext(
      incident({
        severity: 'catastrophic' as never,
        detectedAt: 'not-a-date',
        reference: '',
      }),
    );
    expect(result.complete).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/severity/i);
    expect(result.reasons.join(' ')).toMatch(/timestamp/i);
    expect(result.reasons.join(' ')).toMatch(/reference/i);
  });

  it('rejects incident scopes that are not approved pause scopes', () => {
    const result = validateIncidentContext(
      incident({ affectedScopes: ['treasury' as never] }),
    );
    expect(result.complete).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/non-approved/i);
  });

  it('requires blast radius coverage for every affected scope', () => {
    const result = validateIncidentContext(
      incident({
        affectedScopes: ['dispute', 'verification'],
        blastRadius: [blastRadius()],
      }),
    );
    expect(result.complete).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/verification/i);
  });

  it('rejects an empty blast radius', () => {
    const result = validateIncidentContext(incident({ blastRadius: [] }));
    expect(result.complete).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/blast radius is missing/i);
  });
});

describe('validateBlastRadius', () => {
  it('accepts a complete entry', () => {
    expect(validateBlastRadius(blastRadius()).complete).toBe(true);
  });

  it('rejects missing impact and reversibility declaration', () => {
    const result = validateBlastRadius(
      blastRadius({ userImpact: '', reversible: undefined as never }),
    );
    expect(result.complete).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/impact/i);
    expect(result.reasons.join(' ')).toMatch(/reversib/i);
  });
});

describe('blastRadiusForScope', () => {
  it('returns the entry for an affected scope', () => {
    expect(blastRadiusForScope(incident(), 'dispute')?.moduleLabel).toBe(
      'Dispute engine',
    );
  });

  it('returns null when the scope is not covered', () => {
    expect(blastRadiusForScope(incident(), 'appeal')).toBeNull();
  });
});
