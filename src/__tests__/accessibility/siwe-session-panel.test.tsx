/**
 * V2-FE-047 — Accessibility + keyboard coverage for the SIWE session UX.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { assertAccessible } from '../utils/axe';
import { SiweSessionPanelView } from '@/components/auth';
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

describe('Accessibility: SIWE session UX', () => {
  it('disconnected state has no axe violations', async () => {
    const { container } = render(
      <SiweSessionPanelView
        {...makeProps({ address: null, connectSlot: <button>Connect Wallet</button> })}
      />,
    );
    await assertAccessible(container);
  });

  it('ready-to-sign state has no axe violations and is keyboard operable', async () => {
    const onSign = jest.fn();
    const { container } = render(
      <SiweSessionPanelView {...makeProps({ status: 'ready-to-sign', intent: INTENT, onSign })} />,
    );
    await assertAccessible(container);

    // Keyboard-only: review consent → sign.
    await userEvent.tab();
    expect(screen.getByTestId('siwe-consent')).toHaveFocus();
    await userEvent.keyboard(' ');

    const signButton = screen.getByRole('button', { name: /sign the reviewed message/i });
    expect(signButton).toBeEnabled();

    await userEvent.tab();
    expect(signButton).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onSign).toHaveBeenCalledTimes(1);
  });

  it('error state has no axe violations', async () => {
    const { container } = render(
      <SiweSessionPanelView
        {...makeProps({
          status: 'error',
          error: { kind: 'REPLAYED', message: 'This sign-in request was already used.' },
        })}
      />,
    );
    await assertAccessible(container);
  });
});
