/**
 * V2-FE-064 — DeploymentPreviewGuard Component Tests
 *
 * Covers:
 *  - not_preview: children pass through unmodified
 *  - verified: children pass through unmodified
 *  - blocked: children NOT rendered by default; alert rendered
 *  - blocked with renderChildrenWhenBlocked=true: children visually hidden
 *  - WCAG AA accessibility via axe-core
 *  - data-testid attributes for automated verification
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import { DeploymentPreviewGuard } from '../DeploymentPreviewGuard';
import type { PreviewVerificationResult } from '@/lib/deployment';

expect.extend(toHaveNoViolations);

const notPreviewResult: PreviewVerificationResult = {
  status: 'not_preview',
  allowsMutation: true,
  manifest: null,
  displayInfo: null,
  failures: [],
  failureDetails: [],
};

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
  displayInfo: {
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
  },
  failures: [],
  failureDetails: [],
};

const blockedResult: PreviewVerificationResult = {
  status: 'blocked',
  allowsMutation: false,
  manifest: null,
  displayInfo: null,
  failures: ['production_targeting', 'wrong_chain'],
  failureDetails: [
    'chainId 10 (Optimism Mainnet) is a production chain.',
    'Preview builds must target Optimism Sepolia (11155420).',
  ],
};

describe('DeploymentPreviewGuard — not_preview', () => {
  it('renders children transparently', () => {
    render(
      <DeploymentPreviewGuard verificationResult={notPreviewResult}>
        <button>Submit Claim</button>
      </DeploymentPreviewGuard>,
    );
    expect(screen.getByRole('button', { name: 'Submit Claim' })).toBeInTheDocument();
  });

  it('data-preview-guard-status is "not_preview"', () => {
    render(
      <DeploymentPreviewGuard verificationResult={notPreviewResult}>
        <span>content</span>
      </DeploymentPreviewGuard>,
    );
    expect(screen.getByTestId('deployment-preview-guard')).toHaveAttribute(
      'data-preview-guard-status',
      'not_preview',
    );
  });

  it('no alert rendered', () => {
    render(
      <DeploymentPreviewGuard verificationResult={notPreviewResult}>
        <span>content</span>
      </DeploymentPreviewGuard>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('DeploymentPreviewGuard — verified', () => {
  it('renders children when verified', () => {
    render(
      <DeploymentPreviewGuard verificationResult={verifiedResult}>
        <button>Submit Claim</button>
      </DeploymentPreviewGuard>,
    );
    expect(screen.getByRole('button', { name: 'Submit Claim' })).toBeInTheDocument();
  });

  it('data-preview-guard-status is "verified"', () => {
    render(
      <DeploymentPreviewGuard verificationResult={verifiedResult}>
        <span>content</span>
      </DeploymentPreviewGuard>,
    );
    expect(screen.getByTestId('deployment-preview-guard')).toHaveAttribute(
      'data-preview-guard-status',
      'verified',
    );
  });

  it('no alert rendered for verified', () => {
    render(
      <DeploymentPreviewGuard verificationResult={verifiedResult}>
        <span>content</span>
      </DeploymentPreviewGuard>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <DeploymentPreviewGuard verificationResult={verifiedResult}>
        <button>Submit</button>
      </DeploymentPreviewGuard>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DeploymentPreviewGuard — blocked (fail closed)', () => {
  it('renders role="alert" with failure details', () => {
    render(
      <DeploymentPreviewGuard verificationResult={blockedResult}>
        <button>Submit Claim</button>
      </DeploymentPreviewGuard>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText(/chainId 10 \(Optimism Mainnet\) is a production chain/i),
    ).toBeInTheDocument();
  });

  it('does NOT render children by default when blocked', () => {
    render(
      <DeploymentPreviewGuard verificationResult={blockedResult}>
        <button>Submit Claim</button>
      </DeploymentPreviewGuard>,
    );
    expect(screen.queryByRole('button', { name: 'Submit Claim' })).not.toBeInTheDocument();
  });

  it('data-preview-guard-status is "blocked"', () => {
    render(
      <DeploymentPreviewGuard verificationResult={blockedResult}>
        <span>content</span>
      </DeploymentPreviewGuard>,
    );
    expect(screen.getByTestId('deployment-preview-guard')).toHaveAttribute(
      'data-preview-guard-status',
      'blocked',
    );
  });

  it('renders hidden children when renderChildrenWhenBlocked=true', () => {
    render(
      <DeploymentPreviewGuard
        verificationResult={blockedResult}
        renderChildrenWhenBlocked={true}
      >
        <button>Submit Claim</button>
      </DeploymentPreviewGuard>,
    );
    const hiddenWrapper = screen.getByTestId('deployment-preview-guard-children-hidden');
    expect(hiddenWrapper).toBeInTheDocument();
    expect(hiddenWrapper).toHaveAttribute('aria-hidden', 'true');
  });

  it('hidden children wrapper has pointer-events none (not interactive)', () => {
    render(
      <DeploymentPreviewGuard
        verificationResult={blockedResult}
        renderChildrenWhenBlocked={true}
      >
        <button>Submit Claim</button>
      </DeploymentPreviewGuard>,
    );
    const hiddenWrapper = screen.getByTestId('deployment-preview-guard-children-hidden');
    expect(hiddenWrapper.className).toContain('pointer-events-none');
  });

  it('has no axe violations for blocked state', async () => {
    const { container } = render(
      <DeploymentPreviewGuard verificationResult={blockedResult}>
        <button>Submit</button>
      </DeploymentPreviewGuard>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('mentions mutations are blocked in the alert text', () => {
    render(
      <DeploymentPreviewGuard verificationResult={blockedResult}>
        <span>content</span>
      </DeploymentPreviewGuard>,
    );
    expect(screen.getByRole('alert').textContent).toMatch(/block/i);
  });
});
