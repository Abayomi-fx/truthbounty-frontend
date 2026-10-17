/**
 * UI-FE-080 Required Test:
 * PDF/print accessibility and WCAG 2.2 AA compliance tests
 * for receipt modal, button, and printable document format.
 */

import React from 'react';
import { render, screen, fireEvent } from '../../../__tests__/utils/test-utils';
import { assertAccessible } from '../../../__tests__/utils/axe';
import { TransactionReceiptModal } from '../TransactionReceiptModal';
import { TransactionReceiptButton } from '../TransactionReceiptButton';
import { generateReceipt, formatReceiptAsPrintableHtml } from '@/lib/receipts';
import type { RawReceiptInput } from '@/lib/receipts/types';

const MOCK_INPUT: RawReceiptInput = {
  action: 'claim',
  status: 'safe',
  chainId: 11155420,
  txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  blockNumber: '100234',
  blockHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  confirmations: 2,
  referenceId: 'claim-a11y-test-1',
  parameters: {
    claimant: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    rewardAmountEth: '0.25',
  },
  timestamp: '2026-10-15T14:00:00.000Z',
};

describe('UI-FE-080: WCAG 2.2 AA Accessibility Checks', () => {
  it('TransactionReceiptModal has 0 axe violations when open', async () => {
    const receipt = generateReceipt(MOCK_INPUT);
    const { container } = render(
      <TransactionReceiptModal
        receipt={receipt}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'receipt-dialog-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'receipt-dialog-desc');

    await assertAccessible(container);
  });

  it('TransactionReceiptButton has 0 axe violations', async () => {
    const { container } = render(
      <TransactionReceiptButton
        input={MOCK_INPUT}
        label="Download Receipt"
      />
    );

    const btn = screen.getByRole('button', { name: /Open downloadable receipt for claim/i });
    expect(btn).toBeInTheDocument();

    await assertAccessible(container);
  });

  it('TransactionReceiptModal handles Escape key to dismiss', () => {
    const handleClose = jest.fn();
    const receipt = generateReceipt(MOCK_INPUT);
    render(
      <TransactionReceiptModal
        receipt={receipt}
        isOpen={true}
        onClose={handleClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('Printable document HTML is semantically structured and passes DOM accessibility audit', async () => {
    const receipt = generateReceipt(MOCK_INPUT);
    const htmlString = formatReceiptAsPrintableHtml(receipt);

    // Verify key print / WCAG AA semantic tags
    expect(htmlString).toContain('<!DOCTYPE html>');
    expect(htmlString).toContain('<html lang="en">');
    expect(htmlString).toContain('@media print');
    expect(htmlString).toContain('<main>');
    expect(htmlString).toContain('<h1');
    expect(htmlString).toContain('<dl>');
    expect(htmlString).toContain('<time datetime="');

    // Parse the inner body content to run an axe assertion
    const bodyMatch = htmlString.match(/<body>([\s\S]*?)<\/body>/);
    const bodyContent = bodyMatch ? bodyMatch[1] : htmlString;

    const div = document.createElement('div');
    div.innerHTML = bodyContent;
    document.body.appendChild(div);

    try {
      await assertAccessible(div);
    } finally {
      document.body.removeChild(div);
    }
  });

  it('Modal renders warning alert role when replaced or reorged', async () => {
    const reorgedReceipt = generateReceipt({
      ...MOCK_INPUT,
      action: 'retry',
      status: 'reorged',
      isReorged: true,
      orphanedBlockHash: '0x9999888877776666555544443333222211110000aaaabbbbccccddddeeeeffff',
    });

    const { container } = render(
      <TransactionReceiptModal
        receipt={reorgedReceipt}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/Historical Lineage Warning/i);

    await assertAccessible(container);
  });
});
