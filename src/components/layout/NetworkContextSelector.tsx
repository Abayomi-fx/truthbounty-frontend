'use client';

import React, { useCallback, useId } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { OPTIMISM_CHAIN_IDS } from '@/lib/transaction-machine/transaction-machine.types';
import { useAppShellContext } from '@/context/AppShellContext';

export interface NetworkContextSelectorProps {
  className?: string;
}

export function NetworkContextSelector({ className = '' }: NetworkContextSelectorProps) {
  const selectId = useId();
  const shell = useAppShellContext();
  const wagmiAccount = useAccount();
  const wagmiChainId = useChainId();
  const { switchChain } = useSwitchChain();

  const isConnected = shell.isConnected ?? wagmiAccount.isConnected;
  const currentChainId = shell.chainId !== undefined ? shell.chainId : wagmiChainId;

  const isOptimismMainnet = currentChainId === 10;
  const isOptimismSepolia = currentChainId === 11155420;
  const isSupported = shell.isSupportedChain ?? (
    isOptimismMainnet ||
    isOptimismSepolia ||
    (process.env.NODE_ENV !== 'production' && currentChainId === 31337)
  );

  const handleNetworkChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const targetChainId = Number(e.target.value);
      if (
        OPTIMISM_CHAIN_IDS.includes(targetChainId as 10 | 11155420) &&
        switchChain
      ) {
        switchChain({ chainId: targetChainId });
      }
    },
    [switchChain],
  );

  const dotColor = !isConnected
    ? 'bg-muted-foreground'
    : isSupported
    ? isOptimismMainnet
      ? 'bg-emerald-500'
      : 'bg-indigo-500'
    : 'bg-red-500 animate-pulse';

  const selectValue = isOptimismMainnet
    ? '10'
    : isOptimismSepolia
    ? '11155420'
    : isSupported
    ? String(currentChainId)
    : 'unsupported';

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-xs sm:text-sm font-medium text-foreground shadow-sm ${className}`}
      data-testid="network-context-selector"
    >
      <span
        className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`}
        aria-hidden="true"
      />
      <label htmlFor={selectId} className="sr-only">
        Select Optimism network
      </label>
      <select
        id={selectId}
        value={selectValue}
        onChange={handleNetworkChange}
        className="hidden sm:block min-w-0 bg-transparent text-foreground text-xs sm:text-sm focus:outline-none cursor-pointer pr-1"
        aria-label="Select chain"
      >
        {!isSupported && isConnected && (
          <option value="unsupported" disabled className="bg-card text-destructive">
            Unsupported Network
          </option>
        )}
        <option value="10" className="bg-card text-foreground">
          Optimism
        </option>
        <option value="11155420" className="bg-card text-foreground">
          Optimism Sepolia
        </option>
      </select>
    </div>
  );
}
