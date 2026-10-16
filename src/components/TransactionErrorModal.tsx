import React from 'react';
import { NormalizedError } from '../hooks/useTransactionErrorHandler';

interface Props {
    error: NormalizedError | null;
    onClose: () => void;
    onRetry?: () => void;
}

export const TransactionErrorModal: React.FC<Props> = ({ error, onClose, onRetry }) => {
    if (!error) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
                <div className="flex items-center space-x-3 mb-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${error.isUserRejection ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                        {error.isUserRejection ? '⚠️' : '❌'}
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">{error.title}</h3>
                        <p className="text-xs text-slate-400">Optimism Mainnet / Testnet V2 Client</p>
                    </div>
                </div>

                <p className="text-sm text-slate-300 mb-6 leading-relaxed bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                    {error.message}
                </p>

                <div className="flex space-x-3">
                    {error.retryable && onRetry && (
                        <button
                            onClick={() => { onClose(); onRetry(); }}
                            className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 py-2.5 text-sm font-medium transition-colors"
                        >
                            Try Again
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-lg bg-slate-800 hover:bg-slate-700 py-2.5 text-sm font-medium transition-colors text-slate-300"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
};