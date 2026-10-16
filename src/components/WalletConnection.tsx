'use client';

import React, { useState } from 'react';
import { useAccount } from '@/hooks/useAccount';
import { useIsMounted } from '@/hooks/useIsMounted';
import { useWallet, type WalletLifecycleState } from '@/hooks/useWallet';
import { copyPublicIdentifier } from '@/lib/clipboard';
import { ConnectButton } from '@/components/ui/ConnectButton';
import styles from './style.module.css';

/**
 * Accessible, human-readable feedback for every wallet lifecycle state.
 * Rendered in an sr-only live region so screen-reader users get accurate
 * asynchronous feedback without any visual redesign.
 */
export function describeWalletState(
  state: WalletLifecycleState,
  error: Error | null,
): string {
  switch (state) {
    case 'connecting':
      return 'Connecting wallet. Please confirm in your wallet.';
    case 'reconnecting':
      return 'Reconnecting wallet.';
    case 'connected':
      return 'Wallet connected.';
    case 'unsupported-chain':
      return 'Wallet is connected to an unsupported network. Switch to Optimism.';
    case 'error':
      return `Wallet connection failed: ${error?.message ?? 'unknown error'}. Try connecting again.`;
    case 'disconnected':
    default:
      return 'Wallet not connected.';
  }
}

export function WalletConnection() {
  const mounted = useIsMounted();
  const account = useAccount();
  const wallet = useWallet();
  const [copyStatus, setCopyStatus] = useState('');

  const handleDisconnect = () => {
    wallet.disconnect();
  };

  const handleCopyAddress = async () => {
    if (!account?.address) return;
    const result = await copyPublicIdentifier(account.address, 'address');
    setCopyStatus(
      result === 'copied'
        ? 'Full wallet address copied. Only public identifiers should be copied; never copy secrets.'
        : result === 'invalid'
          ? 'This wallet address is invalid and cannot be copied.'
          : result === 'denied'
          ? 'Clipboard access was denied. Select and copy the full address manually.'
          : 'Clipboard is unavailable. Select and copy the full address manually.',
    );
  };

  return (
    <>
      {mounted && account ? (
        <div className={styles.displayData}>
          {/* Address button (accessible + keyboard friendly) */}
          <button
            type="button"
            className={styles.card}
            onClick={handleCopyAddress}
            aria-label={`Copy full wallet address ${account.address}`}
          >
            {account.displayName}
          </button>

          {/* Disconnect button */}
          <button
            type="button"
            className={styles.disconnectButton}
            onClick={handleDisconnect}
            aria-label="Disconnect wallet"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <ConnectButton label="Connect Wallet" />
      )}

      {/* Screen-reader feedback for copy + connection lifecycle status */}
      <span className="text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
        {copyStatus}
      </span>
      <span
        className="sr-only"
        role="status"
        data-testid="wallet-connection-status"
        aria-live="polite"
        aria-atomic="true"
      >
        {describeWalletState(wallet.state, wallet.connectorError)}
      </span>
    </>
  );
}

export default WalletConnection;
