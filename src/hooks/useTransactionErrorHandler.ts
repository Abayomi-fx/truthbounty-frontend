import { useState, useCallback } from 'react';

export interface NormalizedError {
    title: string;
    message: string;
    isUserRejection: boolean;
    isContractRevert: boolean;
    retryable: boolean;
}

export function useTransactionErrorHandler() {
    const [errorState, setErrorState] = useState<NormalizedError | null>(null);

    const handleTransactionError = useCallback((err: unknown): NormalizedError => {
        let title = 'Transaction Failed';
        let message = 'An unexpected error occurred while processing your transaction.';
        let isUserRejection = false;
        let isContractRevert = false;
        let retryable = true;

        // Inspect error codes and messages across standard EVM providers (MetaMask, WalletConnect, Viem/Ethers)
        const errObj = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : null;
        const infoObj = errObj?.info && typeof errObj.info === 'object' ? (errObj.info as Record<string, unknown>) : null;
        const innerErrObj = infoObj?.error && typeof infoObj.error === 'object' ? (infoObj.error as Record<string, unknown>) : null;

        const errorCode = errObj?.code ?? innerErrObj?.code;
        const rawMessage = (typeof errObj?.message === 'string' && errObj.message) || (typeof errObj?.reason === 'string' && errObj.reason);
        const errorMessage = rawMessage || (typeof err === 'string' ? err : JSON.stringify(err) || '');

        if (
            errorCode === 4001 ||
            errorCode === 'ACTION_REJECTED' ||
            errorMessage.includes('user rejected') ||
            errorMessage.includes('User denied transaction signature')
        ) {
            title = 'Action Cancelled';
            message = 'You cancelled the request in your wallet.';
            isUserRejection = true;
            retryable = true;
        } else if (
            errorCode === 'CALL_EXCEPTION' ||
            errorMessage.includes('execution reverted') ||
            errorMessage.includes('revert')
        ) {
            title = 'Contract Reverted';
            message = extractRevertReason(errorMessage);
            isContractRevert = true;
            retryable = false; // Reverts usually require fixing inputs or state
        } else if (errorMessage.includes('insufficient funds')) {
            title = 'Insufficient Funds';
            message = 'Your wallet balance is too low to cover the transaction value and estimated gas fees on Optimism.';
            retryable = true;
        } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
            title = 'Network Connection Error';
            message = 'Failed to connect to the Optimism network RPC. Please verify your network connection.';
            retryable = true;
        }

        const normalized: NormalizedError = {
            title,
            message,
            isUserRejection,
            isContractRevert,
            retryable,
        };

        setErrorState(normalized);
        return normalized;
    }, []);

    const clearError = useCallback(() => {
        setErrorState(null);
    }, []);

    return {
        errorState,
        handleTransactionError,
        clearError,
    };
}

function extractRevertReason(rawMessage: string): string {
    if (rawMessage.includes('reverted with reason:')) {
        const parts = rawMessage.split('reverted with reason:');
        return parts[1]?.trim().split('\n')[0] || 'The smart contract reverted the transaction.';
    }
    if (rawMessage.includes('execution reverted:')) {
        const parts = rawMessage.split('execution reverted:');
        return parts[1]?.trim().split('\n')[0] || 'The smart contract reverted the transaction.';
    }
    return 'The transaction was reverted by the smart contract due to unmet preconditions or security guards.';
}