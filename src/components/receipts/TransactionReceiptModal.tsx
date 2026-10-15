'use client';

/**
 * UI-FE-080: Accessible Transaction & Decision Receipt Modal (WCAG 2.2 AA)
 */

import React, { useEffect, useRef } from 'react';
import {
  Download,
  Printer,
  Copy,
  Check,
  X,
  FileText,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import type { CanonicalReceiptRecord } from '@/lib/receipts/types';
import { useReceipt } from '@/hooks/useReceipt';
import { getTransactionExplorerUrl } from '@/lib/explorer';

export interface TransactionReceiptModalProps {
  receipt: CanonicalReceiptRecord;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function TransactionReceiptModal({
  receipt,
  isOpen,
  onClose,
  className = '',
}: TransactionReceiptModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const {
    downloadJson,
    downloadText,
    printDocument,
    isDownloading,
    copiedChecksum,
    copyChecksum,
  } = useReceipt({
    action: receipt.action,
    status: receipt.status,
    chainId: receipt.provenance.chain.chainId,
    txHash: receipt.provenance.consensus.txHash,
    blockNumber: receipt.provenance.consensus.blockNumber,
    blockHash: receipt.provenance.consensus.blockHash,
    confirmations: receipt.provenance.consensus.confirmations,
    safeThreshold: receipt.provenance.consensus.safeThreshold,
    finalizedThreshold: receipt.provenance.consensus.finalizedThreshold,
    indexerAcknowledged: receipt.provenance.consensus.indexerAcknowledged,
    contractAddress: receipt.provenance.chain.contractAddress,
    contractName: receipt.provenance.chain.contractName,
    protocolVersion: receipt.provenance.chain.protocolVersion,
    releaseId: receipt.provenance.chain.releaseId,
    gitCommit: receipt.provenance.chain.gitCommit,
    apiVersion: receipt.provenance.chain.apiVersion,
    indexerReference: receipt.provenance.chain.indexerReference,
    isReplaced: receipt.provenance.history.isReplaced,
    replacedBy: receipt.provenance.history.replacedBy,
    originalTxHash: receipt.provenance.history.originalTxHash,
    isReorged: receipt.provenance.history.isReorged,
    orphanedBlockHash: receipt.provenance.history.orphanedBlockHash,
    reorgDetectedAt: receipt.provenance.history.reorgDetectedAt,
    referenceId: receipt.actionDetails.referenceId,
    targetResource: receipt.actionDetails.targetResource,
    parameters: receipt.actionDetails.parameters,
    notes: receipt.actionDetails.notes,
    timestamp: receipt.timestamp,
  });

  // Handle Escape key and focus management
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Initial focus on close button
    closeButtonRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isReplaced = receipt.provenance.history.isReplaced;
  const isReorged = receipt.provenance.history.isReorged;
  const isWarning = isReplaced || isReorged;

  const explorerUrl = receipt.provenance.consensus.txHash
    ? getTransactionExplorerUrl(
        receipt.provenance.consensus.txHash,
        receipt.provenance.chain.chainId,
      )
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-dialog-title"
      aria-describedby="receipt-dialog-desc"
    >
      <div
        ref={modalRef}
        className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl p-6 space-y-6 ${className}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-400" aria-hidden="true" />
              <h2 id="receipt-dialog-title" className="text-lg font-bold text-white tracking-tight">
                Cryptographic Action Receipt
              </h2>
            </div>
            <p id="receipt-dialog-desc" className="text-xs text-slate-400">
              Immutable provenance record for action <span className="font-semibold text-slate-300">{receipt.action}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 text-xs font-semibold uppercase rounded-md border ${
                receipt.status === 'finalized'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : receipt.status === 'safe'
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  : receipt.status === 'reorged' || receipt.status === 'reverted'
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : receipt.status === 'replaced'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              {receipt.status}
            </span>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close receipt modal"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Warning Banner for Replaced / Reorged history */}
        {isWarning && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5"
          >
            <div className="flex items-center gap-2 font-semibold text-amber-400">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <span>Historical Lineage Warning</span>
            </div>
            {isReplaced && (
              <p>
                This transaction was superseded on-chain by replacement transaction:{' '}
                <code className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[11px] text-amber-300">
                  {receipt.provenance.history.replacedBy}
                </code>
              </p>
            )}
            {isReorged && (
              <p>
                This transaction was orphaned during a blockchain reorganization. Orphaned Block Hash:{' '}
                <code className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[11px] text-amber-300">
                  {receipt.provenance.history.orphanedBlockHash ?? 'N/A'}
                </code>
              </p>
            )}
          </div>
        )}

        {/* Provenance & Consensus Details */}
        <div className="space-y-4">
          <section aria-labelledby="section-provenance">
            <h3 id="section-provenance" className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Protocol & Provenance
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-xs bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/80">
              <div>
                <dt className="text-slate-400">Receipt ID</dt>
                <dd className="font-mono text-slate-200 break-all">{receipt.receiptId}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Timestamp (UTC)</dt>
                <dd className="font-mono text-slate-200">{receipt.timestamp}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Chain</dt>
                <dd className="text-slate-200 font-medium">
                  {receipt.provenance.chain.chainName} ({receipt.provenance.chain.chainId})
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Protocol Release</dt>
                <dd className="font-mono text-slate-200">
                  {receipt.provenance.chain.protocolVersion} ({receipt.provenance.chain.releaseId})
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-400">Contract Reference</dt>
                <dd className="font-mono text-slate-300 break-all">
                  {receipt.provenance.chain.contractName} ({receipt.provenance.chain.contractAddress})
                </dd>
              </div>
              {receipt.provenance.consensus.txHash && (
                <div className="sm:col-span-2">
                  <dt className="text-slate-400">Transaction Hash</dt>
                  <dd className="flex items-center gap-2 font-mono text-indigo-300 break-all">
                    <span>{receipt.provenance.consensus.txHash}</span>
                    {explorerUrl && (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs text-indigo-400 hover:text-indigo-300"
                        title="View on Explorer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-slate-400">Block Number</dt>
                <dd className="font-mono text-slate-200">
                  {receipt.provenance.consensus.blockNumber ?? 'Pending'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Confirmations & Finality</dt>
                <dd className="text-slate-200">
                  <span className="font-semibold">{receipt.provenance.consensus.confirmations ?? 0}</span> confs
                  {' · '}
                  <span className="uppercase text-[11px] font-bold text-slate-300">
                    {receipt.provenance.consensus.finalityLevel}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          {/* Action Specifics (Privacy-Safe) */}
          <section aria-labelledby="section-action-data">
            <h3 id="section-action-data" className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Action Parameters (Privacy-Safe)
            </h3>
            <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/80 space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">Reference ID:</span>
                <span className="font-mono text-slate-200">{receipt.actionDetails.referenceId}</span>
              </div>
              {receipt.actionDetails.targetResource && (
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">Target Resource:</span>
                  <span className="font-mono text-slate-200">{receipt.actionDetails.targetResource}</span>
                </div>
              )}
              {receipt.actionDetails.notes && (
                <div className="flex flex-col gap-1 border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">Notes:</span>
                  <p className="text-slate-300 text-xs">{receipt.actionDetails.notes}</p>
                </div>
              )}

              {Object.keys(receipt.actionDetails.parameters).length > 0 && (
                <div className="pt-1 space-y-1">
                  <span className="text-slate-400 block mb-1">Parameters:</span>
                  <div className="space-y-1 pl-2 border-l border-slate-800">
                    {Object.entries(receipt.actionDetails.parameters).map(([key, val]) => (
                      <div key={key} className="flex justify-between font-mono text-[11px]">
                        <span className="text-slate-400">{key}:</span>
                        <span className="text-slate-200">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* SHA-256 Digital Checksum */}
          <section aria-labelledby="section-checksum">
            <div className="flex items-center justify-between bg-indigo-950/30 border border-indigo-900/40 p-3 rounded-xl text-xs">
              <div className="min-w-0 pr-2">
                <span className="text-slate-400 block text-[11px]">SHA-256 Checksum</span>
                <code className="text-indigo-300 font-mono text-[11px] truncate block">
                  SHA256:{receipt.checksum}
                </code>
              </div>
              <button
                type="button"
                onClick={copyChecksum}
                aria-label="Copy receipt checksum"
                className="shrink-0 p-1.5 rounded-lg bg-indigo-900/40 hover:bg-indigo-900/70 text-indigo-200 transition-colors"
              >
                {copiedChecksum ? (
                  <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={downloadJson}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors focus:ring-2 focus:ring-indigo-500"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download JSON</span>
          </button>

          <button
            type="button"
            onClick={downloadText}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors focus:ring-2 focus:ring-indigo-500"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download Text</span>
          </button>

          <button
            type="button"
            onClick={printDocument}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm focus:ring-2 focus:ring-indigo-500"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
