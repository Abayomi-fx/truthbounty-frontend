export async function getClaimById(id: string) {
  const res = await fetch(`/api/claims/${id}`);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('CLAIM_NOT_FOUND');
    }
    throw new Error('Failed to fetch claim');
  }
  return res.json();
}

export async function submitVerification(payload: {
  claimId: string;
  decision: 'verify' | 'reject';
  stakeAmount: number;
}) {
  const res = await fetch('/api/verifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error('Verification failed');
  return res.json();
}
