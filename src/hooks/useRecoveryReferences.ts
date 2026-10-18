'use client';

import { useCallback, useEffect, useState } from 'react';
import { subscribeToPendingTransactions } from '@/lib/pending-transactions';
import {
  readRecoveryReferences,
  isRecoveryStorageUnavailable,
  TRANSACTION_STORAGE_EVENT,
} from '@/lib/transaction-machine/recovery-references';
import type { CenterTransaction } from '@/components/features/rewards-center/model';

export function useRecoveryReferences() {
  const [records, setRecords] = useState<CenterTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const refresh = useCallback(() => {
    setRecords(readRecoveryReferences());
    setStorageUnavailable(isRecoveryStorageUnavailable());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribeToPendingTransactions(refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener(TRANSACTION_STORAGE_EVENT, refresh);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener(TRANSACTION_STORAGE_EVENT, refresh);
    };
  }, [refresh]);

  return { records, isLoading, storageUnavailable, refresh };
}
