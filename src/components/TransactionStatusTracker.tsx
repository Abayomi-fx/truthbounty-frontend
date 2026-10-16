// src/components/TransactionStatusTracker.tsx
import React from 'react';
import { TransactionLifecycleState } from '../hooks/useTransactionLifecycleMonitor';

interface Props {
    txState: TransactionLifecycleState | null;
    onSpeedUp?: () => void;
    onCancel?: () => void;
    onDismiss?: () => void;
}

export const TransactionStatusTracker: React.FC<Props> = ({ txState, onSpeedUp, onCancel, onDismiss }) => {
    if (!txState) return null;

    const isPendingOrStuck = txState.status === 'pending' || txState.status === 'stuck';

    return (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm rounded-xl bg-slate-900 border border-slate-800 p-4 shadow-2xl text-slate-100 animate-slide-up">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2.5">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${txState.status === 'stuck' ? 'bg-amber-500/10 text-amber-400 animate-pulse' : 'bg-indigo-500/10 text-indigo-400'}`}>
                        {txState.status === 'stuck' ? '⏳' : '🔄'}
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold capitalize">Transaction {txState.status}</h4>
                        <p className="text-[10px] text-slate-400 font-mono">
                            {txState.hash.slice(0, 8)}...{txState.hash.slice(-6)}
                        </p>
                    </div>
                </div>
                {onDismiss && (
                    <button onClick={onDismiss} className="text-slate-500 hover:text-slate-300 text-xs">
                        ✕
                    </button>
                )}
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/50">
                {txState.message}
            </p>

            {isPendingOrStuck && (
                <div className="flex space-x-2">
                    {onSpeedUp && (
                        <button
                            onClick={onSpeedUp}
                            className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 py-2 text-xs font-medium transition-colors"
                        >
                            Speed Up (Replace)
                        </button>
                    )}
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="flex-1 rounded-lg bg-slate-800 hover:bg-slate-700 py-2 text-xs font-medium transition-colors text-slate-300"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};