/**
 * V2-FE-047 — SiweSessionPanelView component states.
 *
 * Covers loading, empty (disconnected), success, rejection, error and recovery
 * states, and enforces explicit review (no blind signing).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SiweSessionPanelView } from '../SiweSessionPanel';
import { toSiweSignInIntent } from '@/lib/auth/siwe-presentation';
import type { SiweChallenge } from '@/lib/auth/siwe-types';

const MESSAGE = `truthbounty.app wants you to sign in with your Ethereum account:
0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E

Sign in to TruthBounty.

URI: https://truthbounty.app
Version: 1
Chain ID: 10
Nonce: abc123XYZ
Issued At: 2026-08-31T00:00:00.000Z
Expiration Time: 2026-09-01T00:00:00.000Z
Resources:
- https://truthbounty.app/terms`;

const CHALLENGE: SiweChallenge = {
  message: MESSAGE,
  nonce: 'abc123XYZ',
  address: '0x742d35cc6634c0532925a3b844bc9e7595f0eb1e',
  chainId: 10,
  issuedAt: '2026-08-31T00:00:00.000Z',
  expirationTime: '2026-09-01T00:00:00.000Z',
  domain: 'truthbounty.app',
  uri: 'https://truthbounty.app',
  version: '1',
};

const INTENT = toSiweSignInIntent(CHALLENGE, Date.parse('2026-08-31T12:00:00.000Z'));

function makeProps(overrides: Partial<React.ComponentProps<typeof SiweSessionPanelView>> = {}) {
  return {
    status: 'idle' as const,
    intent: null,
    error: null,
    session: null,
    address: '0x742d35cc6634c0532925a3b844bc9e7595f0eb1e',
    onBegin: jest.fn(),
    onSign: jest.fn(),
    onLogout: jest.fn(),
    onReset: jest.fn(),
    ...overrides,
  };
}

describe('SiweSessionPanelView — lifecycle states', () => {
  it('prompts to connect the wallet when disconnected', () => {
    render(
      <SiweSessionPanelView
        {...makeProps({ address: null, connectSlot: <button>Connect Wallet</button> })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument();
    expect(screen.getByTestId('siwe-status')).toHaveTextContent(/not signed in/i);
    expect(screen.queryByRole('button', { name: /sign in with ethereum/i })).toBeNull();
  });

  it('starts the sign-in flow from idle', async () => {
    const onBegin = jest.fn();
    render(<SiweSessionPanelView {...makeProps({ onBegin })} />);

    await userEvent.click(screen.getByRole('button', { name: /sign in with ethereum/i }));
    expect(onBegin).toHaveBeenCalledTimes(1);
  });

  it('shows progress feedback while requesting/signing/submitting', () => {
    render(<SiweSessionPanelView {...makeProps({ status: 'signing' })} />);
    expect(screen.getByTestId('siwe-busy')).toHaveTextContent(/wallet signature/i);
  });

  it('presents the exact intent and requires explicit review before signing', async () => {
    const onSign = jest.fn();
    render(
      <SiweSessionPanelView
        {...makeProps({ status: 'ready-to-sign', intent: INTENT, onSign })}
      />,
    );

    expect(screen.getByTestId('siwe-domain')).toHaveTextContent('truthbounty.app');
    expect(screen.getByTestId('siwe-chain')).toHaveTextContent('10');
    expect(screen.getByTestId('siwe-nonce')).toHaveTextContent('abc123XYZ');
    expect(screen.getByTestId('siwe-expiry')).toBeInTheDocument();
    expect(screen.getByTestId('siwe-resources')).toHaveTextContent(
      'https://truthbounty.app/terms',
    );
    expect(screen.getByTestId('siwe-message').textContent).toBe(MESSAGE);

    const signButton = screen.getByRole('button', { name: /sign the reviewed message/i });
    expect(signButton).toBeDisabled();

    await userEvent.click(screen.getByTestId('siwe-consent'));
    expect(signButton).toBeEnabled();

    await userEvent.click(signButton);
    expect(onSign).toHaveBeenCalledTimes(1);
  });

  it('shows the session and offers sign out when authenticated', async () => {
    const onLogout = jest.fn();
    const session = {
      address: '0x742d35cc6634c0532925a3b844bc9e7595f0eb1e',
      chainId: 10,
      token: 'token',
      expiresAt: Date.parse('2026-09-01T00:00:00.000Z'),
      issuedAt: Date.parse('2026-08-31T00:00:00.000Z'),
    };
    render(
      <SiweSessionPanelView
        {...makeProps({ status: 'authenticated', session, onLogout })}
      />,
    );

    expect(screen.getByTestId('siwe-session-address')).toHaveTextContent(session.address);
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('SiweSessionPanelView — error and recovery states', () => {
  it('offers retry for a recoverable rejection', async () => {
    const onSign = jest.fn();
    const onBegin = jest.fn();
    render(
      <SiweSessionPanelView
        {...makeProps({
          status: 'error',
          error: { kind: 'USER_REJECTED', message: 'User rejected the request.' },
          onSign,
          onBegin,
        })}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/user rejected the request/i);
    await userEvent.click(screen.getByRole('button', { name: /try signing in again/i }));
    expect(onSign).toHaveBeenCalledTimes(1);

    await userEvent.click(
      screen.getByRole('button', { name: /request a new sign-in request/i }),
    );
    expect(onBegin).toHaveBeenCalledTimes(1);
  });

  it('requires a new challenge after expiry (no blind retry)', async () => {
    const onSign = jest.fn();
    const onBegin = jest.fn();
    render(
      <SiweSessionPanelView
        {...makeProps({
          status: 'error',
          error: { kind: 'NONCE_EXPIRED', message: 'Challenge expired.' },
          onSign,
          onBegin,
        })}
      />,
    );

    expect(screen.queryByRole('button', { name: /try signing in again/i })).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: /request a new sign-in request/i }),
    );
    expect(onBegin).toHaveBeenCalledTimes(1);
    expect(onSign).not.toHaveBeenCalled();
  });

  it('tells the user not to sign an invalid message', () => {
    render(
      <SiweSessionPanelView
        {...makeProps({
          status: 'error',
          error: { kind: 'INVALID_MESSAGE', message: 'Malformed message.' },
        })}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/do not sign/i);
  });
});
