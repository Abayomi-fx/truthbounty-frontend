/**
 * Hook for encoding and submitting dispute opening transactions.
 *
 * The pinned `TruthBountyWeighted` ABI is the only authority for the calldata
 * layout. When it does not declare a dispute-opening entrypoint this hook
 * reports the flow as unsupported and refuses to build a call, rather than
 * guessing a selector or hand-rolling an ABI encoding.
 */

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useWriteContract } from 'wagmi';
import { encodeFunctionData, type Abi } from 'viem';
import {
  DisputeContext,
  DisputeSubmissionPayload,
  DisputeTransaction,
  DisputeSimulationResult,
  DisputeValidation,
  DisputeSubmissionStatus,
} from '@/app/types/dispute';
import {
  getContractAbi,
  getContractAddress,
  getProtocolVersion,
  getReleaseChainId,
} from '@/lib/contracts/registry';
import { evaluateWriteTarget } from '@/lib/contracts/write-gate';

interface UseDisputeSubmissionConfig {
  contractAddress?: string;
  abi?: readonly unknown[];
  expectedChainId?: number;
  artifactVersion?: string;
}

interface DisputeSubmissionResult {
  validateDispute: (
    context: DisputeContext,
    payload: DisputeSubmissionPayload
  ) => DisputeValidation;

  simulateDispute: (
    context: DisputeContext,
    payload: DisputeSubmissionPayload
  ) => Promise<DisputeSimulationResult>;

  submitDispute: (
    context: DisputeContext,
    payload: DisputeSubmissionPayload
  ) => Promise<DisputeTransaction>;

  isSimulating: boolean;
  isSubmitting: boolean;
  error: string | null;
  lastTransaction: DisputeTransaction | null;
  artifactVersion: string;
  /** True when the pinned ABI declares a dispute-opening entrypoint. */
  isDisputeSupported: boolean;
}

const OPTIMISM_MAINNET_CHAIN_ID = 10;
const OPTIMISM_SEPOLIA_CHAIN_ID = 11155420;
const EXPECTED_ARTIFACT_VERSION = '2.0.0';

/**
 * Dispute-opening entrypoint, discovered from the pinned ABI rather than
 * assumed. No hardcoded selector exists in this module.
 */
const DISPUTE_FUNCTIONS = ['openDispute', 'createDispute', 'dispute'] as const;

/**
 * Hook for encoding and submitting dispute opening transactions
 */
export function useDisputeSubmission(
  config: UseDisputeSubmissionConfig = {}
): DisputeSubmissionResult {
  const contractAddress =
    config.contractAddress ?? getContractAddress('TruthBountyWeighted');
  const abi = config.abi ?? getContractAbi('TruthBountyWeighted');
  const expectedChainId = config.expectedChainId ?? getReleaseChainId();
  const artifactVersion = config.artifactVersion ?? getProtocolVersion();

  const { address: userAddress, isConnected } = useAccount();
  const currentChainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract() ?? {};

  const [isSimulating, setIsSimulating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTransaction, setLastTransaction] = useState<DisputeTransaction | null>(
    null
  );

  /**
   * True only when the pinned ABI genuinely declares a dispute-opening
   * function. Never assumed.
   */
  const abiSupportsDispute = useMemo(
    () =>
      DISPUTE_FUNCTIONS.some((name) =>
        (abi as readonly { type?: string; name?: string }[]).some(
          (entry) => entry?.type === 'function' && entry.name === name,
        ),
      ),
    [abi],
  );

  /**
   * Name of the declared dispute-opening function, or `null` when absent.
   */
  const disputeFunctionName = useMemo((): string | null => {
    for (const candidate of DISPUTE_FUNCTIONS) {
      const declared = (abi as readonly { type?: string; name?: string }[]).some(
        (entry) => entry?.type === 'function' && entry.name === candidate,
      );
      if (declared) return candidate;
    }
    return null;
  }, [abi]);

  /**
   * Encode the dispute call from the pinned ABI.
   *
   * Returns `null` when the ABI declares no dispute entrypoint or the claim id
   * is not a canonical 32-byte value, so callers fail closed instead of
   * emitting malformed calldata.
   */
  const encodeDisputeCall = useCallback(
    (
      claimId: string,
      reason: string,
      bondAmount: string,
    ): `0x${string}` | null => {
      if (!disputeFunctionName) return null;

      const trimmedClaimId = claimId.trim();
      if (!/^0x[a-fA-F0-9]{64}$/.test(trimmedClaimId)) return null;

      try {
        return encodeFunctionData({
          abi: abi as unknown as Abi,
          functionName: disputeFunctionName,
          args: [trimmedClaimId as `0x${string}`, reason, BigInt(bondAmount)],
        }) as `0x${string}`;
      } catch {
        return null;
      }
    },
    [abi, disputeFunctionName],
  );

  /**
   * Validate dispute submission
   */
  const validateDispute = useCallback(
    (
      context: DisputeContext,
      payload: DisputeSubmissionPayload
    ): DisputeValidation => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check dispute window open
      const windowOpen = context.deadline.isWindowOpen && !context.deadline.isWindowClosed;
      if (!windowOpen) {
        errors.push('Dispute window has closed or has not opened yet');
      }

      // Check no active dispute
      const noActiveDispute = !context.deadline.hasActiveDispute;
      if (!noActiveDispute) {
        errors.push('A dispute has already been opened for this claim');
      }

      // Check wallet connected
      const walletConnected = isConnected && !!userAddress;
      if (!walletConnected) {
        errors.push('Wallet not connected');
      }

      // Check correct chain
      const correctChain = currentChainId === expectedChainId;
      if (!correctChain) {
        errors.push(
          `Wrong network. Expected chain ${expectedChainId}, got ${currentChainId}`
        );
      }

      // Fail closed through the single validated release manifest before any signing path.
      const writeTarget = evaluateWriteTarget({
        activeChainId: currentChainId,
        contractAddress,
        expectedProtocolVersion: artifactVersion,
      });
      if (!writeTarget.ok) {
        errors.push(...writeTarget.errors);
      }

      // Check contract address valid
      const contractAddressValid =
        contractAddress.match(/^0x[a-fA-F0-9]{40}$/) !== null;
      if (!contractAddressValid) {
        errors.push('Invalid contract address format');
      }

      // Check artifact version (in production, query from contract)
      const artifactVersionValid = writeTarget.ok;
      if (!artifactVersionValid && writeTarget.errors.length === 0) {
        errors.push(`Contract version mismatch. Expected ${artifactVersion}`);
      }

      // Check sufficient balance
      let sufficientBalance = false;
      try {
        const bondBigInt = BigInt(payload.bondAmount);
        const balanceBigInt = BigInt(context.walletPosition.currentBalance);
        sufficientBalance = balanceBigInt >= bondBigInt;
        if (!sufficientBalance) {
          errors.push('Insufficient balance for challenge bond');
        }
      } catch (err) {
        errors.push('Invalid bond amount format');
      }

      // Validate bond amount matches required bond
      let bondAmountValid = false;
      try {
        const payloadBond = BigInt(payload.bondAmount);
        const requiredBond = BigInt(context.bond.bondAmount);
        bondAmountValid = payloadBond === requiredBond;
        if (!bondAmountValid) {
          errors.push(
            `Bond amount must be exactly ${context.bond.bondAmount} wei`
          );
        }
      } catch (err) {
        errors.push('Invalid bond amount');
      }

      // Check reason provided
      const reasonProvided = Boolean(payload.reason && payload.reason.trim().length > 0);
      if (!reasonProvided) {
        errors.push('Dispute reason is required');
      } else if (payload.reason.length < 10) {
        warnings.push('Dispute reason should be more descriptive (at least 10 characters)');
      }

      // Check not participated in first round (some protocols disallow)
      const notParticipatedInFirstRound = !context.walletPosition.hasParticipatedInFirstRound;
      // Note: This check is protocol-specific. Some protocols allow, others don't.
      // For now, we only warn if participated
      if (!notParticipatedInFirstRound) {
        warnings.push(
          'You participated in first-round verification. Some protocols may disallow disputes from verifiers.'
        );
      }

      // Check contract not paused (will be checked async in simulation)
      const contractNotPaused = true; // Checked in simulateDispute

      const validation: DisputeValidation = {
        isValid: errors.length === 0,
        errors,
        warnings,
        checks: {
          windowOpen,
          noActiveDispute,
          walletConnected,
          correctChain,
          sufficientBalance,
          notParticipatedInFirstRound,
          bondAmountValid,
          reasonProvided,
          contractAddressValid,
          artifactVersionValid,
          contractNotPaused,
        },
      };

      return validation;
    },
    [
      isConnected,
      userAddress,
      currentChainId,
      expectedChainId,
      contractAddress,
      artifactVersion,
    ]
  );

  /**
   * Simulate dispute opening transaction
   */
  const simulateDispute = useCallback(
    async (
      context: DisputeContext,
      payload: DisputeSubmissionPayload
    ): Promise<DisputeSimulationResult> => {
      setIsSimulating(true);
      setError(null);

      try {
        // Validate first
        const validation = validateDispute(context, payload);
        if (!validation.isValid) {
          return {
            success: false,
            error: validation.errors.join('; '),
          };
        }

        // The pinned ABI is the authority: no declared entrypoint means the
        // dispute flow is unavailable. Never guess a selector.
        if (!disputeFunctionName) {
          return {
            success: false,
            error:
              'The canonical ABI declares no dispute-opening function; dispute submission is unavailable.',
          };
        }

        const calldata = encodeDisputeCall(
          payload.claimId,
          payload.reason,
          payload.bondAmount,
        );
        if (!calldata) {
          return {
            success: false,
            error:
              'Could not encode the dispute call from the canonical ABI; fail closed.',
          };
        }

        // Real eth_call simulation. This also reverts when the contract is
        // paused, so no separate (unverifiable) pause check is invented.
        if (!publicClient?.simulateContract) {
          return {
            success: false,
            error: 'Public client is unavailable for dispute simulation.',
          };
        }

        let gasEstimate: string;
        try {
          const gas = await publicClient.estimateGas({
            account: userAddress as unknown as `0x${string}`,
            to: contractAddress as `0x${string}`,
            data: calldata,
            value: BigInt(payload.bondAmount),
          });
          gasEstimate = gas.toString();
        } catch (err) {
          return {
            success: false,
            error:
              err instanceof Error
                ? err.message
                : 'Gas estimation failed — fail closed',
          };
        }

        try {
          await publicClient.simulateContract({
            account: userAddress as unknown as `0x${string}`,
            address: contractAddress as `0x${string}`,
            abi: abi as unknown as Abi,
            functionName: disputeFunctionName,
            args: [
              payload.claimId.trim() as `0x${string}`,
              payload.reason,
              BigInt(payload.bondAmount),
            ],
            value: BigInt(payload.bondAmount),
          });
        } catch (err) {
          return {
            success: false,
            error: `Simulation reverted: ${
              err instanceof Error ? err.message : String(err)
            }`,
          };
        }

        // No dispute id is projected: it is assigned on-chain by the
        // contract, and inventing one here would fabricate protocol state.
        return {
          success: true,
          gasEstimate,
          projectedState: {
            bondLocked: payload.bondAmount,
            newStatus: 'DISPUTED',
          } as DisputeSimulationResult['projectedState'],
          data: {
            from: userAddress as string,
            to: contractAddress,
            value: payload.bondAmount, // Bond sent as value
            calldata,
          },
        };
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Simulation failed';
        setError(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      } finally {
        setIsSimulating(false);
      }
    },
    [
      validateDispute,
      disputeFunctionName,
      encodeDisputeCall,
      userAddress,
      contractAddress,
      abi,
      publicClient,
    ]
  );

  /**
   * Submit dispute opening transaction
   */
  const submitDispute = useCallback(
    async (
      context: DisputeContext,
      payload: DisputeSubmissionPayload
    ): Promise<DisputeTransaction> => {
      setIsSubmitting(true);
      setError(null);

      try {
        // Validate first
        const validation = validateDispute(context, payload);
        if (!validation.isValid) {
          throw new Error(validation.errors.join('; '));
        }

        // Simulate to catch errors early
        const simulation = await simulateDispute(context, payload);
        if (!simulation.success) {
          throw new Error(simulation.error || 'Simulation failed');
        }

        if (!disputeFunctionName) {
          throw new Error(
            'The canonical ABI declares no dispute-opening function; dispute submission is unavailable.'
          );
        }
        if (!writeContractAsync) {
          throw new Error(
            'Wallet write path unavailable: the connected wallet cannot submit transactions.'
          );
        }

        const transactionHash = await writeContractAsync({
          address: contractAddress,
          abi: abi as unknown as Abi,
          functionName: disputeFunctionName,
          args: [
            payload.claimId.trim() as `0x${string}`,
            payload.reason,
            BigInt(payload.bondAmount),
          ],
          value: BigInt(payload.bondAmount),
          chainId: expectedChainId,
        } as never);

        // The bond lock and dispute id are only known from a mined receipt,
        // so they are left unasserted here rather than predicted.
        const transaction: DisputeTransaction = {
          transactionHash,
          from: userAddress as string,
          to: contractAddress,
          status: 'PENDING',
          claimId: payload.claimId,
          bondAmount: payload.bondAmount,
          reason: payload.reason,
          timestamp: new Date().toISOString(),
          bondLocked: false,
        };
        setLastTransaction(transaction);
        return transaction;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Submission failed';
        setError(errorMsg);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      validateDispute,
      simulateDispute,
      disputeFunctionName,
      writeContractAsync,
      contractAddress,
      abi,
      expectedChainId,
      userAddress,
    ]
  );

  return {
    validateDispute,
    simulateDispute,
    submitDispute,
    isSimulating,
    isSubmitting,
    error,
    lastTransaction,
    artifactVersion,
    isDisputeSupported: abiSupportsDispute,
  };
}

/**
 * Utility: Check if dispute can be submitted
 */
export function canSubmitDispute(validation: DisputeValidation): boolean {
  return validation.isValid;
}

/**
 * Utility: Get primary error message from validation
 */
export function getPrimaryError(validation: DisputeValidation): string | null {
  if (validation.errors.length === 0) return null;
  return validation.errors[0];
}

/**
 * Utility: Calculate bond in ETH (for display)
 * Canonical implementation in @/lib/format
 */
export { formatBondAmount } from '@/lib/format';

