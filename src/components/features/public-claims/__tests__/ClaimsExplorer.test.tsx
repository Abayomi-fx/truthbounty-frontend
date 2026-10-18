import { fireEvent, render, screen } from '@testing-library/react';
import { ClaimsExplorer } from '../ClaimsExplorer';
import { useClaimsList } from '@/hooks/useClaimsList';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/claims',
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/hooks/useClaimsList');
jest.mock('@/hooks/useNetworkStatus');

const mockUseClaimsList = jest.mocked(useClaimsList);
const mockUseNetworkStatus = jest.mocked(useNetworkStatus);

function setListState(viewState: 'loading' | 'ready' | 'ready-stale' | 'empty' | 'error') {
  mockUseClaimsList.mockReturnValue({
    viewState,
    data: viewState === 'ready' || viewState === 'ready-stale' ? {
      items: [{
        id: 'claim-1',
        title: 'Air-quality readings improved',
        category: 'Climate',
        status: 'UNDER_REVIEW',
        confidenceScore: null,
        totalStaked: 0,
        highImpact: true,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-02T00:00:00.000Z',
      }],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      projection: { freshness: viewState === 'ready-stale' ? 'stale' : 'fresh', generatedAt: '2026-10-02T00:00:00.000Z' },
    } : undefined,
    lastValid: undefined,
    error: undefined,
    isLoading: viewState === 'loading',
    isFetching: false,
    retry: jest.fn(),
  });
}

describe('ClaimsExplorer', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockUseNetworkStatus.mockReturnValue({ isOnline: true } as ReturnType<typeof useNetworkStatus>);
  });

  it('renders projection-backed claims and marks stale data', () => {
    setListState('ready-stale');
    render(<ClaimsExplorer />);

    expect(screen.getByRole('heading', { name: 'Explore claims' })).toBeInTheDocument();
    expect(screen.getByText(/projection is stale or degraded/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Air-quality readings improved' })).toHaveAttribute('href', '/claims/claim-1');
  });

  it('shows error and empty states without inventing rows', () => {
    setListState('error');
    const { rerender } = render(<ClaimsExplorer />);
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be verified/i);

    setListState('empty');
    rerender(<ClaimsExplorer />);
    expect(screen.getByRole('status')).toHaveTextContent(/no matching claims/i);
  });

  it('preserves filters in a shareable URL', () => {
    setListState('empty');
    render(<ClaimsExplorer />);
    fireEvent.change(screen.getByLabelText('Claim status'), { target: { value: 'DISPUTED' } });
    expect(mockPush).toHaveBeenCalledWith('/claims?status=DISPUTED&sort=createdAt.desc');
  });
});
