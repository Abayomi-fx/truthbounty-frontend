/**
 * Design system: header typography
 *
 * Invariants enforced by these tests:
 *   - h1 elements use the `font-bold` (700) utility class.
 *   - h2..h4 elements use the `font-semibold` (600) utility class.
 *   - No header in the audited components uses the under-weighted
 *     `font-medium` utility, which was previously misaligned with the
 *     design system.
 *
 * These tests were added in response to the audit finding:
 *   "Incorrect fontWeight in headers — Design system alignment".
 */

import React from 'react';
import { render } from '@testing-library/react';

// Components under test pull in wagmi hooks (via useDisputeContext on
// MainClaimCard's OpenDispute panel); provide inert stubs so rendering works
// without a WagmiProvider.
jest.mock('wagmi', () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => 11155420,
  useBlockNumber: () => ({ data: BigInt(12345678) }),
  usePublicClient: () => ({}),
}));

import { ClaimStats } from '@/components/features/claim-details/ClaimStats';
import { TopVerifiers } from '@/components/features/claim-details/TopVerifiers';
import { MainClaimCard } from '@/components/features/claim-details/MainClaimCard';
import { DisputeVoting } from '@/components/features/disputes/DisputeVoting';
import type { ClaimData, TopVerifier } from '@/app/types/dispute';

const claimDataFixture: ClaimData = {
  id: 'claim_1',
  category: 'Politics',
  hash: '0xabc',
  status: 'Verified',
  title: 'Sample claim title',
  source: 'example.com',
  timeAgo: '2h ago',
  votesFor: 80,
  votesAgainst: 20,
  verifiersCount: 12,
  confidenceScore: 85,
  totalStaked: 5000,
};

const verifiersFixture: TopVerifier[] = [
  { id: 'v1', rank: 1, name: 'Alice', staked: '$1,000', score: 95 },
];

/**
 * Returns the font-weight Tailwind utility class applied to the element,
 * if any. Returns `null` when no recognized weight class is present.
 */
function getFontWeightClass(el: Element | null): string | null {
  if (!el) return null;
  const classes = (el.getAttribute('class') ?? '').split(/\s+/);
  const weights = [
    'font-thin',
    'font-extralight',
    'font-light',
    'font-normal',
    'font-medium',
    'font-semibold',
    'font-bold',
    'font-extrabold',
    'font-black',
  ];
  return classes.find((c) => weights.includes(c)) ?? null;
}

describe('Design system: header font-weight invariants', () => {
  it('ClaimStats h2 uses font-semibold', () => {
    const { container } = render(<ClaimStats data={claimDataFixture} />);
    const h2 = container.querySelector('h2');
    expect(h2).not.toBeNull();
    expect(getFontWeightClass(h2)).toBe('font-semibold');
  });

  it('TopVerifiers h2 uses font-semibold', () => {
    const { container } = render(<TopVerifiers verifiers={verifiersFixture} />);
    const h2 = container.querySelector('h2');
    expect(h2).not.toBeNull();
    expect(getFontWeightClass(h2)).toBe('font-semibold');
  });

  it('MainClaimCard h1 uses font-bold and h3 elements use font-semibold', () => {
    const { container } = render(<MainClaimCard data={claimDataFixture} />);

    const h1 = container.querySelector('h1');
    expect(h1).not.toBeNull();
    expect(getFontWeightClass(h1)).toBe('font-bold');

    const h3List = container.querySelectorAll('h3');
    // The MainClaimCard renders at least the "Verification Breakdown" and
    // "Confidence Score" subsection headings.
    expect(h3List.length).toBeGreaterThanOrEqual(2);
    h3List.forEach((h3) => {
      expect(getFontWeightClass(h3)).toBe('font-semibold');
    });
  });

  it('DisputeVoting h3 uses font-semibold (not font-bold)', () => {
    const { container } = render(
      <DisputeVoting
        disputeId="dsp_1"
        currentStaked={1000}
        onVote={async () => {}}
      />
    );
    const h3 = container.querySelector('h3');
    expect(h3).not.toBeNull();
    expect(getFontWeightClass(h3)).toBe('font-semibold');
  });

  it('No audited header uses the under-weighted font-medium utility', () => {
    const { container: c1 } = render(<ClaimStats data={claimDataFixture} />);
    const { container: c2 } = render(
      <TopVerifiers verifiers={verifiersFixture} />
    );
    const { container: c3 } = render(<MainClaimCard data={claimDataFixture} />);
    const { container: c4 } = render(
      <DisputeVoting
        disputeId="dsp_1"
        currentStaked={1000}
        onVote={async () => {}}
      />
    );

    [c1, c2, c3, c4].forEach((root) => {
      const headers = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headers.forEach((h) => {
        expect(getFontWeightClass(h)).not.toBe('font-medium');
      });
    });
  });
});
