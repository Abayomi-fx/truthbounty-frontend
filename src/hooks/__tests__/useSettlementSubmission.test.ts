/**
 * Unit tests for useSettlementSubmission hook.
 *
 * V2-FE-150 — these assert the *real* behaviour: calldata comes from the pinned
 * canonical ABI, the gas estimate comes from the node, and a transaction hash
 * exists only when the wallet actually returns one.
 */

import { renderHook, act } from '@testing-library/react';
import { useSettlementSubmission } from '@/hooks/useSettlementSubmission';
import { SettlementAction } from '@/app/types/settlement';
import * as wagmi from 'wagmi';

jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useChainId: jest.fn(() => 11155420),
  usePublicClient: jest.fn(),
  useWriteContract: jest.fn(),
}));

const CONTRACT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

/** Minimal but real shape of the canonical settlement entrypoints. */
const CANONICAL_ABI = [
  {
    type: 'function',
    name: 'settleProvisional',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'claimId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'finalize',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'claimId', type: 'bytes32' }],
    outputs: [],
  },
] as const;

const REAL_TX_HASH = `0x${'ab'.repeat(32)}`;
/** Canonical 32-byte claim identifier. */
const CLAIM_ID = `0x${'1a'.repeat(32)}`;

jest.mock('@/lib/contracts/registry', () => ({
  getContractAddress: jest.fn(() => '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'),
  getContractAbi: jest.fn(() => []),
  getProtocolVersion: jest.fn(() => '2.0.0'),
  getReleaseChainId: jest.fn(() => 11155420),
  getProtocolRelease: jest.fn(() => ({
    manifest: {
      protocolVersion: '2.0.0',
      releaseId: 'v2.0.0-sepolia',
      gitCommit: '5333c0acb9ccfb8a6a37ae76b3397d06781f0119',
      compilerVersion: 'foundry-0.2.0',
      chainId: 11155420,
      deploymentBlock: 0,
      abiVersion: '2.0.0',
      eventSchemaVersion: '2.0.0',
      parameterSetVersion: '2.0.0',
      contracts: {
        TruthBountyWeighted: {
          proxy: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          implementation: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        },
      },
    },
    addresses: {
      chainId: 11155420,
      TruthBountyWeighted: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    },
    abis: { TruthBountyWeighted: [] },
    events: { version: '2.0.0', events: [] },
    parameters: {},
    roles: {},
    checksums: { version: '1', files: {} },
  })),
}));

const registry = jest.requireMock('@/lib/contracts/registry') as {
  getContractAbi: jest.Mock;
};

describe('useSettlementSubmission', () => {
  const mockUserAddress = '0x1234567890123456789012345678901234567890';
  const action: SettlementAction = {
    type: 'SETTLE_PROVISIONAL',
    claimId: CLAIM_ID,
    isCallable: true,
  };

  const simulateContract = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    registry.getContractAbi.mockReturnValue(CANONICAL_ABI);
    (wagmi.useAccount as jest.Mock).mockReturnValue({ address: mockUserAddress });
    (wagmi.useChainId as jest.Mock).mockReturnValue(11155420);
    simulateContract.mockResolvedValue({ request: {} });
    (wagmi.usePublicClient as jest.Mock).mockReturnValue({ simulateContract });
    (wagmi.useWriteContract as jest.Mock).mockReturnValue({
      writeContractAsync: jest.fn().mockResolvedValue(REAL_TX_HASH),
    });
  });

  const render = (config = { contractAddress: CONTRACT }) =>
    renderHook(() => useSettlementSubmission(config));

  describe('simulation', () => {
    it('encodes calldata from the canonical ABI', async () => {
      const { result } = render();

      let simulationResult: any;
      await act(async () => {
        simulationResult = await result.current.simulateSettlement(action);
      });

      expect(simulationResult.success).toBe(true);
      expect(simulationResult.data.from).toBe(mockUserAddress);
      expect(simulationResult.data.to).toBe(CONTRACT);
      expect(simulationResult.data.calldata).toMatch(/^0x[0-9a-f]+$/i);
      // Not one of the fabricated selectors the stub used to emit.
      expect(simulationResult.data.calldata).not.toBe(
        expect.stringContaining('12345678'),
      );
    });

    it('encodes FINALIZE from the canonical ABI', async () => {
      const { result } = render();

      let simulationResult: any;
      await act(async () => {
        simulationResult = await result.current.simulateSettlement({
          ...action,
          type: 'FINALIZE',
        });
      });

      expect(simulationResult.success).toBe(true);
      expect(simulationResult.data.calldata).toMatch(/^0x[0-9a-f]+$/i);
    });

    it('reports no calldata when the pinned ABI omits the entrypoint (never guesses a selector)', async () => {      registry.getContractAbi.mockReturnValue([]);
      const { result } = render();

      let simulationResult: any;
      await act(async () => {
        simulationResult = await result.current.simulateSettlement(action);
      });

      expect(simulationResult.success).toBe(true);
      expect(simulationResult.data.calldata).toBeUndefined();
    });

    it('reports only the gas the node actually returned', async () => {
      simulateContract.mockResolvedValue({ request: { gas: 123_456n } });
      const { result } = render();

      let simulationResult: any;
      await act(async () => {
        simulationResult = await result.current.simulateSettlement(action);
      });

      expect(simulationResult.gasEstimate).toBe('123456');
    });

    it('omits the gas estimate entirely when the node reports none', async () => {
      simulateContract.mockResolvedValue({ request: {} });
      const { result } = render();

      let simulationResult: any;
      await act(async () => {
        simulationResult = await result.current.simulateSettlement(action);
      });

      expect(simulationResult.success).toBe(true);
      expect(simulationResult).not.toHaveProperty('gasEstimate');
    });

    it('fails closed when no RPC endpoint is available to simulate against', async () => {
      (wagmi.usePublicClient as jest.Mock).mockReturnValue(undefined);
      const { result } = render();

      let simulationResult: any;
      await act(async () => {
        simulationResult = await result.current.simulateSettlement(action);
      });

      expect(simulationResult.success).toBe(false);
      expect(simulationResult.error).toMatch(/no rpc endpoint/i);
    });

    it('surfaces a reverting simulation instead of claiming success', async () => {
      simulateContract.mockRejectedValue(new Error('execution reverted: not allowed'));
      const { result } = render();

      let simulationResult: any;
      await act(async () => {
        simulationResult = await result.current.simulateSettlement(action);
      });

      expect(simulationResult.success).toBe(false);
      expect(simulationResult.error).toMatch(/simulation reverted/i);
      expect(result.current.error).toMatch(/simulation reverted/i);
    });

    it('rejects simulation for a non-callable action', async () => {
      const { result } = render();

      let simulationResult: any;
      await act(async () => {
        simulationResult = await result.current.simulateSettlement({
          ...action,
          isCallable: false,
          reason: 'Voting period not ended',
        });
      });

      expect(simulationResult.success).toBe(false);
      expect(simulationResult.error).toContain('Voting period not ended');
      expect(simulateContract).not.toHaveBeenCalled();
    });

    it('rejects simulation without a wallet connection', async () => {
      (wagmi.useAccount as jest.Mock).mockReturnValue({ address: undefined });
      const { result } = render();

      let simulationResult: any;
      await act(async () => {
        simulationResult = await result.current.simulateSettlement(action);
      });

      expect(simulationResult.success).toBe(false);
      expect(simulationResult.error).toContain('Wallet not connected');
    });

    it('rejects a claim ID that is not a canonical 32-byte hex value', async () => {
      const { result } = render();

      let simulationResult: any;
      await act(async () => {
        simulationResult = await result.current.simulateSettlement({
          ...action,
          claimId: 'claim-123',
        });
      });

      expect(simulationResult.success).toBe(false);
      expect(simulationResult.error).toMatch(/32-byte hex/i);
      expect(simulateContract).not.toHaveBeenCalled();
    });

    it('rejects an invalid contract address', async () => {
      const { result } = render({ contractAddress: 'invalid-address' });

      let simulationResult: any;
      await act(async () => {
        simulationResult = await result.current.simulateSettlement(action);
      });

      expect(simulationResult.success).toBe(false);
      expect(simulationResult.error).toMatch(
        /Invalid contract address|Invalid EVM address|Write target address/i,
      );
    });
  });

  describe('submission', () => {
    it('returns the hash the wallet actually produced and records it', async () => {
      const { result } = render();

      let submission: any;
      await act(async () => {
        submission = await result.current.submitSettlement(action);
      });

      expect(submission.transactionHash).toBe(REAL_TX_HASH);
      expect(submission.status).toBe('pending');
      expect(submission.type).toBe('SETTLE_PROVISIONAL');
      expect(submission.from).toBe(mockUserAddress);
      expect(submission.to).toBe(CONTRACT);
      expect(result.current.lastSubmission).toEqual(submission);
      expect(result.current.error).toBeNull();
    });

    it('fails closed without a wallet write path (never fabricates a tx hash)', async () => {
      (wagmi.useWriteContract as jest.Mock).mockReturnValue(undefined);
      const { result } = render();

      let error: Error | undefined;
      await act(async () => {
        try {
          await result.current.submitSettlement(action);
        } catch (e) {
          error = e as Error;
        }
      });

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/writeContract|synthetic/i);
      expect(result.current.lastSubmission).toBeNull();
    });

    it('fails closed when the wallet returns no hash at all', async () => {
      (wagmi.useWriteContract as jest.Mock).mockReturnValue({
        writeContractAsync: jest.fn().mockResolvedValue(undefined),
      });
      const { result } = render();

      let error: Error | undefined;
      await act(async () => {
        try {
          await result.current.submitSettlement(action);
        } catch (e) {
          error = e as Error;
        }
      });

      expect(error?.message).toMatch(/did not return a transaction hash/i);
      expect(result.current.lastSubmission).toBeNull();
    });

    it('fails closed when the wallet returns a malformed hash', async () => {
      (wagmi.useWriteContract as jest.Mock).mockReturnValue({
        writeContractAsync: jest.fn().mockResolvedValue('0xnope'),
      });
      const { result } = render();

      let error: Error | undefined;
      await act(async () => {
        try {
          await result.current.submitSettlement(action);
        } catch (e) {
          error = e as Error;
        }
      });

      expect(error?.message).toMatch(/did not return a transaction hash/i);
      expect(result.current.lastSubmission).toBeNull();
    });

    it('surfaces a user rejection distinctly from a write failure', async () => {
      (wagmi.useWriteContract as jest.Mock).mockReturnValue({
        writeContractAsync: jest
          .fn()
          .mockRejectedValue(new Error('User rejected the request.')),
      });
      const { result } = render();

      let error: Error | undefined;
      await act(async () => {
        try {
          await result.current.submitSettlement(action);
        } catch (e) {
          error = e as Error;
        }
      });

      expect(error?.message).toMatch(/rejected by the wallet/i);
      expect(result.current.lastSubmission).toBeNull();
    });

    it('never reaches the wallet when the simulation reverts', async () => {
      simulateContract.mockRejectedValue(new Error('execution reverted'));
      const writeContractAsync = jest.fn().mockResolvedValue(REAL_TX_HASH);
      (wagmi.useWriteContract as jest.Mock).mockReturnValue({ writeContractAsync });
      const { result } = render();

      let error: Error | undefined;
      await act(async () => {
        try {
          await result.current.submitSettlement(action);
        } catch (e) {
          error = e as Error;
        }
      });

      expect(error?.message).toMatch(/simulation reverted/i);
      expect(writeContractAsync).not.toHaveBeenCalled();
      expect(result.current.lastSubmission).toBeNull();
    });

    it('fails closed when the wallet is on the wrong chain', async () => {
      (wagmi.useChainId as jest.Mock).mockReturnValue(1);
      const { result } = render();

      let error: Error | undefined;
      await act(async () => {
        try {
          await result.current.submitSettlement(action);
        } catch (e) {
          error = e as Error;
        }
      });

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Wrong network|Unsupported network|readiness/i);
      expect(result.current.lastSubmission).toBeNull();
    });

    it('rejects non-callable actions without inventing a submission', async () => {
      const { result } = render();

      let error: any;
      await act(async () => {
        try {
          await result.current.submitSettlement({
            ...action,
            isCallable: false,
            reason: 'Already settled',
          });
        } catch (e) {
          error = e;
        }
      });

      expect(error).toBeDefined();
      expect(result.current.error).toContain('Already settled');
      expect(result.current.lastSubmission).toBeNull();
    });
  });

  describe('loading states', () => {
    it('exposes isSimulating and isSubmitting', async () => {
      const { result } = render();

      act(() => {
        void result.current.simulateSettlement(action);
      });
      expect(result.current.isSimulating).toBe(true);

      await act(async () => {
        await result.current.simulateSettlement(action);
      });
      expect(result.current.isSimulating).toBe(false);

      await act(async () => {
        await result.current.submitSettlement(action);
      });
      expect(result.current.isSubmitting).toBe(false);
    });
  });
});
