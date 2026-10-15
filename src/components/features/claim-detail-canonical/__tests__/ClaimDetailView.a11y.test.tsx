/**
 * Accessibility tests for ClaimDetailView components
 * Tests WCAG AA compliance: ARIA roles, keyboard navigation, focus management, screen reader support
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClaimDetailView } from '../ClaimDetailView';
import { ClaimDetailSkeleton } from '../ClaimDetailSkeleton';
import { ClaimNotFound } from '../ClaimNotFound';
import { ClaimDetailError } from '../ClaimDetailError';
import { ClaimStalenessIndicator } from '../ClaimStalenessIndicator';
import * as claimDetailProjectionHook from '@/hooks/useClaimDetailProjection';
import * as claimDetailFreshnessHook from '@/hooks/useClaimDetailFreshness';
import type { ClaimDetailEnvelope } from '@/app/types/claim-detail-projection';

expect.extend(toHaveNoViolations);

// Mock hooks
jest.mock('@/hooks/useClaimDetailProjection');
jest.mock('@/hooks/useClaimDetailFreshness');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const mockUseClaimDetailProjection = claimDetailProjectionHook.useClaimDetailProjection as jest.MockedFunction<
  typeof claimDetailProjectionHook.useClaimDetailProjection
>;

const mockUseClaimDetailFreshness = claimDetailFreshnessHook.useClaimDetailFreshness as jest.MockedFunction<
  typeof claimDetailFreshnessHook.useClaimDetailFreshness
>;

describe('ClaimDetailView Accessibility', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    mockUseClaimDetailFreshness.mockReturnValue({
      status: 'fresh',
      isStale: false,
      isDegraded: false,
      generatedAt: new Date().toISOString(),
      lastUpdated: 'just now',
      reason: null,
      indexedAtBlock: 1000,
      finalizedBlock: 995,
      blockLag: 5,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockEnvelope: ClaimDetailEnvelope = {
    claim: {
      id: 'claim-123',
      title: 'Test Claim',
      description: 'Test description',
      claimantAddress: '0x1234567890123456789012345678901234567890',
      status: 'OPEN',
      bountyAmount: 1.5,
      totalStaked: 0.5,
      evidence: [],
      createdAt: '2026-09-27T00:00:00.000Z',
      updatedAt: '2026-09-27T00:00:00.000Z',
      verifications: [],
      settlement: {
        settledAt: null,
        settlementTxHash: null,
        isFinalized: false,
        finalizedBlock: null,
      },
      claimantReputation: 75,
      voteCounts: { support: 10, reject: 2 },
      confidenceScore: 85,
    },
    projection: {
      freshness: 'fresh',
      generatedAt: new Date().toISOString(),
      indexedAtBlock: 1000,
      finalizedBlock: 995,
    },
  };

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    );
  };

  describe('ARIA roles and attributes', () => {
    it('loading state has correct ARIA attributes', async () => {
      mockUseClaimDetailProjection.mockReturnValue({
        data: null,
        viewState: 'loading',
        isLoading: true,
        isRefetching: false,
        isError: false,
        error: null,
        errorCode: null,
        refetch: jest.fn(),
      });

      const { container } = renderWithProviders(<ClaimDetailView claimId="claim-123" />);

      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute('aria-busy', 'true');
      expect(statusElement).toHaveAttribute('aria-label', 'Loading claim details');

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('error state has correct ARIA alert', async () => {
      mockUseClaimDetailProjection.mockReturnValue({
        data: null,
        viewState: 'error',
        isLoading: false,
        isRefetching: false,
        isError: true,
        error: new Error('Network error'),
        errorCode: 'PROJECTION_UNAVAILABLE',
        refetch: jest.fn(),
      });

      const { container } = renderWithProviders(<ClaimDetailView claimId="claim-123" />);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute('aria-live', 'assertive');

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('not-found state has correct ARIA status', async () => {
      mockUseClaimDetailProjection.mockReturnValue({
        data: null,
        viewState: 'not-found',
        isLoading: false,
        isRefetching: false,
        isError: true,
        error: new Error('Claim not found'),
        errorCode: 'CLAIM_NOT_FOUND',
        refetch: jest.fn(),
      });

      const { container } = renderWithProviders(<ClaimDetailView claimId="claim-123" />);

      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('staleness indicator has correct ARIA attributes', async () => {
      mockUseClaimDetailProjection.mockReturnValue({
        data: mockEnvelope,
        viewState: 'ready-stale',
        isLoading: false,
        isRefetching: false,
        isError: false,
        error: null,
        errorCode: null,
        refetch: jest.fn(),
      });

      mockUseClaimDetailFreshness.mockReturnValue({
        status: 'stale',
        isStale: true,
        isDegraded: false,
        generatedAt: new Date(Date.now() - 60000).toISOString(),
        lastUpdated: '1m ago',
        reason: null,
        indexedAtBlock: 1000,
        finalizedBlock: 995,
        blockLag: 5,
      });

      const { container } = renderWithProviders(<ClaimDetailView claimId="claim-123" />);

      const stalenessStatus = screen.getByText(/data may be out of date/i).closest('[role="status"]');
      expect(stalenessStatus).toHaveAttribute('aria-live', 'polite');

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('ready state has no axe violations', async () => {
      mockUseClaimDetailProjection.mockReturnValue({
        data: mockEnvelope,
        viewState: 'ready',
        isLoading: false,
        isRefetching: false,
        isError: false,
        error: null,
        errorCode: null,
        refetch: jest.fn(),
      });

      const { container } = renderWithProviders(<ClaimDetailView claimId="claim-123" showActions={false} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Focus management', () => {
    it('moves focus to error heading when error appears', async () => {
      const { container } = render(
        <ClaimDetailError
          error={new Error('Test error')}
          errorCode="PROJECTION_UNAVAILABLE"
          onRetry={jest.fn()}
        />
      );

      await waitFor(() => {
        const heading = screen.getByRole('heading', { name: /failed to load claim/i });
        expect(heading).toHaveFocus();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('moves focus to not-found heading when shown', async () => {
      const { container } = render(<ClaimNotFound claimId="claim-123" />);

      await waitFor(() => {
        const heading = screen.getByRole('heading', { name: /claim not found/i });
        expect(heading).toHaveFocus();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('does not trap focus in loading state', () => {
      const { container } = render(<ClaimDetailSkeleton />);

      // Loading state should not trap focus
      const tabbableElements = container.querySelectorAll(
        'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      expect(tabbableElements).toHaveLength(0);
    });
  });

  describe('Keyboard navigation', () => {
    it('retry button is keyboard accessible', async () => {
      const mockRetry = jest.fn();
      render(
        <ClaimDetailError
          error={new Error('Test error')}
          errorCode="PROJECTION_UNAVAILABLE"
          onRetry={mockRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /try again/i });

      // Tab to button
      await userEvent.tab();
      expect(retryButton).toHaveFocus();

      // Activate with Enter
      await userEvent.keyboard('{Enter}');
      expect(mockRetry).toHaveBeenCalledTimes(1);

      mockRetry.mockClear();

      // Activate with Space
      retryButton.focus();
      await userEvent.keyboard(' ');
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('refresh button in staleness indicator is keyboard accessible', async () => {
      const mockRefresh = jest.fn();
      render(
        <ClaimStalenessIndicator
          freshness={{
            status: 'stale',
            isStale: true,
            isDegraded: false,
            generatedAt: new Date().toISOString(),
            lastUpdated: '1m ago',
            reason: null,
            indexedAtBlock: 1000,
            finalizedBlock: 995,
            blockLag: 5,
          }}
          onRefresh={mockRefresh}
        />
      );

      const refreshButton = screen.getByRole('button', { name: /refresh data/i });

      await userEvent.tab();
      expect(refreshButton).toHaveFocus();

      await userEvent.keyboard('{Enter}');
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it('back to claims button is keyboard accessible', async () => {
      render(<ClaimNotFound claimId="claim-123" />);

      const backButton = screen.getByRole('button', { name: /back to claims/i });

      await userEvent.tab();
      // Focus should be on heading first (from focus management)
      await userEvent.tab();
      expect(backButton).toHaveFocus();

      await userEvent.keyboard('{Enter}');
      // Router push would be called here (mocked)
    });

    it('all interactive elements are reachable via Tab', async () => {
      mockUseClaimDetailProjection.mockReturnValue({
        data: mockEnvelope,
        viewState: 'ready-stale',
        isLoading: false,
        isRefetching: false,
        isError: false,
        error: null,
        errorCode: null,
        refetch: jest.fn(),
      });

      mockUseClaimDetailFreshness.mockReturnValue({
        status: 'stale',
        isStale: true,
        isDegraded: false,
        generatedAt: new Date().toISOString(),
        lastUpdated: '1m ago',
        reason: null,
        indexedAtBlock: 1000,
        finalizedBlock: 995,
        blockLag: 5,
      });

      renderWithProviders(<ClaimDetailView claimId="claim-123" showActions={false} />);

      // Should be able to tab to refresh button
      await userEvent.tab();
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      expect(refreshButton).toHaveFocus();
    });
  });

  describe('Screen reader support', () => {
    it('loading state announces to screen readers', () => {
      render(<ClaimDetailSkeleton />);

      const srOnly = screen.getByText(/loading claim details, please wait/i);
      expect(srOnly).toHaveClass('sr-only');
    });

    it('error messages are announced assertively', () => {
      render(
        <ClaimDetailError
          error={new Error('Test error')}
          errorCode="PROJECTION_UNAVAILABLE"
          onRetry={jest.fn()}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it('status badge includes accessible label', async () => {
      mockUseClaimDetailProjection.mockReturnValue({
        data: mockEnvelope,
        viewState: 'ready',
        isLoading: false,
        isRefetching: false,
        isError: false,
        error: null,
        errorCode: null,
        refetch: jest.fn(),
      });

      renderWithProviders(<ClaimDetailView claimId="claim-123" showActions={false} />);

      const statusBadge = screen.getByLabelText(/status: open/i);
      expect(statusBadge).toBeInTheDocument();
    });

    it('evidence links have descriptive labels', async () => {
      const envelopeWithEvidence = {
        ...mockEnvelope,
        claim: {
          ...mockEnvelope.claim,
          evidence: [
            {
              id: 'ev-1',
              type: 'link' as const,
              value: 'https://example.com/evidence',
              createdAt: '2026-09-27T00:00:00.000Z',
            },
          ],
        },
      };

      mockUseClaimDetailProjection.mockReturnValue({
        data: envelopeWithEvidence,
        viewState: 'ready',
        isLoading: false,
        isRefetching: false,
        isError: false,
        error: null,
        errorCode: null,
        refetch: jest.fn(),
      });

      renderWithProviders(<ClaimDetailView claimId="claim-123" showActions={false} />);

      const evidenceLink = screen.getByRole('link', { name: /evidence link 1/i });
      expect(evidenceLink).toBeInTheDocument();
    });
  });

  describe('Reduced motion support', () => {
    it('skeleton respects prefers-reduced-motion', () => {
      // Mock prefers-reduced-motion
      const mockMatchMedia = jest.fn().mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: mockMatchMedia,
      });

      const { container } = render(<ClaimDetailSkeleton />);

      // When prefers-reduced-motion is active, animate-pulse should not be present
      const pulseElements = container.querySelectorAll('.animate-pulse');
      expect(pulseElements).toHaveLength(0);
    });
  });

  describe('Color contrast', () => {
    it('has no color contrast violations', async () => {
      mockUseClaimDetailProjection.mockReturnValue({
        data: mockEnvelope,
        viewState: 'ready',
        isLoading: false,
        isRefetching: false,
        isError: false,
        error: null,
        errorCode: null,
        refetch: jest.fn(),
      });

      const { container } = renderWithProviders(
        <ClaimDetailView claimId="claim-123" showActions={false} />
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Semantic HTML', () => {
    it('uses proper heading hierarchy', async () => {
      mockUseClaimDetailProjection.mockReturnValue({
        data: mockEnvelope,
        viewState: 'ready',
        isLoading: false,
        isRefetching: false,
        isError: false,
        error: null,
        errorCode: null,
        refetch: jest.fn(),
      });

      renderWithProviders(<ClaimDetailView claimId="claim-123" showActions={false} />);

      const h1 = screen.getByRole('heading', { level: 1, name: /test claim/i });
      expect(h1).toBeInTheDocument();

      const h2Elements = screen.getAllByRole('heading', { level: 2 });
      expect(h2Elements.length).toBeGreaterThan(0);
    });

    it('uses list markup for verifications', async () => {
      const envelopeWithVerifications = {
        ...mockEnvelope,
        claim: {
          ...mockEnvelope.claim,
          verifications: [
            {
              id: 'v-1',
              verifierAddress: '0x1234567890123456789012345678901234567890',
              decision: 'SUPPORT' as const,
              stakeAmount: 1,
              timestamp: '2026-09-27T00:00:00.000Z',
            },
          ],
        },
      };

      mockUseClaimDetailProjection.mockReturnValue({
        data: envelopeWithVerifications,
        viewState: 'ready',
        isLoading: false,
        isRefetching: false,
        isError: false,
        error: null,
        errorCode: null,
        refetch: jest.fn(),
      });

      renderWithProviders(<ClaimDetailView claimId="claim-123" showActions={false} />);

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
    });
  });
});
