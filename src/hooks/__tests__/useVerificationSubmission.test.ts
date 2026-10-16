import { act, renderHook, waitFor } from '@testing-library/react';
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from 'wagmi';
import { reconcileWithProjection } from '@/app/lib/verification-reconcile';
import { useVerificationSubmission } from '@/hooks/useVerificationSubmission';

jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useChainId: jest.fn(),
  usePublicClient: jest.fn(),
  useReadContract: jest.fn(),
  useWriteContract: jest.fn(),
}));

jest.mock('@/app/lib/verification-reconcile', () => ({
  ...jest.requireActual('@/app/lib/verification-reconcile'),
  reconcileWithProjection: jest.fn(),
}));

const WALLET = '0x0000000000000000000000000000000000000001';
const VERIFICATION_CONTRACT = '0x1234567890123456789012345678901234567890';
const REGISTRY_CONTRACT = '0x2222222222222222222222222222222222222222';
const STAKING_TOKEN = '0x3333333333333333333333333333333333333333';
const CHAIN = 11155420;
const TX_HASH = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`;

const MIN_STAKE = 1n * 10n ** 18n;
const STAKE = 2n * 10n ** 18n;
const BALANCE = 50n * 10n ** 18n;
const NOW = BigInt(Math.floor(Date.now() / 1000));
const FUTURE_DEADLINE = NOW + 86_400n;

const mockedReconcileWithProjection = reconcileWithProjection as jest.Mock;
const mockedUseAccount = useAccount as jest.Mock;
const mockedUseChainId = useChainId as jest.Mock;
const mockedUsePublicClient = usePublicClient as jest.Mock;
const mockedUseReadContract = useReadContract as jest.Mock;
const mockedUseWriteContract = useWriteContract as jest.Mock;

const mockReads = jest.fn();
const mockWriteContractAsync = jest.fn();
const mockSimulateContract = jest.fn();
const mockGetTransactionReceipt = jest.fn();

let allowanceValue = 0n;

const readRefetch = jest.fn(async () => undefined);

function createReadStore(): Record<
  string,
  () => {
    data: unknown;
    isLoading: boolean;
    refetch: jest.Mock;
  }
> {
  return {
    minStakeAmount: () => ({ data: MIN_STAKE, isLoading: false, refetch: readRefetch }),
    getClaim: () => ({
      data: { status: 1, verificationDeadline: FUTURE_DEADLINE },
      isLoading: false,
      refetch: readRefetch,
    }),
    hasVerified: () => ({ data: false, isLoading: false, refetch: readRefetch }),
    allowance: () => ({
      get data() {
        return allowanceValue;
      },
      isLoading: false,
      refetch: readRefetch,
    }),
    balanceOf: () => ({ data: BALANCE, isLoading: false, refetch: readRefetch }),
  };
}

let readStore = createReadStore();

function installMocks() {
  mockReads.mockImplementation(({ functionName }: { functionName: string }) =>
    readStore[functionName]?.() ?? { data: undefined, isLoading: false, refetch: readRefetch }
  );
  mockedUseReadContract.mockImplementation(mockReads);

  mockWriteContractAsync.mockImplementation(({ functionName }: { functionName: string }) => {
    if (functionName === 'approve') {
      // Simulate the approval tx updating on-chain allowance.
      allowanceValue = 100n * 10n ** 18n;
      return Promise.resolve(`0x${'aa'.repeat(32)}`);
    }
    return Promise.resolve(TX_HASH);
  });
  mockedUseWriteContract.mockReturnValue({ writeContractAsync: mockWriteContractAsync });

  mockSimulateContract.mockResolvedValue({ request: {} });
  mockGetTransactionReceipt.mockResolvedValue({
    transactionHash: TX_HASH,
    status: '0x1',
    blockNumber: 999n,
  });
  mockedUsePublicClient.mockReturnValue({
    simulateContract: mockSimulateContract,
    getTransactionReceipt: mockGetTransactionReceipt,
  });

  mockedUseAccount.mockReturnValue({ address: WALLET, isConnected: true });
  mockedUseChainId.mockReturnValue(CHAIN);

  mockedReconcileWithProjection.mockResolvedValue({
    id: 'ver-1',
    claimId: '123',
    decision: 'VERIFY',
    status: 'confirmed',
    txHash: TX_HASH,
    chainId: CHAIN,
    artifactVersion: 'iv-verification-submission@v1.0.0',
  });
}

function pinEnv() {
  process.env.NEXT_PUBLIC_TRUTHBOUNTY_PROTOCOL_RELEASE_TAG = 'v2-sc-010@v0.1.0';
  process.env.NEXT_PUBLIC_TRUTHBOUNTY_VERIFICATION_SUBMISSION_ADDRESS =
    VERIFICATION_CONTRACT;
  process.env.NEXT_PUBLIC_TRUTHBOUNTY_CLAIM_REGISTRY_ADDRESS = REGISTRY_CONTRACT;
  process.env.NEXT_PUBLIC_TRUTHBOUNTY_STAKING_TOKEN_ADDRESS = STAKING_TOKEN;
}

function clearEnv() {
  delete process.env.NEXT_PUBLIC_TRUTHBOUNTY_PROTOCOL_RELEASE_TAG;
  delete process.env.NEXT_PUBLIC_TRUTHBOUNTY_VERIFICATION_SUBMISSION_ADDRESS;
  delete process.env.NEXT_PUBLIC_TRUTHBOUNTY_CLAIM_REGISTRY_ADDRESS;
  delete process.env.NEXT_PUBLIC_TRUTHBOUNTY_STAKING_TOKEN_ADDRESS;
}

beforeEach(() => {
  jest.clearAllMocks();
  allowanceValue = 100n * 10n ** 18n;
  readStore = createReadStore();
  pinEnv();
  installMocks();
});

afterEach(() => {
  clearEnv();
});

async function renderReady(
  config: Parameters<typeof useVerificationSubmission>[0] = { claimId: '123' }
) {
  const rendered = renderHook(() => useVerificationSubmission(config));
  await waitFor(() => {
    expect(rendered.result.current.roundParams?.isOpen).toBe(true);
  });
  return rendered;
}

describe('useVerificationSubmission', () => {
  it('fails closed with PROTOCOL_DISABLED when the artifact is not pinned', async () => {
    clearEnv();
    const { result } = renderHook(() =>
      useVerificationSubmission({ claimId: '123', chainId: CHAIN })
    );
    await waitFor(() => expect(result.current.artifact.isDeployed).toBe(false));

    await act(async () => {
      await expect(
        result.current.submitVerification({ position: 'TRUE', stake: STAKE })
      ).rejects.toMatchObject({ code: 'PROTOCOL_DISABLED' });
    });
    expect(result.current.phase).toBe('error');
  });

  it('rejects UNCONNECTED wallets', async () => {
    mockedUseAccount.mockReturnValue({ address: undefined, isConnected: false });
    const { result } = await renderReady();

    await act(async () => {
      await expect(
        result.current.submitVerification({ position: 'TRUE', stake: STAKE })
      ).rejects.toMatchObject({ code: 'UNCONNECTED' });
    });
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it('rejects a WRONG_NETWORK submission', async () => {
    mockedUseChainId.mockReturnValue(1);
    const { result } = await renderReady({ claimId: '123', chainId: CHAIN });

    await act(async () => {
      await expect(
        result.current.submitVerification({ position: 'TRUE', stake: STAKE })
      ).rejects.toMatchObject({ code: 'WRONG_NETWORK' });
    });
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it('rejects an INVALID_CLAIM id', async () => {
    const { result } = renderHook(() =>
      useVerificationSubmission({ claimId: 'not-a-claim', chainId: CHAIN })
    );

    await act(async () => {
      await expect(
        result.current.submitVerification({ position: 'TRUE', stake: STAKE })
      ).rejects.toMatchObject({ code: 'INVALID_CLAIM' });
    });
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it('prevents a duplicate ALREADY_VERIFIED submission', async () => {
    readStore.hasVerified = () => ({
      data: true,
      isLoading: false,
      refetch: readRefetch,
    });
    const { result } = await renderReady();

    await act(async () => {
      await expect(
        result.current.submitVerification({ position: 'TRUE', stake: STAKE })
      ).rejects.toMatchObject({ code: 'ALREADY_VERIFIED' });
    });
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it('runs the full submission flow to confirmed', async () => {
    const { result } = await renderReady();

    let outcome: Awaited<ReturnType<typeof result.current.submitVerification>>;
    await act(async () => {
      outcome = await result.current.submitVerification({ position: 'TRUE', stake: STAKE });
    });

    expect(outcome!.phase).toBe('confirmed');
    expect(result.current.lastTxHash).toBe(TX_HASH);
    expect(result.current.reconciliation?.status).toBe('confirmed');

    // No approval needed when allowance already covers the stake.
    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'submitVerification' })
    );
    expect(mockWriteContractAsync).not.toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'approve' })
    );
    expect(mockSimulateContract).toHaveBeenCalled();
    expect(mockGetTransactionReceipt).toHaveBeenCalledWith({ hash: TX_HASH });

    const projectionRequest = mockedReconcileWithProjection.mock.calls[0][0];
    expect(projectionRequest.decision).toBe('VERIFY');
    expect(projectionRequest.stakeAmount).toBe(2); // whole token units
    expect(projectionRequest.claimId).toBe('123');
  });

  it('approves max allowance first when the allowance is insufficient', async () => {
    allowanceValue = 0n;
    const { result } = await renderReady();

    await act(async () => {
      await result.current.submitVerification({ position: 'TRUE', stake: STAKE });
    });

    const calls = mockWriteContractAsync.mock.calls.map(
      (call: [{ functionName: string }]) => call[0].functionName
    );
    expect(calls).toEqual(['approve', 'submitVerification']);
    expect(mockWriteContractAsync.mock.calls[0][0].args[1]).toBe(2n ** 256n - 1n); // maxUint256
    expect(result.current.reconciliation?.status).toBe('confirmed');
  });

  it('fails with APPROVAL_REJECTED when the wallet rejects approve', async () => {
    allowanceValue = 0n;
    mockWriteContractAsync.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === 'approve') return Promise.reject(new Error('user rejected'));
      return Promise.resolve(TX_HASH);
    });
    const { result } = await renderReady();

    await act(async () => {
      await expect(
        result.current.submitVerification({ position: 'TRUE', stake: STAKE })
      ).rejects.toMatchObject({ code: 'APPROVAL_REJECTED' });
    });
    expect(result.current.phase).toBe('error');
  });

  it('surfaces SIMULATION_REVERTED when eth_call fails', async () => {
    mockSimulateContract.mockRejectedValue(new Error('Insufficient stake'));
    const { result } = await renderReady();

    await act(async () => {
      await expect(
        result.current.submitVerification({ position: 'TRUE', stake: STAKE })
      ).rejects.toMatchObject({ code: 'SIMULATION_REVERTED' });
    });
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it('returns rejected when the receipt is a revert', async () => {
    mockGetTransactionReceipt.mockResolvedValue({
      transactionHash: TX_HASH,
      status: '0x0',
      blockNumber: 999n,
    });
    const { result } = await renderReady();

    let outcome: Awaited<ReturnType<typeof result.current.submitVerification>>;
    await act(async () => {
      outcome = await result.current.submitVerification({ position: 'TRUE', stake: STAKE });
    });

    expect(outcome!.phase).toBe('rejected');
    expect(outcome!.reconciliation?.status).toBe('rejected');
    expect(result.current.phase).toBe('rejected');
  });
});
