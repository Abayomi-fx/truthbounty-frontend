import { useState, useEffect } from 'react';

export type TxLifecycleStatus = 'pending' | 'confirmed' | 'replaced' | 'dropped' | 'stuck' | 'failed';

export interface TransactionLifecycleState {
    status: TxLifecycleStatus;
    hash: string;
    replacementHash?: string;
    message: string;
    elapsedSeconds: number;
}

export function useTransactionLifecycleMonitor(txHash: string | null, provider?: unknown) {
    const [txState, setTxState] = useState<TransactionLifecycleState | null>(null);
    const [isStuck, setIsStuck] = useState(false);

    useEffect(() => {
        if (!txHash) {
            setTxState(null);
            setIsStuck(false);
            return;
        }

        let isMounted = true;
        let elapsed = 0;

        setTxState({
            status: 'pending',
            hash: txHash,
            message: 'Transaction submitted to Optimism network. Waiting for sequencer confirmation...',
            elapsedSeconds: 0,
        });

        // Timer to track stuck transactions (> 60 seconds without receipt)
        const timer = setInterval(() => {
            if (!isMounted) return;
            elapsed += 5;

            setTxState(prev => (prev ? { ...prev, elapsedSeconds: elapsed } : null));

            if (elapsed > 60) {
                setIsStuck(true);
                setTxState(prev =>
                    prev && prev.status !== 'stuck'
                        ? {
                              ...prev,
                              status: 'stuck',
                              message: 'Transaction is taking longer than usual. It may be stuck due to low gas price or network congestion.',
                          }
                        : prev,
                );
            }
        }, 5000);

        return () => {
            isMounted = false;
            clearInterval(timer);
        };
    }, [txHash, provider]);

    return {
        txState,
        isStuck,
    };
}