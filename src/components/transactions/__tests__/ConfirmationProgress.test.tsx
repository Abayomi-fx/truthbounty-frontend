/**
 * ConfirmationProgress Component Tests
 * V2-FE Transaction Confirmation
 *
 * Coverage:
 * - Progress bar rendering with correct percentage
 * - ARIA progressbar attributes (role, aria-valuenow, aria-valuemin, aria-valuemax, aria-label)
 * - Confirmation count display (X / Y format)
 * - Time estimate display
 * - Compact mode (hides progress bar)
 * - Block number display (optional)
 * - Reduced motion support (disables animations)
 * - Screen reader announcements
 */

import { render, screen } from '@testing-library/react';
import { ConfirmationProgress } from '../ConfirmationProgress';

describe('ConfirmationProgress', () => {
  describe('rendering', () => {
    it('renders confirmation count and progress bar', () => {
      render(
        <ConfirmationProgress
          confirmations={5}
          targetConfirmations={12}
        />
      );

      expect(screen.getByText(/confirming/i)).toBeInTheDocument();
      expect(screen.getByText('5 / 12')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('renders time estimate when showTimeEstimate is true', () => {
      render(
        <ConfirmationProgress
          confirmations={5}
          targetConfirmations={12}
          showTimeEstimate={true}
          blockTimeMs={2000}
        />
      );

      // 7 blocks remaining * 2s = 14s
      expect(screen.getByText(/~14s remaining/i)).toBeInTheDocument();
    });

    it('does not render time estimate when disabled', () => {
      render(
        <ConfirmationProgress
          confirmations={5}
          targetConfirmations={12}
          showTimeEstimate={false}
        />
      );

      expect(screen.queryByText(/remaining/i)).not.toBeInTheDocument();
    });

    it('renders block number when provided', () => {
      render(
        <ConfirmationProgress
          confirmations={5}
          targetConfirmations={12}
          blockNumber={12345n}
        />
      );

      expect(screen.getByText(/block #12345/i)).toBeInTheDocument();
    });

    it('does not render block number when not provided', () => {
      render(
        <ConfirmationProgress
          confirmations={5}
          targetConfirmations={12}
        />
      );

      expect(screen.queryByText(/block #/i)).not.toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('hides progress bar in compact mode', () => {
      render(
        <ConfirmationProgress
          confirmations={5}
          targetConfirmations={12}
          compact={true}
        />
      );

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(screen.getByText('5 / 12')).toBeInTheDocument();
    });

    it('shows progress bar in normal mode', () => {
      render(
        <ConfirmationProgress
          confirmations={5}
          targetConfirmations={12}
          compact={false}
        />
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('progress bar', () => {
    it('sets correct ARIA progressbar attributes', () => {
      render(
        <ConfirmationProgress
          confirmations={6}
          targetConfirmations={12}
        />
      );

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '6');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '12');
      expect(progressbar).toHaveAttribute('aria-label', 'Transaction confirming, 6 of 12 confirmations');
    });

    it('calculates correct progress percentage', () => {
      const { rerender } = render(
        <ConfirmationProgress
          confirmations={0}
          targetConfirmations={12}
        />
      );

      let progressBar = screen.getByRole('progressbar').querySelector('div');
      expect(progressBar).toHaveStyle({ width: '0%' });

      rerender(
        <ConfirmationProgress
          confirmations={6}
          targetConfirmations={12}
        />
      );

      progressBar = screen.getByRole('progressbar').querySelector('div');
      expect(progressBar).toHaveStyle({ width: '50%' });

      rerender(
        <ConfirmationProgress
          confirmations={12}
          targetConfirmations={12}
        />
      );

      progressBar = screen.getByRole('progressbar').querySelector('div');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });
  });

  describe('time estimates', () => {
    it('formats time in seconds', () => {
      render(
        <ConfirmationProgress
          confirmations={10}
          targetConfirmations={12}
          blockTimeMs={2000}
        />
      );

      // 2 blocks * 2s = 4s
      expect(screen.getByText(/~4s remaining/i)).toBeInTheDocument();
    });

    it('formats time in minutes', () => {
      render(
        <ConfirmationProgress
          confirmations={0}
          targetConfirmations={60}
          blockTimeMs={2000}
        />
      );

      // 60 blocks * 2s = 120s = 2m
      expect(screen.getByText(/~2m remaining/i)).toBeInTheDocument();
    });

    it('does not show estimate when target reached', () => {
      render(
        <ConfirmationProgress
          confirmations={12}
          targetConfirmations={12}
        />
      );

      expect(screen.queryByText(/remaining/i)).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has accessible label for screen readers', () => {
      render(
        <ConfirmationProgress
          confirmations={5}
          targetConfirmations={12}
        />
      );

      const srOnly = screen.getByRole('status', { hidden: true });
      expect(srOnly).toHaveTextContent('Transaction confirming, 5 of 12 confirmations');
    });

    it('includes time estimate in screen reader announcement', () => {
      render(
        <ConfirmationProgress
          confirmations={5}
          targetConfirmations={12}
          showTimeEstimate={true}
          blockTimeMs={2000}
        />
      );

      const srOnly = screen.getByRole('status', { hidden: true });
      expect(srOnly).toHaveTextContent(/approximately ~14s remaining/i);
    });

    it('has aria-live="polite" for non-disruptive updates', () => {
      render(
        <ConfirmationProgress
          confirmations={5}
          targetConfirmations={12}
        />
      );

      const status = screen.getByRole('status', { hidden: true });
      expect(status).toHaveAttribute('aria-live', 'polite');
    });

    it('has aria-atomic="true" for complete announcements', () => {
      render(
        <ConfirmationProgress
          confirmations={5}
          targetConfirmations={12}
        />
      );

      const status = screen.getByRole('status', { hidden: true });
      expect(status).toHaveAttribute('aria-atomic', 'true');
    });
  });

  describe('spinner animation', () => {
    it('renders animated spinner icon', () => {
      const { container } = render(
        <ConfirmationProgress
          confirmations={5}
          targetConfirmations={12}
        />
      );

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('respects reduced motion preferences', () => {
      const { container } = render(
        <ConfirmationProgress
          confirmations={5}
          targetConfirmations={12}
        />
      );

      const spinner = container.querySelector('.motion-reduce\\:animate-none');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles 0 confirmations', () => {
      render(
        <ConfirmationProgress
          confirmations={0}
          targetConfirmations={12}
        />
      );

      expect(screen.getByText('0 / 12')).toBeInTheDocument();
      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '0');
    });

    it('handles completed progress (confirmations >= target)', () => {
      render(
        <ConfirmationProgress
          confirmations={12}
          targetConfirmations={12}
        />
      );

      expect(screen.getByText('12 / 12')).toBeInTheDocument();
      const progressBar = screen.getByRole('progressbar').querySelector('div');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    it('handles confirmations exceeding target', () => {
      render(
        <ConfirmationProgress
          confirmations={15}
          targetConfirmations={12}
        />
      );

      expect(screen.getByText('15 / 12')).toBeInTheDocument();
      // Progress clamped to 100%
      const progressBar = screen.getByRole('progressbar').querySelector('div');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    it('handles very large block numbers', () => {
      render(
        <ConfirmationProgress
          confirmations={5}
          targetConfirmations={12}
          blockNumber={999999999999999n}
        />
      );

      expect(screen.getByText(/block #999999999999999/i)).toBeInTheDocument();
    });
  });

  describe('custom className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <ConfirmationProgress
          confirmations={5}
          targetConfirmations={12}
          className="custom-class"
        />
      );

      const wrapper = container.querySelector('[data-testid="confirmation-progress"]');
      expect(wrapper).toHaveClass('custom-class');
    });
  });
});
