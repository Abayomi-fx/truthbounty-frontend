'use client';

import React, { useEffect, useState } from 'react';
import { useAccount } from '@/hooks/useAccount';
import { useIsMounted } from '@/hooks/useIsMounted';
import { useWallet, type WalletLifecycleState } from '@/hooks/useWallet';
import { copyPublicIdentifier } from '@/lib/clipboard';
import { ConnectButton } from '@/components/ui/ConnectButton';
import styles from './style.module.css';

/**
 * The only supported chain for this UI. Any other chain is wrong-chain.
 */
export const SUPPORTED_CHAIN_ID = 10;
export const SUPPORTED_CHAIN_NAME = 'Optimism';

export type IdentityTrustState =
  | 'verified'
  | 'unverified'
  | 'stale'
  | 'revoked'
  | 'unavailable';

export type ReleaseState = 'verified' | 'changed' | 'stale' | 'unavailable';

export interface VerifiedManifest {
  releaseId: string;
  releaseLabel: string;
  identityLabel: string;
  identityTrust: IdentityTrustState;
  chainId: number;
  chainName: string;
}

export interface WalletConnectionProps {
  /** Verified-manifest inputs. Never authoritative. */
  manifest?: VerifiedManifest;
  /** Optional override for tests/stories. */
  chainId?: number | null;
  /** Optional override for tests/stories. */
  identityTrust?: IdentityTrustState;
  /** Optional override for tests/stories. */
  releaseState?: ReleaseState;
  /** Optional override for tests/stories. */
  accountAddress?: string | null;
}

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

export function describeIdentityTrust(state: IdentityTrustState): string {
  switch (state) {
    case 'verified':
      return 'Identity is verified against the pinned manifest. This is context only and does not grant authority.';
    case 'unverified':
      return 'Identity is not verified. Treat as untrusted context.';
    case 'stale':
      return 'Identity information is stale. Refresh the verified manifest before relying on it.';
    case 'revoked':
      return 'Identity has been revoked. Do not treat this as authorized.';
    case 'unavailable':
    default:
      return 'Identity information is unavailable.';
  }
}

export function describeReleaseState(state: ReleaseState): string {
  switch (state) {
    case 'verified':
      return 'Release matches the verified manifest.';
    case 'changed':
      return 'Release has changed. Review the new manifest before continuing.';
    case 'stale':
      return 'Release information is stale. Refresh the verified manifest.';
    case 'unavailable':
    default:
      return 'Release information is unavailable.';
  }
}

export function WalletConnection({
  manifest,
  chainId,
  identityTrust,
  releaseState,
  accountAddress,
}: WalletConnectionProps = {}) {
  const mounted = useIsMounted();
  const account = useAccount();
  const wallet = useWallet();
  const [copyStatus, setCopyStatus] = useState('');

  // Resolve inputs from verified manifest + optional overrides.
  const resolvedChainId = chainId ?? manifest?.chainId ?? null;
  const resolvedChainName = manifest?.chainName ?? SUPPORTED_CHAIN_NAME;
  const resolvedIdentityTrust: IdentityTrustState =
    identityTrust ?? manifest?.identityTrust ?? 'unavailable';
  const resolvedReleaseState: ReleaseState =
    releaseState ?? (manifest ? 'verified' : 'unavailable');
  const resolvedAddress = accountAddress ?? account?.address ?? null;

  // Account/chain/release changes invalidate protected UI state.
  useEffect(() => {
    setCopyStatus('');
  }, [resolvedAddress, resolvedChainId, resolvedReleaseState]);

  const handleDisconnect = () => {
    wallet.disconnect();
  };

  const handleCopyAddress = async () => {
    if (!resolvedAddress) return;
    const result = await copyPublicIdentifier(resolvedAddress, 'address');
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

  const isConnected = Boolean(resolvedAddress);
  const isWrongChain =
    isConnected && resolvedChainId !== null && resolvedChainId !== SUPPORTED_CHAIN_ID;
  const isChainUnavailable = isConnected && resolvedChainId === null;

  return (
    <div className={styles.walletControls} data-testid="wallet-connection">
      {mounted && isConnected ? (
        <div className={styles.displayData}>
          {/** Address button (accessible + keyboard friendly) */}
          <button
            type="button"
            className={styles.card}
            onClick={handleCopyAddress}
            aria-label={`Copy full wallet address ${resolvedAddress}`}
          >
            {account?.displayName ?? resolvedAddress}
          </button>

          {/** Disconnect button */}
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

      {/** Context controls: chain, release, identity. Non-authoritative. */}
      <div className={styles.contextControls} data-testid="wallet-context-controls">
        <span
          className={styles.contextBadge}
          data-testid="chain-context"
          data-state={isWrongChain ? 'wrong-chain' : isChainUnavailable ? 'unavailable' : 'supported'}
        >
          {isWrongChain
            ? `Unsupported network. Switch to ${resolvedChainName}.`
            : isChainUnavailable
              ? 'Network context unavailable.'
              : `Network: ${resolvedChainName}`}
        </span>

        <span
          className={styles.contextBadge}
          data-testid="release-context"
          data-state={resolvedReleaseState}
        >
          {describeReleaseState(resolvedReleaseState)}
        </span>

        <span
          className={styles.contextBadge}
          data-testid="identity-context"
          data-state={resolvedIdentityTrust}
        >
          {describeIdentityTrust(resolvedIdentityTrust)}
        </span>
      </div>

      {/** Screen-reader feedback for copy + lifecycle status */}
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
    </div>
  );
}

export default WalletConnection;
