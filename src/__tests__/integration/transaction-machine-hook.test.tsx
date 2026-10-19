/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports -- test doubles and dynamic module access */
/**
 * V2-FE-009 — Integration tests for the useTransactionMachine hook.
 *
 * Coverage:
 *  - Hook initialises from idle by default
 *  - Hook initialises from persisted state on mount (reload recovery)
 *  - Full happy path driven through send()
 *  - Wrong-network: lastError is set, state stays idle
 *  - Reload recovery: unmount mid-confirming, remount → confirming
 *  - RETRY from reverted resets to idle
 *  - RETRY from dropped resets to idle
 *  - onFinalized callback fires exactly once, not on subsequent events
 *  - onReverted callback fires exactly once
 *  - onDropped callback fires exactly once
 *  - reset() clears persisted state and returns to idle
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useTransactionMachine } from '@/hooks/useTransactionMachine';
import {
  persistTxState,
  createTxContext,
  updateTxContext,
} from '@/lib/transaction-machine/transaction-persistence';
import { OPTIMISM_CHAIN_IDS } from '@/lib/transaction-machine/transaction-machine.types';

const OP_MAINNET = OPTIMISM_CHAIN_IDS[0]; // 10

const MOCK_HASH =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const satisfies `0x${string}`;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Default initialization
// ---------------------------------------------------------------------------

describe('Initialization', () => {
  it('starts in idle state by default', () => {
    const { result } = renderHook(() =>
      useTransactionMachine({ id: 'init-test', label: 'Test' }),
    );
    expect(result.current.state.status).toBe('idle');
    expect(result.current.lastError).toBeNull();
  });

  it('hydrates from persisted state on mount (reload recovery)', () => {
    // Simulate a previous session that was mid-confirming
    const ctx = createTxContext('reload-test', 'Reload test');
    const confirming = {
      status: 'confirming' as const,
      txHash: MOCK_HASH,
      chainId: OP_MAINNET,
      blockNumber: BigInt(999),
      confirmations: 1,
      error: null,
      replacedBy: null,
    };
    persistTxState(updateTxContext(ctx, confirming));

    const { result } = renderHook(() =>
      useTransactionMachine({ id: 'reload-test', label: 'Reload test' }),
    );

    expect(result.current.state.status).toBe('confirming');
    expect(result.current.state.txHash).toBe(MOCK_HASH);
  });

  it('discards invalid persisted state and starts idle', () => {
    // Store a stale v1 entry
    localStorage.setItem(
      'tb-tx-v2:stale-hook',
      JSON.stringify({ schemaVersion: 1, id: 'stale-hook' }),
    );

    const { result } = renderHook(() =>
      useTransactionMachine({ id: 'stale-hook', label: 'Stale' }),
    );

    expect(result.current.state.status).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// Full happy path
// ---------------------------------------------------------------------------

describe('Full happy path via send()', () => {
  it('progresses through all states to finalized', () => {
    const { result } = renderHook(() =>
      useTransactionMachine({ id: 'happy-path', label: 'Happy' }),
    );

    act(() => {
      result.current.send({ type: 'PREPARE', chainId: OP_MAINNET });
    });
    expect(result.current.state.status).toBe('preparing');

    act(() => {
      result.current.send({ type: 'REQUEST_SIGNATURE' });
    });
    expect(result.current.state.status).toBe('signature-requested');

    act(() => {
      result.current.send({ type: 'SUBMIT', txHash: MOCK_HASH });
    });
    expect(result.current.state.status).toBe('submitted');
    expect(result.current.state.txHash).toBe(MOCK_HASH);

    act(() => {
      result.current.send({
        type: 'CONFIRM',
        blockNumber: BigInt(100),
        confirmations: 1,
        receiptChainId: OP_MAINNET,
      });
    });
    expect(result.current.state.status).toBe('confirming');

    act(() => {
      result.current.send({ type: 'MARK_SAFE' });
    });
    expect(result.current.state.status).toBe('safe');

    act(() => {
      result.current.send({ type: 'FINALIZE' });
    });
    expect(result.current.state.status).toBe('finalized');
  });
});

// ---------------------------------------------------------------------------
// Wrong-network
// ---------------------------------------------------------------------------

describe('Wrong-network detection', () => {
  it('sets lastError and does NOT change state when PREPARE uses a wrong chainId', () => {
    const { result } = renderHook(() =>
      useTransactionMachine({ id: 'wrong-net', label: 'Wrong net' }),
    );

    act(() => {
      result.current.send({ type: 'PREPARE', chainId: 1 }); // Ethereum mainnet — not allowed
    });

    expect(result.current.state.status).toBe('idle');
    expect(result.current.lastError).not.toBeNull();
    expect(result.current.lastError?.reason).toBe('WRONG_NETWORK');
  });
});

// ---------------------------------------------------------------------------
// Reload recovery (detailed)
// ---------------------------------------------------------------------------

describe('Reload recovery', () => {
  it('resumes from confirming after unmount/remount', () => {
    const id = 'resume-test';
    const ctx = createTxContext(id, 'Resume test');
    const confirming = {
      status: 'confirming' as const,
      txHash: MOCK_HASH,
      chainId: OP_MAINNET,
      blockNumber: BigInt(500),
      confirmations: 2,
      error: null,
      replacedBy: null,
    };
    persistTxState(updateTxContext(ctx, confirming));

    // "Remount" — new renderHook invocation with same id
    const { result } = renderHook(() =>
      useTransactionMachine({ id, label: 'Resume test' }),
    );

    expect(result.current.state.status).toBe('confirming');
    if (result.current.state.status === 'confirming') {
      expect(result.current.state.confirmations).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// RETRY
// ---------------------------------------------------------------------------

describe('RETRY resets to idle', () => {
  it('from reverted → idle via RETRY', () => {
    const { result } = renderHook(() =>
      useTransactionMachine({ id: 'retry-reverted', label: 'Retry reverted' }),
    );

    act(() => {
      result.current.send({ type: 'PREPARE', chainId: OP_MAINNET });
      result.current.send({ type: 'REQUEST_SIGNATURE' });
      result.current.send({ type: 'SUBMIT', txHash: MOCK_HASH });
      result.current.send({
        type: 'CONFIRM',
        blockNumber: BigInt(1),
        confirmations: 1,
        receiptChainId: OP_MAINNET,
      });
      result.current.send({ type: 'REVERT' });
    });

    expect(result.current.state.status).toBe('reverted');

    act(() => {
      result.current.send({ type: 'RETRY' });
    });

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.txHash).toBeNull();
  });

  it('from dropped → idle via RETRY', () => {
    const { result } = renderHook(() =>
      useTransactionMachine({ id: 'retry-dropped', label: 'Retry dropped' }),
    );

    act(() => {
      result.current.send({ type: 'PREPARE', chainId: OP_MAINNET });
      result.current.send({ type: 'REQUEST_SIGNATURE' });
      result.current.send({ type: 'SUBMIT', txHash: MOCK_HASH });
      result.current.send({ type: 'DROP' });
    });

    expect(result.current.state.status).toBe('dropped');

    act(() => {
      result.current.send({ type: 'RETRY' });
    });

    expect(result.current.state.status).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------

describe('Terminal callbacks fire exactly once', () => {
  it('onFinalized fires once when finalized', () => {
    const onFinalized = jest.fn();
    const { result } = renderHook(() =>
      useTransactionMachine({
        id: 'cb-finalized',
        label: 'Callbacks',
        onFinalized,
      }),
    );

    act(() => {
      result.current.send({ type: 'PREPARE', chainId: OP_MAINNET });
      result.current.send({ type: 'REQUEST_SIGNATURE' });
      result.current.send({ type: 'SUBMIT', txHash: MOCK_HASH });
      result.current.send({
        type: 'CONFIRM',
        blockNumber: BigInt(1),
        confirmations: 1,
        receiptChainId: OP_MAINNET,
      });
      result.current.send({ type: 'MARK_SAFE' });
      result.current.send({ type: 'FINALIZE' });
    });

    expect(onFinalized).toHaveBeenCalledTimes(1);
    expect(onFinalized).toHaveBeenCalledWith(MOCK_HASH);
  });

  it('onReverted fires once when reverted', () => {
    const onReverted = jest.fn();
    const { result } = renderHook(() =>
      useTransactionMachine({
        id: 'cb-reverted',
        label: 'Revert callbacks',
        onReverted,
      }),
    );

    act(() => {
      result.current.send({ type: 'PREPARE', chainId: OP_MAINNET });
      result.current.send({ type: 'REQUEST_SIGNATURE' });
      result.current.send({ type: 'SUBMIT', txHash: MOCK_HASH });
      result.current.send({
        type: 'CONFIRM',
        blockNumber: BigInt(1),
        confirmations: 1,
        receiptChainId: OP_MAINNET,
      });
      result.current.send({ type: 'REVERT' });
    });

    expect(onReverted).toHaveBeenCalledTimes(1);
    expect(onReverted).toHaveBeenCalledWith(MOCK_HASH);
  });

  it('onDropped fires once when dropped', () => {
    const onDropped = jest.fn();
    const { result } = renderHook(() =>
      useTransactionMachine({
        id: 'cb-dropped',
        label: 'Drop callbacks',
        onDropped,
      }),
    );

    act(() => {
      result.current.send({ type: 'PREPARE', chainId: OP_MAINNET });
      result.current.send({ type: 'REQUEST_SIGNATURE' });
      result.current.send({ type: 'SUBMIT', txHash: MOCK_HASH });
      result.current.send({ type: 'DROP' });
    });

    expect(onDropped).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// reset()
// ---------------------------------------------------------------------------

describe('reset()', () => {
  it('returns to idle and clears persisted state', () => {
    const { result } = renderHook(() =>
      useTransactionMachine({ id: 'reset-test', label: 'Reset test' }),
    );

    act(() => {
      result.current.send({ type: 'PREPARE', chainId: OP_MAINNET });
      result.current.send({ type: 'REQUEST_SIGNATURE' });
    });

    expect(result.current.state.status).toBe('signature-requested');

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.status).toBe('idle');
    expect(result.current.lastError).toBeNull();

    // Persisted state should be cleared
    const { hydrateTxState } = require('@/lib/transaction-machine/transaction-persistence');
    expect(hydrateTxState('reset-test')).toBeNull();
  });
});
