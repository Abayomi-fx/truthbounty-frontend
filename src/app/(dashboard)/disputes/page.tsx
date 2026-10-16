'use client';

import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useDisputeRegister } from '@/app/queries/disputes.queries';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { DisputeRegisterTable } from '@/components/features/disputes/DisputeRegisterTable';
import {
  DisputeRegisterEmpty,
  DisputeRegisterStale,
  DisputeRegisterUnavailable,
} from '@/components/features/disputes/DisputeRegisterStates';

export default function DisputesRoutePage() {
  const {
    data,
    isPending,
    isError,
    isPaused,
    fetchStatus,
    refetch,
  } = useDisputeRegister();
  const { isOnline } = useNetworkStatus();

  const hasData = Boolean(data);
  const initialLoad = isPending && fetchStatus !== 'paused';
  const offlineNoData = isPending && fetchStatus === 'paused' && !hasData;
  const failedNoData = isError && !hasData && !offlineNoData;
  const showStale = hasData && (isError || !isOnline || isPaused);

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Public Dispute Register
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Read-only projection of on-chain disputes. Provisional outcomes are labelled
            and are not established truth. The contract remains canonical for all
            mutations.
          </p>
        </div>

        {initialLoad ? (
          <div
            role="status"
            aria-live="polite"
            data-testid="dispute-register-loading"
            className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground"
          >
            Loading dispute register…
          </div>
        ) : offlineNoData ? (
          <DisputeRegisterUnavailable
            title="Dispute register unavailable"
            body="You are offline and no cached projection is available."
            onRetry={() => void refetch()}
          />
        ) : failedNoData ? (
          <DisputeRegisterUnavailable
            title="Dispute register unavailable"
            body="The projection could not be loaded. The contract remains canonical."
            onRetry={() => void refetch()}
          />
        ) : (
          <div className="space-y-4">
            {showStale ? <DisputeRegisterStale onRetry={() => void refetch()} /> : null}
            {data && data.length > 0 ? (
              <DisputeRegisterTable entries={data} />
            ) : (
              <DisputeRegisterEmpty />
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
