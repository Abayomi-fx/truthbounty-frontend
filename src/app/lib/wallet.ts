/**
 * Wallet abstraction layer — V2 EVM stub.
 *
 * V2-FE-009: Removed synthetic hash generation and Stellar dependencies.
 * Real implementations are blocked on V2-FE-003 (contract ABI freeze)
 * and V2-FE-005 (indexer API interface).
 *
 * Callers of claimRewards should migrate to useEvmTransaction + the
 * TruthBounty rewards contract once ABIs are available.
 *
 * UI-FE-058: Wallet persistence is now routed through the versioned
 * browser-state layer. Only non-sensitive, non-authoritative hints
 * (last connected address and chain id) are persisted. Signatures,
 * private keys, seed phrases, and authoritative protocol state are
 * never written to browser storage.
 */

import {
  deletePersistedState,
  readPersistedState,
  writePersistedState,
} from './persistedState';

export interface ClaimRewardResult {
  txHash: `0x${string}`;
}

/**
 * Wallet connection hint persisted across reloads.
 *
 * This is a non-authoritative convenience hint only. The authoritative
 * connection state is derived from the wallet provider at runtime.
 */
export interface WalletConnectionHint {
  address: `${string}`;
  chainId: number;
  connectedAt: number;
}

const WALLET_HINT_KEY = 'wallet.connectionHint';

export function readWalletConnectionHint(): WalletConnectionHint | null {
  const result = readPersistedState<WalletConnectionHint>(WALLET_HINT_KEY);
  if (!result.ok) {
    return null;
  }
  const value = result.value;
  if (!value) {
    return null;
  }
  if (
    typeof value.address !== 'string' ||
    typeof value.chainId !== 'number' ||
    typeof value.connectedAt !== 'number'
  ) {
    deletePersistedState(WALLET_HINT_KEY);
    return null;
  }
  return value;
}

export function writeWalletConnectionHint(
  hint: Omit<WalletConnectionHint, 'connectedAt'>,
): void {
  writePersistedState(WALLET_HINT_KEY, {
    address: hint.address,
    chainId: hint.chainId,
    connectedAt: Date.now(),
  });
}

export function clearWalletConnectionHint(): void {
  deletePersistedState(WALLET_HINT_KEY);
}

/**
 * NOT IMPLEMENTED — pending V2-FE-003 (contract ABI freeze).
 *
 * Will be replaced with a Wagmi `writeContract` call to the TruthBounty
 * rewards contract's `claim(claimIds)` method.
 *
 * @throws Error always — callers must gate on contract availability.
 */
export async function claimRewards(
  _claimIds: string[],
): Promise<ClaimRewardResult> {
  throw new Error(
    '[claimRewards] Not implemented: waiting for V2-FE-003 contract ABI. ' +
      'Use useEvmTransaction.writeContract once the ABI is available.',
  );
}

/**
 * NOT IMPLEMENTED — pending V2-FE-003.
 *
 * Will be replaced with a Wagmi `readContract` call to the ERC-20
 * TruthBounty token's `balanceOf(address)`.
 *
 * @throws Error always.
 */
export async function getTokenBalance(
  _address?: string,
): Promise<number | bigint> {
  throw new Error(
    '[getTokenBalance] Not implemented: waiting for V2-FE-003 contract ABI.',
  );
}
