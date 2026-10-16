/**
 * Dispute API functions.
 *
 * Authoritative source: on-chain DisputeCreated / DisputeResolved events
 * indexed into the projection layer.
 *
 * Security rules:
 *  - Never fabricate dispute IDs, outcome verdicts, vote counts, or stake amounts.
 *  - Amounts returned by the API are exact integer strings (wei precision); do
 *    not convert them locally without explicit bigint handling.
 *  - The public projection is never a canonical authority for mutations.
 */

import type {
  Dispute,
  CreateDisputePayload,
  DisputeRegisterEntry,
  DisputeDetail,
} from '@/app/types/dispute';

export type { DisputeRegisterEntry, DisputeDetail };

export type { Dispute, CreateDisputePayload };

export async function fetchDisputesByClaim(claimId: string): Promise<Dispute[]> {
  const res = await fetch(
    `/api/claims/${encodeURIComponent(claimId)}/disputes`,
  );
  if (!res.ok) throw new Error('Failed to fetch disputes for claim');
  return res.json();
}

export async function fetchDisputeDetail(disputeId: string): Promise<Dispute> {
  const res = await fetch(`/api/disputes/${encodeURIComponent(disputeId)}`);
  if (!res.ok) throw new Error('Failed to fetch dispute detail');
  return res.json();
}

export async function createDispute(
  payload: CreateDisputePayload,
): Promise<Dispute> {
  const res = await fetch('/api/disputes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create dispute');
  return res.json();
}

/**
 * Public dispute register projection.
 *
 * This is a read-only projection of on-chain dispute events. The contract
 * is canonical for all mutations and for final resolution state.
 */
export async function fetchDisputeRegister(): Promise<DisputeRegisterEntry[]> {
  const res = await fetch('/api/disputes');
  if (!res.ok) throw new Error('Failed to fetch dispute register');
  return res.json();
}

/**
 * Public dispute detail projection.
 *
 * Returns `null` when the dispute ID is unknown to the projection layer.
 * The caller must not fabricate a dispute from a missing response.
 */
export async function fetchPublicDisputeDetail(
  disputeId: string,
): Promise<DisputeDetail | null> {
  const res = await fetch(
    `/api/disputes/${encodeURIComponent(disputeId)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch dispute detail');
  return res.json();
}
