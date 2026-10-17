'use client';

/**
 * UI-FE-080: Reusable Transaction & Decision Receipt Trigger Button
 */

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import type { RawReceiptInput, CanonicalReceiptRecord } from '@/lib/receipts/types';
import { generateReceipt } from '@/lib/receipts';
import { TransactionReceiptModal } from './TransactionReceiptModal';

export interface TransactionReceiptButtonProps {
  input: RawReceiptInput;
  label?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
}

export function TransactionReceiptButton({
  input,
  label = 'Download Receipt',
  className = '',
  variant = 'secondary',
  size = 'sm',
}: TransactionReceiptButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [receipt, setReceipt] = useState<CanonicalReceiptRecord | null>(null);

  const handleClick = () => {
    try {
      const generated = generateReceipt(input);
      setReceipt(generated);
      setIsOpen(true);
    } catch (err) {
      console.error('Failed to generate receipt from canonical input', err);
    }
  };

  const baseClasses =
    'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-50';

  const sizeClasses = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm';

  const variantClasses =
    variant === 'primary'
      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
      : variant === 'ghost'
      ? 'bg-transparent hover:bg-slate-800 text-slate-300 hover:text-white'
      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
        aria-label={`Open downloadable receipt for ${input.action}`}
      >
        <Download className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span>{label}</span>
      </button>

      {receipt && (
        <TransactionReceiptModal
          receipt={receipt}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
