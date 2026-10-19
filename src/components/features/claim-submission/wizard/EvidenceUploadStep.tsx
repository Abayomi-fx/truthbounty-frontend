/**
 * Evidence Upload Step (Step 2 of 5) — UI-FE-012
 *
 * Presentation composition for evidence selection/upload in the claim
 * submission wizard. Exposes:
 *  - File drag-and-drop and URL input selection.
 *  - CID/source integrity (SHA-256 digest match, content-addressed reference).
 *  - Availability gating: missing upload adapter renders unavailable, never
 *    simulated success.
 *  - Explicit privacy/secrets warnings (protected evidence).
 *  - Exact integer file sizes and source metadata preserved.
 *
 * Authority model: The UI never fabricates upload success. When the upload
 * adapter is not pinned, the selection controls are disabled with
 * aria-disabled="true" and explanatory copy — never a silent no-op.
 */

'use client';

import React, { useRef, useState, useCallback } from 'react';
import {
  Upload,
  Link as LinkIcon,
  FileCheck2,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  X,
  RefreshCw,
} from 'lucide-react';
import type {
  EvidenceUploadStepProps,
  EvidenceUploadStepState,
  EvidenceIntegrity,
  EvidenceSourceMetadata,
} from './types';
import { EVIDENCE_PRIVACY_NOTICE } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an exact byte count to a human-readable string (no rounding of the integer). */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${unitIndex === 0 ? size : size.toFixed(1)} ${units[unitIndex]}`;
}

/** Format the upload progress as an integer percentage string. */
function formatProgress(progress: number): string {
  return `${Math.floor(progress)}%`;
}

/** Map the evidence state to a human-readable status message for screen readers. */
function getStatusMessage(state: EvidenceUploadStepState): string {
  switch (state.status) {
    case 'idle':
      return 'Ready to upload evidence.';
    case 'validating':
      return 'Validating file.';
    case 'hashing':
      return `Calculating file integrity locally. ${formatProgress(state.progress)}`;
    case 'uploading':
      return `Uploading. ${formatProgress(state.progress)} sent. Not confirmed yet.`;
    case 'verifying':
      return 'Verifying integrity against the server-reported digest.';
    case 'verified':
      return `Evidence verified. Content identifier: ${state.integrity.contentIdentifier}.`;
    case 'url-verified':
      return `URL evidence verified: ${state.source.sanitizedLabel}.`;
    case 'failed':
      return state.error;
    case 'cancelled':
      return 'Upload cancelled. Nothing was submitted.';
    case 'invalidated':
      return state.reason;
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Privacy notice block. Always visible so the user can review the privacy
 * guarantees and the secrets/protected-evidence warning at every step.
 */
function PrivacyNotice() {
  return (
    <div
      data-testid="evidence-privacy-notice"
      className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-2"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-blue-400" aria-hidden="true" />
        <p className="text-sm font-semibold text-blue-200">
          {EVIDENCE_PRIVACY_NOTICE.title}
        </p>
      </div>
      <ul className="list-disc list-inside space-y-1 text-xs text-blue-200/80">
        {EVIDENCE_PRIVACY_NOTICE.points.map((point, index) => (
          <li key={index}>{point}</li>
        ))}
      </ul>
      <div className="flex items-start gap-2 mt-2 pt-2 border-t border-blue-500/20">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-amber-200/90" data-testid="evidence-secret-warning">
          {EVIDENCE_PRIVACY_NOTICE.secretWarning}
        </p>
      </div>
    </div>
  );
}

/**
 * Progress indicator for hashing/uploading states. Uses ARIA progressbar.
 */
function ProgressIndicator({
  progress,
  label,
}: {
  progress: number;
  label: string;
}) {
  return (
    <div className="space-y-1" data-testid="evidence-progress">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className="tabular-nums">{formatProgress(progress)}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.floor(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="w-full h-2 bg-[#232329] rounded-full overflow-hidden"
      >
        <div
          className="h-full bg-orange-500 transition-all motion-reduce:transition-none"
          style={{ width: `${Math.min(progress, 100)}%` }}
          data-testid="evidence-progress-bar"
        />
      </div>
    </div>
  );
}

/**
 * Verified evidence card showing CID/source integrity.
 */
function VerifiedEvidenceCard({
  state,
}: {
  state:
    | { status: 'verified'; integrity: EvidenceIntegrity }
    | { status: 'url-verified'; source: EvidenceSourceMetadata };
}) {
  if (state.status === 'verified') {
    const { integrity } = state;
    return (
      <div
        data-testid="evidence-verified-card"
        className="rounded-lg border border-green-500/40 bg-green-500/5 p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-green-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-green-300">Evidence verified</p>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">File:</dt>
            <dd className="text-white font-mono text-xs break-all">
              {integrity.sanitizedFileName}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Size:</dt>
            <dd className="text-white tabular-nums" data-testid="evidence-file-size">
              {formatBytes(integrity.fileSizeBytes)}
              <span className="text-slate-500 ml-1">({integrity.fileSizeBytes} bytes)</span>
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Type:</dt>
            <dd className="text-white">{integrity.mimeType}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Integrity:</dt>
            <dd className="text-green-400" data-testid="evidence-integrity-status">
              {integrity.integrityVerified ? 'SHA-256 verified ✓' : 'Not verified'}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-slate-400">Content identifier (CID):</dt>
            <dd
              className="text-white font-mono text-xs break-all bg-[#232329] rounded px-2 py-1"
              data-testid="evidence-cid"
            >
              {integrity.contentIdentifier}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  // url-verified
  const { source } = state;
  return (
    <div
      data-testid="evidence-url-verified-card"
      className="rounded-lg border border-green-500/40 bg-green-500/5 p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <LinkIcon className="w-5 h-5 text-green-400" aria-hidden="true" />
        <p className="text-sm font-semibold text-green-300">URL evidence verified</p>
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">Source:</dt>
          <dd className="text-white" data-testid="evidence-source-label">
            {source.sanitizedLabel}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">Valid:</dt>
          <dd className="text-green-400" data-testid="evidence-url-valid">
            {source.isValid ? 'HTTPS validated ✓' : 'Invalid'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Error / failed state card with optional retry button.
 */
function FailedCard({
  state,
  onRetry,
  onReset,
}: {
  state: { status: 'failed'; error: string; retryable: boolean };
  onRetry: () => void;
  onReset: () => void;
}) {
  return (
    <div
      data-testid="evidence-failed-card"
      className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 space-y-3"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-red-300" role="alert" data-testid="evidence-error-message">
          {state.error}
        </p>
      </div>
      <div className="flex gap-2">
        {state.retryable && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
            data-testid="evidence-retry-button"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Retry upload
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-300 bg-[#232329] hover:bg-[#2a2a32] rounded-lg transition-colors"
          data-testid="evidence-choose-again-button"
        >
          Choose file again
        </button>
      </div>
    </div>
  );
}

/**
 * Cancelled / invalidated state card.
 */
function CancelledCard({
  message,
  onReset,
  testId,
}: {
  message: string;
  onReset: () => void;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3"
    >
      <div className="flex items-start gap-2">
        <X className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-amber-300" role="status">
          {message}
        </p>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-300 bg-[#232329] hover:bg-[#2a2a32] rounded-lg transition-colors"
        data-testid="evidence-choose-again-button"
      >
        Choose file again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EvidenceUploadStep({
  state,
  uploadAvailable,
  canProceed,
  onFileSelect,
  onUrlEnter,
  onRetry,
  onCancel,
  onReset,
  onNext,
  onBack,
  onCancelWizard,
}: EvidenceUploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [urlValue, setUrlValue] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const adapterMissing = !uploadAvailable.available;
  const isBusy =
    state.status === 'validating' ||
    state.status === 'hashing' ||
    state.status === 'uploading' ||
    state.status === 'verifying';
  const isTerminal =
    state.status === 'verified' ||
    state.status === 'url-verified' ||
    state.status === 'failed' ||
    state.status === 'cancelled' ||
    state.status === 'invalidated';

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
      e.target.value = '';
    },
    [onFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (adapterMissing || isBusy) return;
      const file = e.dataTransfer.files?.[0];
      if (file) onFileSelect(file);
    },
    [adapterMissing, isBusy, onFileSelect],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!adapterMissing && !isBusy) setDragActive(true);
    },
    [adapterMissing, isBusy],
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleUrlSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!urlValue.trim()) return;
      try {
        const parsed = new URL(urlValue.trim());
        if (parsed.protocol !== 'https:') {
          setUrlError('URL must use HTTPS.');
          return;
        }
        setUrlError(null);
        onUrlEnter(urlValue.trim());
      } catch {
        setUrlError('Enter a valid URL.');
      }
    },
    [urlValue, onUrlEnter],
  );

  const statusMessage = getStatusMessage(state);

  return (
    <div className="space-y-6" data-testid="evidence-upload-step">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Evidence Upload</h3>
        <p className="text-sm text-slate-400">
          Upload an evidence file or provide an evidence URL. All evidence is
          cryptographically verified before it can be used.
        </p>
      </div>

      {/* Screen reader live region */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="evidence-sr-status">
        {statusMessage}
      </div>

      {/* Adapter unavailable notice */}
      {adapterMissing && (
        <div
          data-testid="evidence-adapter-unavailable"
          role="alert"
          className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 space-y-2"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-amber-200">
                Evidence upload is unavailable
              </p>
              <p className="text-xs text-amber-200/80 mt-1">
                {uploadAvailable.available === false && uploadAvailable.reason}
              </p>
              {uploadAvailable.available === false && uploadAvailable.adapterIssue && (
                <p className="text-xs text-amber-200/60 mt-1">
                  Tracked under adapter issue {uploadAvailable.adapterIssue}.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* File selection (drag & drop) */}
      {!isTerminal && (
        <div>
          <label
            htmlFor="evidence-file-input"
            className="block text-sm font-medium text-slate-200 mb-2"
          >
            Upload evidence file
          </label>
          <div
            data-testid="evidence-dropzone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${dragActive && !adapterMissing ? 'border-orange-500 bg-orange-500/10' : 'border-[#2a2a32]'}
              ${adapterMissing ? 'opacity-50' : 'cursor-pointer hover:border-orange-500/50'}
            `}
          >
            <input
              ref={fileInputRef}
              id="evidence-file-input"
              type="file"
              className="sr-only"
              disabled={adapterMissing || isBusy}
              onChange={handleFileChange}
              aria-describedby="evidence-file-hint"
              accept="application/pdf,image/png,image/jpeg,video/mp4,video/webm"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={adapterMissing || isBusy}
              aria-disabled={adapterMissing || isBusy}
              aria-label="Choose evidence file to upload"
              className={`
                inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${adapterMissing || isBusy
                  ? 'bg-[#232329] text-slate-500 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'}
              `}
              data-testid="evidence-choose-file-button"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              Choose file
            </button>
            <p id="evidence-file-hint" className="mt-2 text-xs text-slate-500">
              Drag and drop a file here, or click to browse. Supported: PDF, PNG,
              JPG, MP4, WebM. Max 50 MB.
            </p>
          </div>
        </div>
      )}

      {/* URL input */}
      {!isTerminal && (
        <div>
          <label htmlFor="evidence-url-input" className="block text-sm font-medium text-slate-200 mb-2">
            Or provide an evidence URL
          </label>
          <form onSubmit={handleUrlSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
              <input
                ref={urlInputRef}
                id="evidence-url-input"
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                disabled={adapterMissing || isBusy}
                placeholder="https://example.com/evidence"
                className={`
                  w-full pl-10 pr-4 py-2 bg-[#232329] border rounded-lg text-white placeholder-slate-500
                  focus:outline-none focus:ring-2 transition-colors
                  ${urlError
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-[#2a2a32] focus:ring-orange-500/50'}
                  ${adapterMissing || isBusy ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                aria-invalid={!!urlError}
                aria-describedby={urlError ? 'evidence-url-error' : undefined}
                data-testid="evidence-url-input"
              />
            </div>
            <button
              type="submit"
              disabled={adapterMissing || isBusy || !urlValue.trim()}
              aria-disabled={adapterMissing || isBusy || !urlValue.trim()}
              className={`
                px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${adapterMissing || isBusy || !urlValue.trim()
                  ? 'bg-[#232329] text-slate-500 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'}
              `}
              data-testid="evidence-url-submit"
            >
              Verify URL
            </button>
          </form>
          {urlError && (
            <p id="evidence-url-error" className="mt-1 text-xs text-red-400" role="alert">
              {urlError}
            </p>
          )}
        </div>
      )}

      {/* In-progress states */}
      {state.status === 'validating' && (
        <div
          data-testid="evidence-validating"
          className="flex items-center gap-2 text-sm text-slate-300"
          role="status"
          aria-busy="true"
        >
          <Loader2 className="w-4 h-4 animate-spin text-orange-400" aria-hidden="true" />
          Validating file…
        </div>
      )}

      {state.status === 'hashing' && (
        <ProgressIndicator progress={state.progress} label="Calculating file integrity locally" />
      )}

      {state.status === 'uploading' && (
        <div className="space-y-2">
          <ProgressIndicator progress={state.progress} label="Uploading evidence" />
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-300 bg-[#232329] hover:bg-[#2a2a32] rounded-lg transition-colors"
            data-testid="evidence-cancel-button"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Cancel upload
          </button>
        </div>
      )}

      {state.status === 'verifying' && (
        <div
          data-testid="evidence-verifying"
          className="flex items-center gap-2 text-sm text-slate-300"
          role="status"
          aria-busy="true"
        >
          <Loader2 className="w-4 h-4 animate-spin text-orange-400" aria-hidden="true" />
          Verifying integrity against the server-reported digest…
        </div>
      )}

      {/* Terminal states */}
      {state.status === 'verified' && (
        <VerifiedEvidenceCard state={state} />
      )}
      {state.status === 'url-verified' && (
        <VerifiedEvidenceCard state={state} />
      )}
      {state.status === 'failed' && (
        <FailedCard state={state} onRetry={onRetry} onReset={onReset} />
      )}
      {state.status === 'cancelled' && (
        <CancelledCard
          testId="evidence-cancelled-card"
          message="Upload cancelled. Nothing was submitted."
          onReset={onReset}
        />
      )}
      {state.status === 'invalidated' && (
        <CancelledCard
          testId="evidence-invalidated-card"
          message={state.reason}
          onReset={onReset}
        />
      )}

      {/* Privacy notice — always visible */}
      <PrivacyNotice />

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-[#232329]">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancelWizard}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canProceed}
            aria-disabled={!canProceed}
            className={`
              px-6 py-2 text-sm font-medium rounded-lg transition-colors
              ${canProceed
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-[#232329] text-slate-500 cursor-not-allowed'}
            `}
            data-testid="evidence-next-button"
          >
            Next: Review
          </button>
        </div>
      </div>
    </div>
  );
}
