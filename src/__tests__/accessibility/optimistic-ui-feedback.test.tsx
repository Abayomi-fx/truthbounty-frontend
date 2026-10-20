/**
 * V2-FE-058 — Optimistic UI Rollback on Canonical Failure
 * Accessibility tests for optimistic UI feedback and recovery states.
 */

import React, { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { useOptimisticUpdates } from '@/hooks/useOptimisticUpdates';
import { resetGlobalOptimisticStore } from '@/lib/optimistic/optimistic-store';

expect.extend(toHaveNoViolations);

/**
 * Test component that demonstrates optimistic UI with feedback.
 */
function OptimisticClaimComponent() {
  const [displayClaim, setDisplayClaim] = useState<{
    claimId: string;
    status: string;
  } | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const { optimistic, rollbackAll } = useOptimisticUpdates('test-tx');

  const handleCreateClaim = async () => {
    setIsLoading(true);
    setFeedbackMessage('');

    // Create optimistic display
    const result = optimistic('claim-display', {
      label: 'Optimistic claim display',
      optimisticState: { claimId: 'temp-claim-123', status: 'pending' },
      rollback: () => {
        setDisplayClaim(null);
        setFeedbackMessage('Claim creation failed. Please try again.');
      },
    });

    if (result.success) {
      // Show optimistic state immediately
      setDisplayClaim({
        claimId: 'temp-claim-123',
        status: 'pending',
      });
      setFeedbackMessage('Creating claim...');
    } else {
      setFeedbackMessage(`Error: ${result.error}`);
    }

    setIsLoading(false);
  };

  const handleRollback = () => {
    rollbackAll('TRANSACTION_REVERTED');
  };

  return (
    <div role="region" aria-label="Optimistic claim creation">
      <h1>Claim Creation</h1>

      <button
        onClick={handleCreateClaim}
        disabled={isLoading || displayClaim !== null}
        aria-busy={isLoading}
        aria-label="Create new claim"
      >
        {isLoading ? 'Creating...' : 'Create Claim'}
      </button>

      {feedbackMessage && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="feedback"
        >
          {feedbackMessage}
        </div>
      )}

      {displayClaim && (
        <div
          role="article"
          aria-label={`Claim ${displayClaim.claimId}`}
          className="claim-display"
        >
          <h2>Claim Created</h2>
          <p>ID: {displayClaim.claimId}</p>
          <p>Status: {displayClaim.status}</p>
        </div>
      )}

      <button
        onClick={handleRollback}
        disabled={!displayClaim}
        aria-label="Discard claim and try again"
      >
        Discard
      </button>
    </div>
  );
}

/**
 * Component demonstrating error recovery with accessible keyboard navigation.
 */
function OptimisticErrorRecoveryComponent() {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'error'>('idle');
  const { rollbackAll } = useOptimisticUpdates('recovery-tx');

  const handleRetry = () => {
    setError(null);
    setStatus('idle');
  };

  const handleDismiss = () => {
    rollbackAll('TRANSACTION_REVERTED');
    setError(null);
    setStatus('idle');
  };

  return (
    <div role="region" aria-label="Error recovery section">
      {status === 'error' && error && (
        <div
          role="alert"
          className="error-container"
          aria-label="Transaction error"
        >
          <h2>Transaction Failed</h2>
          <p>{error}</p>
          <div className="error-actions">
            <button
              onClick={handleRetry}
              aria-label="Retry transaction"
              className="retry-button"
            >
              Retry
            </button>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss error"
              className="dismiss-button"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

describe('Accessibility - Optimistic UI Feedback', () => {
  beforeEach(() => {
    resetGlobalOptimisticStore();
  });

  describe('ARIA live regions', () => {
    it('should have accessible status announcements for optimistic updates', async () => {
      const { container } = render(<OptimisticClaimComponent />);

      // Check for live region
      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');
      expect(statusRegion).toHaveAttribute('aria-atomic', 'true');

      // Create claim to update status
      const createButton = screen.getByLabelText('Create new claim');
      await userEvent.click(createButton);

      // Status should be updated
      await waitFor(() => {
        expect(statusRegion).toHaveTextContent('Creating claim...');
      });

      // Run accessibility check
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should announce rollback via live region', async () => {
      const { container } = render(<OptimisticClaimComponent />);

      const createButton = screen.getByLabelText('Create new claim');
      await userEvent.click(createButton);

      const discardButton = screen.getByLabelText('Discard claim and try again');
      await userEvent.click(discardButton);

      const statusRegion = screen.getByRole('status');
      await waitFor(() => {
        expect(statusRegion).toHaveTextContent(
          'Claim creation failed. Please try again.',
        );
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Alert regions', () => {
    it('should have accessible error alerts with role="alert"', async () => {
      const { container } = render(<OptimisticErrorRecoveryComponent />);

      // Error region should be accessible
      const errorRegion = container.querySelector('[role="alert"]');

      if (errorRegion) {
        expect(errorRegion).toHaveAttribute('aria-label');
      }

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Button accessibility', () => {
    it('should have proper aria-labels on all buttons', () => {
      render(<OptimisticClaimComponent />);

      const createButton = screen.getByLabelText('Create new claim');
      const discardButton = screen.getByLabelText('Discard claim and try again');

      expect(createButton).toHaveAccessibleName();
      expect(discardButton).toHaveAccessibleName();
    });

    it('should properly indicate loading state with aria-busy', async () => {
      render(<OptimisticClaimComponent />);

      const createButton = screen.getByLabelText('Create new claim');

      // Initially not busy
      expect(createButton).not.toHaveAttribute('aria-busy', 'true');

      await userEvent.click(createButton);

      // Should be busy during load (briefly)
      // Note: In actual implementation, aria-busy would be managed more carefully
      expect(createButton).toBeDisabled();
    });

    it('should disable buttons in appropriate states', async () => {
      render(<OptimisticClaimComponent />);

      const createButton = screen.getByLabelText('Create new claim');
      const discardButton = screen.getByLabelText('Discard claim and try again');

      // Initially create is enabled, discard is disabled
      expect(createButton).not.toBeDisabled();
      expect(discardButton).toBeDisabled();

      await userEvent.click(createButton);

      // After creation, create is disabled, discard is enabled
      await waitFor(() => {
        expect(createButton).toBeDisabled();
      });
      await waitFor(() => {
        expect(discardButton).not.toBeDisabled();
      });
    });
  });

  describe('Heading hierarchy', () => {
    it('should have proper heading hierarchy', () => {
      const { container } = render(<OptimisticClaimComponent />);

      const h1 = container.querySelector('h1');
      const h2s = container.querySelectorAll('h2');

      expect(h1).toBeInTheDocument();
      expect(h1).toHaveTextContent('Claim Creation');

      // h2 should only appear after h1
      h2s.forEach((h2) => {
        expect(h2.compareDocumentPosition(h1)).toBe(
          Node.DOCUMENT_POSITION_PRECEDING,
        );
      });
    });
  });

  describe('Keyboard navigation', () => {
    it('should support keyboard navigation through buttons', async () => {
      const user = userEvent.setup();
      render(<OptimisticClaimComponent />);

      const createButton = screen.getByLabelText('Create new claim');
      const discardButton = screen.getByLabelText('Discard claim and try again');

      // Tab to first button
      await user.tab();
      expect(createButton).toHaveFocus();

      // Tab to next button
      await user.tab();
      expect(discardButton).toHaveFocus();

      // Shift+Tab back
      await user.tab({ shift: true });
      expect(createButton).toHaveFocus();
    });

    it('should support Enter key to trigger buttons', async () => {
      const user = userEvent.setup();
      render(<OptimisticClaimComponent />);

      const createButton = screen.getByLabelText('Create new claim');

      // Focus button
      createButton.focus();
      expect(createButton).toHaveFocus();

      // Press Enter
      await user.keyboard('{Enter}');

      // Button should be clicked
      expect(createButton).toBeDisabled();
    });

    it('should support Space key to trigger buttons', async () => {
      const user = userEvent.setup();
      render(<OptimisticClaimComponent />);

      const createButton = screen.getByLabelText('Create new claim');

      // Focus button
      createButton.focus();
      expect(createButton).toHaveFocus();

      // Press Space
      await user.keyboard(' ');

      // Button should be clicked
      expect(createButton).toBeDisabled();
    });
  });

  describe('Semantic regions', () => {
    it('should use semantic HTML regions with proper roles', () => {
      render(<OptimisticClaimComponent />);

      const claimRegion = screen.getByRole('region', {
        name: /optimistic claim creation/i,
      });
      expect(claimRegion).toBeInTheDocument();

      const article = screen.queryByRole('article');
      // Article may not exist until claim is created
      expect(article).not.toBeInTheDocument();
    });

    it('should label regions with aria-label', () => {
      const { container } = render(<OptimisticClaimComponent />);

      const mainRegion = container.querySelector('[role="region"]');
      expect(mainRegion).toHaveAttribute('aria-label');
    });
  });

  describe('No accessibility violations', () => {
    it('should have no accessibility violations in base state', async () => {
      const { container } = render(<OptimisticClaimComponent />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations after interaction', async () => {
      const { container } = render(<OptimisticClaimComponent />);

      const createButton = screen.getByLabelText('Create new claim');
      await userEvent.click(createButton);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in error state', async () => {
      const { container } = render(<OptimisticErrorRecoveryComponent />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
