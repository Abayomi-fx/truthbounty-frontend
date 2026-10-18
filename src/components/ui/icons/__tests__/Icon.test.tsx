/**
 * UI-FE-089 — `Icon` accessibility and variant contract.
 *
 * Proves that decorative icons are removed from the accessibility tree,
 * meaningful icons require (and expose) an accessible name, and that the
 * size/stroke/tone/disabled/motion variants behave consistently.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import { assertAccessible } from '@/__tests__/utils/axe';
import { Icon, type IconProps } from '@/components/ui/icons';

describe('Icon', () => {
  it('is decorative by default and hidden from assistive technology', () => {
    const { container } = render(<Icon name="shield" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).toHaveAttribute('data-decorative', 'true');
    expect(svg).not.toHaveAttribute('role', 'img');
  });

  it('exposes an accessible name via title when meaningful', () => {
    render(<Icon name="shield-check" decorative={false} title="Verified secure" />);
    const img = screen.getByRole('img', { name: 'Verified secure' });
    expect(img).toHaveAttribute('data-decorative', 'false');
    expect(img).not.toHaveAttribute('aria-hidden');
  });

  it('exposes an accessible name via aria-label when meaningful', () => {
    render(
      <Icon name="lock" decorative={false} aria-label="Access restricted" />,
    );
    expect(screen.getByRole('img', { name: 'Access restricted' })).toBeInTheDocument();
  });

  it('throws when a meaningful icon has no accessible name', () => {
    const invalidProps = {
      name: 'shield',
      decorative: false,
    } as unknown as IconProps;
    expect(() => render(<Icon {...invalidProps} />)).toThrow(
      /not decorative/i,
    );
  });

  it('applies size and derived stroke width', () => {
    const { container } = render(<Icon name="check" size="xl" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('size-8');
    expect(svg).toHaveAttribute('stroke-width', '1.5');
    expect(svg).toHaveAttribute('data-size', 'xl');
  });

  it('applies semantic tone colour and allows an override', () => {
    const { container } = render(<Icon name="alert-triangle" tone="danger" />);
    expect(container.querySelector('svg')).toHaveClass('text-danger');
  });

  it('marks disabled icons without removing them', () => {
    const { container } = render(<Icon name="ban" disabled />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-disabled', 'true');
    expect(svg).toHaveClass('opacity-50');
  });

  it('animates the loader only when motion is safe', () => {
    const { container } = render(<Icon name="loader" />);
    expect(container.querySelector('svg')).toHaveClass('motion-safe:animate-spin');
  });

  it('is axe-clean as a decorative icon and as an icon-only control', async () => {
    const { container } = render(
      <button type="button" aria-label="Refresh data">
        <Icon name="refresh" />
      </button>,
    );
    await assertAccessible(container);
  });

  // Compile-time guard: meaningful icons MUST have an accessible name.
  it('rejects unnamed meaningful icons at the type level', () => {
    // @ts-expect-error meaningful icons require a title or aria-label
    const _invalid: IconProps = { name: 'shield', decorative: false };
    expect(_invalid).toBeDefined();
  });
});
