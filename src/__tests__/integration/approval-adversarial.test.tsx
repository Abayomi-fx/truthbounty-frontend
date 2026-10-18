/**
 * V2-FE-089 — Adversarial approval lifecycle
 *
 * Exercises useERC20Approval + ApprovalButton against adversarial wallet/RPC
 * behaviour. Only wagmi is mocked; the hooks and component run for real.
 *
 * Regressions covered:
 *  - A confirmed approval was reported as failed because the post-receipt
 *    decision used the cached (pre-receipt) allowance instead of a fresh read.
 *  - A receipt query failure (RPC error / timeout / dropped tx) left the hook
 *    stuck in 'pending-approval' with no feedback or recovery.
 *  - After a wrong-chain detection, switching back to a supported chain left
 *    the hook stuck in 'unsupported-chain' with a disabled button.
 */

import React from 'react';
import { renderHook, render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useChainId,
} from 'wagmi';
import { useERC20Approval, ERC20ApprovalError } from '@/hooks/useERC20Approval';
import { useERC20Allowance } from '@/hooks/useERC20Allowance';
import { ApprovalButton } from '@/components/ui/ApprovalButton';
import { assertAccessible } from '@/__tests__/utils/axe';
import {
  MOCK_ADDRESS_1,
  MOCK_TX_HASH_1,
  MOCK_TX_HASH_2,
  MOCK_CHAIN_ID,
} from '@/__tests__/mocks/wagmi/mock-wagmi';

jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useChainId: jest.fn(),
  useReadContract: jest.fn(),
  useWriteContract: jest.fn(),
  useWaitForTransactionReceipt: jest.fn(),
  http: jest.fn(() => ({})),
  createStorage: jest.fn(() => ({})),
  cookieStorage: {},
}));

jest.mock('@rainbow-me/rainbowkit', () => ({
  getDefaultConfig: jest.fn(() => ({
    chains: [{ id: 10 }, { id: 11155420 }],
    transports: {},
  })),
}));

const mockedUseAccount = useAccount as jest.MockedFunction<typeof useAccount>;
const mockedUseChainId = useChainId as jest.MockedFunction<typeof useChainId>;
const mockedUseReadContract = useReadContract as jest.MockedFunction<typeof useReadContract>;
const mockedUseWriteContract = useWriteContract as jest.MockedFunction<typeof useWriteContract>;
const mockedUseWaitForTransactionReceipt =
  useWaitForTransactionReceipt as jest.MockedFunction<typeof useWaitForTransactionReceipt>;

const TOKEN_ADDRESS = '0xaabbccddaabbccddaabbccddaabbccddaabbccdd' as `0x${string}`;
const SPENDER_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as `0x${string}`;
const REQUIRED_AMOUNT = 1_000_000_000_000_000_000n;
const UNSUPPORTED_CHAIN_ID = 1;

type Receipt = { status: 'success' | 'reverted'; blockNumber: bigint; transactionHash: `0x${string}` };

/** Mutable chain/wallet state the wagmi mocks read on every render. */
interface Scenario {
  chainId: number;
  /** Allowance currently cached by the read hook (what a stale render sees). */
  cachedAllowance: bigint | undefined;
  /** Receipt per tx hash; undefined = not yet mined. */
  receipts: Record<string, Receipt | undefined>;
  /** Receipt query error per tx hash (RPC failure, timeout, dropped tx). */
  receiptErrors: Record<string, Error | undefined>;
  refetch: jest.Mock;
  writeContractAsync: jest.Mock;
}

let scenario: Scenario;

function freshRead(data: bigint) {
  return Promise.resolve({ data, error: null, status: 'success' });
}

function installMocks() {
  mockedUseAccount.mockImplementation(
    () => ({ address: MOCK_ADDRESS_1, isConnected: true }) as unknown as ReturnType<typeof useAccount>,
  );
  mockedUseChainId.mockImplementation(() => scenario.chainId);
  mockedUseReadContract.mockImplementation(
    () =>
      ({
        data: scenario.cachedAllowance,
        isLoading: false,
        error: null,
        refetch: scenario.refetch,
      }) as unknown as ReturnType<typeof useReadContract>,
  );
  mockedUseWriteContract.mockImplementation(
    () => ({ writeContractAsync: scenario.writeContractAsync }) as unknown as ReturnType<typeof useWriteContract>,
  );
  mockedUseWaitForTransactionReceipt.mockImplementation(
    (args) => {
      const hash = (args as { hash?: string } | undefined)?.hash;
      return {
        data: hash ? (scenario.receipts[hash] ?? null) : null,
        isLoading: false,
        error: hash ? (scenario.receiptErrors[hash] ?? null) : null,
      } as unknown as ReturnType<typeof useWaitForTransactionReceipt>;
    },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  scenario = {
    chainId: MOCK_CHAIN_ID,
    cachedAllowance: 0n,
    receipts: {},
    receiptErrors: {},
    refetch: jest.fn(() => freshRead(REQUIRED_AMOUNT)),
    writeContractAsync: jest.fn().mockResolvedValue(MOCK_TX_HASH_1),
  };
  installMocks();
});

function renderApproval(policy: 'exact' | 'reset' = 'exact') {
  return renderHook(() =>
    useERC20Approval({
      tokenAddress: TOKEN_ADDRESS,
      spender: SPENDER_ADDRESS,
      requiredAmount: REQUIRED_AMOUNT,
      policy,
    }),
  );
}

async function submitAndMine(
  result: { current: ReturnType<typeof useERC20Approval> },
  rerender: () => void,
  receipt: Receipt,
) {
  await waitFor(() => expect(result.current.status).toBe('needs-approval'));
  await act(async () => {
    await result.current.approve();
  });
  expect(result.current.status).toBe('pending-approval');

  scenario.receipts[MOCK_TX_HASH_1] = receipt;
  await act(async () => {
    rerender();
  });
}

const minedSuccess: Receipt = { status: 'success', blockNumber: 1001n, transactionHash: MOCK_TX_HASH_1 };

// ===========================================================================
// Receipt → canonical allowance (regression: stale cached allowance)
// ===========================================================================

describe('confirmed approval is decided by a fresh chain read', () => {
  it('reaches success even though the cached allowance is still pre-receipt', async () => {
    // Cached value stays 0n — exactly what wagmi returns during a refetch.
    const { result, rerender } = renderApproval();
    await submitAndMine(result, rerender, minedSuccess);

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.error).toBeNull();
    expect(scenario.refetch).toHaveBeenCalledTimes(1);
  });

  it('stays in confirming until the fresh read resolves (no timer or guess)', async () => {
    let resolveRead!: (value: unknown) => void;
    scenario.refetch.mockImplementation(() => new Promise((resolve) => (resolveRead = resolve)));

    const { result, rerender } = renderApproval();
    await submitAndMine(result, rerender, minedSuccess);

    // API/RPC lag: the read has not returned yet.
    expect(result.current.status).toBe('confirming');
    expect(result.current.isApproving).toBe(true);

    await act(async () => {
      resolveRead({ data: REQUIRED_AMOUNT, error: null, status: 'success' });
    });
    expect(result.current.status).toBe('success');
  });

  it('fails closed when the fresh read shows the allowance was not granted', async () => {
    // Replacement 'cancelled' case: the mined replacement is a success receipt
    // for a different call, so the allowance never moved.
    scenario.refetch.mockImplementation(() => freshRead(0n));

    const { result, rerender } = renderApproval();
    await submitAndMine(result, rerender, minedSuccess);

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect((result.current.error as ERC20ApprovalError).reason).toBe('APPROVAL_FAILED');
  });

  it('reaches success for a repriced (sped-up) replacement once the chain shows the allowance', async () => {
    const replacement: Receipt = { status: 'success', blockNumber: 1002n, transactionHash: MOCK_TX_HASH_2 };

    const { result, rerender } = renderApproval();
    await submitAndMine(result, rerender, replacement);

    await waitFor(() => expect(result.current.status).toBe('success'));
  });

  it('fails closed when the fresh read errors', async () => {
    scenario.refetch.mockImplementation(() =>
      Promise.resolve({ data: undefined, error: new Error('RPC unavailable'), status: 'error' }),
    );

    const { result, rerender } = renderApproval();
    await submitAndMine(result, rerender, minedSuccess);

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect((result.current.error as ERC20ApprovalError).reason).toBe('ALLOWANCE_REFRESH_FAILED');
  });

  it('fails closed when the fresh read rejects', async () => {
    scenario.refetch.mockImplementation(() => Promise.reject(new Error('network down')));

    const { result, rerender } = renderApproval();
    await submitAndMine(result, rerender, minedSuccess);

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect((result.current.error as ERC20ApprovalError).reason).toBe('ALLOWANCE_REFRESH_FAILED');
  });

  it('ignores a late fresh read after the user resets', async () => {
    let resolveRead!: (value: unknown) => void;
    scenario.refetch.mockImplementation(() => new Promise((resolve) => (resolveRead = resolve)));

    const { result, rerender } = renderApproval();
    await submitAndMine(result, rerender, minedSuccess);
    expect(result.current.status).toBe('confirming');

    delete scenario.receipts[MOCK_TX_HASH_1];
    act(() => {
      result.current.reset();
    });
    await act(async () => {
      resolveRead({ data: REQUIRED_AMOUNT, error: null, status: 'success' });
    });

    // Re-evaluated from the (still 0n) cached chain state, not the abandoned attempt.
    expect(result.current.status).toBe('needs-approval');
  });

  it('still fails closed on a reverted receipt without reading allowance', async () => {
    const { result, rerender } = renderApproval();
    await submitAndMine(result, rerender, { ...minedSuccess, status: 'reverted' });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(scenario.refetch).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Receipt query failure (regression: stuck in pending-approval)
// ===========================================================================

describe('receipt query failure', () => {
  it('moves pending-approval to a recoverable error instead of hanging', async () => {
    const { result, rerender } = renderApproval();
    await waitFor(() => expect(result.current.status).toBe('needs-approval'));
    await act(async () => {
      await result.current.approve();
    });
    expect(result.current.status).toBe('pending-approval');

    scenario.receiptErrors[MOCK_TX_HASH_1] = new Error('WaitForTransactionReceiptTimeoutError');
    await act(async () => {
      rerender();
    });

    expect(result.current.status).toBe('error');
    expect((result.current.error as ERC20ApprovalError).reason).toBe('RECEIPT_UNAVAILABLE');
    expect(result.current.isApproving).toBe(false);

    // Recovery re-reads chain state rather than assuming an outcome.
    delete scenario.receiptErrors[MOCK_TX_HASH_1];
    act(() => {
      result.current.reset();
    });
    await waitFor(() => expect(result.current.status).toBe('needs-approval'));
  });

  it('moves pending-reset to error when the reset receipt cannot be read', async () => {
    const { result, rerender } = renderApproval('reset');
    await waitFor(() => expect(result.current.status).toBe('needs-approval'));
    await act(async () => {
      await result.current.approve();
    });
    expect(result.current.status).toBe('pending-reset');

    scenario.receiptErrors[MOCK_TX_HASH_1] = new Error('TransactionReceiptNotFoundError');
    await act(async () => {
      rerender();
    });

    expect(result.current.status).toBe('error');
    expect((result.current.error as ERC20ApprovalError).reason).toBe('RECEIPT_UNAVAILABLE');
    // The second approve() must never be sent without a confirmed reset.
    expect(scenario.writeContractAsync).toHaveBeenCalledTimes(1);
  });

  it('does not treat a receipt error as success when no tx is pending', async () => {
    scenario.receiptErrors[MOCK_TX_HASH_1] = new Error('stale error');
    const { result } = renderApproval();
    await waitFor(() => expect(result.current.status).toBe('needs-approval'));
    expect(result.current.error).toBeNull();
  });
});

// ===========================================================================
// Wrong chain (regression: stuck in unsupported-chain)
// ===========================================================================

describe('wrong chain', () => {
  it('fails closed on an unsupported chain and never issues a write', async () => {
    scenario.chainId = UNSUPPORTED_CHAIN_ID;
    const { result } = renderApproval();

    await waitFor(() => expect(result.current.status).toBe('unsupported-chain'));
    await expect(result.current.approve()).rejects.toMatchObject({ reason: 'UNSUPPORTED_CHAIN' });
    expect(scenario.writeContractAsync).not.toHaveBeenCalled();
  });

  it('recovers once the wallet switches back to a supported chain', async () => {
    scenario.chainId = UNSUPPORTED_CHAIN_ID;
    const { result, rerender } = renderApproval();
    await waitFor(() => expect(result.current.status).toBe('unsupported-chain'));

    scenario.chainId = MOCK_CHAIN_ID;
    rerender();

    await waitFor(() => expect(result.current.status).toBe('needs-approval'));
  });

  it('drops back to unsupported-chain if the wallet switches away while approved', async () => {
    scenario.cachedAllowance = REQUIRED_AMOUNT;
    const { result, rerender } = renderApproval();
    await waitFor(() => expect(result.current.status).toBe('approved'));

    scenario.chainId = UNSUPPORTED_CHAIN_ID;
    rerender();

    await waitFor(() => expect(result.current.status).toBe('unsupported-chain'));
  });
});

// ===========================================================================
// Wallet rejection
// ===========================================================================

describe('wallet rejection', () => {
  it('rejects without a tx hash and allows a clean retry', async () => {
    scenario.writeContractAsync
      .mockRejectedValueOnce(Object.assign(new Error('User rejected the request.'), { code: 4001 }))
      .mockResolvedValueOnce(MOCK_TX_HASH_1);

    const { result } = renderApproval();
    await waitFor(() => expect(result.current.status).toBe('needs-approval'));

    await act(async () => {
      await result.current.approve();
    });
    expect(result.current.status).toBe('rejected');
    expect(mockedUseWaitForTransactionReceipt).not.toHaveBeenCalledWith(
      expect.objectContaining({ hash: expect.any(String) }),
    );

    act(() => {
      result.current.reset();
    });
    await waitFor(() => expect(result.current.status).toBe('needs-approval'));
    await act(async () => {
      await result.current.approve();
    });
    expect(result.current.status).toBe('pending-approval');
  });
});

// ===========================================================================
// useERC20Allowance.refetch contract
// ===========================================================================

describe('useERC20Allowance.refetch', () => {
  function renderAllowance(chainId: number) {
    return renderHook(() =>
      useERC20Allowance({
        tokenAddress: TOKEN_ADDRESS,
        owner: MOCK_ADDRESS_1,
        spender: SPENDER_ADDRESS,
        chainId,
      }),
    );
  }

  it('resolves with the fresh chain value', async () => {
    const { result } = renderAllowance(MOCK_CHAIN_ID);
    await expect(result.current.refetch()).resolves.toBe(REQUIRED_AMOUNT);
  });

  it('resolves undefined (never a fabricated value) when the read errors', async () => {
    scenario.refetch.mockImplementation(() =>
      Promise.resolve({ data: 5n, error: new Error('bad'), status: 'error' }),
    );
    const { result } = renderAllowance(MOCK_CHAIN_ID);
    await expect(result.current.refetch()).resolves.toBeUndefined();
  });

  it('does not read on an unsupported chain', async () => {
    const { result } = renderAllowance(UNSUPPORTED_CHAIN_ID);
    await expect(result.current.refetch()).resolves.toBeUndefined();
    expect(scenario.refetch).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Accessible feedback and keyboard recovery
// ===========================================================================

function ApprovalHarness() {
  const approval = useERC20Approval({
    tokenAddress: TOKEN_ADDRESS,
    spender: SPENDER_ADDRESS,
    requiredAmount: REQUIRED_AMOUNT,
  });
  return (
    <ApprovalButton
      approvalStatus={approval.status}
      approvalError={approval.error}
      onApprove={() => {
        void approval.approve().catch(() => undefined);
      }}
      onRetry={approval.reset}
      tokenSymbol="USDC"
      hideWhenApproved={false}
    />
  );
}

describe('ApprovalButton adversarial feedback', () => {
  it('announces a receipt failure accessibly and recovers via keyboard', async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<ApprovalHarness />);

    await user.tab();
    const button = await screen.findByRole('button', { name: /approve usdc spending/i });
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(button).toHaveAttribute('data-approval-status', 'pending-approval'));
    expect(button).toHaveAttribute('aria-busy', 'true');

    scenario.receiptErrors[MOCK_TX_HASH_1] = new Error('timeout');
    await act(async () => {
      rerender(<ApprovalHarness />);
    });

    const retry = screen.getByRole('button', { name: /approval failed: .*could not confirm/i });
    expect(retry).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('status')).toHaveTextContent(/could not confirm the approval transaction/i);
    await assertAccessible(container);

    delete scenario.receiptErrors[MOCK_TX_HASH_1];
    retry.focus();
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.getByTestId('approval-button')).toHaveAttribute('data-approval-status', 'needs-approval'),
    );
  });

  it('re-enables the approve action after switching back from the wrong network', async () => {
    scenario.chainId = UNSUPPORTED_CHAIN_ID;
    const { rerender } = render(<ApprovalHarness />);

    const wrongNetwork = await screen.findByRole('button', { name: /unsupported network/i });
    expect(wrongNetwork).toBeDisabled();

    scenario.chainId = MOCK_CHAIN_ID;
    rerender(<ApprovalHarness />);

    const approve = await screen.findByRole('button', { name: /approve usdc spending/i });
    expect(approve).toBeEnabled();
  });
});
