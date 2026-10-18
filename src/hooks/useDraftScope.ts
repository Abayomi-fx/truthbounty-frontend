/**
 * UI-FE-084 — useDraftScope.
 *
 * Builds the wallet/release scope a form draft is pinned to:
 * connected account + connected chain + pinned protocol release.
 *
 * Drafts authored under one scope are never restored under another; a
 * change to any part of this scope quarantines incompatible drafts.
 */

'use client';

import { useMemo } from 'react';
import { useAccount, useChainId } from '@/hooks/web3';
import { getProtocolDiagnostics } from '@/lib/contracts/registry';
import type { DraftScope } from '@/lib/drafts/recoverable-draft';

export function useDraftScope(): DraftScope {
  const { address } = useAccount();
  const chainId = useChainId();

  return useMemo(() => {
    let releaseId = 'unknown';
    try {
      releaseId = getProtocolDiagnostics().releaseId;
    } catch {
      releaseId = 'unknown';
    }
    return {
      address: address ? address.toLowerCase() : null,
      chainId: typeof chainId === 'number' && Number.isFinite(chainId) ? chainId : null,
      releaseId,
    };
  }, [address, chainId]);
}
