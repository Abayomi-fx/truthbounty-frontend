/**
 * Component tests for ClaimDetailView
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClaimDetailView } from '../ClaimDetailView';
import * as claimDetailProjectionHook from '@/hooks/useClaimDetailProjection';
import * as claimDetailFreshnessHook from '@/hooks/useClaimDetailFreshness';
import type { ClaimDetailEnvelope } from '@/app/types/claim-detail-projection';

// Mock hooks
jest.mock('@/hooks/useClaimDetailProjection');
jest.mock('@/hooks/useClaimDetailFreshness');

const mockUseClaimDetailProjection = claimDetailProjectionHook.useClaimDetailProjection as jest.MockedFunction<
  typeof claimDetailProjectionHook.useClaimDetailProjection
>;

const mockUseClaimDetailFreshness = claimDetailFreshnessHook.useClaimDetailFreshness as jest.MockedFunction<
  typeof claimDetailFreshnessHook.useClaimDetailFreshness
>;

describe('ClaimDetailView', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Default freshness mock
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
      title: 'Test Claim Title',
      description: 'Test claim description',
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

  describe('loading state', () => {
    it('renders skeleton when loading', () => {
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

      renderWithProviders(<ClaimDetailView claimId="claim-123" />);

      expect(screen.getByRole('status', { name: /loading claim details/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/loading claim details/i)).toBeInTheDocument();
    });
  });

  describe('not-found state', () => {
    it('renders not-found when claim does not exist', () => {
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

      renderWithProviders(<ClaimDetailView claimId="claim-123" />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText(/claim not found/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back to claims/i })).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders error when fetch fails', () => {
      const mockRefetch = jest.fn();
      mockUseClaimDetailProjection.mockReturnValue({
        data: null,
        viewState: 'error',
        isLoading: false,
        isRefetching: false,
        isError: true,
        error: new Error('Network error'),
        errorCode: 'PROJECTION_UNAVAILABLE',
        refetch: mockRefetch,
      });

      renderWithProviders(<ClaimDetailView claimId="claim-123" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load claim/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('calls refetch when retry button clicked', () => {
      const mockRefetch = jest.fn();
      mockUseClaimDetailProjection.mockReturnValue({
        data: null,
        viewState: 'error',
        isLoading: false,
        isRefetching: false,
        isError: true,
        error: new Error('Network error'),
        errorCode: 'PROJECTION_UNAVAILABLE',
        refetch: mockRefetch,
      });

      renderWithProviders(<ClaimDetailView claimId="claim-123" />);

      const retryButton = screen.getByRole('button', { name: /try again/i });
      retryButton.click();

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('ready state', () => {
    it('renders claim details when data is ready', () => {
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

      renderWithProviders(<ClaimDetailView claimId="claim-123" />);

      expect(screen.getByText('Test Claim Title')).toBeInTheDocument();
      expect(screen.getByText('Test claim description')).toBeInTheDocument();
      expect(screen.getByText(/open/i)).toBeInTheDocument();
    });

    it('does not show staleness indicator in ready state', () => {
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

      renderWithProviders(<ClaimDetailView claimId="claim-123" />);

      expect(screen.queryByText(/data may be out of date/i)).not.toBeInTheDocument();
    });
  });

  describe('ready-stale state', () => {
    it('shows staleness indicator when projection is stale', () => {
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

      renderWithProviders(<ClaimDetailView claimId="claim-123" />);

      expect(screen.getByText(/data may be out of date/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('calls refetch when refresh button clicked', () => {
      const mockRefetch = jest.fn();
      mockUseClaimDetailProjection.mockReturnValue({
        data: mockEnvelope,
        viewState: 'ready-stale',
        isLoading: false,
        isRefetching: false,
        isError: false,
        error: null,
        errorCode: null,
        refetch: mockRefetch,
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

      renderWithProviders(<ClaimDetailView claimId="claim-123" />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      refreshButton.click();

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('actions', () => {
    it('shows actions by default', () => {
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

      renderWithProviders(<ClaimDetailView claimId="claim-123" />);

      // Actions should be rendered (mocked wallet will be tested separately)
      expect(screen.getByText(/verify/i)).toBeInTheDocument();
      expect(screen.getByText(/dispute/i)).toBeInTheDocument();
    });

    it('hides actions when showActions is false', () => {
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

      expect(screen.queryByText(/verify/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/dispute/i)).not.toBeInTheDocument();
    });
  });

  describe('polling', () => {
    it('enables polling by default', () => {
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

      renderWithProviders(<ClaimDetailView claimId="claim-123" />);

      expect(mockUseClaimDetailProjection).toHaveBeenCalledWith(
        expect.objectContaining({
          refetchInterval: undefined, // undefined means use default polling logic
        })
      );
    });

    it('disables polling when enablePolling is false', () => {
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

      renderWithProviders(<ClaimDetailView claimId="claim-123" enablePolling={false} />);

      expect(mockUseClaimDetailProjection).toHaveBeenCalledWith(
        expect.objectContaining({
          refetchInterval: false,
        })
      );
    });
  });
});
