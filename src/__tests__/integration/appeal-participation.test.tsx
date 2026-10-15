/**
 * Integration tests for the appeal participation flow.
 * Covers context fetch → validation → simulation → submission → reconciliation
 * using the real ABI-driven participation flow (never fabricated calldata or hashes).
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { toFunctionSelector } from 'viem';
import { useAppealContext } from '@/hooks/useAppealContext';
import {
  appealContextConfig,
  buildAppealProjection,
} from '@/__tests__/fixtures/appealProjection';
import { useAppealParticipation } from '@/hooks/useAppealParticipation';
import { useAppealReconciliation } from '@/hooks/useAppealReconciliation';
import {
  MOCK_ADDRESS_1,
  MOCK_TX_HASH_1,
} from '@/__tests__/mocks/wagmi/mock-wagmi';
import * as wagmi from 'wagmi';

jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useChainId: jest.fn(),
  useBlockNumber: jest.fn(),
  useWaitForTransactionReceipt: jest.fn(),
  usePublicClient: jest.fn(),
  useWriteContract: jest.fn(),
}));

const mockContractAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const mockUserAddress = MOCK_ADDRESS_1;
const OPTIMISM_MAINNET = 11155420;
const TX_HASH = MOCK_TX_HASH_1;
const APPEAL_ID = '0x' + 'ab'.repeat(32);

const TEST_ABI = [
  {
    type: 'function',
    name: 'participateInAppeal',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'appealId', type: 'bytes32' },
      { name: 'support', type: 'bool' },
      { name: 'stakeAmount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

const PARTICIPATE_SELECTOR = toFunctionSelector(
  'participateInAppeal(bytes32,bool,uint256)'
);

const mockSimulateContract = jest.fn();
const mockGetTransactionReceipt = jest.fn();
const mockReadContract = jest.fn();
const mockWriteContractAsync = jest.fn();

function renderAppealHook(config: Record<string, unknown> = {}) {
  return renderHook(() =>
    useAppealParticipation({
      contractAddress: mockContractAddress,
      abi: TEST_ABI,
      expectedChainId: OPTIMISM_MAINNET,
      ...config,
    })
  );
}

describe('Appeal Participation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (wagmi.useAccount as jest.Mock).mockReturnValue({
      address: mockUserAddress,
      isConnected: true,
    });
    (wagmi.useChainId as jest.Mock).mockReturnValue(OPTIMISM_MAINNET);
    (wagmi.useBlockNumber as jest.Mock).mockReturnValue({
      data: BigInt(12345678),
    });
    mockSimulateContract.mockResolvedValue({ request: {} });
    mockGetTransactionReceipt.mockResolvedValue({
      transactionHash: TX_HASH,
      status: '0x1',
      blockNumber: 1234n,
      gasUsed: 21000n,
      chainId: OPTIMISM_MAINNET,
    });
    mockReadContract.mockResolvedValue(0n);
    (wagmi.usePublicClient as jest.Mock).mockReturnValue({
      simulateContract: mockSimulateContract,
      getTransactionReceipt: mockGetTransactionReceipt,
      readContract: mockReadContract,
    });
    mockWriteContractAsync.mockResolvedValue(TX_HASH);
    (wagmi.useWriteContract as jest.Mock).mockReturnValue({
      writeContractAsync: mockWriteContractAsync,
    });
  });

  describe('complete participation flow', () => {
    it('should complete full flow: fetch context → validate → simulate → submit → reconcile', async () => {
      const { result: contextResult } = renderHook(() =>
        useAppealContext(appealContextConfig({
          appealId: APPEAL_ID,
          claimId: 'claim-456',
          contractAddress: mockContractAddress,
          userAddress: mockUserAddress,
        }))
      );

      await waitFor(() => {
        expect(contextResult.current.context).not.toBeNull();
      });

      const context = contextResult.current.context!;
      expect(context.isEligible).toBe(true);

      const { result: participationResult } = renderAppealHook();

      const validation = participationResult.current.validateParticipation(
        context,
        'SUPPORT',
        '500000000000000000'
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      let simulation: any;
      await act(async () => {
        simulation = await participationResult.current.simulateParticipation(
          context,
          'SUPPORT',
          '500000000000000000'
        );
      });

      expect(simulation?.success).toBe(true);
      expect(simulation?.data?.calldata.startsWith(PARTICIPATE_SELECTOR)).toBe(
        true
      );

      // Step 5: Submit through the real wallet write path (V2-FE-100)
      let submitted: any;
      await act(async () => {
        submitted = await participationResult.current.submitParticipation(
          context,
          'SUPPORT',
          '500000000000000000'
        );
      });

      expect(mockWriteContractAsync).toHaveBeenCalledTimes(1);
      expect(submitted.transactionHash).toBe(TX_HASH);
      expect(submitted.from).toBe(mockUserAddress);
      expect(submitted.to).toBe(mockContractAddress);
      expect(submitted.chainId).toBe(OPTIMISM_MAINNET);
      expect(submitted.status).toBe('CONFIRMED');
      expect(submitted.blockNumber).toBe(1234n);
      expect(participationResult.current.phase).toBe('confirmed');

      // Reconciliation only proceeds from a real receipt — fabricate nothing here
      const realHash = '0x' + 'ab'.repeat(32);
      (wagmi.useWaitForTransactionReceipt as jest.Mock).mockReturnValue({
        data: {
          status: 'success',
          transactionHash: realHash,
          blockNumber: BigInt(12345680),
        },
        isLoading: false,
        error: null,
      });

      const { result: reconciliationResult } = renderHook(() =>
        useAppealReconciliation({
          transaction: {
            transactionHash: realHash,
            from: mockUserAddress,
            to: mockContractAddress,
            status: 'PENDING',
            appealId: 'appeal-123',
            claimId: 'claim-456',
            disputeId: 'dispute-789',
            decision: 'SUPPORT',
            stakeAmount: '500000000000000000',
            timestamp: new Date().toISOString(),
          },
        })
      );

      await waitFor(() => {
        expect(reconciliationResult.current.result).not.toBeNull();
      });

      expect(reconciliationResult.current.result?.status).toBe('confirmed');
      expect(
        reconciliationResult.current.result?.position.hasParticipated
      ).toBe(true);
      expect(reconciliationResult.current.stateSegregation).not.toBeNull();
      expect(
        reconciliationResult.current.stateSegregation?.statesAreIndependent
      ).toBe(true);
    });

    it('should handle oppose decision in complete flow', async () => {
      const { result: contextResult } = renderHook(() =>
        useAppealContext(appealContextConfig({
          appealId: APPEAL_ID,
          claimId: 'claim-789',
          contractAddress: mockContractAddress,
          userAddress: mockUserAddress,
        }))
      );

      await waitFor(() => {
        expect(contextResult.current.context).toBeDefined();
      });

      const { result: participationResult } = renderAppealHook();

      let submitted: any;
      await act(async () => {
        submitted = await participationResult.current.submitParticipation(
          contextResult.current.context!,
          'OPPOSE',
          '300000000000000000'
        );
      });

      // OPPOSE is encoded from the real ABI and submitted via the wallet.
      expect(mockWriteContractAsync).toHaveBeenCalledTimes(1);
      const [writeArgs] = mockWriteContractAsync.mock.calls[0] as [
        { args: unknown[] },
      ];
      expect(writeArgs.args[1]).toBe(false);
      expect(submitted.transactionHash).toBe(TX_HASH);
      expect(submitted.decision).toBe('OPPOSE');
      expect(submitted.status).toBe('CONFIRMED');
    });
  });

  describe('fail-closed guards', () => {
    it('should fail closed and never invent a hash when the wallet write path is unavailable', async () => {
      (wagmi.useWriteContract as jest.Mock).mockReturnValue(undefined);

      const { result: contextResult } = renderHook(() =>
        useAppealContext(appealContextConfig({
          appealId: APPEAL_ID,
          claimId: 'claim-456',
          contractAddress: mockContractAddress,
          userAddress: mockUserAddress,
        }))
      );

      await waitFor(() => {
        expect(contextResult.current.context).not.toBeNull();
      });

      const { result: participationResult } = renderAppealHook();

      let submitError: Error | undefined;
      await act(async () => {
        try {
          await participationResult.current.submitParticipation(
            contextResult.current.context!,
            'SUPPORT',
            '500000000000000000'
          );
        } catch (e) {
          submitError = e as Error;
        }
      });

      expect(submitError).toBeDefined();
      expect(submitError?.message).toMatch(/writeContract|wallet write/i);
      expect(participationResult.current.lastTransaction).toBeNull();
    });
  });

  describe('error handling in flow', () => {
    it('should stop flow when context fetch fails', async () => {
      (wagmi.useAccount as jest.Mock).mockReturnValue({
        address: undefined,
        isConnected: false,
      });

      const { result: contextResult } = renderHook(() =>
        useAppealContext(appealContextConfig({
          appealId: APPEAL_ID,
          claimId: 'claim-456',
          contractAddress: mockContractAddress,
          userAddress: mockUserAddress,
        }))
      );

      await waitFor(() => {
        expect(contextResult.current.error).toBeDefined();
      });

      expect(contextResult.current.context).toBeNull();
      expect(contextResult.current.error).toContain('Wallet not connected');
    });

    it('should stop flow when validation fails', async () => {
      const { result: contextResult } = renderHook(() =>
        useAppealContext(appealContextConfig({
          appealId: APPEAL_ID,
          claimId: 'claim-456',
          contractAddress: mockContractAddress,
          userAddress: mockUserAddress,
        }))
      );

      await waitFor(() => {
        expect(contextResult.current.context).toBeDefined();
      });

      const { result: participationResult } = renderAppealHook();

      await act(async () => {
        await expect(
          participationResult.current.submitParticipation(
            contextResult.current.context!,
            'SUPPORT',
            '50000000000000000' // Below minimum
          )
        ).rejects.toThrow('Stake amount below minimum');
      });
    });

    it('should handle transaction revert in reconciliation', async () => {
      const { result: contextResult } = renderHook(() =>
        useAppealContext(appealContextConfig({
          appealId: APPEAL_ID,
          claimId: 'claim-456',
          contractAddress: mockContractAddress,
          userAddress: mockUserAddress,
        }))
      );

      await waitFor(() => {
        expect(contextResult.current.context).toBeDefined();
      });

      const { result: participationResult } = renderAppealHook();

      // Submission fails closed without a wallet write path
      await act(async () => {
        try {
          await participationResult.current.submitParticipation(
            contextResult.current.context!,
            'SUPPORT',
            '500000000000000000'
          );
        } catch {
          // expected
        }
      });

      const revertedHash = '0x' + 'cd'.repeat(32);

      // Mock reverted transaction from a real-shaped receipt
      (wagmi.useWaitForTransactionReceipt as jest.Mock).mockReturnValue({
        data: {
          status: 'reverted',
          transactionHash: revertedHash,
        },
        isLoading: false,
        error: null,
      });

      const { result: reconciliationResult } = renderHook(() =>
        useAppealReconciliation({
          transaction: {
            transactionHash: revertedHash,
            from: mockUserAddress,
            to: mockContractAddress,
            status: 'PENDING',
            appealId: 'appeal-123',
            claimId: 'claim-456',
            disputeId: 'dispute-789',
            decision: 'SUPPORT',
            stakeAmount: '500000000000000000',
            timestamp: new Date().toISOString(),
          },
        })
      );

      await waitFor(() => {
        expect(reconciliationResult.current.result).not.toBeNull();
      });

      expect(reconciliationResult.current.result?.status).toBe('reverted');
      expect(
        reconciliationResult.current.result?.position.hasParticipated
      ).toBe(false);
    });
  });

  describe('state segregation throughout flow', () => {
    it('should maintain state segregation from context to reconciliation', async () => {
      const { result: contextResult } = renderHook(() =>
        useAppealContext(appealContextConfig({
          appealId: APPEAL_ID,
          claimId: 'claim-456',
          contractAddress: mockContractAddress,
          userAddress: mockUserAddress,
        }))
      );

      await waitFor(() => {
        expect(contextResult.current.context).not.toBeNull();
      });

      const { result: participationResult } = renderAppealHook();

      // Real wallet write path: submission submits and only a real receipt confirms.
      let submitted: any;
      await act(async () => {
        submitted = await participationResult.current.submitParticipation(
          contextResult.current.context!,
          'SUPPORT',
          '500000000000000000'
        );
      });
      expect(submitted.transactionHash).toBe(TX_HASH);
      expect(submitted.status).toBe('CONFIRMED');

      const confirmedHash = '0x' + 'ef'.repeat(32);
      (wagmi.useWaitForTransactionReceipt as jest.Mock).mockReturnValue({
        data: {
          status: 'success',
          transactionHash: confirmedHash,
        },
        isLoading: false,
        error: null,
      });

      const { result: reconciliationResult } = renderHook(() =>
        useAppealReconciliation({
          transaction: {
            transactionHash: confirmedHash,
            from: mockUserAddress,
            to: mockContractAddress,
            status: 'PENDING',
            appealId: submitted.appealId,
            claimId: submitted.claimId,
            disputeId: submitted.disputeId,
            decision: 'SUPPORT',
            stakeAmount: '500000000000000000',
            timestamp: new Date().toISOString(),
          },
        })
      );

      await waitFor(() => {
        expect(reconciliationResult.current.stateSegregation).not.toBeNull();
      });

      const segregation = reconciliationResult.current.stateSegregation!;

      expect(segregation.claimId).toBe('claim-456');
      expect(segregation.appealState.appealId).toBe(APPEAL_ID);
      expect(segregation.appealState.decision).toBe('SUPPORT');
      expect(segregation.appealState.status).toBe('CONFIRMED');
      expect(segregation.statesAreIndependent).toBe(true);
    });
  });

  describe('real-time updates during flow', () => {
    it('should reflect a new projected deadline after a refetch', async () => {
      // The deadline is projection-owned: local block height must never
      // synthesise one. It changes only when the projection is re-read.
      let blocksRemaining = 39_200;
      const fetcher = jest.fn(async () =>
        buildAppealProjection({
          appealId: APPEAL_ID,
          chainId: OPTIMISM_MAINNET,
          snapshot: { appealId: APPEAL_ID, claimId: 'claim-456' },
          deadline: { appealId: APPEAL_ID, blocksRemaining },
          position: { appealId: APPEAL_ID, userAddress: mockUserAddress },
        })
      );

      const { result: contextResult } = renderHook(() =>
        useAppealContext({
          appealId: APPEAL_ID,
          claimId: 'claim-456',
          contractAddress: mockContractAddress,
          pollInterval: 100000,
          fetcher,
        })
      );

      await waitFor(() => {
        expect(contextResult.current.context).not.toBeNull();
      });

      expect(contextResult.current.context!.deadline.blocksRemaining).toBe(
        39_200
      );

      blocksRemaining = 12_000;
      await contextResult.current.refetch();

      await waitFor(() => {
        expect(
          contextResult.current.context?.deadline.blocksRemaining
        ).toBe(12_000);
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('does not change the deadline when only the local block height moves', async () => {
      const fetcher = jest.fn(async () =>
        buildAppealProjection({
          appealId: APPEAL_ID,
          chainId: OPTIMISM_MAINNET,
          snapshot: { appealId: APPEAL_ID, claimId: 'claim-456' },
          deadline: { appealId: APPEAL_ID, blocksRemaining: 39_200 },
          position: { appealId: APPEAL_ID, userAddress: mockUserAddress },
        })
      );

      const { result: contextResult, rerender } = renderHook(() =>
        useAppealContext({
          appealId: APPEAL_ID,
          claimId: 'claim-456',
          contractAddress: mockContractAddress,
          pollInterval: 100000,
          fetcher,
        })
      );

      await waitFor(() => {
        expect(contextResult.current.context).not.toBeNull();
      });

      (wagmi.useBlockNumber as jest.Mock).mockReturnValue({
        data: BigInt(99_999_999),
      });
      rerender();
      await act(async () => {});

      expect(contextResult.current.context?.deadline.blocksRemaining).toBe(
        39_200
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe('concurrent participation attempts', () => {
    it('should prevent double submission', async () => {
      const { result: contextResult } = renderHook(() =>
        useAppealContext(appealContextConfig({
          appealId: APPEAL_ID,
          claimId: 'claim-456',
          contractAddress: mockContractAddress,
          userAddress: mockUserAddress,
        }))
      );

      await waitFor(() => {
        expect(contextResult.current.context).toBeDefined();
      });

      const { result: participationResult } = renderAppealHook();

      // First submission goes through the real wallet write path.
      let firstSubmitted: any;
      await act(async () => {
        firstSubmitted = await participationResult.current.submitParticipation(
          contextResult.current.context!,
          'SUPPORT',
          '500000000000000000'
        );
      });

      expect(firstSubmitted.transactionHash).toBe(TX_HASH);
      expect(firstSubmitted.status).toBe('CONFIRMED');
      expect(participationResult.current.lastTransaction?.transactionHash).toBe(
        TX_HASH
      );

      const updatedContext = {
        ...contextResult.current.context!,
        walletPosition: {
          ...contextResult.current.context!.walletPosition,
          hasParticipated: true,
          existingDecision: 'SUPPORT' as const,
        },
        isEligible: false,
        ineligibilityReason: 'Already participated',
      };

      const validation = participationResult.current.validateParticipation(
        updatedContext,
        'OPPOSE',
        '300000000000000000'
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'You have already participated in this appeal'
      );
    });
  });

  describe('real simulation data', () => {
    it('should surface real calldata and never fabricate gas or projections', async () => {
      const { result: contextResult } = renderHook(() =>
        useAppealContext(appealContextConfig({
          appealId: APPEAL_ID,
          claimId: 'claim-456',
          contractAddress: mockContractAddress,
          userAddress: mockUserAddress,
        }))
      );

      await waitFor(() => {
        expect(contextResult.current.context).toBeDefined();
      });

      const { result: participationResult } = renderAppealHook();

      const stakeAmount = '1000000000000000000'; // 1 ETH
      let simulation: any;

      await act(async () => {
        simulation = await participationResult.current.simulateParticipation(
          contextResult.current.context!,
          'SUPPORT',
          stakeAmount
        );
      });

      expect(simulation?.success).toBe(true);
      expect(simulation?.data?.calldata.startsWith(PARTICIPATE_SELECTOR)).toBe(
        true
      );
      expect(simulation?.gasEstimate).toBeUndefined();
      expect(simulation?.projectedState).toBeUndefined();
      expect(simulation?.data?.calldata).toBeDefined();
    });
  });
});