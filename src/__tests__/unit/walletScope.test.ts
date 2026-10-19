/**
 * Unit tests for wallet-scope invalidation helpers (V2-FE-063).
 */

import { QueryClient } from '@tanstack/react-query';
import {
  buildProtocolContextKey,
  invalidateWalletScope,
  keysForWalletScope,
  onWalletScopeChange,
} from '@/app/queries/walletScope';
import { claimKeys, walletKeys } from '@/app/queries/queryKeys';

const ADDR_A = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const ADDR_B = '0x0000000000000000000000000000000000000001';

describe('keysForWalletScope', () => {
  it('returns empty list when scope is invalid', () => {
    expect(keysForWalletScope('bad', 10)).toEqual([]);
    expect(keysForWalletScope(ADDR_A, 0)).toEqual([]);
  });

  it('returns scoped keys for a valid wallet+chain', () => {
    const keys = keysForWalletScope(ADDR_A, 10);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys[0]).toEqual(walletKeys.scope(ADDR_A, 10));
    expect(keys).toContainEqual(claimKeys.byWallet(ADDR_A, 10));
  });
});

describe('invalidateWalletScope / onWalletScopeChange', () => {
  it('removes only the previous wallet scope on account switch', () => {
    const client = new QueryClient();
    client.setQueryData(walletKeys.balance(ADDR_A, 10), { value: 1n });
    client.setQueryData(walletKeys.balance(ADDR_B, 10), { value: 2n });
    client.setQueryData(claimKeys.detail('claim-1'), { id: 'claim-1' });

    const result = onWalletScopeChange(
      client,
      { address: ADDR_A, chainId: 10 },
      { address: ADDR_B, chainId: 10 },
    );

    expect(result.removed).toBeGreaterThan(0);
    expect(client.getQueryData(walletKeys.balance(ADDR_A, 10))).toBeUndefined();
    // Other wallet scope and global claim detail must survive.
    expect(client.getQueryData(walletKeys.balance(ADDR_B, 10))).toEqual({ value: 2n });
    expect(client.getQueryData(claimKeys.detail('claim-1'))).toEqual({ id: 'claim-1' });
  });

  it('removes previous scope on chain switch for same address', () => {
    const client = new QueryClient();
    client.setQueryData(walletKeys.balance(ADDR_A, 10), { value: 1n });
    client.setQueryData(walletKeys.balance(ADDR_A, 11155420), { value: 3n });

    onWalletScopeChange(
      client,
      { address: ADDR_A, chainId: 10 },
      { address: ADDR_A, chainId: 11155420 },
    );

    expect(client.getQueryData(walletKeys.balance(ADDR_A, 10))).toBeUndefined();
    expect(client.getQueryData(walletKeys.balance(ADDR_A, 11155420))).toEqual({
      value: 3n,
    });
  });

  it('no-ops when scope is unchanged', () => {
    const client = new QueryClient();
    client.setQueryData(walletKeys.balance(ADDR_A, 10), { value: 1n });
    const result = onWalletScopeChange(
      client,
      { address: ADDR_A, chainId: 10 },
      { address: ADDR_A, chainId: 10 },
    );
    expect(result.removed).toBe(0);
    expect(client.getQueryData(walletKeys.balance(ADDR_A, 10))).toEqual({ value: 1n });
  });

  it('invalidateWalletScope returns 0 for invalid inputs', () => {
    const client = new QueryClient();
    expect(invalidateWalletScope(client, 'nope', 10)).toBe(0);
  });

  it('builds a release-aware protocol context key for failing closed invalidation', () => {
    expect(
      buildProtocolContextKey({
        address: ADDR_A,
        chainId: 10,
        releaseId: 'v2.0.0-sepolia',
        deploymentBlock: 12345,
        artifactChecksum: 'abc123',
      }),
    ).toBe('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd:10:v2.0.0-sepolia:12345:abc123');
  });

  it('clears in-flight mutation state when the wallet or chain scope changes', () => {
    const client = new QueryClient();
    client.getMutationCache().add({
      mutationId: 'mut-1',
      mutationKey: ['mutations', 'flow'],
      state: { status: 'pending', data: undefined, error: null, variables: undefined, context: undefined },
      options: { mutationFn: async () => ({ ok: true }) },
      submit: () => undefined,
      reset: () => undefined,
      mutate: () => undefined,
      execute: () => Promise.resolve({ ok: true }),
    } as never);

    onWalletScopeChange(
      client,
      { address: ADDR_A, chainId: 10 },
      { address: ADDR_B, chainId: 10 },
    );

    expect(client.getMutationCache().getAll()).toHaveLength(0);
  });
});
