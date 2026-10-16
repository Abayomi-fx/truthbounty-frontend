'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, AlertTriangle, X, CheckCircle2, Lock } from 'lucide-react';
import type { OperationalQueueItem } from '@/app/types/admin';

export interface OperationConfirmModalProps {
  operation: OperationalQueueItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (operationId: string, confirmationText: string) => Promise<void>;
}

export function OperationConfirmModal({
  operation,
  isOpen,
  onClose,
  onConfirm,
}: OperationConfirmModalProps) {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmationInput('');
      setError(null);
      setIsSubmitting(false);
      // Autofocus input
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !operation) return null;

  const isHighRisk = operation.risk === 'high';
  const isInputValid = confirmationInput.trim() === 'CONFIRM';

  const handleExecute = async () => {
    if (!isInputValid) {
      setError('Please type "CONFIRM" to authorize this high-impact action.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirm(operation.id, confirmationInput.trim());
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in"
      data-testid="operation-confirm-modal"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isHighRisk ? 'bg-destructive/15 text-destructive' : 'bg-amber-500/15 text-amber-500'
              }`}
            >
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h3 id="confirm-modal-title" className="text-base font-bold text-foreground">
                Authorize Bounded Operation
              </h3>
              <p className="text-xs text-muted-foreground font-mono">{operation.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close confirmation dialog"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Operation Details & Authority Breakdown */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2.5 text-xs">
          <div>
            <span className="text-muted-foreground font-medium">Operation:</span>
            <p className="text-foreground font-semibold mt-0.5">{operation.title}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
            <div>
              <span className="text-muted-foreground font-medium">Required Authority:</span>
              <p className="text-primary font-mono font-semibold mt-0.5">{operation.authority}</p>
            </div>
            <div>
              <span className="text-muted-foreground font-medium">Risk Level:</span>
              <p
                className={`font-semibold capitalize mt-0.5 ${
                  isHighRisk ? 'text-destructive' : 'text-amber-500'
                }`}
              >
                {operation.risk} Risk
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-border/40">
            <span className="text-muted-foreground font-medium">Target Resource:</span>
            <p className="text-foreground font-mono mt-0.5">{operation.targetResource}</p>
          </div>

          <div className="pt-2 border-t border-border/40">
            <span className="text-muted-foreground font-medium">Impact & Consequence:</span>
            <p id="confirm-modal-desc" className="text-foreground/90 mt-0.5 leading-relaxed">
              {operation.consequence}
            </p>
          </div>

          <div className="pt-2 border-t border-border/40 flex items-center gap-1.5 text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Audit Trail: Immutable cryptographic receipt will be generated.</span>
          </div>
        </div>

        {/* Invariant Statement */}
        <div className="flex items-start gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5 text-xs text-muted-foreground">
          <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Strict Protocol Invariant: This action cannot alter claim verdicts, move user escrow balances, or bypass consensus.
          </span>
        </div>

        {/* Type "CONFIRM" prompt */}
        <div className="space-y-2">
          <label htmlFor="confirm-input" className="block text-xs font-semibold text-foreground">
            Type <span className="font-mono text-primary font-bold">CONFIRM</span> to execute:
          </label>
          <input
            id="confirm-input"
            ref={inputRef}
            type="text"
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.target.value)}
            placeholder="CONFIRM"
            autoComplete="off"
            className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-primary transition-all"
          />
          {error && <p className="text-xs text-destructive font-medium">{error}</p>}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-accent transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={!isInputValid || isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span>Authorizing…</span>
            ) : (
              <span>Authorize & Execute</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
