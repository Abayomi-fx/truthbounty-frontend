import React from 'react';
import { render, screen } from '@testing-library/react';

import { EvidenceLinks } from '../EvidenceLinks';

/**
 * V2-FE-132 — fail-closed evidence rendering. Evidence URLs are untrusted API
 * content; safe links must render as hardened anchors and unsafe URLs must
 * render as a blocked placeholder (never an anchor).
 */
describe('EvidenceLinks', () => {
  const evidenceProps = {
    evidences: [
      {
        id: 'ev-0',
        title: 'Report',
        description: 'Official report',
        url: 'https://docs.example.com/report',
      },
    ],
  };

  it('renders a safe https url as a hardened anchor', () => {
    render(<EvidenceLinks {...evidenceProps} />);

    const link = screen.getByRole('link', { name: /view/i });
    expect(link).toHaveAttribute('href', 'https://docs.example.com/report');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toMatch(/noopener/);
    expect(link.getAttribute('rel')).toMatch(/noreferrer/);
  });

  it('renders a safe ipfs url as a hardened anchor', () => {
    render(
      <EvidenceLinks
        evidences={[
          {
            id: 'ev-ipfs',
            title: 'IPFS doc',
            description: 'Content-addressed document',
            url: 'ipfs://QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX/document',
          },
        ]}
      />
    );

    const link = screen.getByRole('link', { name: /view/i });
    expect(link).toHaveAttribute('href', 'https://dweb.link/ipfs/QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX/document');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('blocks a javascript: url instead of rendering a clickable anchor', () => {
    render(
      <EvidenceLinks
        evidences={[
          {
            id: 'ev-2',
            title: 'Phish',
            description: 'Contains a script payload',
            url: 'javascript:alert(document.cookie)',
          },
        ]}
      />
    );

    const blocked = screen.getByRole('img');
    expect(blocked).toHaveTextContent('Invalid URI');
    expect(screen.queryByRole('link', { name: /view/i })).not.toBeInTheDocument();
  });

  it('blocks a protocol-relative url', () => {
    render(
      <EvidenceLinks
        evidences={[
          {
            id: 'ev-3',
            title: 'Evil',
            description: 'Protocol-relative url',
            url: '//evil.example/path',
          },
        ]}
      />
    );

    expect(screen.getByRole('img')).toHaveTextContent('Invalid URI');
    expect(screen.queryByRole('link', { name: /view/i })).not.toBeInTheDocument();
  });

  it('blocks a data: url', () => {
    render(
      <EvidenceLinks
        evidences={[
          {
            id: 'ev-4',
            title: 'Data url',
            description: 'Embedded payload',
            url: 'data:text/html,<script>alert(1)</script>',
          },
        ]}
      />
    );

    expect(screen.getByRole('img')).toHaveTextContent('Invalid URI');
    expect(screen.queryByRole('link', { name: /view/i })).not.toBeInTheDocument();
  });

  it('blocks an empty url', () => {
    render(
      <EvidenceLinks
        evidences={[
          {
            id: 'ev-5',
            title: 'Empty url',
            description: 'No url',
            url: '   ',
          },
        ]}
      />
    );

    expect(screen.getByRole('img')).toHaveTextContent('Invalid URI');
    expect(screen.queryByRole('link', { name: /view/i })).not.toBeInTheDocument();
  });

  it('percent-encodes unsafe characters inside a valid https url instead of leaking them raw', () => {
    render(
      <EvidenceLinks
        evidences={[
          {
            id: 'ev-6',
            title: 'Encoded url',
            description: 'Percent-encoding behaviour',
            url: "https://example.com/ok' onfocus='alert(1)'",
          },
        ]}
      />
    );

    // Upstream canonical behaviour: the scheme/authority are validated, and the
    // href is serialized through `new URL(...)`, which percent-encodes control
    // characters (the space becomes %20) so an attacker-controlled value can
    // never break out of the href attribute or inject an event handler.
    const link = screen.getByRole('link', { name: /view/i });
    expect(link).toHaveAttribute('href', "https://example.com/ok'%20onfocus='alert(1)'");
    expect(link.getAttribute('href')).not.toContain('"');
  });
});