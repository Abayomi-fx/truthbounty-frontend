import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SafeExternalLink } from '@/components/security/SafeExternalLink';
import { SAFE_EXTERNAL_REL } from '@/lib/security/evidence-sanitizer';

describe('SafeExternalLink', () => {
  it('renders hardened rel for target="_blank" external links', () => {
    render(
      <SafeExternalLink href="https://example.com">
        link
      </SafeExternalLink>,
    );
    const anchor = screen.getByRole('link', { name: /opens example\.com/i });
    expect(anchor).toHaveAttribute('target', '_blank');
    expect(anchor).toHaveAttribute('referrerpolicy', 'no-referrer');
    const rel = anchor.getAttribute('rel') ?? '';
    const tokens = rel.toLowerCase().split(/\s+/).filter(Boolean);
    expect(tokens).toContain('noopener');
    expect(tokens).toContain('noreferrer');
    expect(tokens).toContain('nofollow');
  });

  it('exports SAFE_EXTERNAL_REL constant with all three required tokens', () => {
    const tokens = SAFE_EXTERNAL_REL.toLowerCase().split(/\s+/).filter(Boolean);
    expect(tokens).toContain('noopener');
    expect(tokens).toContain('noreferrer');
    expect(tokens).toContain('nofollow');
  });

  it('blocks unsafe href schemes (fail-closed, does not render anchor)', () => {
    const { container } = render(
      <SafeExternalLink href="javascript:alert(1)">click</SafeExternalLink>,
    );
    expect(container.querySelector('a')).toBeNull();
  });

  it('shows the destination domain to users', () => {
    render(<SafeExternalLink href="https://sub.example.com/x">Evidence</SafeExternalLink>);
    expect(screen.getByText('sub.example.com')).toBeInTheDocument();
  });

  it('is keyboard focusable when safe', async () => {
    const user = userEvent.setup();
    render(<SafeExternalLink href="https://example.com">Open</SafeExternalLink>);
    const anchor = screen.getByRole('link', { name: /opens example\.com/i });
    await user.tab();
    expect(anchor).toHaveFocus();
  });
});
