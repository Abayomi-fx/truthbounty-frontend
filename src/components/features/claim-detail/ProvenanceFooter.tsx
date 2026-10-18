'use client';

/**
 * ProvenanceFooter — contract address, chain, release version, indexer freshness (UI-FE-010 Task 9)
 *
 * All values come from canonical sources:
 * - Contract address: release registry (not hardcoded)
 * - Chain name/ID: src/config/chains.ts (not hardcoded)
 * - Protocol version: release manifest
 * - Freshness: /api/freshness via useApiFreshness
 *
 * Collapsible on mobile via <details>/<summary> — Req 9.5.
 */

import * as React from 'react';
import {
  getContractAddress,
  getProtocolVersion,
  getReleaseChainId,
} from '@/lib/contracts/registry';
import { getChainConfig } from '@/config/chains';
import { SafeExternalLink } from '@/components/security/SafeExternalLink';
import { useApiFreshness } from '@/app/queries/freshness.queries';
import { cn } from '@/lib/utils';

export interface ProvenanceFooterProps {
  chainId: number;
}

export function ProvenanceFooter({ chainId }: ProvenanceFooterProps) {
  const { data: freshnessData, isLoading: isFreshnessLoading } = useApiFreshness({
    pollInterval: 30_000,
  });

  // Contract address from release registry — Req 9.1
  const contractAddress = React.useMemo(() => {
    try {
      // Only read for the release chain; other chains have no deployed contract
      if (getReleaseChainId() === chainId) {
        return getContractAddress('TruthBountyWeighted');
      }
      return null;
    } catch {
      return null;
    }
  }, [chainId]);

  // Chain config from src/config/chains.ts — Req 9.2 (no hardcoded strings)
  const chainConfig = React.useMemo(() => {
    try {
      return getChainConfig(chainId);
    } catch {
      return null;
    }
  }, [chainId]);

  // Protocol version from release manifest — Req 9.3
  const protocolVersion = React.useMemo(() => {
    try {
      return getProtocolVersion();
    } catch {
      return null;
    }
  }, []);

  const explorerBase = chainConfig?.blockExplorer.url ?? 'https://optimistic.etherscan.io';
  const explorerAddressUrl = contractAddress
    ? `${explorerBase}/address/${contractAddress}`
    : null;

  const freshness = freshnessData?.freshness;

  return (
    <aside
      aria-label="Protocol provenance"
      data-testid="provenance-footer"
    >
      {/*
       * Mobile collapsible via <details>/<summary> — Req 9.5.
       * The <details> element announces expanded/collapsed state natively to
       * assistive technologies without needing custom aria-expanded management.
       */}
      <details className="group rounded-xl border border-border/60 bg-surface/80">
        <summary
          className={cn(
            'flex cursor-pointer list-none items-center justify-between px-4 py-3',
            'text-sm font-medium text-ink-muted select-none',
            'hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl',
            '[&::-webkit-details-marker]:hidden',
          )}
        >
          <span className="flex items-center gap-2">
            <span aria-hidden="true">🔍</span>
            Provenance &amp; data sources
          </span>
          {/* Chevron indicator — purely decorative */}
          <span
            className="transition-transform group-open:rotate-180"
            aria-hidden="true"
          >
            ▾
          </span>
        </summary>

        <div className="border-t border-border/40 px-4 pb-4 pt-3">
          <dl className="space-y-3 text-xs">
            {/* Contract address — Req 9.1 */}
            <div>
              <dt className="tb-label text-ink-muted uppercase tracking-wide">
                Contract
              </dt>
              <dd className="mt-0.5 font-mono text-ink">
                {contractAddress && explorerAddressUrl ? (
                  <SafeExternalLink
                    href={explorerAddressUrl}
                    aria-label={`Contract address ${contractAddress} — view on block explorer (opens in new tab)`}
                    className="break-all underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    {contractAddress}
                    <span className="sr-only">(opens in new tab)</span>
                  </SafeExternalLink>
                ) : (
                  <span className="text-ink-muted" title="Contract address not available for this chain">
                    —
                  </span>
                )}
              </dd>
            </div>

            {/* Chain — Req 9.2 (from config, not hardcoded) */}
            <div>
              <dt className="tb-label text-ink-muted uppercase tracking-wide">
                Network
              </dt>
              <dd className="mt-0.5 text-ink">
                {chainConfig ? (
                  <>
                    {chainConfig.name}{' '}
                    <span className="text-ink-muted">(chain {chainConfig.id})</span>
                  </>
                ) : (
                  <span className="text-ink-muted" title="Chain configuration unavailable">—</span>
                )}
              </dd>
            </div>

            {/* Protocol version — Req 9.3 */}
            <div>
              <dt className="tb-label text-ink-muted uppercase tracking-wide">
                Protocol version
              </dt>
              <dd className="mt-0.5 font-mono text-ink">
                {protocolVersion ?? (
                  <span className="text-ink-muted" title="Protocol version unavailable">—</span>
                )}
              </dd>
            </div>

            {/* Indexer freshness — Req 9.4 */}
            <div>
              <dt className="tb-label text-ink-muted uppercase tracking-wide">
                Last indexed block
              </dt>
              <dd className="mt-0.5 font-mono text-ink">
                {isFreshnessLoading ? (
                  <span className="text-ink-muted">Loading…</span>
                ) : freshness ? (
                  freshness.indexedHeight.toLocaleString()
                ) : (
                  <span className="text-ink-muted" title="Indexed block unavailable">—</span>
                )}
              </dd>
            </div>

            <div>
              <dt className="tb-label text-ink-muted uppercase tracking-wide">
                Data as of
              </dt>
              <dd className="mt-0.5 text-ink">
                {isFreshnessLoading ? (
                  <span className="text-ink-muted">Loading…</span>
                ) : freshnessData?.freshness.lastUpdate ? (
                  <time dateTime={freshnessData.freshness.lastUpdate}>
                    {new Date(freshnessData.freshness.lastUpdate).toLocaleString()}
                  </time>
                ) : (
                  <span className="text-ink-muted" title="Freshness timestamp unavailable">—</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </details>
    </aside>
  );
}

export default ProvenanceFooter;
