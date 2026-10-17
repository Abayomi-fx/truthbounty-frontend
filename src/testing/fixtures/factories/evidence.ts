/**
 * UI-FE-088 — typed evidence factory.
 *
 * Conforms to the pinned `Evidence` interface in `src/app/types/claim.ts`.
 * Values are deterministic and contain no secrets or production endpoints:
 * evidence URLs use the reserved `example.test` TLD (RFC 2606).
 */

import type { Evidence, EvidenceType } from '../../../app/types/claim';
import { createFixtureContext, type FixtureContext } from '../deterministic';

/** Every canonical evidence kind, in a fixed order. */
export const EVIDENCE_TYPES: readonly EvidenceType[] = [
  'link',
  'text',
  'image',
  'video',
  'document',
] as const;

export interface MakeEvidenceOptions {
  /** Stable index used to derive the id and value. Default 0. */
  index?: number;
  /** Claim the evidence belongs to (used in ids and URLs). */
  claimId?: string;
  /** Explicit evidence kind; defaults to a deterministic pick. */
  type?: EvidenceType;
  ctx?: FixtureContext;
}

/** Deterministic evidence value per kind — no external hosts, no credentials. */
function evidenceValue(type: EvidenceType, claimId: string, index: number): string {
  const ordinal = index + 1;
  switch (type) {
    case 'link':
      return `https://evidence.example.test/${claimId}/source-${ordinal}`;
    case 'text':
      return `Fixture witness statement ${ordinal} for ${claimId}.`;
    case 'image':
      return `https://evidence.example.test/${claimId}/image-${ordinal}.png`;
    case 'video':
      return `https://evidence.example.test/${claimId}/clip-${ordinal}.webm`;
    case 'document':
      return `https://evidence.example.test/${claimId}/document-${ordinal}.pdf`;
    default: {
      const exhaustive: never = type;
      return String(exhaustive);
    }
  }
}

/** Build one pinned-shape `Evidence` record. */
export function makeEvidence(options: MakeEvidenceOptions = {}): Evidence {
  const { index = 0, claimId = 'claim-0001', ctx = createFixtureContext() } = options;
  const type = options.type ?? ctx.pick(`evidence-type:${claimId}:${index}`, EVIDENCE_TYPES);

  return {
    id: ctx.id('evidence', index),
    type,
    value: evidenceValue(type, claimId, index),
    createdAt: ctx.isoAt(-3_600_000 * (index + 1)),
  };
}

/** Build `count` evidence records for a claim, deterministically ordered. */
export function makeEvidenceSet(
  claimId: string,
  count: number,
  ctx: FixtureContext = createFixtureContext(),
): Evidence[] {
  return Array.from({ length: count }, (_unused, index) =>
    makeEvidence({ index, claimId, ctx }),
  );
}
