'use client';

import { useEffect, useRef } from 'react';
import { useAccount, useChainId } from 'wagmi';

export function useWalletReconciliation(onInvalidate: () => void) {
  const { address } = useAccount();
  const chainId = useChainId();
  const previous = useRef({ address, chainId });

  useEffect(() => {
    if (previous.current.address !== address || previous.current.chainId !== chainId) {
      previous.current = { address, chainId };
      onInvalidate();
    }
  }, [address, chainId, onInvalidate]);
}
