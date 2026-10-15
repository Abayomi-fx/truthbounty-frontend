import type {
  AdminDashboardOverview,
  ExecuteOperationRequest,
  ExecuteOperationResponse,
} from '@/app/types/admin';

export async function fetchAdminOverview(adminAddress: string): Promise<AdminDashboardOverview> {
  const res = await fetch('/api/admin/overview', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'x-admin-address': adminAddress,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const reason = errorBody.reason || errorBody.error || `HTTP ${res.status}`;
    const err = new Error(reason);
    (err as { status?: number }).status = res.status;
    throw err;
  }

  return res.json();
}

export async function executeAdminOperation(
  payload: ExecuteOperationRequest
): Promise<ExecuteOperationResponse> {
  const res = await fetch('/api/admin/operations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-admin-address': payload.operatorAddress,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const reason = errorBody.reason || errorBody.error || `HTTP ${res.status}`;
    const err = new Error(reason);
    (err as { status?: number }).status = res.status;
    throw err;
  }

  return res.json();
}
