/**
 * Accessibility tests for TransactionStatusBadge
 * 
 * Verifies ARIA live regions, role attributes, screen reader announcements,
 * keyboard navigation, and WCAG 2.1 AA compliance.
 */

import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { TransactionStatusBadge, TransactionStatusBadgeCompact } from '../TransactionStatusBadge';
import type { TransactionStatus } from '@/lib/transaction-machine';

expect.extend(toHaveNoViolations);

describe('TransactionStatusBadge Accessibility', () => {
  const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as const;
  const mockReplacedBy = '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321' as const;

  describe('WCAG 2.1 AA Compliance', () => {
    const allStates: TransactionStatus[] = [
      'idle',
      'preparing',
      'signature-requested',
      'submitted',
      'confirming',
      'safe',
      'indexing',
      'finalized',
      'dropped',
      'replaced',
      'reverted',
    ];

    it.each(allStates)('has no axe violations for %s state', async (status) => {
      const { container } = render(<TransactionStatusBadge status={status} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no axe violations with all optional props', async () => {
      const { container } = render(
        <TransactionStatusBadge
          status="replaced"
          txHash={mockTxHash}
          replacedBy={mockReplacedBy}
          confirmations={5}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('compact variant has no axe violations', async () => {
      const { container } = render(<TransactionStatusBadgeCompact status="finalized" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no axe violations in dark theme context', async () => {
      const { container } = render(
        <div className="dark">
          <TransactionStatusBadge status="confirming" txHash={mockTxHash} confirmations={3} />
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('ARIA Live Regions', () => {
    it('idle state has aria-live="off" (no announcements)', () => {
      const { container } = render(<TransactionStatusBadge status="idle" />);
      const liveRegion = container.querySelector('[aria-live="off"]');
      expect(liveRegion).toBeInTheDocument();
    });

    it('pending states have aria-live="polite" (non-interruptive)', () => {
      const pendingStates: TransactionStatus[] = [
        'preparing',
        'signature-requested',
        'submitted',
        'confirming',
        'safe',
        'indexing',
      ];

      pendingStates.forEach((status) => {
        const { container } = render(<TransactionStatusBadge status={status} />);
        const liveRegion = container.querySelector('[aria-live="polite"]');
        expect(liveRegion).toBeInTheDocument();
      });
    });

    it('terminal success states have aria-live="assertive" (immediate)', () => {
      const { container } = render(<TransactionStatusBadge status="finalized" />);
      const liveRegion = container.querySelector('[aria-live="assertive"]');
      expect(liveRegion).toBeInTheDocument();
    });

    it('terminal failure states have aria-live="assertive" (immediate)', () => {
      const failureStates: TransactionStatus[] = ['dropped', 'replaced', 'reverted'];

      failureStates.forEach((status) => {
        const { container } = render(<TransactionStatusBadge status={status} />);
        const liveRegion = container.querySelector('[aria-live="assertive"]');
        expect(liveRegion).toBeInTheDocument();
      });
    });

    it('sets aria-atomic="true" for complete announcements', () => {
      const { container } = render(<TransactionStatusBadge status="confirming" />);
      const liveRegion = container.querySelector('[aria-atomic="true"]');
      expect(liveRegion).toBeInTheDocument();
    });
  });

  describe('Role Attributes', () => {
    it('uses role="status" for status updates', () => {
      render(<TransactionStatusBadge status="submitted" />);
      const statusElement = screen.getByRole('status');
      expect(statusElement).toBeInTheDocument();
    });

    it('role="status" is present on all state variants', () => {
      const states: TransactionStatus[] = [
        'idle',
        'preparing',
        'submitted',
        'confirming',
        'finalized',
        'dropped',
      ];

      states.forEach((status) => {
        const { unmount } = render(<TransactionStatusBadge status={status} />);
        const statusElement = screen.getByRole('status');
        expect(statusElement).toBeInTheDocument();
        unmount();
      });
    });

    it('compact variant also uses role="status"', () => {
      render(<TransactionStatusBadgeCompact status="finalized" />);
      const statusElement = screen.getByRole('status');
      expect(statusElement).toBeInTheDocument();
    });
  });

  describe('Screen Reader Content', () => {
    it('provides descriptive label and description', () => {
      render(<TransactionStatusBadge status="confirming" />);
      expect(screen.getByText('Confirming')).toBeInTheDocument();
      expect(screen.getByText('Waiting for confirmations')).toBeInTheDocument();
    });

    it('compact variant provides full description via aria-label', () => {
      const { container } = render(<TransactionStatusBadgeCompact status="confirming" />);
      const badge = container.querySelector('[aria-label]');
      expect(badge?.getAttribute('aria-label')).toContain('Confirming');
      expect(badge?.getAttribute('aria-label')).toContain('Waiting for confirmations');
    });

    it('hides decorative icons from screen readers', () => {
      const { container } = render(<TransactionStatusBadge status="submitted" />);
      const hiddenIcons = container.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenIcons.length).toBeGreaterThan(0);
    });

    it('includes transaction hash in accessible content', () => {
      render(<TransactionStatusBadge status="submitted" txHash={mockTxHash} />);
      const hashText = screen.getByText(/0x12345678.*abcdef/);
      expect(hashText).toBeInTheDocument();
      expect(hashText).not.toHaveAttribute('aria-hidden');
    });

    it('includes confirmations count in accessible content', () => {
      render(<TransactionStatusBadge status="confirming" confirmations={3} />);
      const confirmText = screen.getByText('3 confirmations');
      expect(confirmText).toBeInTheDocument();
      expect(confirmText).not.toHaveAttribute('aria-hidden');
    });

    it('includes replacement information in accessible content', () => {
      render(
        <TransactionStatusBadge
          status="replaced"
          txHash={mockTxHash}
          replacedBy={mockReplacedBy}
        />
      );
      const replacementText = screen.getByText(/Replaced by/);
      expect(replacementText).toBeInTheDocument();
      expect(replacementText).not.toHaveAttribute('aria-hidden');
    });
  });

  describe('Semantic HTML', () => {
    it('uses semantic div with proper role', () => {
      const { container } = render(<TransactionStatusBadge status="submitted" />);
      const statusElement = container.querySelector('[role="status"]');
      expect(statusElement?.tagName).toBe('DIV');
    });

    it('uses semantic span for compact variant', () => {
      const { container } = render(<TransactionStatusBadgeCompact status="submitted" />);
      const statusElement = container.querySelector('[role="status"]');
      expect(statusElement?.tagName).toBe('SPAN');
    });

    it('uses proper heading hierarchy (no invalid headings)', () => {
      const { container } = render(<TransactionStatusBadge status="confirming" />);
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
      expect(headings.length).toBe(0); // Badge should not use headings
    });
  });

  describe('Focus Management', () => {
    it('badge is not focusable (status announcements only)', () => {
      const { container } = render(<TransactionStatusBadge status="submitted" />);
      const badge = container.querySelector('[role="status"]');
      expect(badge).not.toHaveAttribute('tabindex');
    });

    it('does not trap focus', () => {
      const { container } = render(<TransactionStatusBadge status="confirming" />);
      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      expect(focusableElements.length).toBe(0);
    });
  });

  describe('Color Contrast', () => {
    it('applies sufficient contrast classes for idle state', () => {
      const { container } = render(<TransactionStatusBadge status="idle" />);
      expect(container.querySelector('.text-slate-400')).toBeInTheDocument();
      expect(container.querySelector('.bg-slate-800')).toBeInTheDocument();
    });

    it('applies sufficient contrast classes for pending states', () => {
      const { container } = render(<TransactionStatusBadge status="submitted" />);
      expect(container.querySelector('.text-blue-300')).toBeInTheDocument();
      expect(container.querySelector('.bg-blue-950')).toBeInTheDocument();
    });

    it('applies sufficient contrast classes for success state', () => {
      const { container } = render(<TransactionStatusBadge status="finalized" />);
      expect(container.querySelector('.text-green-300')).toBeInTheDocument();
      expect(container.querySelector('.bg-green-950')).toBeInTheDocument();
    });

    it('applies sufficient contrast classes for error states', () => {
      const { container } = render(<TransactionStatusBadge status="reverted" />);
      expect(container.querySelector('.text-red-300')).toBeInTheDocument();
      expect(container.querySelector('.bg-red-950')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('maintains accessibility with custom className', () => {
      const { container } = render(
        <TransactionStatusBadge status="confirming" className="custom-responsive" />
      );
      const badge = container.querySelector('[role="status"]');
      expect(badge).toHaveClass('custom-responsive');
      expect(badge?.getAttribute('aria-live')).toBe('polite');
    });

    it('compact variant maintains accessibility', () => {
      const { container } = render(
        <TransactionStatusBadgeCompact status="submitted" className="mobile-variant" />
      );
      const badge = container.querySelector('[role="status"]');
      expect(badge).toHaveClass('mobile-variant');
      expect(badge?.getAttribute('aria-label')).toBeTruthy();
    });
  });

  describe('State Change Announcements', () => {
    it('announces state transitions via live region', () => {
      const { rerender } = render(<TransactionStatusBadge status="submitted" />);
      const statusBefore = screen.getByRole('status');
      expect(statusBefore).toBeInTheDocument();

      rerender(<TransactionStatusBadge status="confirming" confirmations={1} />);
      const statusAfter = screen.getByRole('status');
      expect(statusAfter).toBeInTheDocument();
      expect(screen.getByText('Confirming')).toBeInTheDocument();
    });

    it('announces terminal success with assertive priority', () => {
      const { rerender } = render(<TransactionStatusBadge status="indexing" />);
      
      rerender(<TransactionStatusBadge status="finalized" />);
      const finalStatus = screen.getByRole('status');
      expect(finalStatus.getAttribute('aria-live')).toBe('assertive');
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('announces terminal failure with assertive priority', () => {
      const { rerender } = render(<TransactionStatusBadge status="submitted" />);
      
      rerender(<TransactionStatusBadge status="dropped" />);
      const droppedStatus = screen.getByRole('status');
      expect(droppedStatus.getAttribute('aria-live')).toBe('assertive');
      expect(screen.getByText('Dropped')).toBeInTheDocument();
    });
  });

  describe('Error Recovery Patterns', () => {
    it('provides accessible error information', () => {
      render(<TransactionStatusBadge status="reverted" txHash={mockTxHash} />);
      expect(screen.getByText('Reverted')).toBeInTheDocument();
      expect(screen.getByText('Transaction execution failed on-chain')).toBeInTheDocument();
    });

    it('distinguishes between failure types accessibly', () => {
      const { rerender } = render(<TransactionStatusBadge status="dropped" />);
      expect(screen.getByText('Dropped')).toBeInTheDocument();
      expect(screen.getByText('Transaction dropped from mempool')).toBeInTheDocument();

      rerender(<TransactionStatusBadge status="reverted" />);
      expect(screen.getByText('Reverted')).toBeInTheDocument();
      expect(screen.getByText('Transaction execution failed on-chain')).toBeInTheDocument();

      rerender(<TransactionStatusBadge status="replaced" />);
      expect(screen.getByText('Replaced')).toBeInTheDocument();
      expect(screen.getByText('Transaction replaced by another')).toBeInTheDocument();
    });
  });

  describe('Multiple Instances', () => {
    it('each instance has independent live region', () => {
      render(
        <>
          <TransactionStatusBadge status="submitted" />
          <TransactionStatusBadge status="confirming" />
          <TransactionStatusBadge status="finalized" />
        </>
      );

      const statusElements = screen.getAllByRole('status');
      expect(statusElements).toHaveLength(3);
      statusElements.forEach((element) => {
        expect(element).toHaveAttribute('aria-live');
        expect(element).toHaveAttribute('aria-atomic', 'true');
      });
    });

    it('compact and full variants can coexist accessibly', () => {
      render(
        <>
          <TransactionStatusBadge status="confirming" />
          <TransactionStatusBadgeCompact status="submitted" />
        </>
      );

      const statusElements = screen.getAllByRole('status');
      expect(statusElements).toHaveLength(2);
    });
  });
});
