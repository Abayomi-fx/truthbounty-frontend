import React from 'react';
import { render, screen } from '@testing-library/react';

import { ClaimDetails } from '../ClaimDetails';
import { createMockClaim } from '@/__tests__/utils/test-utils';

jest.mock('@/components/hooks/useTrust', () => ({
  useTrustForAddress: () => ({
    isVerified: false,
    reputation: 50,
    accountAgeDays: 5,
    suspicious: false,
  }),
}));

jest.mock('@/components/ui/TrustScoreTooltip', () => {
  function MockTrustScoreTooltip() {
    return <span data-testid="tooltip">tooltip</span>;
  }

  return MockTrustScoreTooltip;
});

/**
 * V2-FE-132 — evidence rendering inside the claim detail view must fail
 * closed. The evidence list goes through `sanitizeEvidenceList`; safe links
 * render through SafeExternalLink and blocked items render as an accessible
 * note, never as an anchor.
 */
describe('ClaimDetails - evidence rendering', () => {
  it('renders a safe evidence link as a hardened anchor', () => {
    const claim = createMockClaim({
      evidence: [
        {
          id: 'ev-1',
          type: 'link',
          value: 'https://example.com/proof',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    render(<ClaimDetails claim={claim} />);

    const link = screen.getByRole('link', { name: /Evidence link/ });
    expect(link).toHaveAttribute('href', 'https://example.com/proof');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toMatch(/noopener/);
    expect(link.getAttribute('rel')).toMatch(/noreferrer/);
  });

  it('renders an unsafe evidence link as a blocked note, not an anchor', () => {
    const claim = createMockClaim({
      evidence: [
        {
          id: 'ev-2',
          type: 'link',
          value: 'javascript:alert(document.cookie)',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    render(<ClaimDetails claim={claim} />);

    expect(screen.getByRole('note')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a safe evidence text item as plain text', () => {
    const claim = createMockClaim({
      evidence: [
        {
          id: 'ev-3',
          type: 'text',
          value: 'Witness testimony',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    render(<ClaimDetails claim={claim} />);

    expect(screen.getByText('Witness testimony')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('blocks an unsafe evidence image instead of rendering it', () => {
    const claim = createMockClaim({
      evidence: [
        {
          id: 'ev-4',
          type: 'image',
          value: 'data:text/html,<script>alert(1)</script>',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    render(<ClaimDetails claim={claim} />);

    expect(screen.getByRole('note')).toBeInTheDocument();
    expect(screen.queryByAltText('Evidence image')).not.toBeInTheDocument();
  });
});