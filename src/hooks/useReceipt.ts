'use client';

/**
 * UI-FE-080: Reusable Hook for Generating & Downloading Receipts
 */

import { useState, useCallback, useMemo } from 'react';
import type {
  CanonicalReceiptRecord,
  RawReceiptInput,
} from '@/lib/receipts/types';
import {
  generateReceipt,
  formatReceiptAsText,
  formatReceiptAsPrintableHtml,
  generateReceiptFilename,
  serializeDeterministicReceiptJson,
} from '@/lib/receipts';

export interface UseReceiptOptions {
  input: RawReceiptInput | null;
  autoDownloadOnFinalized?: boolean;
}

export type UseTransactionReceiptOptions = UseReceiptOptions;

export interface UseReceiptResult {
  receipt: CanonicalReceiptRecord | null;
  error: Error | null;
  downloadJson: () => void;
  downloadText: () => void;
  printDocument: () => void;
  isDownloading: boolean;
  copiedChecksum: boolean;
  copyChecksum: () => Promise<void>;
}

export type UseTransactionReceiptResult = UseReceiptResult;

export function useReceipt(
  input: RawReceiptInput | null,
): UseReceiptResult {
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedChecksum, setCopiedChecksum] = useState(false);

  // Generate canonical receipt deterministically
  const { receipt, error } = useMemo(() => {
    if (!input) {
      return { receipt: null, error: null };
    }
    try {
      const rec = generateReceipt(input);
      return { receipt: rec, error: null };
    } catch (err) {
      return { receipt: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }, [input]);

  // Trigger browser download via Blob
  const triggerBlobDownload = useCallback(
    (content: string, mimeType: string, filename: string) => {
      if (typeof window === 'undefined') return;
      setIsDownloading(true);

      try {
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        // Revoke after small delay
        setTimeout(() => {
          URL.revokeObjectURL(url);
          setIsDownloading(false);
        }, 100);
      } catch (e) {
        setIsDownloading(false);
        console.error('Failed to trigger receipt download', e);
      }
    },
    [],
  );

  const downloadJson = useCallback(() => {
    if (!receipt) return;
    const jsonStr = serializeDeterministicReceiptJson(receipt);
    const filename = generateReceiptFilename({
      action: receipt.action,
      referenceOrHash: receipt.provenance.consensus.txHash ?? receipt.actionDetails.referenceId,
      status: receipt.status,
      extension: 'json',
    });
    triggerBlobDownload(jsonStr, 'application/json', filename);
  }, [receipt, triggerBlobDownload]);

  const downloadText = useCallback(() => {
    if (!receipt) return;
    const textStr = formatReceiptAsText(receipt);
    const filename = generateReceiptFilename({
      action: receipt.action,
      referenceOrHash: receipt.provenance.consensus.txHash ?? receipt.actionDetails.referenceId,
      status: receipt.status,
      extension: 'txt',
    });
    triggerBlobDownload(textStr, 'text/plain', filename);
  }, [receipt, triggerBlobDownload]);

  const printDocument = useCallback(() => {
    if (!receipt || typeof window === 'undefined') return;
    const htmlStr = formatReceiptAsPrintableHtml(receipt);

    // Open print window with accessible printable HTML
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlStr);
      printWindow.document.close();
      printWindow.focus();
      // Allow DOM to render then trigger print dialog
      setTimeout(() => {
        try {
          printWindow.print();
        } catch {
          // Window closed or unsupported
        }
      }, 250);
    }
  }, [receipt]);

  const copyChecksum = useCallback(async () => {
    if (!receipt || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(`SHA256:${receipt.checksum}`);
      setCopiedChecksum(true);
      setTimeout(() => setCopiedChecksum(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  }, [receipt]);

  return {
    receipt,
    error,
    downloadJson,
    downloadText,
    printDocument,
    isDownloading,
    copiedChecksum,
    copyChecksum,
  };
}

export const useTransactionReceipt = useReceipt;

