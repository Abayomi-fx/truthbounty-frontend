import React from 'react';

export type TransactionStatusValue =
  | 'idle'
  | 'pending'
  | 'preparing'
  | 'signature-requested'
  | 'submitted'
  | 'confirming'
  | 'safe'
  | 'indexing'
  | 'stale'
  | 'success'
  | 'finalized'
  | 'error'
  | 'dropped'
  | 'replaced'
  | 'reverted'
  | 'rejected'
  | 'reorged'
  | 'failed';

export type TransactionStatusMessages = Partial<
  Record<TransactionStatusValue, string>
>;

interface TransactionStatusProps {
  status: TransactionStatusValue;
  messages?: TransactionStatusMessages;
  errorMessage?: string;
  onRetry?: () => void;
}

const errorStatuses = new Set<TransactionStatusValue>([
  'error',
  'dropped',
  'replaced',
  'reverted',
  'rejected',
  'reorged',
  'failed',
]);

const busyStatuses = new Set<TransactionStatusValue>([
  'pending',
  'preparing',
  'signature-requested',
  'submitted',
  'confirming',
  'safe',
  'indexing',
  'stale',
]);

const defaultMessages: Record<TransactionStatusValue, string> = {
  idle: '',
  pending: 'Transaction pending...',
  preparing: 'Preparing transaction...',
  'signature-requested': 'Confirm the transaction in your wallet.',
  submitted: 'Transaction submitted.',
  confirming: 'Transaction confirming...',
  safe: 'Transaction is safe.',
  indexing: 'Transaction confirmed; waiting for indexing.',
  stale: 'Transaction status may be stale.',
  success: 'Verification submitted.',
  finalized: 'Transaction finalized.',
  error: 'Transaction failed.',
  dropped: 'Transaction was dropped.',
  replaced: 'Transaction was replaced.',
  reverted: 'Transaction reverted.',
  rejected: 'Transaction rejected.',
  reorged: 'Transaction was affected by a chain reorganization.',
  failed: 'Transaction failed.',
};

export function TransactionStatus({
  status,
  messages = {},
  errorMessage,
  onRetry,
}: TransactionStatusProps) {
  if (status === 'idle') return null;

  const message = messages[status] ?? defaultMessages[status];

  if (busyStatuses.has(status)) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center space-x-2 text-gray-600 dark:text-gray-300"
      >
        <svg
          className="motion-safe:animate-spin h-4 w-4 text-blue-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p className="text-sm font-medium">{message}</p>
      </div>
    );
  }

  if (errorStatuses.has(status)) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex flex-col space-y-2 text-red-600 dark:text-red-400"
      >
        <p className="text-sm font-medium">{message}</p>
        {errorMessage ? (
          <p className="text-xs text-red-500 dark:text-red-300">{errorMessage}</p>
        ) : null}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="self-start rounded text-xs underline focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Retry transaction
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center space-x-2 text-green-600 dark:text-green-400"
    >
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
