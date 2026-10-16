# ActiveClaimsTable Architecture (V2-FE-109)

## Overview

The ActiveClaimsTable has been refactored to resolve data ownership ambiguity through a clean container/presentational split. This document describes the architecture, component boundaries, and testing strategy.

## Component Hierarchy

```
ActiveClaimsTableContainer (Query Owner)
  ├─ useClaimsList (Data Fetching Hook)
  │   ├─ fetchClaimsList (API Client)
  │   └─ useDebounce (Search Optimization)
  └─ ActiveClaimsTable (Presentational)
```

## Components

### ActiveClaimsTable (Presentational)

**Location:** `src/components/features/ActiveClaimsTable.tsx`

**Responsibility:** Pure rendering component that displays claim projection data.

**Owns:**
- UI rendering
- User interactions (clicks, keyboard navigation)
- Accessibility markup

**Does NOT own:**
- Data fetching
- Query state
- Search/filter/pagination state

**Props:**
- `items: ClaimListItem[]` - Claim rows from projection
- Search, filter, and pagination state + callbacks
- Stale/error metadata for display

**Usage:**
- Storybook compositions (with fixture data)
- Never used directly in production routes

### ActiveClaimsTableContainer

**Location:** `src/components/features/ActiveClaimsTableContainer.tsx`

**Responsibility:** Query-owning boundary that manages the canonical claims list projection.

**Owns:**
- All data fetching via `useClaimsList`
- Query state management
- View state derivation (loading → ready → error)
- Mapping query results to presentational props

**Does NOT own:**
- UI rendering (delegates to ActiveClaimsTable)

**Props:**
- `pageSize?: number` - Optional pagination override

**Usage:**
- Production routes (dashboard page)
- Integration tests

### useClaimsList Hook

**Location:** `src/hooks/useClaimsList.ts`

**Responsibility:** Canonical claims list projection query hook.

**Owns:**
- Search state + debouncing
- Filter state (status, high impact)
- Pagination state
- React Query integration
- View state derivation

**Returns:**
- `viewState: ClaimsListViewState` - Explicit state (loading | ready | ready-stale | empty | error)
- `envelope: ClaimsListEnvelope | undefined` - Raw projection data
- Search, filter, pagination state + setters
- Action callbacks (refetch, clearFilters, pagination controls)

## Data Flow

### Read Path (Projection)

```
API Endpoint (/api/claims?...)
  ↓
fetchClaimsList (API client with validation)
  ↓
useClaimsList (query + state management)
  ↓
ActiveClaimsTableContainer (view state mapping)
  ↓
ActiveClaimsTable (rendering)
```

### State Transitions

```
Initial → loading
loading → ready (on success)
loading → error (on failure)
ready → ready-stale (on stale projection)
empty ↔ ready (based on items.length)
```

## API Contract

### Projection Envelope

```typescript
interface ClaimsListEnvelope {
  items: ClaimListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  projection: {
    freshness: 'fresh' | 'stale' | 'degraded';
    generatedAt: string;
    reason?: string;
  };
}
```

### View States

```typescript
type ClaimsListViewState =
  | 'loading'    // No data yet
  | 'ready'      // Fresh data loaded
  | 'ready-stale' // Stale data visible
  | 'empty'      // No claims indexed
  | 'error';     // Recoverable error
```

## Testing Strategy

### Integration Tests

**File:** `src/components/features/__tests__/ActiveClaimsTable.test.tsx`

**Tests:** ActiveClaimsTableContainer with full query integration

**Covers:**
- Ready state with canonical projection data
- Search debouncing
- Filter application (status, high impact)
- Server-side pagination
- Empty states (truly empty vs filtered-empty)
- Stale projection banners
- Recoverable errors with retry
- Accessibility structure

**Approach:**
- Mock `fetch` with canonical envelope responses
- Assert against query params in request URLs
- Verify UI reflects projection metadata (freshness, pagination)

### Storybook Stories

**File:** `src/components/features/ActiveClaimsTable.stories.tsx`

**Tests:** ActiveClaimsTable presentational component

**Covers:**
- Ready state
- Paginated data
- Empty state
- Filtered empty
- Stale state
- Active search
- Status/impact filters
- Unscored claims
- Mobile viewport
- Keyboard focus

**Approach:**
- Direct component usage with fixture props
- No query mocking
- Visual regression testing

## Acceptance Criteria

✅ **Data ownership is explicit and documented**
- Container owns queries, presentational component owns rendering
- Architecture documented in this file

✅ **All tests exercise the same public component contract**
- Integration tests use ActiveClaimsTableContainer
- Storybook uses ActiveClaimsTable with fixtures
- No mock data in production

✅ **No production mock fallback exists**
- Dashboard uses ActiveClaimsTableContainer
- All data comes from API projection
- Errors fail closed with retry UX

✅ **Stale/error states fail closed**
- Stale data is visible but marked as stale
- Errors show canonical error codes
- No privileged actions on stale/error states

## Migration Notes

### Before (Ambiguous)

```tsx
// Component accepted props BUT tests expected it to own fetching
<ActiveClaimsTable claims={rows} isLoading={loading} />
```

### After (Explicit)

```tsx
// Production: Container owns fetching
<ActiveClaimsTableContainer />

// Storybook: Presentational with fixtures
<ActiveClaimsTable items={mockItems} {...handlers} />
```

## Related Files

- `src/app/api/claims.api.ts` - API client with projection validation
- `src/app/types/claim-list.ts` - Projection types and view states
- `src/hooks/useDebounce.ts` - Search input debouncing
- `src/app/queries/queryKeys.ts` - React Query key factories

## Dependencies

- React Query for query state management
- Canonical API projection endpoint (`/api/claims`)
- No indexer implementation or contract deployment required
