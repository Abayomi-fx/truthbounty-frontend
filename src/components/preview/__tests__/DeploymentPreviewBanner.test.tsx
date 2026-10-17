/**
 * V2-FE-064 — DeploymentPreviewBanner Component Tests
 *
 * Covers:
 *  - verified state renders provenance metadata (commit, release, chain, artifact, API, env)
 *  - blocked state renders role="alert" with failure reasons
 *  - not_preview returns null (no DOM rendered)
 *  - blocked banner cannot be dismissed
 *  - verified banner can be dismissed
 *  - WCAG AA accessibility (axe-core)
 *  - live region roles
 *  - display never contains secrets or fabricated state
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import { DeploymentPreviewBanner } from '../DeploymentPreviewBanner';
import type { PreviewVerificationResult, PreviewDisplayInfo } from '@/lib/deployment';

expect.extend(toHaveNoViolations);

function makeDisplayInfo(overrides: Partial<PreviewDisplayInfo> = {}): PreviewDisplayInfo {
  return {
    commitShort: 'a1b2c3d',
    commitFull: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    releaseId: 'v2.0.0-sepolia-preview-42',
    protocolVersion: '2.0.0',
    chainId: 11155420,
    chainName: 'Optimism Sepolia',
    artifactChecksumShort: 'aaaaaaaaaaaa',
    artifactChecksumFull: 'a'.repeat(64),
    apiVersion: 'v2',
    environment: 'preview',
    builtAt: '2026-10-15T10:00:00.000Z',
    prNumber: 42,
    buildId: 'build-ci-001',
    checksumMatchesRegistry: true,
    ...overrides,
  };
}

const verifiedResult: PreviewVerificationResult = {
  status: 'verified',
  allowsMutation: true,
  manifest: {
    gitCommit: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    releaseId: 'v2.0.0-sepolia-preview-42',
    protocolVersion: '2.0.0',
    chainId: 11155420,
    artifactChecksum: 'a'.repeat(64),
    apiUrl: 'https://api-preview.staging.example.com',
    apiVersion: 'v2',
    environment: 'preview',
    builtAt: '2026-10-15T10:00:00.000Z',
    prNumber: 42,
    buildId: 'build-ci-001',
  },
  displayInfo: makeDisplayInfo(),
  failures: [],
  failureDetails: [],
};

const blockedResult: PreviewVerificationResult = {
  status: 'blocked',
  allowsMutation: false,
  manifest: null,
  displayInfo: null,
  failures: ['wrong_chain', 'production_targeting'],
  failureDetails: [
    'chainId 10 (Optimism Mainnet) is a production chain.',
    'environment is set to "production".',
  ],
};

const notPreviewResult: PreviewVerificationResult = {
  status: 'not_preview',
  allowsMutation: true,
  manifest: null,
  displayInfo: null,
  failures: [],
  failureDetails: [],
};

describe('DeploymentPreviewBanner — verified state', () => {
  it('renders the banner with provenance metadata', () => {
    render(<DeploymentPreviewBanner verificationResult={verifiedResult} />);
    expect(screen.getByTestId('deployment-preview-banner')).toBeInTheDocument();
    expect(screen.getByText(/a1b2c3d/)).toBeInTheDocument();
    expect(screen.getByText(/v2\.0\.0-sepolia-preview-42/)).toBeInTheDocument();
    expect(screen.getByText(/Optimism Sepolia/)).toBeInTheDocument();
    expect(screen.getByText(/v2/)).toBeInTheDocument();
    expect(screen.getByText(/preview/i)).toBeInTheDocument();
  });

  it('shows PR number when present', () => {
    render(<DeploymentPreviewBanner verificationResult={verifiedResult} />);
    expect(screen.getByText(/PR #42/)).toBeInTheDocument();
  });

  it('uses role="status" (polite live region) for verified state', () => {
    render(<DeploymentPreviewBanner verificationResult={verifiedResult} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has a dismiss button when dismissible=true (default)', () => {
    render(<DeploymentPreviewBanner verificationResult={verifiedResult} />);
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('hides the banner after dismiss', () => {
    render(<DeploymentPreviewBanner verificationResult={verifiedResult} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByTestId('deployment-preview-banner')).not.toBeInTheDocument();
  });

  it('does not render dismiss button when dismissible=false', () => {
    render(
      <DeploymentPreviewBanner verificationResult={verifiedResult} dismissible={false} />,
    );
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });

  it('shows checksum registry match indicator', () => {
    render(<DeploymentPreviewBanner verificationResult={verifiedResult} />);
    const checksumEl = screen.getByLabelText(/artifact checksum.*matches registry/i);
    expect(checksumEl).toBeInTheDocument();
  });

  it('has no axe WCAG AA violations', async () => {
    const { container } = render(
      <DeploymentPreviewBanner verificationResult={verifiedResult} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('DeploymentPreviewBanner — blocked state', () => {
  it('renders the blocked banner with role="alert"', () => {
    render(<DeploymentPreviewBanner verificationResult={blockedResult} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders all failure details', () => {
    render(<DeploymentPreviewBanner verificationResult={blockedResult} />);
    expect(
      screen.getByText(/chainId 10 \(Optimism Mainnet\) is a production chain/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/environment is set to "production"/i),
    ).toBeInTheDocument();
  });

  it('blocked banner CANNOT be dismissed (no dismiss button)', () => {
    render(<DeploymentPreviewBanner verificationResult={blockedResult} />);
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });

  it('blocked banner stays rendered even when dismissed=true via prop attempt', () => {
    // The banner itself controls dismissibility; blocked always stays
    render(
      <DeploymentPreviewBanner verificationResult={blockedResult} dismissible={true} />,
    );
    // No dismiss button for blocked state
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('has no axe WCAG AA violations', async () => {
    const { container } = render(
      <DeploymentPreviewBanner verificationResult={blockedResult} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('data-preview-status attribute is "blocked"', () => {
    render(<DeploymentPreviewBanner verificationResult={blockedResult} />);
    expect(screen.getByTestId('deployment-preview-banner')).toHaveAttribute(
      'data-preview-status',
      'blocked',
    );
  });
});

describe('DeploymentPreviewBanner — not_preview state', () => {
  it('renders nothing when status is not_preview', () => {
    const { container } = render(
      <DeploymentPreviewBanner verificationResult={notPreviewResult} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('no wrapper div is rendered', () => {
    render(<DeploymentPreviewBanner verificationResult={notPreviewResult} />);
    expect(screen.queryByTestId('deployment-preview-banner-wrapper')).not.toBeInTheDocument();
  });
});

describe('DeploymentPreviewBanner — security invariants', () => {
  it('does not render any production secrets in the DOM', () => {
    render(<DeploymentPreviewBanner verificationResult={verifiedResult} />);
    const domText = document.body.textContent ?? '';
    expect(domText).not.toContain('password');
    expect(domText).not.toContain('secret');
    expect(domText).not.toContain('PRIVATE');
    expect(domText).not.toContain('0x0000000000000000000000000000000000000000');
  });

  it('verified banner data-preview-status is "verified"', () => {
    render(<DeploymentPreviewBanner verificationResult={verifiedResult} />);
    expect(screen.getByTestId('deployment-preview-banner')).toHaveAttribute(
      'data-preview-status',
      'verified',
    );
  });

  it('verified banner exposes chain-id as data attribute (not fabricated)', () => {
    render(<DeploymentPreviewBanner verificationResult={verifiedResult} />);
    expect(screen.getByTestId('deployment-preview-banner')).toHaveAttribute(
      'data-preview-chain-id',
      '11155420',
    );
  });
});
