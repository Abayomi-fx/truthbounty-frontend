'use client';

import { useRecoveryReferences } from '@/hooks/useRecoveryReferences';
import { useRewardsCenterData } from '@/hooks/useRewardsCenterData';
import { RewardsCenter } from './RewardsCenter';
import { TransactionCenter } from './TransactionCenter';

export function ConnectedRewardsCenter() {
  const { data, refresh, canRefresh } = useRewardsCenterData();
  const recovery = useRecoveryReferences();
  return (
    <RewardsCenter
      data={data}
      transactions={recovery.records}
      recoveryUnavailable={recovery.storageUnavailable}
      refreshingDisabled={!canRefresh}
      onRefresh={() => {
        refresh();
        recovery.refresh();
      }}
    />
  );
}

export function ConnectedTransactionCenter() {
  const { records, isLoading, storageUnavailable, refresh } =
    useRecoveryReferences();
  return (
    <TransactionCenter
      records={records}
      state={
        isLoading ? 'loading' : storageUnavailable ? 'unavailable' : 'ready'
      }
      onRefresh={refresh}
    />
  );
}
