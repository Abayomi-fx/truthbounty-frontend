// src/components/TransactionStatusTracker.tsx
import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { TransactionLifecycleState } from '../hooks/useTransactionLifecycleMonitor';
import { createReceiptFromLifecycleState } from '@/lib/receipts';
import { TransactionReceiptModal } from '@/components/receipts/TransactionReceiptModal';
import type { CanonicalReceiptRecord, ReceiptActionType } from '@/lib/receipts/types';
import { usePublicServiceStatus } from '@/hooks/usePublicServiceStatus';

interface Props {
    txState: TransactionLifecycleState | null;
    action?: ReceiptActionType;
    chainId?: number;
    onSpeedUp?: () => void;
    onCancel?: () => void;
    onDismiss?: () => void;
}

export const TransactionStatusTracker: React.FC<Props> = ({
    txState,
    action = 'claim',
    chainId = 11155420,
    onSpeedUp,
    onCancel,
    onDismiss,
}) => {
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [receipt, setReceipt] = useState<CanonicalReceiptRecord | null>(null);
    const { status: publicStatus, freshness } = usePublicServiceStatus();

    if (!txState) return null;

    const isPendingOrStuck = txState.status === 'pending' || txState.status === 'stuck';
    const isStale = freshness === 'stale' || freshness === 'missing';
    const isDegraded = publicStatus?.overall === 'degraded' || publicStatus?.overall === 'partial';
    const isUnavailable = publicStatus?.overall === 'unavailable';
    const isDelayed = publicStatus?.overall === 'delayed';

    const handleOpenReceipt = () => {
        try {
            const rec = createReceiptFromLifecycleState(action, txState, {
                chainId,
            });
            setReceipt(rec);
            setIsReceiptOpen(true);
        } catch (err) {
            console.error('Failed to generate receipt', err);
        }
    };

    return (
        <>
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
                        <button onClick={onDismiss} aria-label="Dismiss status notification" className="text-slate-500 hover:text-slate-300 text-xs">
                            ✕
                        </button>
                    )}
                </div>

                <p className="text-xs text-slate-300 mb-4 leading-relaxed bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/50">
                    {txState.message}
                </p>

                {(isStale || isDegraded || isUnavailable || isDelayed) && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="mb-3 rounded-lg border border-amber-700/50 bg-amber-950/40 p-2.5 text-[11px] leading-relaxed text-amber-200"
                    >
                        <span className="font-semibold">Service status: </span>
                        {isUnavailable && 'Unavailable — observations could not be retrieved.'}
                        {isStale && 'Stale — last observation is outdated; do not treat as healthy.'}
                        {isDelayed && 'Delayed — observations are lagging behind.'}
                        {isDegraded && 'Degraded or partial — some dependencies are not reporting.'}
                    </div>
                )}

                <div className="flex flex-col gap-2">
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

                    <button
                        type="button"
                        onClick={handleOpenReceipt}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
                        aria-label="Download or view transaction receipt"
                    >
                        <Download className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        <span>Download Receipt</span>
                    </button>
                </div>
            </div>

            {receipt && (
                <TransactionReceiptModal
                    receipt={receipt}
                    isOpen={isReceiptOpen}
                    onClose={() => setIsReceiptOpen(false)}
                />
            )}
        </>
    );
};
