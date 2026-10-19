/**
 * V2-FE-047 — Integration: secure SIWE session UX end-to-end.
 *
 * Drives the real useSiweAuth orchestration through the presentational panel
 * with an injected API client and signature function. Proves:
 *   - the exact backend message is presented verbatim before signing,
 *   - signing is impossible until the user explicitly reviews the message,
 *   - success transitions to an authenticated session,
 *   - logout clears the session and returns to idle.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SiweSessionPanel } from '@/components/auth';
import { createMemorySessionStore } from '@/lib/auth/session-store';
import type { SiweApiClient } from '@/lib/auth/siwe-client';

jest.mock('wagmi', () => ({
  useAccount: jest.fn(() => ({ isConnected: false, address: undefined })),
  useChainId: jest.fn(() => 10),
  useSignMessage: jest.fn(() => ({
    signMessage: jest.fn(async () => '0x' + 'ab'.repeat(65)),
  })),
}));

jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  recoverMessageAddress: jest.fn(
    async () => '0x742d35cc6634c0532925a3b844bc9e7595f0eb1e',
  ),
}));

const ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E';
const NOW = Date.parse('2026-08-31T12:00:00.000Z');

const MESSAGE = `truthbounty.app wants you to sign in with your Ethereum account:
${ADDRESS}

Sign in to TruthBounty.

URI: https://truthbounty.app
Version: 1
Chain ID: 10
Nonce: abc123XYZ
Issued At: 2026-08-31T00:00:00.000Z
Expiration Time: 2026-09-01T00:00:00.000Z
Resources:
- https://truthbounty.app/terms`;

function makeApiClient(): SiweApiClient {
  return {
    async requestChallenge() {
      return {
        message: MESSAGE,
        nonce: 'abc123XYZ',
        address: ADDRESS.toLowerCase(),
        chainId: 10,
        issuedAt: '2026-08-31T00:00:00.000Z',
        expirationTime: '2026-09-01T00:00:00.000Z',
        domain: 'truthbounty.app',
        uri: 'https://truthbounty.app',
        version: '1',
      };
    },
    async submitVerification() {
      return {
        token: 'session-token',
        expiresAt: new Date(NOW + 60_000).toISOString(),
        address: ADDRESS.toLowerCase(),
        chainId: 10,
      };
    },
    async revokeSession() {},
  };
}

function renderPanel() {
  const sessionStore = createMemorySessionStore(() => NOW);
  render(
    <SiweSessionPanel
      authOptions={{
        apiClient: makeApiClient(),
        sessionStore,
        accountOverride: { address: ADDRESS, chainId: 10 },
        signMessage: async () => ('0x' + 'ab'.repeat(65)) as `0x${string}`,
        now: () => NOW,
      }}
    />,
  );
  return { sessionStore };
}

describe('SIWE session UX integration', () => {
  it('reviews the exact message, requires consent, authenticates and logs out', async () => {
    const { sessionStore } = renderPanel();

    // Idle → request challenge.
    await userEvent.click(screen.getByRole('button', { name: /sign in with ethereum/i }));

    // The exact backend message is displayed verbatim.
    await waitFor(() =>
      expect(screen.getByTestId('siwe-message').textContent).toBe(MESSAGE),
    );
    expect(screen.getByTestId('siwe-domain')).toHaveTextContent('truthbounty.app');
    expect(screen.getByTestId('siwe-chain')).toHaveTextContent('10');
    expect(screen.getByTestId('siwe-nonce')).toHaveTextContent('abc123XYZ');

    // No blind signing: the sign button is disabled until the user reviews.
    const signButton = screen.getByRole('button', { name: /sign the reviewed message/i });
    expect(signButton).toBeDisabled();

    await userEvent.click(screen.getByTestId('siwe-consent'));
    expect(signButton).toBeEnabled();
    await userEvent.click(signButton);

    // Authenticated session is shown and persisted.
    await waitFor(() =>
      expect(
        screen.getByTestId('siwe-session-address').textContent?.toLowerCase(),
      ).toBe(ADDRESS.toLowerCase()),
    );
    expect(sessionStore.get()?.token).toBe('session-token');

    // Logout clears the session and returns to idle.
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /sign in with ethereum/i })).toBeInTheDocument(),
    );
    expect(sessionStore.get()).toBeNull();
  });
});
