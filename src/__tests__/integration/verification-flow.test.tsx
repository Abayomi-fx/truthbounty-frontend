import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient } from '@tanstack/react-query'
import { render, createMockClaim, createMockVerification } from '../utils/test-utils'
import { setupMockServer } from '../mocks/server'
import VerificationActions from '@/components/features/claim-verification/VerificationActions'
import { StakeForm } from '@/components/features/claim-verification/StakeForm'
import { ClaimDetails } from '@/components/features/claim-verification/ClaimDetails'

// Setup mock server
const server = setupMockServer()

// Mock the wallet functions
jest.mock('@/app/lib/wallet', () => ({
  getTokenBalance: jest.fn(() => Promise.resolve(100)),
}))

// Mock the API functions
jest.mock('@/app/lib/api', () => ({
  submitVerification: jest.fn(),
}))

describe('Verification Flow Integration Tests', () => {
  let queryClient: QueryClient
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    user = userEvent.setup()
  })

  describe('Verification Actions', () => {
    it('should verify a claim successfully', async () => {
      const mockVerification = createMockVerification({ decision: 'VERIFY' })
      const { submitVerification } = require('@/app/lib/api')
      submitVerification.mockResolvedValue(mockVerification)

      render(
        <VerificationActions claimId="claim-1" stakeAmount={50} />,
        { queryClient }
      )

      // Click verify button
      const verifyButton = screen.getByRole('button', { name: 'Verify' })
      await user.click(verifyButton)

      // Wait for success
      await waitFor(() => {
        expect(submitVerification).toHaveBeenCalledWith({
          claimId: 'claim-1',
          decision: 'verify',
          stakeAmount: 50,
        })
      })

      expect(screen.getByText(/verification submitted/i)).toBeInTheDocument()
    })

    it('should reject a claim successfully', async () => {
      const mockVerification = createMockVerification({ decision: 'REJECT' })
      const { submitVerification } = require('@/app/lib/api')
      submitVerification.mockResolvedValue(mockVerification)

      render(
        <VerificationActions claimId="claim-1" stakeAmount={50} />,
        { queryClient }
      )

      // Click reject button
      const rejectButton = screen.getByRole('button', { name: 'Reject' })
      await user.click(rejectButton)

      // Wait for success
      await waitFor(() => {
        expect(submitVerification).toHaveBeenCalledWith({
          claimId: 'claim-1',
          decision: 'reject',
          stakeAmount: 50,
        })
      })

      expect(screen.getByText(/verification submitted/i)).toBeInTheDocument()
    })

    it('should handle verification errors gracefully', async () => {
      const { submitVerification } = require('@/app/lib/api')
      submitVerification.mockRejectedValue(new Error('Verification failed'))

      render(
        <VerificationActions claimId="claim-1" stakeAmount={50} />,
        { queryClient }
      )

      // Click verify button
      const verifyButton = screen.getByRole('button', { name: 'Verify' })
      await user.click(verifyButton)

      // Check for error status
      await waitFor(() => {
        expect(screen.getByText(/transaction failed/i)).toBeInTheDocument()
      })
    })

    it('should show loading state during verification', async () => {
      const { submitVerification } = require('@/app/lib/api')
      // Never settle: the assertion observes the in-flight state deterministically
      // instead of racing a timer.
      submitVerification.mockImplementation(() => new Promise(() => {}))

      render(
        <VerificationActions claimId="claim-1" stakeAmount={50} />,
        { queryClient }
      )

      // Click verify button
      const verifyButton = screen.getByRole('button', { name: 'Verify' })
      await user.click(verifyButton)

      // Check for loading state. The protocol boundary also surfaces a
      // "lifecycle pending" line, so target the transaction status region.
      const pendingStatus = await screen.findByText(/transaction pending/i);
      expect(pendingStatus).toHaveAttribute('role', 'status');
      expect(pendingStatus).toHaveAttribute('aria-live', 'polite');
    })
  })

  describe('Stake Form', () => {
    it('should display token balance', async () => {
      render(
        <StakeForm claimId="claim-1" />,
        { queryClient }
      )

      // Wait for balance to load
      await waitFor(() => {
        expect(
          screen.getByText((_, el) => el?.textContent?.replace(/\s+/g, ' ').trim() === 'Balance: 100 TBNT')
        ).toBeInTheDocument()
      })
    })

    it('should validate stake amount against balance', async () => {
      render(
        <StakeForm claimId="claim-1" />,
        { queryClient }
      )

      // Enter amount greater than balance
      const stakeInput = screen.getByPlaceholderText('Enter stake amount')
      await user.type(stakeInput, '150')

      // Check for insufficient balance warning
      await waitFor(() => {
        expect(screen.getByText(/Insufficient balance/)).toBeInTheDocument()
      })
    })

    it('should allow valid stake amount', async () => {
      render(
        <StakeForm claimId="claim-1" />,
        { queryClient }
      )

      // Enter valid amount
      const stakeInput = screen.getByPlaceholderText('Enter stake amount')
      await user.type(stakeInput, '50')

      // Should not show insufficient balance warning
      expect(screen.queryByText(/Insufficient balance/)).not.toBeInTheDocument()
    })

    it('should handle empty stake amount', async () => {
      render(
        <StakeForm claimId="claim-1" />,
        { queryClient }
      )

      // Input should be empty initially
      const stakeInput = screen.getByPlaceholderText('Enter stake amount')
      expect((stakeInput as HTMLInputElement).value).toBe('')

      // Should not show insufficient balance warning
      expect(screen.queryByText(/Insufficient balance/)).not.toBeInTheDocument()
    })
  })

  describe('Claim Details', () => {
    it('should display claim information', () => {
      const mockClaim = createMockClaim({
        id: 'claim-1',
        title: 'Test Claim Title',
        description: 'Test claim description',
        status: 'OPEN',
        bountyAmount: 100,
        totalStaked: 50,
      })

      render(
        <ClaimDetails claim={mockClaim} />,
        { queryClient }
      )

      expect(screen.getByText('Test Claim Title')).toBeInTheDocument()
      expect(screen.getByText('Test claim description')).toBeInTheDocument()
      expect(screen.getByText('OPEN')).toBeInTheDocument()
    })

    it('should display claim with evidence', () => {
      const mockClaim = createMockClaim({
        evidence: [
          { id: 'evidence-1', type: 'link', value: 'https://example.com', createdAt: '2024-01-01T00:00:00Z' },
          { id: 'evidence-2', type: 'text', value: 'Some text evidence', createdAt: '2024-01-01T00:00:00Z' },
        ],
      })

      render(
        <ClaimDetails claim={mockClaim} />,
        { queryClient }
      )

      expect(screen.getByText('https://example.com')).toBeInTheDocument()
      expect(screen.getByText('Some text evidence')).toBeInTheDocument()
    })

    it('should handle claim with no evidence', () => {
      const mockClaim = createMockClaim({ evidence: [] })

      render(
        <ClaimDetails claim={mockClaim} />,
        { queryClient }
      )

      // Should not crash and should display claim info
      expect(screen.getByText(mockClaim.title)).toBeInTheDocument()
    })
  })

  describe('Full Verification Flow', () => {
    it('should complete full verification workflow', async () => {
      // Mock successful verification
      const mockVerification = createMockVerification()
      const { submitVerification } = require('@/app/lib/api')
      submitVerification.mockResolvedValue(mockVerification)

      const mockClaim = createMockClaim({
        id: 'claim-1',
        title: 'Claim to Verify',
        status: 'OPEN',
      })

      // Render full verification components
      render(
        <div>
          <ClaimDetails claim={mockClaim} />
          <StakeForm claimId="claim-1" />
          <VerificationActions claimId="claim-1" stakeAmount={50} />
        </div>,
        { queryClient }
      )

      // 1. View claim details
      expect(screen.getByText('Claim to Verify')).toBeInTheDocument()
      expect(screen.getByText('OPEN')).toBeInTheDocument()

      // 2. Check stake form
      await waitFor(() => {
        expect(
          screen.getByText((_, el) => el?.textContent?.replace(/\s+/g, ' ').trim() === 'Balance: 100 TBNT')
        ).toBeInTheDocument()
      })

      // 3. Enter stake amount
      const stakeInput = screen.getByPlaceholderText('Enter stake amount')
      await user.type(stakeInput, '50')

      // 4. Submit verification
      const verifyButton = screen.getByRole('button', { name: 'Verify' })
      await user.click(verifyButton)

      // 5. Check for success
      await waitFor(() => {
        expect(submitVerification).toHaveBeenCalledWith({
          claimId: 'claim-1',
          decision: 'verify',
          stakeAmount: 50,
        })
      })
    })

    it('should handle verification with rejection', async () => {
      const mockVerification = createMockVerification({ decision: 'REJECT' })
      const { submitVerification } = require('@/app/lib/api')
      submitVerification.mockResolvedValue(mockVerification)

      const mockClaim = createMockClaim({
        id: 'claim-1',
        title: 'Claim to Reject',
        status: 'OPEN',
      })

      render(
        <div>
          <ClaimDetails claim={mockClaim} />
          <StakeForm claimId="claim-1" />
          <VerificationActions claimId="claim-1" stakeAmount={50} />
        </div>,
        { queryClient }
      )

      // Submit rejection
      const rejectButton = screen.getByRole('button', { name: 'Reject' })
      await user.click(rejectButton)

      await waitFor(() => {
        expect(submitVerification).toHaveBeenCalledWith({
          claimId: 'claim-1',
          decision: 'reject',
          stakeAmount: 50,
        })
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors in verification actions', async () => {
      const { submitVerification } = require('@/app/lib/api')
      submitVerification.mockRejectedValue(new Error('Network error'))

      render(
        <VerificationActions claimId="claim-1" stakeAmount={50} />,
        { queryClient }
      )

      const verifyButton = screen.getByRole('button', { name: 'Verify' })
      await user.click(verifyButton)

      await waitFor(() => {
        expect(screen.getByText(/transaction failed/i)).toBeInTheDocument()
      })
    })

    it('should handle wallet balance errors', async () => {
      const { getTokenBalance } = require('@/app/lib/wallet')
      getTokenBalance.mockRejectedValue(new Error('Wallet not connected'))

      render(
        <StakeForm claimId="claim-1" />,
        { queryClient }
      )

      // Should handle error gracefully (may not show balance)
      await waitFor(() => {
        expect(screen.queryByText(/Balance:/)).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should be keyboard accessible', async () => {
      render(
        <div>
          <StakeForm claimId="claim-1" />
          <VerificationActions claimId="claim-1" stakeAmount={50} />
        </div>,
        { queryClient }
      )

      // Tab through elements
      await user.tab()
      expect(screen.getByPlaceholderText('Enter stake amount')).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: 'Verify' })).toHaveFocus()

      await user.tab()
      expect(screen.getByRole('button', { name: 'Reject' })).toHaveFocus()
    })

    it('should have proper ARIA labels', () => {
      render(
        <div>
          <ClaimDetails claim={createMockClaim()} />
          <StakeForm claimId="claim-1" />
          <VerificationActions claimId="claim-1" stakeAmount={50} />
        </div>,
        { queryClient }
      )

      // Check for proper labels
      expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter stake amount')).toBeInTheDocument()
    })
  })
})
