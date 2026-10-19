import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { wagmmConfig } from '@/config/wagmi'
import { WebSocketProvider } from '@/components/providers/WebSocketProvider'
import type { Claim, ClaimStatus } from '@/app/types/claim'

// Test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
    mutations: {
      rety: false,
    },
  },
})

// Custom render function with providers
interface AllTheProvidersProps {
  children: React.ReactNode
  queryClient?: QueryClient
  wsConfig?: any
}

const AllTheProviders = ({ children, queryClient, wsConfig }: AllTheProvidersProps) => {
  const testQueryClient = queryClient || createTestQueryClient()

  return (
    <WagmiProvider config={wagmmConfig}>
      <QueryClientProvider client={testQueryClient}>
        <WebSocketProvider config={wsConfig || { url: 'ws://test:8080' }}>
          {children}
        </WebSocketProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    queryClient?: QueryClient
    wsConfig?: any
  }
) => {
  const { queryClient, wsConfig, ...renderOptions } = options || {}

  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders queryClient={queryClient} wsConfig={wsConfig}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  })
}

// Mock data generators
export const createMockClaim = (overrides: Partial<Claim> = {}): Claim => ({
  id: 'claim-1',
  title: 'Test Claim',
  description: 'This is a test claim description that is long enough.',
  category: 'Science',
  status: 'OPEN' as ClaimStatus,
  claimantAddress: '0x1234567890123456789012345678901234567890',
  proposer: '0x1234567890123456789012345678901234567890',
  bountyAmount: 100,
  totalStaked: 1000,
  evidence: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  ...overrides,
})

export const createMockVerification = (overrides = {}) => ({
  id: 'verification-1',
  claimId: 'claim-1',
  verifier: '0x1234567890123456789012345678901234567890',
  decision: 'TRUE',
  status: 'PENDING',
  stakeAmount: 100,
  confidence: 90,
  createdAt: new Date().toISOString(),
  ...overrides,
})

export const createMockEvidence = (overrides = {}) => ({
  id: 'evidence-1',
  claimId: 'claim-1',
  submitter: '0x1234567890123456789012345678901234567890',
  type: 'url',
  url: 'https://example.com/evidence',
  description: 'Evidence supporting the claim',
  status: 'pending',
  createdAt: new Date().toISOString(),
  ...overrides,
})

export const createMockVote = (overrides = {}) => ({
  id: 'vote-1',
  claimId: 'claim-1',
  voter: '0x1234567890123456789012345678901234567890',
  stance: 'support',
  stakedAmount: 100,
  createdAt: new Date().toISOString(),
  ...overrides,
})

export const mockSubmitVerification = jest.fn((params: any) =>
  Promise.resolve({
    id: 'verif-new',
    ...params,
    status: 'PENDING',
  })
)

// Wait utilities

export const waitForWebSocket = async (delay = 100) => {
  await new Promise(resolve => setTimeout(resolve, delay))
}

// Mock fetch response helpers
export const mockFetchSuccess = (data: any) => {
  ;;(global.fetch as jest.Mock).mockImplementationOnce(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
    })
  )
}

export const mockFetchError = (message = 'An error occurred') => {
  ;;(global.fetch as jest.Mock).mockImplementationOnce(() =>
    Promise.resolve({
      ok: false,
      status: 500,
      statusText: message,
    })
  )
}

// Mock WebSocket events
export const mockWebSocketEvent = (eventType: string, payload: any) => {
  const event = new MessageEvent('message', {
    data: JSON.stringify({
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
    }),
  })

  // Find WebSocket instances and trigger the event
  const wsInstances = (global.WebSocket as unknown as { mock?: { instances?: any[] } }) ?.mock?.instances || []
  wsInstances.forEach((ws: any) => {
    const onMessageHandler = ws.addEventListener?.mock?.calls?.find(
      ([event]: [string]) => event === 'message'
    )?.[1]

    if (onMessageHandler) {
      onMessageHandler(event)
    }
  })
}

// Error summary test helpers
export type ErrorCategory = 'validation' | 'server' | 'simulation' | 'authorization'

export interface FormErrorEntry {
  id: string
  fieldId?: string
  message: string
  category: ErrorCategory
}

export const createMockFormError = (overrides: Partial<FormErrorEntry> = {}): FormErrorEntry => ({
  id: 'error-1',
  fieldId: 'claim-title',
  message: 'Title is required',
  category: 'validation',
  ...overrides,
})

export const createMockErrorSummary = (errors: FormErrorEntry[] = []) => {
  const byCategory = errors.reduce<Record<ErrorCategory, FormErrorEntry[]>>(
    (acc, error) => {
      acc[error.category] = acc[error.category] || []
      acc[error.category].push(error)
      return acc
    },
    {} as Record<ErrorCategory, FormErrorEntry[]>
  )
  return { errors, byCategory }
}

// Re-export everything from React Testing Library
export * from '@testing-library/react'
export { customRender as render }