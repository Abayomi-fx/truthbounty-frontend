import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvidenceViewer } from '../EvidenceViewer';

describe('EvidenceViewer - accordion aria-expanded', () => {
  it('renders toggle button with aria-expanded=true by default', () => {
    render(<EvidenceViewer claimId="claim-1" />);
    const button = screen.getByRole('button', { name: /evidence/i });
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('toggles aria-expanded when button is clicked', () => {
    render(<EvidenceViewer claimId="claim-1" />);
    const button = screen.getByRole('button', { name: /evidence/i });

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('hides evidence content when collapsed', () => {
    render(<EvidenceViewer claimId="claim-1" />);
    const button = screen.getByRole('button', { name: /evidence/i });

    fireEvent.click(button);
    expect(screen.queryByText('Witness testimony text')).not.toBeInTheDocument();
  });

  it('shows evidence content when expanded', () => {
    render(<EvidenceViewer claimId="claim-1" />);
    expect(screen.getByText('Witness testimony text')).toBeInTheDocument();
  });

  it('button has aria-controls pointing to content id', () => {
    render(<EvidenceViewer claimId="claim-1" />);
    const button = screen.getByRole('button', { name: /evidence/i });
    expect(button).toHaveAttribute('aria-controls', 'evidence-content');
  });
});

describe('EvidenceViewer - scroll lock', () => {
  it('renders a scroll container when expanded', () => {
    render(<EvidenceViewer claimId="claim-1" />);
    expect(screen.getByTestId('evidence-scroll-container')).toBeInTheDocument();
  });

  it('does not render the scroll container when collapsed', () => {
    render(<EvidenceViewer claimId="claim-1" />);
    fireEvent.click(screen.getByRole('button', { name: /evidence/i }));
    expect(screen.queryByTestId('evidence-scroll-container')).not.toBeInTheDocument();
  });

  it('applies overscroll-behavior: contain to prevent scroll chaining (lock)', () => {
    render(<EvidenceViewer claimId="claim-1" />);
    const container = screen.getByTestId('evidence-scroll-container');
    // Inline style invariant: scroll must be contained within the viewer
    expect(container.style.overscrollBehavior).toBe('contain');
  });

  it('bounds the panel height so only one scroll surface exists', () => {
    render(<EvidenceViewer claimId="claim-1" />);
    const container = screen.getByTestId('evidence-scroll-container');
    // Invariant: max-height is bounded (prevents the page from being the scroller too)
    expect(container.style.maxHeight).toBe('60vh');
  });

  it('uses overflow-y auto + overscroll-contain utility classes', () => {
    render(<EvidenceViewer claimId="claim-1" />);
    const container = screen.getByTestId('evidence-scroll-container');
    expect(container).toHaveClass('overflow-y-auto');
    expect(container).toHaveClass('overscroll-contain');
  });

  it('protocol invariant: scroll lock is active iff the panel is expanded', () => {
    render(<EvidenceViewer claimId="claim-1" />);
    const button = screen.getByRole('button', { name: /evidence/i });

    // expanded -> scroll container present (lock active)
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('evidence-scroll-container')).toBeInTheDocument();

    // collapsed -> scroll container absent (no scrollable surface, no lock needed)
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('evidence-scroll-container')).not.toBeInTheDocument();

    // re-expanded -> lock re-engaged with same invariants
    fireEvent.click(button);
    const container = screen.getByTestId('evidence-scroll-container');
    expect(container.style.overscrollBehavior).toBe('contain');
    expect(container.style.maxHeight).toBe('60vh');
  });
});

describe('EvidenceViewer - fail-closed unsafe evidence rendering', () => {
  it('renders a safe https link as a hardened anchor', () => {
    render(
      <EvidenceViewer
        claimId="claim-1"
        evidence={[{ type: 'link', value: 'https://example.com/evidence' }]}
      />
    );

    const link = screen.getByRole('link', { name: /example\.com\/evidence/ });
    expect(link).toHaveAttribute('href', 'https://example.com/evidence');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toMatch(/noopener/);
    expect(link.getAttribute('rel')).toMatch(/noreferrer/);
  });

  it('blocks an unsafe link value as a blocked item, never an anchor', () => {
    render(
      <EvidenceViewer
        claimId="claim-1"
        evidence={[{ type: 'link', value: 'javascript:alert(1)' }]}
      />
    );

    expect(screen.getByTestId('evidence-blocked-item')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a safe https image source', () => {
    render(
      <EvidenceViewer
        claimId="claim-1"
        evidence={[{ type: 'image', value: 'https://example.com/evidence/img1.png' }]}
      />
    );

    const img = screen.getByAltText('Evidence image') as HTMLImageElement;
    expect(img.src).toContain('https://example.com/evidence/img1.png');
    expect(img.getAttribute('referrerPolicy')).toBe('no-referrer');
  });

  it('blocks an unsafe image value (data:) as a blocked item', () => {
    render(
      <EvidenceViewer
        claimId="claim-1"
        evidence={[{ type: 'image', value: 'data:text/html,<script>alert(1)</script>' }]}
      />
    );

    expect(screen.getByTestId('evidence-blocked-item')).toBeInTheDocument();
    expect(screen.queryByAltText('Evidence image')).not.toBeInTheDocument();
  });

  it('renders a safe ipfs link through the gateway', () => {
    render(
      <EvidenceViewer
        claimId="claim-1"
        evidence={[
          { type: 'link', value: 'ipfs://QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX/doc' },
        ]}
      />
    );

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toContain('dweb.link/ipfs/QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX/doc');
  });

  it('renders plain text evidence as text children, never dangerouslySetInnerHTML', () => {
    render(
      <EvidenceViewer
        claimId="claim-1"
        evidence={[{ type: 'text', value: '<script>alert("xss")</script>' }]}
      />
    );

    // React escapes it as a text node; no script element is mounted.
    expect(
      screen.getByText('<script>alert("xss")</script>')
    ).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });
});
