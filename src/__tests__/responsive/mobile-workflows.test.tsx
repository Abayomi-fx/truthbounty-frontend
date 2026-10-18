/**
 * V2-FE-128 — Mobile responsiveness invariants for every protocol workflow.
 *
 * jsdom cannot perform real layout, so these tests pin the *responsive
 * contracts* (Tailwind breakpoint classes, stacking rules, scroll regions,
 * truncation and touch-target sizing) that make each workflow usable on
 * narrow viewports. Real viewport assertions (no horizontal overflow at
 * 375×812) live in `e2e/mobile-responsive.spec.ts`.
 *
 * Covered workflows:
 *   1. App shell (top bar + mobile navigation clearance)
 *   2. Claims feed (ActiveClaimsTable)
 *   3. Rewards claim (ClaimRewardsPanel)
 *   4. Claim verification detail (ClaimDetails, VerificationActions, StakeForm)
 *   5. Dispute workflow (DisputeVoting, OpenDispute trigger card)
 *   6. Transaction status (TransactionItem, StatusCard, TransactionStatus)
 *   7. Evidence + claim detail cards (EvidenceLinks)
 *   8. Identity verification (identity page, Worldcoin panel)
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ActiveClaimsTable from '@/components/features/ActiveClaimsTable';
import ClaimRewardsPanel from '@/components/features/ClaimRewardsPanel';
import { ClaimDetails } from '@/components/features/claim-verification/ClaimDetails';
import { VerificationActions } from '@/components/features/claim-verification/VerificationActions';
import { StakeForm } from '@/components/features/claim-verification/StakeForm';
import { TransactionStatus } from '@/components/features/claim-verification/TransactionStatus';
import { TransactionItem } from '@/components/transactions/transaction-item';
import { StatusCard } from '@/components/transactions/status-card';
import { EvidenceLinks } from '@/components/features/claim-details/EvidenceLinks';
import { DisputeVoting } from '@/components/features/disputes/DisputeVoting';
import Topbar from '@/components/layout/Topbar';
import IdentityPage from '@/app/(dashboard)/identity/page';
import type { Claim } from '@/app/types/claim';
import {
  makeEnvelope,
  makeJsonResponse,
} from '@/hooks/__tests__/claim-list-fixtures';

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * The claims feed reads its rows from the canonical projection query
 * (V2-FE-109), so it must be rendered inside a QueryClientProvider.
 */
function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

/* ------------------------------------------------------------------ *
 * Mocks
 * ------------------------------------------------------------------ */

// --- ClaimRewardsPanel: rewards hook (mutable per-test state) -------
let mockRewards: {
  pendingRewards: Array<{ claimId: string; title: string; amount: number }>;
  totalClaimable: number;
  status: 'idle' | 'pending' | 'success' | 'error';
  lastTxHash: string | null;
  errorMessage: string | null;
  claimAll: jest.Mock;
};

jest.mock('@/hooks/useRewards', () => ({
  useRewards: () => mockRewards,
}));

// --- ClaimDetails: trust tooltip data + claim fetch ------------------
jest.mock('@/components/hooks/useTrust', () => ({
  useTrust: () => ({
    reputation: 50,
    isVerified: true,
    accountAgeDays: 30,
    suspicious: false,
  }),
  useTrustForAddress: () => ({ reputation: 72, isVerified: true }),
}));

jest.mock('@/app/lib/api', () => ({
  getClaimById: jest.fn(() => Promise.reject(new Error('CLAIM_NOT_FOUND'))),
  submitVerification: jest.fn(),
}));

// Keep the stake balance promise pending so no state update escapes act();
// the responsive contract under test is the input's sizing, not the balance.
jest.mock('@/app/lib/wallet', () => ({
  getTokenBalance: jest.fn(() => new Promise(() => undefined)),
}));

// --- Topbar: providers, wallet, claim form ---------------------------
jest.mock('@/components/providers', () => ({
  FeatureFlagGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useFeatureFlags: () => ({ isEnabled: () => true }),
}));

jest.mock('@/components/features/claim-submission', () => ({
  ClaimSubmissionForm: () => <div data-testid="claim-submission-form" />,
}));

jest.mock('@/components/WalletConnection', () => ({
  WalletConnection: () => <button type="button">Connect Wallet</button>,
}));

jest.mock('@/components/providers/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'system', setTheme: jest.fn() }),
}));

jest.mock('@/components/providers/WebSocketProvider', () => ({
  useWebSocketStatus: () => ({
    isConnected: true,
    connectionState: 'connected',
    reconnectAttempts: 0,
  }),
}));

// --- Identity page: Worldcoin panel ----------------------------------
jest.mock('@/components/features/worldcoin', () => ({
  WorldcoinVerificationPanel: () => <div data-testid="worldcoin-panel" />,
}));

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const claimFixture: Claim = {
  id: 'claim-responsive-1',
  title: 'A deliberately long claim title that must wrap on narrow viewports instead of overflowing the card',
  description:
    'Claim description body. It is long enough that it wraps naturally across multiple lines on a phone-sized viewport without causing horizontal scrolling.',
  category: 'Science',
  claimantAddress: '0x1234567890123456789012345678901234567890',
  status: 'OPEN',
  bountyAmount: 100,
  totalStaked: 1000,
  evidence: [
    {
      id: 'ev-1',
      type: 'link',
      value: 'https://example.com/a/very/long/evidence/path/that/must/wrap/without/overflowing?query=1234567890',
      createdAt: new Date().toISOString(),
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  mockRewards = {
    pendingRewards: [
      { claimId: 'c1', title: 'Verified claim reward', amount: 12.5 },
    ],
    totalClaimable: 12.5,
    status: 'idle',
    lastTxHash: null,
    errorMessage: null,
    claimAll: jest.fn(),
  };
});

/* ------------------------------------------------------------------ *
 * 1. App shell
 * ------------------------------------------------------------------ */

describe('App shell — top bar mobile layout', () => {
  it('reserves clearance so the fixed hamburger button never covers the chain controls', () => {
    render(<Topbar />);
    const header = screen.getByRole('banner');
    // 4rem left padding below lg (where the hamburger is fixed at left-4),
    // relaxing to the normal gutter at lg+ where the hamburger is hidden.
    expect(header.className).toContain('pl-16');
    expect(header.className).toContain('lg:pl-8');
    expect(header.className).toContain('pr-4');
  });

  it('keeps the wallet connection and submit-claim action visible at every viewport', () => {
    render(<Topbar />);
    const submit = screen.getByRole('button', { name: 'Submit a new claim' });
    const wallet = screen.getByRole('button', { name: /connect wallet/i });

    // Primary actions are never gated behind a breakpoint.
    for (const el of [submit, wallet]) {
      expect(el.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    }
    // The submit label swaps to a compact variant below sm.
    expect(submit.textContent).toContain('+ Claim');
    expect(submit.textContent).toContain('+ Submit Claim');
  });

  it('collapses secondary indicators and feed filters below sm to avoid overflow', () => {
    render(<Topbar />);

    const chainSelect = screen.getByLabelText('Select chain');
    expect(chainSelect.className).toContain('hidden');
    expect(chainSelect.className).toContain('sm:block');
    expect(chainSelect.className).toContain('min-w-0');

    const timeFilter = screen.getByLabelText('Filter by time');
    expect(timeFilter.className).toContain('hidden');
    expect(timeFilter.className).toContain('sm:block');

    // Secondary indicators are wrapped in elements hidden below sm.
    const themeToggle = screen.getByRole('button', { name: /toggle theme/i });
    expect(themeToggle.parentElement?.className).toContain('hidden');
    expect(themeToggle.parentElement?.className).toContain('sm:inline-flex');
  });

  it('lets the filter group shrink while the action group never compresses', () => {
    render(<Topbar />);
    const header = screen.getByRole('banner');
    const [left, right] = Array.from(header.children) as HTMLElement[];
    expect(left.className).toContain('min-w-0');
    expect(right.className).toContain('shrink-0');
  });
});

/* ------------------------------------------------------------------ *
 * 2. Claims feed
 * ------------------------------------------------------------------ */

describe('Claims feed — ActiveClaimsTable mobile layout', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      makeJsonResponse(makeEnvelope({ total: 30, totalPages: 3 }))
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  async function renderFeed() {
    const utils = renderWithQueryClient(<ActiveClaimsTable />);
    await waitFor(() =>
      expect(screen.getByLabelText(/search claims/i)).toBeInTheDocument()
    );
    return utils;
  }

  it('stacks the search row full-width below sm and lets the input shrink', async () => {
    await renderFeed();
    const search = screen.getByLabelText(/search claims/i);
    const row = search.closest('div')?.parentElement as HTMLElement;

    expect(row.className).toContain('w-full');
    expect(row.className).toContain('sm:w-auto');
    expect(search.className).toContain('w-full');
    expect(search.className).toContain('sm:w-auto');
    expect(search.closest('div')?.className).toContain('min-w-0');
  });

  it('lets the search field flex down so the row never overflows on narrow viewports', async () => {
    await renderFeed();
    const search = screen.getByLabelText(/search claims/i);
    const wrapper = search.closest('div') as HTMLElement;

    expect(wrapper.className).toContain('min-w-0');
    expect(wrapper.className).toContain('flex-1');
  });

  it('exposes the data table through a labelled, keyboard-focusable scroll region', async () => {
    const { container } = await renderFeed();
    const region = container.querySelector('[role="region"][aria-label*="Active claims"]');

    expect(region).not.toBeNull();
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region?.className).toContain('overflow-x-auto');

    const table = region?.querySelector('table');
    // Genuine data tables are the documented exception where horizontal
    // scrolling is allowed on narrow viewports.
    expect(table?.className).toContain('min-w-[640px]');
    expect(table?.className).toContain('w-full');
  });

  it('keeps filter buttons announced via aria-pressed on touch layouts', async () => {
    await renderFeed();
    const all = screen.getByRole('button', { name: /^All$/ });
    expect(all).toHaveAttribute('aria-pressed', 'true');
  });
});

/* ------------------------------------------------------------------ *
 * 3. Rewards claim
 * ------------------------------------------------------------------ */

describe('Rewards claim — ClaimRewardsPanel mobile layout', () => {
  it('stacks the header vertically below sm so total + claim button fit', () => {
    const { container } = render(<ClaimRewardsPanel />);
    const header = container.querySelector('.border-b') as HTMLElement;

    expect(header).not.toBeNull();
    expect(header.className).toContain('flex-col');
    expect(header.className).toContain('sm:flex-row');
    expect(header.className).toContain('px-4');
    expect(header.className).toContain('sm:px-6');
  });

  it('spreads total and claim action across the full row on mobile', () => {
    const { container } = render(<ClaimRewardsPanel />);
    const actionGroup = container.querySelector('[class*="sm:w-auto"]') as HTMLElement;

    expect(actionGroup).not.toBeNull();
    expect(actionGroup.className).toContain('w-full');
    expect(actionGroup.className).toContain('justify-between');
    expect(actionGroup.className).toContain('sm:justify-start');
  });

  it('truncates panel copy instead of overflowing narrow cards', () => {
    render(<ClaimRewardsPanel />);
    expect(screen.getByText('Claimable Rewards').className).toContain('truncate');
    expect(screen.getByText('Earned from verified claims').className).toContain('truncate');
    expect(screen.getByText('Verified claim reward').className).toContain('truncate');
  });

  it('keeps the claim action reachable and disabled while the balance is empty', () => {
    mockRewards = {
      pendingRewards: [],
      totalClaimable: 0,
      status: 'idle',
      lastTxHash: null,
      errorMessage: null,
      claimAll: jest.fn(),
    };
    render(<ClaimRewardsPanel />);

    const button = screen.getByRole('button', { name: /claim rewards/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/no unclaimed rewards/i)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ *
 * 4. Claim verification detail
 * ------------------------------------------------------------------ */

describe('Claim verification — detail page mobile layout', () => {
  it('wraps long claim titles and pins the status badge instead of overflowing', () => {
    render(<ClaimDetails claim={claimFixture} />);
    const title = screen.getByRole('heading', { level: 2 });
    expect(title.className).toContain('break-words');
    expect(title.className).toContain('min-w-0');

    const headerRow = title.parentElement as HTMLElement;
    expect(headerRow.className).toContain('flex-wrap');
    expect(headerRow.className).toContain('justify-between');
  });

  it('wraps the category/trust footer row on narrow viewports', () => {
    render(<ClaimDetails claim={claimFixture} />);

    let footer = screen.getByText(/Category:/) as HTMLElement | null;
    while (footer && !footer.className.includes('flex-wrap')) {
      footer = footer.parentElement;
    }

    expect(footer).not.toBeNull();
    expect(footer!.className).toContain('gap-2');
    expect(footer!.className).toContain('justify-between');
  });

  it('allows long evidence URLs to break instead of causing horizontal overflow', () => {
    render(<ClaimDetails claim={claimFixture} />);
    // Evidence links are rendered through SafeExternalLink, so the accessible
    // name comes from the labelled anchor rather than the raw URL text.
    const link = screen.getByRole('link', { name: /evidence link/i });
    expect(link.className).toContain('break-all');
  });

  it('stacks verify/reject actions below sm with ≥44px touch targets', () => {
    render(<VerificationActions claimId="claim-1" stakeAmount={10} />);
    const container = screen.getByRole('button', { name: /^Verify$/ }).parentElement as HTMLElement;

    expect(container.className).toContain('flex-col');
    expect(container.className).toContain('sm:flex-row');
    for (const name of [/^Verify$/, /^Reject$/]) {
      const btn = screen.getByRole('button', { name });
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('touch-manipulation');
    }
  });

  it('keeps the stake input full-width with a 44px minimum touch target', () => {
    render(<StakeForm claimId="claim-1" />);
    const input = screen.getByLabelText(/stake amount/i);
    expect(input.className).toContain('w-full');
    expect(input.className).toContain('min-h-[44px]');
    expect(input.className).toContain('text-base');
  });

  it('announces transaction state changes through live regions', () => {
    const { rerender } = render(<TransactionStatus status="idle" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(<TransactionStatus status="pending" />);
    const pending = screen.getByRole('status');
    expect(pending).toHaveAttribute('aria-live', 'polite');
    expect(pending).toHaveTextContent(/transaction pending/i);

    rerender(<TransactionStatus status="success" />);
    expect(screen.getByRole('status')).toHaveTextContent(/verification submitted/i);

    rerender(<TransactionStatus status="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/transaction failed/i);
  });
});

/* ------------------------------------------------------------------ *
 * 5. Dispute workflow
 * ------------------------------------------------------------------ */

describe('Dispute workflow — mobile layout', () => {
  it('stacks dispute stake input and vote buttons below sm with touch targets', () => {
    render(
      <DisputeVoting disputeId="dsp-1" currentStaked={500} onVote={jest.fn()} />
    );

    const input = screen.getByLabelText(/enter stake amount/i);
    expect(input.className).toContain('w-full');
    expect(input.className).toContain('text-base');

    const valid = screen.getByRole('button', { name: /vote valid/i });
    const invalid = screen.getByRole('button', { name: /vote invalid/i });
    // Two-column grid keeps both targets side-by-side but ≥44px tall on phones.
    const grid = valid.parentElement as HTMLElement;
    expect(grid.className).toContain('grid-cols-2');
    expect(valid.className).toMatch(/py-2\.5/);
    expect(invalid.className).toMatch(/py-2\.5/);
  });
});

/* ------------------------------------------------------------------ *
 * 6. Transaction status
 * ------------------------------------------------------------------ */

describe('Transaction status — mobile layout', () => {
  const base = {
    type: 'verification' as const,
    status: 'confirming' as const,
    title: 'Verification stake',
    description: 'Waiting for wallet confirmation on Optimism.',
    amount: '12.5 TBNT',
    timeAgo: 'just now',
    hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    progress: 40,
  };

  it('wraps the header so status badge and amount never collide', () => {
    render(<TransactionItem {...base} />);
    const heading = screen.getByRole('heading', { level: 3, name: /verification stake/i });

    // Walk up to the header row that owns both the text block and amount.
    let headerRow = heading as HTMLElement | null;
    while (
      headerRow &&
      !(headerRow.className.includes('justify-between') && headerRow.className.includes('gap-3'))
    ) {
      headerRow = headerRow.parentElement;
    }

    expect(headerRow).not.toBeNull();
    expect(headerRow!.className).toContain('flex-wrap');
    expect(headerRow!.className).toContain('gap-3');

    const left = headerRow!.firstElementChild as HTMLElement;
    expect(left.className).toContain('min-w-0');
  });

  it('wraps the footer and allows the hash reference to break', () => {
    render(<TransactionItem {...base} />);
    const code = screen.getByText(/0x12345678/);
    expect(code.className).toContain('break-all');

    const footer = code.closest('div')?.parentElement as HTMLElement;
    expect(footer.className).toContain('flex-wrap');
    expect(footer.className).toContain('justify-between');
  });

  it('drops the fixed card minimum width below sm so grid cards fit', () => {
    const { container } = render(<StatusCard status="pending" count={3} />);
    const card = container.firstElementChild as HTMLElement;

    expect(card.className).toContain('min-w-0');
    expect(card.className).toContain('w-full');
    expect(card.className).toContain('sm:min-w-[200px]');
  });
});

/* ------------------------------------------------------------------ *
 * 7. Evidence + claim detail cards
 * ------------------------------------------------------------------ */

describe('Evidence cards — mobile layout', () => {
  it('truncates evidence titles and pins the view action', () => {
    render(
      <EvidenceLinks
        evidences={[
          {
            id: 'e1',
            title: 'A very long evidence title that would otherwise push the view link off screen',
            description: 'Supporting description text for the evidence item',
            url: 'https://example.com/evidence-1',
          },
        ]}
      />
    );

    const link = screen.getByRole('link', { name: /view evidence/i });
    expect(link.className).toContain('shrink-0');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');

    const title = screen.getByText(/A very long evidence title/);
    expect(title.className).toContain('truncate');
    expect(title.parentElement?.className).toContain('min-w-0');
  });
});

/* ------------------------------------------------------------------ *
 * 8. Identity verification
 * ------------------------------------------------------------------ */

describe('Identity workflow — mobile layout', () => {
  it('renders both workflow steps and the Worldcoin panel on mobile', () => {
    render(<IdentityPage />);
    expect(screen.getByRole('heading', { name: /step 1: connect wallet/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /step 2: verify identity/i })).toBeInTheDocument();
    expect(screen.getByTestId('worldcoin-panel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^identity verification$/i })).toBeInTheDocument();
  });
});
