/**
 * ActiveClaimsTable Storybook Stories (V2-FE-109)
 *
 * Demonstrates all user-visible states of the presentational ActiveClaimsTable
 * component. These stories exercise the rendering contract without query logic.
 *
 * For integration tests with live queries, see ActiveClaimsTable.test.tsx.
 */

import type { Meta, StoryObj } from '@storybook/react';
import ActiveClaimsTable from './ActiveClaimsTable';
import type { ClaimListItem } from '@/app/types/claim-list';

const meta: Meta<typeof ActiveClaimsTable> = {
  title: 'Features/ActiveClaimsTable',
  component: ActiveClaimsTable,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ActiveClaimsTable>;

const mockItems: ClaimListItem[] = [
  {
    id: 'claim-1',
    title: 'Global average temperatures increased by 1.1°C since pre-industrial times',
    category: 'Climate',
    status: 'VERIFIED',
    claimantAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E',
    confidenceScore: 97,
    totalStaked: 45200,
    highImpact: true,
    createdAt: '2026-09-24T10:00:00Z',
    updatedAt: '2026-09-24T10:00:00Z',
  },
  {
    id: 'claim-2',
    title: 'COVID-19 vaccines are 95% effective against severe disease',
    category: 'Health',
    status: 'VERIFIED',
    claimantAddress: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
    confidenceScore: 94,
    totalStaked: 38500,
    highImpact: true,
    createdAt: '2026-09-23T15:30:00Z',
    updatedAt: '2026-09-23T15:30:00Z',
  },
  {
    id: 'claim-3',
    title: 'Renewable energy costs have dropped 90% in the last decade',
    category: 'Technology',
    status: 'UNDER_REVIEW',
    claimantAddress: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
    confidenceScore: 78,
    totalStaked: 22100,
    highImpact: false,
    createdAt: '2026-09-22T09:15:00Z',
    updatedAt: '2026-09-24T08:00:00Z',
  },
  {
    id: 'claim-4',
    title: 'Bitcoin consumes more energy than Argentina',
    category: 'Technology',
    status: 'DISPUTED',
    claimantAddress: '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E',
    confidenceScore: 62,
    totalStaked: 18900,
    highImpact: false,
    createdAt: '2026-09-20T14:45:00Z',
    updatedAt: '2026-09-23T11:20:00Z',
  },
  {
    id: 'claim-5',
    title: 'The Amazon rainforest lost 10% of its area in 50 years',
    category: 'Environment',
    status: 'OPEN',
    claimantAddress: '0x5A0b54D5dc17e0AadC383d2db43B0a0D3E029c4c',
    confidenceScore: null,
    totalStaked: 5000,
    highImpact: true,
    createdAt: '2026-09-24T11:30:00Z',
    updatedAt: '2026-09-24T11:30:00Z',
  },
];

const defaultArgs = {
  items: mockItems,
  search: '',
  onSearchChange: () => {},
  statusFilter: undefined as ClaimStatus | undefined,
  onStatusFilterChange: () => {},
  highImpactFilter: false,
  onHighImpactFilterChange: () => {},
  onClearFilters: () => {},
  hasActiveFilters: false,
  page: 1,
  pageSize: 10,
  total: mockItems.length,
  totalPages: 1,
  onPageChange: () => {},
  canGoNext: false,
  canGoPrevious: false,
};

/**
 * Ready state: table loaded with canonical projection data.
 */
export const Ready: Story = {
  args: defaultArgs,
};

/**
 * Ready state with paginated data showing page 2 of 3.
 */
export const Paginated: Story = {
  args: {
    ...defaultArgs,
    page: 2,
    total: 30,
    totalPages: 3,
    canGoNext: true,
    canGoPrevious: true,
  },
};

/**
 * Empty state: no claims have been indexed yet.
 */
export const Empty: Story = {
  args: {
    ...defaultArgs,
    items: [],
    total: 0,
  },
};

/**
 * Filtered empty: search or filter returns no results.
 */
export const FilteredEmpty: Story = {
  args: {
    ...defaultArgs,
    items: [],
    total: 0,
    search: 'zzz',
    hasActiveFilters: true,
  },
};

/**
 * Stale state: projection freshness is degraded.
 */
export const Stale: Story = {
  args: {
    ...defaultArgs,
    isStale: true,
    staleReason: 'Indexer lagging behind chain head by 120 blocks',
  },
};

/**
 * Active search: user has typed a search query.
 */
export const ActiveSearch: Story = {
  args: {
    ...defaultArgs,
    search: 'climate',
    hasActiveFilters: true,
  },
};

/**
 * Active status filter: only verified claims.
 */
export const FilteredByStatus: Story = {
  args: {
    ...defaultArgs,
    statusFilter: 'VERIFIED',
    hasActiveFilters: true,
    items: mockItems.filter(item => item.status === 'VERIFIED'),
    total: 2,
  },
};

/**
 * High impact filter: only high-impact claims.
 */
export const HighImpactOnly: Story = {
  args: {
    ...defaultArgs,
    highImpactFilter: true,
    hasActiveFilters: true,
    items: mockItems.filter(item => item.highImpact),
    total: 3,
  },
};

/**
 * Single unscored claim: confidence score is null.
 */
export const UnscoredClaim: Story = {
  args: {
    ...defaultArgs,
    items: [mockItems[4]], // The OPEN claim with null score
    total: 1,
  },
};

/**
 * Mobile viewport: responsive design.
 */
export const Mobile: Story = {
  args: defaultArgs,
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

/**
 * Keyboard navigation focus state.
 */
export const KeyboardFocus: Story = {
  args: defaultArgs,
  play: async ({ canvasElement }) => {
    const searchInput = canvasElement.querySelector<HTMLInputElement>('#claims-search');
    searchInput?.focus();
  },
};
