/**
 * UI-FE-080: Deterministic Plain Text & WCAG 2.2 AA Accessible Printable Document Formatter
 *
 * Implements:
 *  - Deterministic plain text export
 *  - Accessible HTML printable document compliant with WCAG 2.2 AA
 *  - Native @media print styling for zero-dependency "Save as PDF" / Print support
 */

import type { CanonicalReceiptRecord } from './types';

/**
 * Format a receipt as deterministic, human-readable plain text.
 */
export function formatReceiptAsText(receipt: CanonicalReceiptRecord): string {
  const lines: string[] = [];

  lines.push('================================================================================');
  lines.push('                      TRUTHBOUNTY PROTOCOL RECEIPT                              ');
  lines.push('================================================================================');
  lines.push('');
  lines.push(`Receipt ID:          ${receipt.receiptId}`);
  lines.push(`Schema Version:      ${receipt.schemaVersion}`);
  lines.push(`Action Type:         ${receipt.action.toUpperCase()}`);
  lines.push(`Lifecycle Status:    ${receipt.status.toUpperCase()}`);
  lines.push(`Timestamp (UTC):     ${receipt.timestamp}`);
  lines.push(`Digital Checksum:    SHA256:${receipt.checksum}`);
  lines.push('');
  lines.push('--------------------------------------------------------------------------------');
  lines.push('PROVENANCE & PROTOCOL RELEASE');
  lines.push('--------------------------------------------------------------------------------');
  lines.push(`Chain:               ${receipt.provenance.chain.chainName} (ID: ${receipt.provenance.chain.chainId})`);
  lines.push(`Protocol Version:    ${receipt.provenance.chain.protocolVersion}`);
  lines.push(`Release ID:          ${receipt.provenance.chain.releaseId}`);
  lines.push(`Git Commit:          ${receipt.provenance.chain.gitCommit}`);
  lines.push(`Contract:            ${receipt.provenance.chain.contractName} (${receipt.provenance.chain.contractAddress})`);
  lines.push(`API Version:         ${receipt.provenance.chain.apiVersion}`);
  if (receipt.provenance.chain.indexerReference) {
    lines.push(`Indexer Reference:   ${receipt.provenance.chain.indexerReference}`);
  }
  lines.push('');
  lines.push('--------------------------------------------------------------------------------');
  lines.push('CONSENSUS & FINALITY');
  lines.push('--------------------------------------------------------------------------------');
  lines.push(`Transaction Hash:    ${receipt.provenance.consensus.txHash ?? 'N/A (pre-inclusion or non-tx action)'}`);
  lines.push(`Block Number:        ${receipt.provenance.consensus.blockNumber ?? 'Pending / Unmined'}`);
  lines.push(`Block Hash:          ${receipt.provenance.consensus.blockHash ?? 'N/A'}`);
  lines.push(`Confirmations:       ${receipt.provenance.consensus.confirmations ?? 0} (Safe: ${receipt.provenance.consensus.safeThreshold}, Finalized: ${receipt.provenance.consensus.finalizedThreshold})`);
  lines.push(`Finality Level:      ${receipt.provenance.consensus.finalityLevel.toUpperCase()}`);
  lines.push(`Indexer Ack:         ${receipt.provenance.consensus.indexerAcknowledged ? 'YES (Verified)' : 'NO'}`);
  lines.push('');

  if (receipt.provenance.history.isReplaced || receipt.provenance.history.isReorged) {
    lines.push('--------------------------------------------------------------------------------');
    lines.push('LINEAGE & HISTORY WARNINGS');
    lines.push('--------------------------------------------------------------------------------');
    if (receipt.provenance.history.isReplaced) {
      lines.push(`[REPLACED] Transaction replaced by: ${receipt.provenance.history.replacedBy}`);
      if (receipt.provenance.history.originalTxHash) {
        lines.push(`Original Hash:       ${receipt.provenance.history.originalTxHash}`);
      }
    }
    if (receipt.provenance.history.isReorged) {
      lines.push('[REORGED] Transaction was subjected to chain reorganization.');
      if (receipt.provenance.history.orphanedBlockHash) {
        lines.push(`Orphaned Block Hash: ${receipt.provenance.history.orphanedBlockHash}`);
      }
      if (receipt.provenance.history.reorgDetectedAt) {
        lines.push(`Reorg Detected At:   ${receipt.provenance.history.reorgDetectedAt}`);
      }
    }
    lines.push('');
  }

  lines.push('--------------------------------------------------------------------------------');
  lines.push('ACTION DETAILS (PRIVACY-SAFE)');
  lines.push('--------------------------------------------------------------------------------');
  lines.push(`Reference ID:        ${receipt.actionDetails.referenceId}`);
  if (receipt.actionDetails.targetResource) {
    lines.push(`Target Resource:     ${receipt.actionDetails.targetResource}`);
  }
  if (receipt.actionDetails.notes) {
    lines.push(`Public Notes:        ${receipt.actionDetails.notes}`);
  }

  const paramKeys = Object.keys(receipt.actionDetails.parameters).sort();
  if (paramKeys.length > 0) {
    lines.push('Parameters:');
    for (const k of paramKeys) {
      lines.push(`  - ${k}: ${String(receipt.actionDetails.parameters[k])}`);
    }
  }

  lines.push('');
  lines.push('================================================================================');
  lines.push('This document was generated deterministically from canonical TruthBounty state.');
  lines.push('================================================================================');

  return lines.join('\n');
}

/**
 * Escape HTML special characters for safe injection-free rendering
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format a receipt as a complete, semantic, WCAG 2.2 AA compliant HTML document
 * ready for accessible screen-reader viewing and native browser printing to PDF.
 */
export function formatReceiptAsPrintableHtml(receipt: CanonicalReceiptRecord): string {
  const isWarning = receipt.provenance.history.isReplaced || receipt.provenance.history.isReorged;

  const paramRows = Object.keys(receipt.actionDetails.parameters)
    .sort()
    .map((key) => {
      const val = receipt.actionDetails.parameters[key];
      return `
        <tr>
          <th scope="row" style="text-align: left; padding: 6px 12px; border: 1px solid #d1d5db; font-family: monospace; font-size: 13px;">${escapeHtml(key)}</th>
          <td style="padding: 6px 12px; border: 1px solid #d1d5db; font-family: monospace; font-size: 13px;">${escapeHtml(String(val))}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Receipt ${escapeHtml(receipt.receiptId)} - TruthBounty</title>
  <style>
    /* WCAG 2.2 AA High Contrast Palette: Black on White with strict >= 4.5:1 ratios */
    :root {
      --bg: #ffffff;
      --text: #111827;
      --text-muted: #4b5563;
      --border: #d1d5db;
      --accent: #0f172a;
      --badge-bg: #f3f4f6;
      --warning-bg: #fef2f2;
      --warning-border: #991b1b;
      --warning-text: #7f1d1d;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
    }
    main {
      max-width: 800px;
      margin: 0 auto;
    }
    header {
      border-bottom: 2px solid var(--text);
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.025em;
      margin-bottom: 4px;
    }
    h2 {
      font-size: 16px;
      font-weight: 600;
      border-bottom: 1px solid var(--border);
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent);
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      background-color: var(--badge-bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
    }
    dl {
      display: grid;
      grid-template-columns: 220px 1fr;
      row-gap: 8px;
      column-gap: 16px;
      font-size: 14px;
    }
    dt {
      font-weight: 600;
      color: var(--text-muted);
    }
    dd {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      word-break: break-all;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    .warning-box {
      background-color: var(--warning-bg);
      border: 2px solid var(--warning-border);
      color: var(--warning-text);
      padding: 12px 16px;
      border-radius: 6px;
      margin: 16px 0;
      font-size: 14px;
    }
    footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-muted);
    }
    /* Native Print Stylesheet for Accessible PDF Generation */
    @media print {
      body {
        padding: 0;
      }
      @page {
        margin: 15mm;
        size: auto;
      }
      .no-print {
        display: none !important;
      }
      section {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
        <div>
          <h1>TruthBounty Transaction & Decision Receipt</h1>
          <p style="color: var(--text-muted); font-size: 13px;">Official Immutable Cryptographic Record</p>
        </div>
        <div style="text-align: right;">
          <span class="badge" aria-label="Status ${escapeHtml(receipt.status)}">${escapeHtml(receipt.status)}</span>
          <p style="font-size: 12px; font-family: monospace; color: var(--text-muted); margin-top: 4px;">Action: ${escapeHtml(receipt.action)}</p>
        </div>
      </div>
    </header>

    ${
      isWarning
        ? `<div class="warning-box" role="alert">
            <strong>Lineage Warning:</strong>
            ${receipt.provenance.history.isReplaced ? `<p>This transaction was superseded on-chain by replacement hash: <code>${escapeHtml(receipt.provenance.history.replacedBy ?? '')}</code></p>` : ''}
            ${receipt.provenance.history.isReorged ? `<p>This transaction was reorganized out of the canonical chain. Orphaned block hash: <code>${escapeHtml(receipt.provenance.history.orphanedBlockHash ?? '')}</code></p>` : ''}
          </div>`
        : ''
    }

    <section aria-labelledby="heading-overview">
      <h2 id="heading-overview">Receipt Metadata</h2>
      <dl>
        <dt>Receipt ID</dt>
        <dd>${escapeHtml(receipt.receiptId)}</dd>
        <dt>Issued Timestamp (UTC)</dt>
        <dd><time datetime="${escapeHtml(receipt.timestamp)}">${escapeHtml(receipt.timestamp)}</time></dd>
        <dt>Digital Fingerprint</dt>
        <dd>SHA256:${escapeHtml(receipt.checksum)}</dd>
      </dl>
    </section>

    <section aria-labelledby="heading-provenance">
      <h2 id="heading-provenance">Provenance & Consensus</h2>
      <dl>
        <dt>Chain</dt>
        <dd>${escapeHtml(receipt.provenance.chain.chainName)} (ID: ${receipt.provenance.chain.chainId})</dd>
        <dt>Protocol Release</dt>
        <dd>${escapeHtml(receipt.provenance.chain.protocolVersion)} (${escapeHtml(receipt.provenance.chain.releaseId)}) [commit: ${escapeHtml(receipt.provenance.chain.gitCommit)}]</dd>
        <dt>Contract Target</dt>
        <dd>${escapeHtml(receipt.provenance.chain.contractName)} (${escapeHtml(receipt.provenance.chain.contractAddress)})</dd>
        <dt>Transaction Hash</dt>
        <dd>${escapeHtml(receipt.provenance.consensus.txHash ?? 'N/A')}</dd>
        <dt>Block Inclusion</dt>
        <dd>${receipt.provenance.consensus.blockNumber ? `Block #${escapeHtml(receipt.provenance.consensus.blockNumber)}` : 'Pending inclusion'}</dd>
        <dt>Block Hash</dt>
        <dd>${escapeHtml(receipt.provenance.consensus.blockHash ?? 'N/A')}</dd>
        <dt>Confirmations</dt>
        <dd>${receipt.provenance.consensus.confirmations ?? 0} (Safe: ${receipt.provenance.consensus.safeThreshold}, Finalized: ${receipt.provenance.consensus.finalizedThreshold})</dd>
        <dt>Finality Provenance</dt>
        <dd><strong>${escapeHtml(receipt.provenance.consensus.finalityLevel.toUpperCase())}</strong> ${receipt.provenance.consensus.indexerAcknowledged ? '(Indexer Acknowledged)' : '(Indexer Pending)'}</dd>
      </dl>
    </section>

    <section aria-labelledby="heading-action">
      <h2 id="heading-action">Action Specifics (Privacy-Safe)</h2>
      <dl>
        <dt>Reference ID</dt>
        <dd>${escapeHtml(receipt.actionDetails.referenceId)}</dd>
        ${
          receipt.actionDetails.targetResource
            ? `<dt>Target Resource</dt><dd>${escapeHtml(receipt.actionDetails.targetResource)}</dd>`
            : ''
        }
        ${
          receipt.actionDetails.notes
            ? `<dt>Public Notes</dt><dd>${escapeHtml(receipt.actionDetails.notes)}</dd>`
            : ''
        }
      </dl>
      ${
        paramRows.length > 0
          ? `<table>
              <caption style="text-align: left; font-weight: 600; font-size: 13px; color: var(--text-muted); margin: 12px 0 6px 0;">Parameters</caption>
              <thead>
                <tr>
                  <th scope="col" style="text-align: left; padding: 6px 12px; background-color: var(--badge-bg); border: 1px solid var(--border); font-size: 13px;">Key</th>
                  <th scope="col" style="text-align: left; padding: 6px 12px; background-color: var(--badge-bg); border: 1px solid var(--border); font-size: 13px;">Value</th>
                </tr>
              </thead>
              <tbody>${paramRows}</tbody>
            </table>`
          : ''
      }
    </section>

    <footer>
      <p>This deterministic receipt reflects verified canonical on-chain and API evidence. Protected vote rationale and private authentication credentials have been excluded.</p>
    </footer>
  </main>
</body>
</html>`;
}
