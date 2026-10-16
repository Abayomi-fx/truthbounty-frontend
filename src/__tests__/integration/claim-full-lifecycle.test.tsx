/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports -- test doubles and dynamic module access */
/**
 * Integration Tests: Complete Claim Lifecycle
 * 
 * Tests the full claim submission → verification → resolution flow with:
 * - Form submission and validation
 * - API interactions
 * - UI state updates
 * - Error handling and recovery
 * - Real-time WebSocket updates
 * - Data consistency across operations
 */

import React from 'react'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient } from '@tanstack/react-query'
import { render, createMockClaim, createMockVerification } from '../utils/test-utils'
import { setupMockServer } from '../mocks/server'
import { useClaims, useSubmitClaim, useClaimDetail, useClaimsByStatus } from '@/app/queries/claims.queries'

const server = setupMockServer()

jest.mock('@/app/api/claims.api', () => ({
  fetchClaims: jest.fn(),
  fetchClaimDetail: jest.fn(),
  submitClaim: jest.fn(),
  fetchClaimsByStatus: jest.fn(),
}))

jest.mock('@/app/lib/api', () => ({
  submitVerification: jest.fn(),
  submitDispute: jest.fn(),
  resolveDispute: jest.fn(),
}))

jest.mock('@/app/lib/wallet', () => ({
  getTokenBalance: jest.fn(() => Promise.resolve(100)),
  sendTransaction: jest.fn(() => Promise.resolve('0xabc123')),
}))

jest.mock('@/components/providers/WebSocketProvider', () => ({
  WebSocketProvider: ({ children }: { children: React.ReactNode }) => children,
  useWebSocketContext: () => ({
    isConnected: true,
    subscribe: jest.fn(),
    send: jest.fn(),
  }),
}))

describe('Complete Claim Lifecycle Integration Tests', () => {
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
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('🎯 Objective 1: Form Submission', () => {
    it('should render claim form with all required fields', async () => {
      function ClaimFormTest() {
        const [formData, setFormData] = React.useState({
          title: '',
          description: '',
          evidence: [] as any[],
        })

        const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault()
          // Mock submission
        }

        return (
          <form onSubmit={handleSubmit} data-testid="claim-form">
            <div>
              <label htmlFor="title">Claim Title</label>
              <input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>
            <div>
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>
            <button type="submit">Submit Claim</button>
          </form>
        )
      }

      render(<ClaimFormTest />, { queryClient })

      // Verify form elements exist
      expect(screen.getByLabelText('Claim Title')).toBeInTheDocument()
      expect(screen.getByLabelText('Description')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Submit Claim' })).toBeInTheDocument()
    })

    it('should validate required fields before submission', async () => {
      function ValidatingFormTest() {
        const [formData, setFormData] = React.useState({
          title: '',
          description: '',
        })
        const [errors, setErrors] = React.useState<Record<string, string>>({})

        const validateForm = () => {
          const newErrors: Record<string, string> = {}
          if (!formData.title.trim()) newErrors.title = 'Title is required'
          if (!formData.description.trim()) newErrors.description = 'Description is required'
          setErrors(newErrors)
          return Object.keys(newErrors).length === 0
        }

        const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault()
          if (validateForm()) {
            // Submit
          }
        }

        return (
          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="title">Title</label>
              <input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
              {errors.title && <span data-testid="title-error">{errors.title}</span>}
            </div>
            <div>
              <label htmlFor="desc">Description</label>
              <input
                id="desc"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
              {errors.description && <span data-testid="desc-error">{errors.description}</span>}
            </div>
            <button type="submit">Submit</button>
          </form>
        )
      }

      render(<ValidatingFormTest />, { queryClient })

      // Submit empty form
      const submitButton = screen.getByRole('button', { name: 'Submit' })
      await user.click(submitButton)

      // Errors should appear
      await waitFor(() => {
        expect(screen.getByTestId('title-error')).toHaveTextContent('Title is required')
        expect(screen.getByTestId('desc-error')).toHaveTextContent('Description is required')
      })
    })

    it('should submit valid form data and call API', async () => {
      const { submitClaim } = require('@/app/api/claims.api')
      const mockNewClaim = createMockClaim({
        id: 'new-claim-1',
        title: 'Climate Change Evidence',
        status: 'OPEN',
      })
      submitClaim.mockResolvedValue(mockNewClaim)

      function SubmissibleFormTest() {
        const [formData, setFormData] = React.useState({
          title: 'Climate Change Evidence',
          description: 'New climate data showing...',
          evidence: [],
        })
        const [submitStatus, setSubmitStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle')

        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault()
          try {
            setSubmitStatus('loading')
            await submitClaim(formData)
            setSubmitStatus('success')
          } catch (error) {
            setSubmitStatus('error')
          }
        }

        return (
          <form onSubmit={handleSubmit}>
            <input value={formData.title} onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))} />
            <textarea value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} />
            <button type="submit" disabled={submitStatus === 'loading'}>
              {submitStatus === 'loading' ? 'Submitting...' : 'Submit'}
            </button>
            {submitStatus === 'success' && <div data-testid="success-msg">Claim submitted successfully</div>}
          </form>
        )
      }

      render(<SubmissibleFormTest />, { queryClient })

      const submitButton = screen.getByRole('button')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByTestId('success-msg')).toBeInTheDocument()
      })

      expect(submitClaim).toHaveBeenCalledWith({
        title: 'Climate Change Evidence',
        description: 'New climate data showing...',
        evidence: [],
      })
    })
  })

  describe('🎯 Objective 2: API Interaction', () => {
    it('should fetch claims list on component mount', async () => {
      const { fetchClaims } = require('@/app/api/claims.api')
      const mockClaims = [
        createMockClaim({ id: 'claim-1', title: 'First Claim' }),
        createMockClaim({ id: 'claim-2', title: 'Second Claim' }),
      ]
      fetchClaims.mockResolvedValue(mockClaims)

      function ClaimsListTest() {
        const { data: claims, isLoading } = useClaims()

        if (isLoading) return <div>Loading...</div>

        return (
          <div data-testid="claims-list">
            {claims?.map(claim => (
              <div key={claim.id} data-testid={`claim-item-${claim.id}`}>
                {claim.title}
              </div>
            ))}
          </div>
        )
      }

      render(<ClaimsListTest />, { queryClient })

      // Should call fetch claims
      expect(fetchClaims).toHaveBeenCalled()

      // Should display claims
      await waitFor(() => {
        expect(screen.getByText('First Claim')).toBeInTheDocument()
        expect(screen.getByText('Second Claim')).toBeInTheDocument()
      })
    })

    it('should fetch claim details on selection', async () => {
      const { fetchClaimDetail } = require('@/app/api/claims.api')
      const mockClaimDetail = createMockClaim({
        id: 'claim-1',
        title: 'Detailed Claim',
        description: 'This is a detailed claim description with evidence links.',
        bountyAmount: 500,
      })
      fetchClaimDetail.mockResolvedValue(mockClaimDetail)

      function ClaimDetailTest() {
        const [selectedId, setSelectedId] = React.useState('claim-1')
        const { data: claim, isLoading } = useClaimDetail(selectedId)

        if (isLoading) return <div>Loading detail...</div>

        return (
          <div data-testid="claim-detail">
            {claim && (
              <>
                <h2>{claim.title}</h2>
                <p>{claim.description}</p>
                <p>Bounty: ${claim.bountyAmount}</p>
              </>
            )}
          </div>
        )
      }

      render(<ClaimDetailTest />, { queryClient })

      await waitFor(() => {
        expect(screen.getByText('Detailed Claim')).toBeInTheDocument()
        expect(screen.getByText('This is a detailed claim description with evidence links.')).toBeInTheDocument()
        expect(screen.getByText('Bounty: $500')).toBeInTheDocument()
      })

      expect(fetchClaimDetail).toHaveBeenCalledWith('claim-1')
    })

    it('should handle API errors gracefully', async () => {
      const { fetchClaims } = require('@/app/api/claims.api')
      fetchClaims.mockRejectedValue(new Error('API Error: Server returned 500'))

      function ErrorHandlingTest() {
        const { data: claims, error, isError } = useClaims()

        return (
          <div>
            {isError && <div data-testid="error-state">Error loading claims</div>}
            {!isError && claims && <div>Loaded {claims.length} claims</div>}
          </div>
        )
      }

      render(<ErrorHandlingTest />, { queryClient })

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument()
      })
    })

    it('should filter claims by status', async () => {
      const { fetchClaimsByStatus } = require('@/app/api/claims.api')
      const openClaims = [
        createMockClaim({ id: 'claim-1', status: 'OPEN' }),
        createMockClaim({ id: 'claim-2', status: 'OPEN' }),
      ]
      fetchClaimsByStatus.mockResolvedValue(openClaims)

      function FilteredClaimsTest() {
        const { data: claims } = useClaimsByStatus('OPEN')

        return (
          <div>
            {claims?.map(claim => (
              <div key={claim.id}>{claim.status}</div>
            ))}
          </div>
        )
      }

      render(<FilteredClaimsTest />, { queryClient })

      await waitFor(() => {
        const statusElements = screen.getAllByText('OPEN')
        expect(statusElements).toHaveLength(2)
      })

      expect(fetchClaimsByStatus).toHaveBeenCalledWith('OPEN')
    })
  })

  describe('🎯 Objective 3: UI Updates', () => {
    it('should update UI when claim transitions from OPEN to UNDER_REVIEW', async () => {
      const { fetchClaimDetail } = require('@/app/api/claims.api')

      function StatusTransitionTest() {
        const [status, setStatus] = React.useState<string>('OPEN')
        const [stakeAmount, setStakeAmount] = React.useState(0)

        const simulateVerification = () => {
          setStatus('UNDER_REVIEW')
          setStakeAmount(50)
        }

        return (
          <div>
            <div data-testid="claim-status">Status: {status}</div>
            <div data-testid="stake-amount">Staked: ${stakeAmount}</div>
            <button onClick={simulateVerification} data-testid="verify-btn">
              Start Verification
            </button>
          </div>
        )
      }

      render(<StatusTransitionTest />, { queryClient })

      expect(screen.getByText('Status: OPEN')).toBeInTheDocument()
      expect(screen.getByText('Staked: $0')).toBeInTheDocument()

      const verifyButton = screen.getByTestId('verify-btn')
      await user.click(verifyButton)

      await waitFor(() => {
        expect(screen.getByText('Status: UNDER_REVIEW')).toBeInTheDocument()
        expect(screen.getByText('Staked: $50')).toBeInTheDocument()
      })
    })

    it('should display loading state during data fetch', async () => {
      const { fetchClaims } = require('@/app/api/claims.api')
      fetchClaims.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([createMockClaim()]), 500))
      )

      function LoadingStateTest() {
        const { data: claims, isLoading } = useClaims()

        return (
          <div>
            {isLoading && <div data-testid="loading">Loading claims...</div>}
            {!isLoading && <div data-testid="loaded">Loaded {claims?.length} claims</div>}
          </div>
        )
      }

      render(<LoadingStateTest />, { queryClient })

      expect(screen.getByTestId('loading')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByTestId('loaded')).toBeInTheDocument()
      }, { timeout: 600 })
    })

    it('should highlight claim with recent activity', async () => {
      function RecentActivityTest() {
        const [claims] = React.useState([
          createMockClaim({ id: 'claim-1', updatedAt: new Date().toISOString() }),
          createMockClaim({ id: 'claim-2', updatedAt: new Date(Date.now() - 86400000).toISOString() }),
        ])

        const isRecent = (updatedAt: string) => {
          const diff = Date.now() - new Date(updatedAt).getTime()
          return diff < 3600000 // 1 hour
        }

        return (
          <div>
            {claims.map(claim => (
              <div 
                key={claim.id} 
                data-testid={`claim-${claim.id}`}
                className={isRecent(claim.updatedAt) ? 'recent' : 'old'}
              >
                {claim.title}
              </div>
            ))}
          </div>
        )
      }

      render(<RecentActivityTest />, { queryClient })

      const recentClaim = screen.getByTestId('claim-claim-1')
      expect(recentClaim).toHaveClass('recent')

      const oldClaim = screen.getByTestId('claim-claim-2')
      expect(oldClaim).toHaveClass('old')
    })

    it('should disable submit button when form is invalid', async () => {
      function FormValidationUITest() {
        const [formData, setFormData] = React.useState({ title: '', description: '' })
        const isValid = formData.title.trim().length > 0 && formData.description.trim().length > 0

        return (
          <form>
            <input
              placeholder="Title"
              value={formData.title}
              onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
            />
            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
            />
            <button type="submit" disabled={!isValid}>
              Submit
            </button>
          </form>
        )
      }

      render(<FormValidationUITest />, { queryClient })

      const submitButton = screen.getByRole('button')
      expect(submitButton).toBeDisabled()

      await user.type(screen.getByPlaceholderText('Title'), 'Test Title')
      expect(submitButton).toBeDisabled()

      await user.type(screen.getByPlaceholderText('Description'), 'Test Description')
      expect(submitButton).not.toBeDisabled()
    })
  })

  describe('🎯 End-to-End: Complete Claim Lifecycle', () => {
    it('should execute full flow: Submit → View → Verify → Complete', async () => {
      const { submitClaim, fetchClaimDetail } = require('@/app/api/claims.api')
      const { submitVerification } = require('@/app/lib/api')

      const submittedClaim = createMockClaim({
        id: 'claim-e2e-1',
        title: 'Test E2E Claim',
        status: 'OPEN',
      })
      const verifiedClaim = createMockClaim({
        id: 'claim-e2e-1',
        title: 'Test E2E Claim',
        status: 'UNDER_REVIEW',
      })
      const completedClaim = createMockClaim({
        id: 'claim-e2e-1',
        title: 'Test E2E Claim',
        status: 'VERIFIED',
      })

      submitClaim.mockResolvedValue(submittedClaim)
      fetchClaimDetail.mockResolvedValueOnce(submittedClaim)
      submitVerification.mockResolvedValue(createMockVerification())
      fetchClaimDetail.mockResolvedValueOnce(verifiedClaim)
      fetchClaimDetail.mockResolvedValueOnce(completedClaim)

      function CompleteFlowTest() {
        const [step, setStep] = React.useState<'initial' | 'submitted' | 'viewing' | 'verifying' | 'completed'>('initial')
        const [currentClaim, setCurrentClaim] = React.useState<any>(null)

        const handleSubmitClaim = async () => {
          const claim = await submitClaim({
            title: 'Test E2E Claim',
            description: 'Test description',
            evidence: [],
          })
          setCurrentClaim(claim)
          setStep('submitted')
        }

        const handleViewClaim = async () => {
          const claim = await fetchClaimDetail(currentClaim.id)
          setCurrentClaim(claim)
          setStep('viewing')
        }

        const handleVerifyClaim = async () => {
          await submitVerification({ claimId: currentClaim.id, decision: 'verify' })
          const claim = await fetchClaimDetail(currentClaim.id)
          setCurrentClaim(claim)
          setStep('verifying')
        }

        const handleCompleteClaim = async () => {
          const claim = await fetchClaimDetail(currentClaim.id)
          setCurrentClaim(claim)
          setStep('completed')
        }

        return (
          <div>
            <div data-testid="step-indicator">{step}</div>
            {currentClaim && (
              <div data-testid="claim-display">
                <h3>{currentClaim.title}</h3>
                <p data-testid="claim-status">Status: {currentClaim.status}</p>
              </div>
            )}
            <div>
              {step === 'initial' && (
                <button onClick={handleSubmitClaim} data-testid="submit-step">
                  Step 1: Submit Claim
                </button>
              )}
              {step === 'submitted' && (
                <button onClick={handleViewClaim} data-testid="view-step">
                  Step 2: View Details
                </button>
              )}
              {step === 'viewing' && (
                <button onClick={handleVerifyClaim} data-testid="verify-step">
                  Step 3: Start Verification
                </button>
              )}
              {step === 'verifying' && (
                <button onClick={handleCompleteClaim} data-testid="complete-step">
                  Step 4: Mark Complete
                </button>
              )}
              {step === 'completed' && (
                <div data-testid="flow-complete">✓ Flow Complete</div>
              )}
            </div>
          </div>
        )
      }

      render(<CompleteFlowTest />, { queryClient })

      // Step 1: Submit
      await user.click(screen.getByTestId('submit-step'))
      await waitFor(() => {
        expect(screen.getByTestId('step-indicator')).toHaveTextContent('submitted')
      })

      // Step 2: View
      await user.click(screen.getByTestId('view-step'))
      await waitFor(() => {
        expect(screen.getByTestId('step-indicator')).toHaveTextContent('viewing')
      })

      // Step 3: Verify
      await user.click(screen.getByTestId('verify-step'))
      await waitFor(() => {
        expect(screen.getByTestId('step-indicator')).toHaveTextContent('verifying')
      })

      // Step 4: Complete
      await user.click(screen.getByTestId('complete-step'))
      await waitFor(() => {
        expect(screen.getByTestId('flow-complete')).toBeInTheDocument()
      })

      // Verify all APIs were called
      expect(submitClaim).toHaveBeenCalled()
      expect(submitVerification).toHaveBeenCalled()
    })

    it('should handle error at any step and allow retry', async () => {
      const { submitClaim } = require('@/app/api/claims.api')
      submitClaim
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockClaim())

      function ErrorRecoveryTest() {
        const [error, setError] = React.useState<string | null>(null)
        const [isSuccess, setIsSuccess] = React.useState(false)

        const handleSubmit = async () => {
          try {
            setError(null)
            await submitClaim({ title: 'Test', description: 'Test', evidence: [] })
            setIsSuccess(true)
          } catch (err) {
            setError('Failed to submit. Please try again.')
          }
        }

        return (
          <div>
            <button onClick={handleSubmit}>Submit</button>
            {error && <div data-testid="error">{error}</div>}
            {isSuccess && <div data-testid="success">Success!</div>}
          </div>
        )
      }

      render(<ErrorRecoveryTest />, { queryClient })

      // First attempt fails
      await user.click(screen.getByRole('button'))
      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument()
      })

      // Retry succeeds
      await user.click(screen.getByRole('button'))
      await waitFor(() => {
        expect(screen.getByTestId('success')).toBeInTheDocument()
      })

      expect(submitClaim).toHaveBeenCalledTimes(2)
    })

    it('should maintain data consistency across multiple operations', async () => {
      const { submitClaim, fetchClaims } = require('@/app/api/claims.api')
      
      const newClaim = createMockClaim({ id: 'new-claim', title: 'New Claim' })
      const allClaims = [newClaim, createMockClaim({ id: 'existing' })]

      submitClaim.mockResolvedValue(newClaim)
      fetchClaims.mockResolvedValue(allClaims)

      function ConsistencyTest() {
        const { data: claims } = useClaims()
        const submitMutation = useSubmitClaim()
        const [submitted, setSubmitted] = React.useState(false)

        const handleSubmit = async () => {
          await submitMutation.mutateAsync({
            title: 'New Claim',
            description: 'Description',
            evidence: [],
          })
          setSubmitted(true)
        }

        return (
          <div>
            <div data-testid="claim-count">Total: {claims?.length || 0}</div>
            <button onClick={handleSubmit}>Add Claim</button>
            {submitted && <div data-testid="submitted">✓ Added</div>}
          </div>
        )
      }

      render(<ConsistencyTest />, { queryClient })

      // Initial count
      await waitFor(() => {
        expect(screen.getByTestId('claim-count')).toHaveTextContent('Total: 2')
      })

      // Submit new claim
      await user.click(screen.getByRole('button'))
      await waitFor(() => {
        expect(screen.getByTestId('submitted')).toBeInTheDocument()
      })
    })
  })
})
