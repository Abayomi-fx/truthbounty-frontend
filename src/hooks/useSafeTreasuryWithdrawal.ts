'use client';

/**
 * useSafeTreasuryWithdrawal — V2-FE-119
 *
 * Orchestrates Safe Treasury Withdrawal UX against canonical artifacts.
 * Never fabricates tx hashes, balances, or success. Fail closed on
 * unsupported chain, missing config, non-admin caller, or ABI gap.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import {
  getContractAbi,
  getContractAddress,
  getReleaseChainId,
} from '@/lib/contracts/registry';
import {
  abiHasTreasuryBalance,
  encodeWithdrawTreasuryCall,
  evaluateAccessGate,
  markBalanceStaleness,
  validateWithdrawalDraft,
} from '@/lib/treasury/safe-withdrawal';
import { getCanonicalRoles } from '@/lib/treasury/protocol-roles';
import type {
  TreasuryBalanceSnapshot,
  TreasuryWithdrawalDraft,
  TreasuryWithdrawalReceipt,
  TreasuryWithdrawalSimulation,
  TreasuryWithdrawalStep,
  TreasuryWithdrawalUiStatus,
  TreasuryWithdrawalValidation,
} from '@/app/types/treasury';
import {
  clearPendingTransaction,
  trackPendingTransaction,
} from '@/lib/pending-transactions';
import { useConstant } from './useConstant';

const EMPTY_DRAFT: TreasuryWithdrawalDraft = {
  recipient: '',
  amountWei: '',
  reason: '',
};

export interface UseSafeTreasuryWithdrawalResult {
  status: TreasuryWithdrawalUiStatus;
  step: TreasuryWithdrawalStep;
  draft: TreasuryWithdrawalDraft;
  setDraft: (patch: Partial<TreasuryWithdrawalDraft>) => void;
  balance: TreasuryBalanceSnapshot | null;
  validation: TreasuryWithdrawalValidation;
  typedConfirm: string;
  setTypedConfirm: (value: string) => void;
  simulation: TreasuryWithdrawalSimulation | null;
  receipt: TreasuryWithdrawalReceipt;
  gateBlockReason: string | null;
  isAdmin: boolean;
  refreshBalance: () => Promise<void>;
  goReview: () => void;
  goTypedConfirm: () => void;
  goBack: () => void;
  simulate: () => Promise<TreasuryWithdrawalSimulation>;
  submit: () => Promise<void>;
  reset: () => void;
}

export function useSafeTreasuryWithdrawal(): UseSafeTreasuryWithdrawalResult {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // wagmi hands back client objects whose identity is not guaranteed to be
  // stable across renders. They are read through refs so that neither identity
  // can invalidate the memoised access gate or re-trigger the balance effect.
  const publicClientRef = useRef(publicClient);
  publicClientRef.current = publicClient;
  const walletClientRef = useRef(walletClient);
  walletClientRef.current = walletClient;

  const abi = useConstant(() => getContractAbi('TruthBountyWeighted'));
  const contractAddress = useConstant(() => getContractAddress('TruthBountyWeighted'));
  const roles = useConstant(() => getCanonicalRoles());

  const gate = useMemo(
    () =>
      evaluateAccessGate({
        walletAddress: (isConnected && address ? address : null) as `0x${string}` | null,
        chainId: chainId ?? null,
        abi,
        roles,
        contractAddress,
      }),
    [isConnected, address, chainId, abi, roles, contractAddress],
  );

  const [draft, setDraftState] = useState<TreasuryWithdrawalDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState<TreasuryWithdrawalStep>('form');
  const [typedConfirm, setTypedConfirm] = useState('');
  const [balance, setBalance] = useState<TreasuryBalanceSnapshot | null>(null);
  const [simulation, setSimulation] = useState<TreasuryWithdrawalSimulation | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [statusOverride, setStatusOverride] = useState<TreasuryWithdrawalUiStatus | null>(null);
  const [receipt, setReceipt] = useState<TreasuryWithdrawalReceipt>({
    txHash: null,
    chainId: null,
    status: 'idle',
    confirmations: null,
  });

  const setDraft = useCallback((patch: Partial<TreasuryWithdrawalDraft>) => {
    setDraftState((prev) => ({ ...prev, ...patch }));
    setSimulation(null);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!gate.configComplete || !gate.abiSupportsWithdraw) {
      setBalance(null);
      return;
    }
    const client = publicClientRef.current;
    if (!client || !gate.chainSupported) {
      setBalance(null);
      return;
    }

    setLoadingBalance(true);
    try {
      let amountWei: string;
      if (abiHasTreasuryBalance(abi)) {
        const raw = (await client.readContract({
          address: contractAddress,
          abi: abi as never,
          functionName: 'treasuryBalance',
        })) as bigint;
        amountWei = raw.toString();
      } else {
        const raw = await client.getBalance({ address: contractAddress });
        amountWei = raw.toString();
      }

      setBalance(
        markBalanceStaleness({
          amountWei,
          fetchedAt: new Date().toISOString(),
          chainId: chainId as number,
          contractAddress,
        }),
      );
    } catch (err) {
      setBalance(null);
      setStatusOverride('failed');
      setReceipt((prev) => ({
        ...prev,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Failed to read treasury balance',
      }));
    } finally {
      setLoadingBalance(false);
    }
  }, [gate, abi, contractAddress, chainId]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  // Recompute staleness periodically without inventing new balances. The
  // interval is keyed on presence only — keying on the balance object itself
  // would tear the timer down and rebuild it on every staleness tick.
  const hasBalance = balance !== null;
  useEffect(() => {
    if (!hasBalance) return;
    const id = window.setInterval(() => {
      setBalance((prev) =>
        prev
          ? markBalanceStaleness({
              amountWei: prev.amountWei,
              fetchedAt: prev.fetchedAt,
              chainId: prev.chainId,
              contractAddress: prev.contractAddress,
            })
          : prev,
      );
    }, 5_000);
    return () => window.clearInterval(id);
  }, [hasBalance]);

  const requireTyped = step === 'typed_confirm' || step === 'submit';
  const validation = useMemo(
    () => validateWithdrawalDraft(draft, balance, typedConfirm, requireTyped),
    [draft, balance, typedConfirm, requireTyped],
  );

  const status: TreasuryWithdrawalUiStatus = useMemo(() => {
    if (statusOverride && ['rejected', 'failed', 'pending', 'confirmed', 'finalized', 'reorged', 'awaiting_signature', 'simulating'].includes(statusOverride)) {
      return statusOverride;
    }
    if (gate.blockReason) {
      if (!gate.configComplete) return 'missing_config';
      if (!gate.abiSupportsWithdraw) return 'missing_config';
      if (!gate.walletConnected) return 'empty';
      if (!gate.chainSupported) return 'unsupported_chain';
      if (!gate.isAdmin) return 'unauthorized';
    }
    if (loadingBalance) return 'loading';
    if (!balance) return 'empty';
    if (balance.isStale) return 'stale';
    if (step === 'review') return 'review';
    if (step === 'typed_confirm') return 'confirming';
    if (BigInt(balance.amountWei || '0') === 0n) return 'empty';
    return 'ready';
  }, [statusOverride, gate, loadingBalance, balance, step]);

  const goReview = useCallback(() => {
    const v = validateWithdrawalDraft(draft, balance, '', false);
    if (!v.ok || gate.blockReason) return;
    setStep('review');
    setStatusOverride(null);
  }, [draft, balance, gate.blockReason]);

  const goTypedConfirm = useCallback(() => {
    const v = validateWithdrawalDraft(draft, balance, '', false);
    if (!v.ok || gate.blockReason) return;
    setStep('typed_confirm');
  }, [draft, balance, gate.blockReason]);

  const goBack = useCallback(() => {
    setSimulation(null);
    setTypedConfirm('');
    setStatusOverride(null);
    setStep((prev) => (prev === 'typed_confirm' ? 'review' : 'form'));
  }, []);

  const simulate = useCallback(async (): Promise<TreasuryWithdrawalSimulation> => {
    setStatusOverride('simulating');
    const v = validateWithdrawalDraft(draft, balance, typedConfirm, true);
    if (!v.ok || gate.blockReason || !address) {
      const result: TreasuryWithdrawalSimulation = {
        success: false,
        error: gate.blockReason || v.errors[0] || 'Validation failed — fail closed',
      };
      setSimulation(result);
      setStatusOverride('failed');
      return result;
    }

    try {
      const calldata = encodeWithdrawTreasuryCall({
        abi,
        recipient: draft.recipient as `0x${string}`,
        amountWei: draft.amountWei,
      });

      // Never invent a gas limit: without a real RPC estimate the withdrawal
      // cannot be shown to the user, so fail closed instead.
      const client = publicClientRef.current;
      if (!client?.estimateGas) {
        const result: TreasuryWithdrawalSimulation = {
          success: false,
          error: 'RPC gas estimate unavailable — fail closed',
        };
        setSimulation(result);
        setStatusOverride('failed');
        return result;
      }

      let gasEstimate: string;
      try {
        const gas = await client.estimateGas({
          account: address,
          to: contractAddress,
          data: calldata,
        });
        gasEstimate = gas.toString();
      } catch (err) {
        const result: TreasuryWithdrawalSimulation = {
          success: false,
          error: err instanceof Error ? err.message : 'Simulation reverted — fail closed',
        };
        setSimulation(result);
        setStatusOverride('failed');
        return result;
      }

      const result: TreasuryWithdrawalSimulation = {
        success: true,
        gasEstimate,
        calldata,
        from: address,
        to: contractAddress,
      };
      setSimulation(result);
      setStatusOverride('confirming');
      return result;
    } catch (err) {
      const result: TreasuryWithdrawalSimulation = {
        success: false,
        error: err instanceof Error ? err.message : 'Encoding failed — fail closed',
      };
      setSimulation(result);
      setStatusOverride('failed');
      return result;
    }
  }, [draft, balance, typedConfirm, gate.blockReason, address, abi, contractAddress]);

  const submit = useCallback(async () => {
    if (gate.blockReason) {
      setStatusOverride('unauthorized');
      return;
    }
    const sim = simulation?.success ? simulation : await simulate();
    const wallet = walletClientRef.current;
    if (!sim.success || !sim.calldata || !wallet || !address) {
      setStatusOverride(sim.error?.toLowerCase().includes('reject') ? 'rejected' : 'failed');
      setReceipt({
        txHash: null,
        chainId: chainId ?? null,
        status: 'failed',
        confirmations: null,
        error: sim.error || 'Cannot submit without successful simulation',
      });
      return;
    }

    const pendingId = `treasury-withdraw:${draft.recipient}:${draft.amountWei}`;
    trackPendingTransaction({
      id: pendingId,
      kind: 'treasury',
      title: 'Treasury withdrawal pending',
      description: `Withdrawing ${draft.amountWei} wei to ${draft.recipient}`,
      txHash: null,
      chainId: chainId ?? getReleaseChainId(),
      machineState: 'signature-requested',
    });

    setStatusOverride('awaiting_signature');
    setStep('submit');

    try {
      const txHash = await wallet.sendTransaction({
        account: address,
        to: contractAddress,
        data: sim.calldata,
        chain: undefined,
      });

      // Real hash only — never fabricate.
      setReceipt({
        txHash,
        chainId: chainId ?? null,
        status: 'pending',
        confirmations: 0,
        submittedAt: new Date().toISOString(),
      });
      setStatusOverride('pending');

      trackPendingTransaction({
        id: pendingId,
        kind: 'treasury',
        title: 'Treasury withdrawal pending',
        description: `Withdrawing ${draft.amountWei} wei to ${draft.recipient}`,
        txHash,
        chainId: chainId ?? getReleaseChainId(),
        machineState: 'submitted',
      });

      const client = publicClientRef.current;
      if (client) {
        const conf = await client.waitForTransactionReceipt({ hash: txHash });
        // Confirmation count comes from the node. If the provider cannot report
        // it, one confirmation is implied by a mined receipt — never more.
        const confirmations =
          typeof client.getTransactionConfirmations === 'function'
            ? Number(await client.getTransactionConfirmations({ hash: txHash }))
            : 1;
        if (conf.status === 'reverted') {
          clearPendingTransaction(pendingId);
          setReceipt({
            txHash,
            chainId: chainId ?? null,
            status: 'failed',
            confirmations,
            error: 'Transaction reverted on-chain',
            submittedAt: new Date().toISOString(),
          });
          setStatusOverride('failed');
          return;
        }

        setReceipt({
          txHash,
          chainId: chainId ?? null,
          status: confirmations >= 12 ? 'finalized' : 'confirmed',
          confirmations,
          submittedAt: new Date().toISOString(),
          finalizedAt: confirmations >= 12 ? new Date().toISOString() : undefined,
        });
        setStatusOverride(confirmations >= 12 ? 'finalized' : 'confirmed');
        clearPendingTransaction(pendingId);
        await refreshBalance();
      }
    } catch (err) {
      clearPendingTransaction(pendingId);
      const message = err instanceof Error ? err.message : 'Submission failed';
      const rejected =
        /user rejected|denied|rejected the request/i.test(message);
      setReceipt({
        txHash: null,
        chainId: chainId ?? null,
        status: rejected ? 'rejected' : 'failed',
        confirmations: null,
        error: message,
      });
      setStatusOverride(rejected ? 'rejected' : 'failed');
    }
  }, [
    gate.blockReason,
    simulation,
    simulate,
    address,
    chainId,
    draft,
    contractAddress,
    refreshBalance,
  ]);

  const reset = useCallback(() => {
    setDraftState(EMPTY_DRAFT);
    setStep('form');
    setTypedConfirm('');
    setSimulation(null);
    setStatusOverride(null);
    setReceipt({ txHash: null, chainId: null, status: 'idle', confirmations: null });
  }, []);

  return {
    status,
    step,
    draft,
    setDraft,
    balance,
    validation,
    typedConfirm,
    setTypedConfirm,
    simulation,
    receipt,
    gateBlockReason: gate.blockReason,
    isAdmin: gate.isAdmin,
    refreshBalance,
    goReview,
    goTypedConfirm,
    goBack,
    simulate,
    submit,
    reset,
  };
}
