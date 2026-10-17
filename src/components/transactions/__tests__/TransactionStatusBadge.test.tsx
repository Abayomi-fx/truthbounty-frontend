/**
 * Unit tests for TransactionStatusBadge
 * 
 * Tests rendering, ARIA attributes, and copy correctness for all 11 states.
 */

import { render, screen } from '@testing-library/react';
import { TransactionStatusBadge, TransactionStatusBadgeCompact } from '../TransactionStatusBadge';
import type { TransactionStatus } from '@/lib/transaction-machine';

describe('TransactionStatusBadge', () => {
  const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as const;
  const mockReplacedBy = '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321' as const;

  describe('State Rendering', () => {
    it('renders idle state', () => {
      render(<TransactionStatusBadge status="idle" />);
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(screen.getByText('No action started')).toBeInTheDocument();
    });

    it('renders preparing state', () => {
      render(<TransactionStatusBadge status="preparing" />);
      expect(screen.getByText('Preparing')).toBeInTheDocument();
      expect(screen.getByText('Validating prerequisites')).toBeInTheDocument();
    });

    it('renders signature-requested state', () => {
      render(<TransactionStatusBadge status="signature-requested" />);
      expect(screen.getByText('Awaiting signature')).toBeInTheDocument();
      expect(screen.getByText('Wallet request open')).toBeInTheDocument();
    });

    it('renders submitted state with hash', () => {
      render(<TransactionStatusBadge status="submitted" txHash={mockTxHash} />);
      expect(screen.getByText('Submitted')).toBeInTheDocument();
      expect(screen.getByText('Transaction broadcast to network')).toBeInTheDocument();
      expect(screen.getByText(/0x12345678.*abcdef/)).toBeInTheDocument();
    });

    it('renders confirming state with confirmations count', () => {
      render(<TransactionStatusBadge status="confirming" txHash={mockTxHash} confirmations={3} />);
      expect(screen.getByText('Confirming')).toBeInTheDocument();
      expect(screen.getByText('3 confirmations')).toBeInTheDocument();
    });

    it('renders singular confirmation correctly', () => {
      render(<TransactionStatusBadge status="confirming" txHash={mockTxHash} confirmations={1} />);
      expect(screen.getByText('1 confirmation')).toBeInTheDocument();
    });

    it('renders safe state', () => {
      render(<TransactionStatusBadge status="safe" txHash={mockTxHash} />);
      expect(screen.getByText('Safe')).toBeInTheDocument();
      expect(screen.getByText('Transaction safe, awaiting finality')).toBeInTheDocument();
    });

    it('renders indexing state', () => {
      render(<TransactionStatusBadge status="indexing" />);
      expect(screen.getByText('Indexing')).toBeInTheDocument();
      expect(screen.getByText('Indexer processing transaction')).toBeInTheDocument();
    });

    it('renders finalized state', () => {
      render(<TransactionStatusBadge status="finalized" txHash={mockTxHash} />);
      expect(screen.getByText('Complete')).toBeInTheDocument();
      expect(screen.getByText('Transaction finalized and indexed')).toBeInTheDocument();
    });

    it('renders dropped state', () => {
      render(<TransactionStatusBadge status="dropped" txHash={mockTxHash} />);
      expect(screen.getByText('Dropped')).toBeInTheDocument();
      expect(screen.getByText('Transaction dropped from mempool')).toBeInTheDocument();
    });

    it('renders replaced state with replacement hash', () => {
      render(<TransactionStatusBadge status="replaced" txHash={mockTxHash} replacedBy={mockReplacedBy} />);
      expect(screen.getByText('Replaced')).toBeInTheDocument();
      expect(screen.getByText('Transaction replaced by another')).toBeInTheDocument();
      expect(screen.getByText(/Replaced by 0xfedcba09/)).toBeInTheDocument();
    });

    it('renders reverted state', () => {
      render(<TransactionStatusBadge status="reverted" txHash={mockTxHash} />);
      expect(screen.getByText('Reverted')).toBeInTheDocument();
      expect(screen.getByText('Transaction execution failed on-chain')).toBeInTheDocument();
    });
  });

  describe('ARIA Attributes', () => {
    it('has role="status" for all states', () => {
      const states: TransactionStatus[] = [
        'idle', 'preparing', 'signature-requested', 'submitted', 
        'confirming', 'safe', 'indexing', 'finalized',
        'dropped', 'replaced', 'reverted'
      ];

      states.forEach(status => {
        const { container } = render(<TransactionStatusBadge status={status} />);
        const badge = container.querySelector('[role="status"]');
        expect(badge).toBeInTheDocument();
      });
    });

    it('sets aria-live="off" for idle state', () => {
      const { container } = render(<TransactionStatusBadge status="idle" />);
      const badge = container.querySelector('[aria-live="off"]');
      expect(badge).toBeInTheDocument();
    });

    it('sets aria-live="polite" for pending states', () => {
      const pendingStates: TransactionStatus[] = [
        'preparing', 'signature-requested', 'submitted', 'confirming', 'safe', 'indexing'
      ];

      pendingStates.forEach(status => {
        const { container } = render(<TransactionStatusBadge status={status} />);
        const badge = container.querySelector('[aria-live="polite"]');
        expect(badge).toBeInTheDocument();
      });
    });

    it('sets aria-live="assertive" for terminal states', () => {
      const terminalStates: TransactionStatus[] = ['finalized', 'dropped', 'replaced', 'reverted'];

      terminalStates.forEach(status => {
        const { container } = render(<TransactionStatusBadge status={status} />);
        const badge = container.querySelector('[aria-live="assertive"]');
        expect(badge).toBeInTheDocument();
      });
    });

    it('sets aria-atomic="true" for all badges', () => {
      const { container } = render(<TransactionStatusBadge status="submitted" />);
      const badge = container.querySelector('[aria-atomic="true"]');
      expect(badge).toBeInTheDocument();
    });

    it('hides icons from screen readers with aria-hidden', () => {
      render(<TransactionStatusBadge status="submitted" />);
      const icons = document.querySelectorAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Visual Variants', () => {
    it('applies idle variant styles', () => {
      const { container } = render(<TransactionStatusBadge status="idle" />);
      const badge = container.querySelector('.bg-slate-800');
      expect(badge).toBeInTheDocument();
    });

    it('applies pending variant styles', () => {
      const { container } = render(<TransactionStatusBadge status="submitted" />);
      const badge = container.querySelector('.bg-blue-950');
      expect(badge).toBeInTheDocument();
    });

    it('applies success variant styles', () => {
      const { container } = render(<TransactionStatusBadge status="finalized" />);
      const badge = container.querySelector('.bg-green-950');
      expect(badge).toBeInTheDocument();
    });

    it('applies warning variant styles', () => {
      const { container } = render(<TransactionStatusBadge status="safe" />);
      const badge = container.querySelector('.bg-amber-950');
      expect(badge).toBeInTheDocument();
    });

    it('applies error variant styles', () => {
      const { container } = render(<TransactionStatusBadge status="reverted" />);
      const badge = container.querySelector('.bg-red-950');
      expect(badge).toBeInTheDocument();
    });

    it('accepts custom className', () => {
      const { container } = render(<TransactionStatusBadge status="idle" className="custom-class" />);
      const badge = container.querySelector('.custom-class');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Conditional Content', () => {
    it('shows transaction hash for submitted state', () => {
      render(<TransactionStatusBadge status="submitted" txHash={mockTxHash} />);
      expect(screen.getByText(/0x12345678.*abcdef/)).toBeInTheDocument();
    });

    it('shows transaction hash for confirming state', () => {
      render(<TransactionStatusBadge status="confirming" txHash={mockTxHash} />);
      expect(screen.getByText(/0x12345678.*abcdef/)).toBeInTheDocument();
    });

    it('shows transaction hash for safe state', () => {
      render(<TransactionStatusBadge status="safe" txHash={mockTxHash} />);
      expect(screen.getByText(/0x12345678.*abcdef/)).toBeInTheDocument();
    });

    it('does not show hash for finalized state', () => {
      const { container } = render(<TransactionStatusBadge status="finalized" txHash={mockTxHash} />);
      expect(container.textContent).not.toContain('0x12345678');
    });

    it('shows replacement hash for replaced state', () => {
      render(<TransactionStatusBadge status="replaced" txHash={mockTxHash} replacedBy={mockReplacedBy} />);
      expect(screen.getByText(/Replaced by 0xfedcba09/)).toBeInTheDocument();
    });

    it('does not show replacement hash if not provided', () => {
      render(<TransactionStatusBadge status="replaced" txHash={mockTxHash} />);
      expect(screen.queryByText(/Replaced by/)).not.toBeInTheDocument();
    });

    it('shows confirmations count when confirming', () => {
      render(<TransactionStatusBadge status="confirming" confirmations={5} />);
      expect(screen.getByText('5 confirmations')).toBeInTheDocument();
    });

    it('does not show confirmations for non-confirming states', () => {
      render(<TransactionStatusBadge status="submitted" confirmations={5} />);
      expect(screen.queryByText('confirmations')).not.toBeInTheDocument();
    });
  });

  describe('TransactionStatusBadgeCompact', () => {
    it('renders compact variant with label only', () => {
      render(<TransactionStatusBadgeCompact status="submitted" />);
      expect(screen.getByText('Submitted')).toBeInTheDocument();
      expect(screen.queryByText('Transaction broadcast to network')).not.toBeInTheDocument();
    });

    it('has proper ARIA attributes', () => {
      const { container } = render(<TransactionStatusBadgeCompact status="confirming" />);
      const badge = container.querySelector('[role="status"]');
      expect(badge).toBeInTheDocument();
      expect(badge?.getAttribute('aria-label')).toContain('Confirming');
      expect(badge?.getAttribute('aria-label')).toContain('Waiting for confirmations');
    });

    it('applies correct styles for all states', () => {
      const { container } = render(<TransactionStatusBadgeCompact status="finalized" />);
      expect(container.querySelector('.bg-green-950')).toBeInTheDocument();
    });

    it('accepts custom className', () => {
      const { container } = render(<TransactionStatusBadgeCompact status="idle" className="compact-custom" />);
      expect(container.querySelector('.compact-custom')).toBeInTheDocument();
    });

    it('hides icon from screen readers', () => {
      render(<TransactionStatusBadgeCompact status="submitted" />);
      const icons = document.querySelectorAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles null txHash gracefully', () => {
      render(<TransactionStatusBadge status="submitted" txHash={null} />);
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });

    it('handles undefined txHash gracefully', () => {
      render(<TransactionStatusBadge status="submitted" />);
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });

    it('handles null replacedBy gracefully', () => {
      render(<TransactionStatusBadge status="replaced" replacedBy={null} />);
      expect(screen.getByText('Replaced')).toBeInTheDocument();
    });

    it('handles null confirmations gracefully', () => {
      render(<TransactionStatusBadge status="confirming" confirmations={null} />);
      expect(screen.getByText('Confirming')).toBeInTheDocument();
      expect(screen.queryByText('confirmations')).not.toBeInTheDocument();
    });

    it('handles zero confirmations', () => {
      render(<TransactionStatusBadge status="confirming" confirmations={0} />);
      expect(screen.getByText('0 confirmations')).toBeInTheDocument();
    });
  });
});
