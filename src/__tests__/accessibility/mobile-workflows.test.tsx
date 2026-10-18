/**
 * V2-FE-128 — Accessibility coverage for the mobile responsive workflow UI.
 *
 * Every workflow component touched by the mobile responsiveness work is
 * checked with axe so stacking/wrapping changes cannot silently regress
 * labels, announcements or landmark structure. Keyboard/focus behaviour of
 * the scroll region and live regions is asserted in
 * `src/__tests__/responsive/mobile-workflows.test.tsx`.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { assertAccessible } from '../utils/axe';
import {
  makeEnvelope,
  makeJsonResponse,
} from '@/hooks/__tests__/claim-list-fixtures';

import ActiveClaimsTable from '@/components/features/ActiveClaimsTable';
import ClaimRewardsPanel from '@/components/features/ClaimRewardsPanel';
import { ClaimDetails } from '@/components/features/claim-verification/ClaimDetails';
import { VerificationActions } from '@/components/features/claim-verification/VerificationActions';
import { TransactionStatus } from '@/components/features/claim-verification/TransactionStatus';
import { TransactionItem } from '@/components/transactions/transaction-item';
import { EvidenceLinks } from '@/components/features/claim-details/EvidenceLinks';
import type { Claim } from '@/app/types/claim';

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

const claimFixture: Claim = {
  id: 'claim-a11y-1',
  title: 'Responsive workflow claim used for accessibility checks',
  description: 'A description long enough to wrap across multiple lines on phones.',
  category: 'Science',
  claimantAddress: '0x1234567890123456789012345678901234567890',
  status: 'OPEN',
  bountyAmount: 100,
  totalStaked: 1000,
  evidence: [
    {
      id: 'ev-1',
      type: 'link',
      value: 'https://example.com/evidence',
      createdAt: new Date().toISOString(),
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  mockRewards = {
    pendingRewards: [{ claimId: 'c1', title: 'Verified claim reward', amount: 12.5 }],
    totalClaimable: 12.5,
    status: 'idle',
    lastTxHash: null,
    errorMessage: null,
    claimAll: jest.fn(),
  };
});

describe('Accessibility: mobile responsive workflow components', () => {
  it('ActiveClaimsTable (claims feed) has no axe violations', async () => {
    // The claims feed reads rows from the canonical projection query, so it
    // needs a QueryClientProvider and a resolved projection to render content.
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(makeJsonResponse(makeEnvelope()));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ActiveClaimsTable />
      </QueryClientProvider>
    );
    await waitFor(() =>
      expect(container.querySelector('table')).not.toBeNull()
    );
    await assertAccessible(container);
    jest.restoreAllMocks();
  });

  it('ClaimRewardsPanel (rewards claim) has no axe violations', async () => {
    const { container } = render(<ClaimRewardsPanel />);
    await assertAccessible(container);
  });

  it('ClaimDetails (claim verification) has no axe violations', async () => {
    const { container } = render(<ClaimDetails claim={claimFixture} />);
    await assertAccessible(container);
  });

  it('VerificationActions (decision workflow) has no axe violations', async () => {
    const { container } = render(
      <VerificationActions claimId="claim-1" stakeAmount={10} />
    );
    await assertAccessible(container);
  });

  it('TransactionStatus announces every user-visible state accessibly', async () => {
    const { container, rerender } = render(<TransactionStatus status="pending" />);
    await assertAccessible(container);

    rerender(<TransactionStatus status="success" />);
    await assertAccessible(container);

    rerender(<TransactionStatus status="error" />);
    await assertAccessible(container);
  });

  it('TransactionItem (transaction status) has no axe violations', async () => {
    const { container } = render(
      <TransactionItem
        type="verification"
        status="failed"
        title="Verification stake"
        description="The transaction could not be confirmed."
        amount="12.5 TBNT"
        timeAgo="2m ago"
        hash="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        errorMessage="Transaction reverted on chain."
        onRetry={() => undefined}
      />
    );
    await assertAccessible(container);
  });

  it('EvidenceLinks (evidence workflow) has no axe violations', async () => {
    const { container } = render(
      <EvidenceLinks
        evidences={[
          {
            id: 'e1',
            title: 'Evidence title',
            description: 'Evidence description',
            url: 'https://example.com/evidence-1',
          },
        ]}
      />
    );
    await assertAccessible(container);
  });
});
