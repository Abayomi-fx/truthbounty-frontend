# Frontend Architecture Documentation

## Overview

TruthBounty Frontend is a decentralized news verification platform built with Next.js 14+, React 19, and TypeScript. The architecture follows modern React patterns with a focus on real-time data synchronization, type safety, and component reusability.

## Tech Stack

### Core Framework
- **Next.js 16.1.6** - React framework with App Router
- **React 19.2.3** - UI library with latest features
- **TypeScript 5** - Type-safe development

### State Management & Data Fetching
- **@tanstack/react-query 5.28.0** - Server state management
- **WebSocket Integration** - Real-time data synchronization
- **Axios 1.6.0** - HTTP client for API calls

### UI & Styling
- **Tailwind CSS 4** - Utility-first CSS framework
- **shadcn/ui** - Component library (configured via components.json)
- **Lucide React** - Icon library
- **Radix UI** - Accessible component primitives

### Blockchain Integration
- **Wagmi 2.5.0** - Ethereum wallet integration
- **RainbowKit 2.0.0** - Wallet connection UI
- **Viem 2.7.0** - Ethereum TypeScript interface

### Testing & Quality
- **Jest 29.7.0** - Unit testing
- **Playwright 1.40.0** - E2E testing
- **ESLint 9** - Code linting
- **Prettier 3.1.0** - Code formatting

## Folder Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (dashboard)/             # Route group for dashboard pages
│   │   ├── claim-detail/        # Individual claim details page
│   │   ├── claims/              # Claims listing page
│   │   ├── identity/            # Identity verification page
│   │   └── page.tsx             # Dashboard home page
│   ├── api/                     # API routes
│   ├── lib/                     # App-specific utilities
│   ├── queries/                 # React Query definitions
│   │   ├── queryClient.ts       # Query client configuration
│   │   ├── queryKeys.ts         # Query key definitions
│   │   ├── claims.queries.ts    # Claim-related queries
│   │   ├── leaderboard.queries.ts # Leaderboard queries
│   │   └── user.queries.ts      # User-related queries
│   ├── types/                   # TypeScript type definitions
│   │   ├── claim.ts             # Claim types
│   │   ├── dispute.ts           # Dispute types
│   │   ├── verification.ts      # Verification types
│   │   ├── websocket.ts         # WebSocket event types
│   │   └── worldcoin.ts         # Worldcoin types
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout
│   └── providers.tsx            # App-wide providers
├── components/                  # React components
│   ├── common/                  # Shared components
│   ├── features/                # Feature-specific components
│   │   ├── claim-details/       # Claim detail components
│   │   ├── claim-submission/    # Claim submission components
│   │   ├── claim-verification/  # Verification components
│   │   ├── disputes/            # Dispute components
│   │   ├── worldcoin/           # Worldcoin integration
│   │   ├── ActiveClaimsTable.tsx
│   │   ├── ActivityAndNodes.tsx
│   │   ├── ClaimRewardsPanel.tsx
│   │   ├── RealtimeActivityFeed.tsx
│   │   ├── StatsCards.tsx
│   │   └── VerificationNodes.tsx
│   ├── layout/                  # Layout components
│   ├── providers/               # Context providers
│   │   ├── QueryProvider.tsx    # React Query provider
│   │   └── WebSocketProvider.tsx # WebSocket provider
│   ├── reputation/              # Reputation system components
│   ├── transactions/            # Transaction components
│   └── ui/                      # Base UI components (shadcn/ui)
│       ├── button.tsx
│       ├── TrustIndicator.tsx
│       ├── TrustWarningBanner.tsx
│       └── WebSocketStatus.tsx
├── hooks/                       # Custom React hooks
│   ├── useClaims.ts             # Claim management hook
│   ├── useLeaderboard.ts        # Leaderboard hook
│   ├── useRealtimeClaims.ts     # Real-time claims hook
│   ├── useRealtimeData.ts       # Real-time data synchronization
│   ├── useRewards.ts            # Rewards management hook
│   ├── useUser.ts               # User data hook
│   ├── useWebSocket.ts          # WebSocket connection hook
│   └── useWorldcoinVerification.ts # Worldcoin verification hook
├── lib/                         # Utility libraries
└── data/                        # Static data or mock data
```

## State Management Architecture

### React Query Integration

The application uses TanStack Query for server state management with the following configuration:

```typescript
// src/app/queries/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 mins
      cacheTime: 1000 * 60 * 30, // 30 mins
      refetchOnWindowFocus: false,
      retry: 2,
    },
    mutations: {
      onError: (error) => console.error('Mutation error:', error),
    },
  },
});
```

### Query Key Strategy

Query keys are centralized in `src/app/queries/queryKeys.ts` following a hierarchical pattern:

```typescript
export const queryKeys = {
  claims: {
    all: ['claims'] as const,
    detail: (claimId: string) => ['claims', claimId] as const,
    byStatus: (status: string) => ['claims', 'status', status] as const,
  },
  verifications: {
    all: ['verifications'] as const,
    byClaim: (claimId: string) => ['verifications', 'claim', claimId] as const,
    byUser: (userId: string) => ['verifications', 'user', userId] as const,
  },
  // ... other query keys
};
```

## Real-Time Data Architecture

### WebSocket Integration

The application implements a robust WebSocket system for real-time updates:

#### Provider Structure
1. **WebSocketProvider** - Manages WebSocket connection state
2. **QueryProvider** - Integrates WebSocket with React Query
3. **useRealtimeData** - Syncs WebSocket events with query cache

#### Event Types
```typescript
// src/app/types/websocket.ts
export type WebSocketEvent = 
  | ClaimCreatedEvent
  | ClaimUpdatedEvent
  | ClaimStatusChangedEvent
  | VerificationAddedEvent
  | DisputeCreatedEvent
  | DisputeResolvedEvent
  | LeaderboardUpdatedEvent;
```

#### Real-time Data Flow
1. WebSocket event received
2. Event parsed and typed
3. Query cache invalidated/updated
4. Components automatically re-render with new data

## Component Architecture

### Feature-Based Organization

Components are organized by features rather than type:

- **claims/** - All claim-related components
- **claim-lifecycle/** - Event-derived timeline visualization (V2-FE-014)
- **verification/** - Verification workflow components
- **disputes/** - Dispute management components
- **worldcoin/** - Identity verification components

### Provider Pattern

Global state is managed through context providers:

```typescript
// src/app/providers.tsx
export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      {children}
    </QueryProvider>
  );
}

// src/components/providers/QueryProvider.tsx
export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider config={wsConfig}>
        <RealtimeDataSync />
        {children}
      </WebSocketProvider>
    </QueryClientProvider>
  );
}
```

### Custom Hooks Pattern

Business logic is encapsulated in custom hooks:

```typescript
// Example: useClaims hook
export function useClaims() {
  return useQuery({
    queryKey: queryKeys.claims.all,
    queryFn: fetchClaims,
    // ... other options
  });
}

// Example: useClaimLifecycleTimeline hook (V2-FE-014)
export function useClaimLifecycleTimeline(config) {
  // Aggregates chain events, API projections, and WebSocket updates
  // into canonical timeline with staleness detection and reconciliation
  return {
    timeline, // Complete timeline with events and metadata
    isLoading,
    isError,
    isStale, // Staleness detection for data integrity
    reconcile, // Manual reconciliation function
  };
}
```

## Data Flow Patterns

### 1. Server Data Flow
```
API → React Query → Component → UI
```

### 2. Real-time Data Flow
```
WebSocket Event → useRealtimeData → Query Cache → Component → UI
```

### 3. User Interaction Flow
```
User Action → Component → Mutation Hook → API → WebSocket Broadcast → All Clients
```

### 4. Blockchain Integration Flow
```
User Action → Wagmi Hook → Smart Contract → Transaction → Indexer → API → Frontend
```

### 5. Event-Derived Timeline Flow (V2-FE-014)
```
Chain Events → Indexer → API Projection
                              ↓
WebSocket Updates → useClaimLifecycleTimeline
                              ↓
                    Timeline State (with provenance tracking)
                              ↓
                    ClaimLifecycleTimeline Component
                              ↓
                    Accessible UI (all states)
```

## Type System Architecture

### Core Domain Types

```typescript
// Claims
interface Claim {
  id: string;
  title: string;
  description: string;
  claimantAddress: string;
  status: ClaimStatus;
  bountyAmount: number;
  totalStaked: number;
  evidence: Evidence[];
  createdAt: string;
  updatedAt: string;
}

// Verifications
interface Verification {
  id: string;
  claimId: string;
  verifierAddress: string;
  decision: VerificationDecision;
  stakeAmount: number;
  status: VerificationStatus;
  transactionHash?: string;
  createdAt: string;
  confirmedAt?: string;
}
```

### Event Types for WebSocket

All WebSocket events are strongly typed for type safety:

```typescript
interface ClaimCreatedEvent {
  type: 'CLAIM_CREATED';
  payload: Claim;
  timestamp: string;
}
```

## Performance Optimizations

### 1. Query Optimization
- **Stale Time**: 5 minutes for balanced freshness
- **Cache Time**: 30 minutes to reduce API calls
- **Selective Refetching**: Disabled on window focus

### 2. Component Optimization
- **React.memo**: Used for expensive components
- **useMemo**: For computed values
- **useCallback**: For event handlers

### 3. Bundle Optimization
- **Dynamic Imports**: For large components
- **Code Splitting**: Automatic with Next.js App Router

## Security Architecture

### 1. Trust System
- **Trust Indicators**: Visual warnings for low-trust accounts
- **Trust Scores**: Based on reputation, verification, and activity
- **Sybil Protection**: Worldcoin integration

### 2. Data Validation
- **TypeScript**: Compile-time type checking
- **Zod**: Runtime validation (where implemented)
- **API Validation**: Server-side validation

### 3. Wallet Security
- **Wagmi**: Secure wallet connection management
- **RainbowKit**: Standardized wallet UI
- **Transaction Signing**: Client-side transaction validation

### 4. Wallet-Scoped Auth Sessions (V2-FE-008)

Authenticated sessions are bound to the connected wallet scope
(`account address + chain id`):

- **Session store** (`src/lib/session-store.ts`): a token is only usable for the
  exact `(address, chainId)` scope it was issued for. Address comparisons are
  case-insensitive; stored payloads are shape-validated before use.
- **Session reconciliation** (`src/hooks/useSessionReconciliation.ts`): when the
  connected account changes, the required chain changes, or the wallet
  disconnects, the auth session is invalidated, chain-scoped storage caches and
  the resumable WebSocket cursor are dropped, and the query cache is cleared.
  It also coordinates wagmi reconnect, explicit logout, and re-authentication.
- **Consumer API** (`src/hooks/useAuthSession.ts`): `authenticate()` stores a
  backend-issued token bound to the current scope and refuses to run without a
  connected wallet; `isAuthenticated` flips to false as soon as the scope moves.
- **Realtime stream** (`src/hooks/useWebSocket.ts`): authenticated frames and
  the HTTP catch-up request only carry the `Authorization` header while the
  stored session is valid for the current scope; the socket is re-established
  when the wallet scope changes so a stale session cannot keep a live stream.

## Testing Architecture

### 1. Unit Testing
- **Jest**: Test runner
- **Testing Library**: Component testing utilities
- **Mock Services**: For API and WebSocket mocking

### 2. E2E Testing
- **Playwright**: Cross-browser E2E testing
- **Page Object Model**: Maintainable test structure

### 3. Integration Testing
- **React Query Testing**: Testing query behavior
- **WebSocket Testing**: Testing real-time features

## Development Workflow

### 1. Component Development
1. Create component in appropriate feature folder
2. Define TypeScript interfaces
3. Implement with hooks for business logic
4. Add unit tests
5. Add integration tests if needed

### 2. State Management
1. Define query keys in `queryKeys.ts`
2. Create query functions in appropriate `.queries.ts` file
3. Create custom hook in `hooks/` folder
4. Use in components

### 3. Real-time Features
1. Define event type in `websocket.ts`
2. Add handler in `useRealtimeData.ts`
3. Test WebSocket integration
4. Add fallback UI for connection issues

## Best Practices

### 1. Code Organization
- **Feature-based**: Group related functionality
- **Consistent naming**: Follow established patterns
- **Type safety**: Strict TypeScript configuration

### 2. Performance
- **Lazy loading**: Load code as needed
- **Memoization**: Prevent unnecessary re-renders
- **Optimistic updates**: Improve perceived performance

### 3. Accessibility
- **Semantic HTML**: Proper element usage
- **ARIA labels**: Screen reader support
- **Keyboard navigation**: Full keyboard accessibility

### 4. Error Handling
- **Error boundaries**: Catch React errors
- **Fallback UI**: Graceful degradation
- **User feedback**: Clear error messages

## Future Architecture Considerations

### 1. Scalability
- **Micro-frontends**: Potential for feature isolation
- **Service Workers**: Offline functionality
- **CDN Integration**: Global performance

### 2. Multi-chain Support
- **Chain abstraction**: Generic blockchain interface
- **Chain-specific adapters**: Pluggable chain implementations
- **Cross-chain bridges**: Multi-chain functionality

### 3. Advanced Features
- **AI Integration**: Automated claim analysis
- **Graph QL**: More efficient data fetching
- **WebAssembly**: Performance-critical computations

## Conclusion

The TruthBounty frontend architecture is designed to be:

- **Scalable**: Modular structure supports growth
- **Maintainable**: Clear separation of concerns
- **Performant**: Optimized for real-time updates
- **Type-safe**: Comprehensive TypeScript usage
- **User-friendly**: Focus on UX and accessibility

This architecture provides a solid foundation for building a decentralized verification platform that can evolve with changing requirements while maintaining code quality and developer productivity.

---

## Security Architecture — Formal Model

For the **full, independently reviewable** security model of the frontend, see:

- **[THREAT_MODEL.md](./THREAT_MODEL.md)** — trust boundaries, threat actors, threat/mitigation matrix, fail-closed posture, telemetry redaction rules, and maintainer sign-off.
- **[UI_STATE_MODEL.md](./UI_STATE_MODEL.md)** — canonical UI state model (loading, empty, stale, rejected, failed, pending, confirmed, finalized, reorged) with per-surface applicability and accessibility contracts.

### Authority model (summary)

- **Smart contracts** are authoritative for protocol mutation.
- The **API is a projection / read layer**, never authoritative for mutation.
- The **frontend never fabricates** transaction success, settlement, rewards, reputation, or protocol state.
- **Fail closed** on missing config, unsupported chain, missing CSP nonce, unresolved canonical artifacts, simulation/receipt mismatch, or integrity uncertainty.

### Where the security primitives live

| Concern | Location |
|---|---|
| Integrity boundary (fail-closed UI) | `src/components/security/IntegrityBoundary.tsx` |
| Telemetry redaction | `src/lib/security/redaction.ts` |
| Sensitive path policy | `src/lib/security/sensitive-paths.ts` |
| Evidence sanitization | `src/lib/security/evidence-sanitizer.ts` |
| CSP + security headers | `src/lib/security/headers.ts`, `docs/SECURITY_HEADERS.md` |
| SIWE auth | `src/lib/auth/siwe-client.ts`, `docs/SIWE_AUTH.md` |
| Transaction lifecycle | `src/hooks/useTransactionMachine.ts`, `useReceiptProjection.ts`, `useFinalizationDetection.ts` |
| Reorg reconciliation | `src/hooks/useReorgReconciliation.ts`, `useStateReconciliation.ts` |
| Settlement detection | `src/hooks/useSettlementDetection.ts` |
| Canonical wallet enforcement | `src/hooks/useCanonicalWallet.ts` |
| PR security review gate | `.github/workflows/pr-security-review.yml` |
