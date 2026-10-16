'use client';

import * as React from 'react';
import {
  Link2,
  FileText,
  Image,
  Video,
  Shield,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type EvidenceType = 'link' | 'text' | 'image' | 'video' | 'document' | 'onchain';

export interface EvidenceSource {
  id: string;
  type: EvidenceType;
  title: string;
  value: string;
  description?: string;
  submittedBy?: string;
  submittedAt?: string;
  verified?: boolean;
  verificationTxHash?: string;
  chainId?: number;
  blockNumber?: number;
  /** IPFS hash or content hash for integrity verification. */
  contentHash?: string;
  /** Whether the evidence is disputed. */
  disputed?: boolean;
  /** Dispute reason if disputed. */
  disputeReason?: string;
}

const TYPE_CONFIG: Record<EvidenceType, { icon: React.ReactNode; label: string; tone: string }> = {
  link: { icon: <Link2 size={14} aria-hidden="true" />, label: 'Link', tone: 'text-blue-400' },
  text: { icon: <FileText size={14} aria-hidden="true" />, label: 'Text', tone: 'text-slate-400' },
  image: { icon: <Image size={14} aria-hidden="true" />, label: 'Image', tone: 'text-green-400' },
  video: { icon: <Video size={14} aria-hidden="true" />, label: 'Video', tone: 'text-purple-400' },
  document: { icon: <FileText size={14} aria-hidden="true" />, label: 'Document', tone: 'text-amber-400' },
  onchain: { icon: <Shield size={14} aria-hidden="true" />, label: 'On-chain', tone: 'text-emerald-400' },
};

// Supported chain explorers - only render links for configured chains
const EXPLORER_CONFIG: Record<number, { name: string; txUrl: (hash: string) => string; blockUrl: (block: number) => string }> = {
  1: { name: 'Ethereum Mainnet', txUrl: (h) => `https://etherscan.io/tx/${h}`, blockUrl: (b) => `https://etherscan.io/block/${b}` },
  5: { name: 'Ethereum Goerli', txUrl: (h) => `https://goerli.etherscan.io/tx/${h}`, blockUrl: (b) => `https://goerli.etherscan.io/block/${b}` },
  10: { name: 'Optimism Mainnet', txUrl: (h) => `https://optimistic.etherscan.io/tx/${h}`, blockUrl: (b) => `https://optimistic.etherscan.io/block/${b}` },
  420: { name: 'Optimism Goerli', txUrl: (h) => `https://goerli-optimism.etherscan.io/tx/${h}`, blockUrl: (b) => `https://goerli-optimism.etherscan.io/block/${b}` },
  42161: { name: 'Arbitrum One', txUrl: (h) => `https://arbiscan.io/tx/${h}`, blockUrl: (b) => `https://arbiscan.io/block/${b}` },
  421613: { name: 'Arbitrum Goerli', txUrl: (h) => `https://goerli.arbiscan.io/tx/${h}`, blockUrl: (b) => `https://goerli.arbiscan.io/block/${b}` },
  11155111: { name: 'Ethereum Sepolia', txUrl: (h) => `https://sepolia.etherscan.io/tx/${h}`, blockUrl: (b) => `https://sepolia.etherscan.io/block/${b}` },
  11155420: { name: 'Optimism Sepolia', txUrl: (h) => `https://sepolia-optimism.etherscan.io/tx/${h}`, blockUrl: (b) => `https://sepolia-optimism.etherscan.io/block/${b}` },
};

function getExplorerForChain(chainId: number | undefined): { name: string; txUrl: (hash: string) => string; blockUrl: (block: number) => string } | null {
  if (!chainId) return null;
  return EXPLORER_CONFIG[chainId] ?? null;
}

export interface EvidenceSourcesListProps {
  /** Array of evidence sources. */
  sources: EvidenceSource[];
  /** Title for the evidence section. */
  title?: string;
  /** Description for the evidence section. */
  description?: string;
  /** Whether evidence is loading. */
  isLoading?: boolean;
  /** Error message if evidence failed to load. */
  error?: string;
  /** Maximum number of sources to show before truncating. */
  maxVisible?: number;
  /** Show verification status badges. */
  showVerification?: boolean;
  /** Show on-chain details (tx hash, block). */
  showOnChainDetails?: boolean;
  /** Show content hash for integrity. */
  showContentHash?: boolean;
  /** Show dispute status. */
  showDisputeStatus?: boolean;
  /** Callback when a source is clicked. */
  onSourceClick?: (source: EvidenceSource) => void;
  /** Custom renderer for evidence value. */
  renderValue?: (source: EvidenceSource) => React.ReactNode;
  /** Additional CSS classes. */
  className?: string;
}

export function EvidenceSourcesList({
  sources,
  title = 'Evidence Sources',
  description,
  isLoading = false,
  error,
  maxVisible = 10,
  showVerification = true,
  showOnChainDetails = true,
  showContentHash = false,
  showDisputeStatus = true,
  onSourceClick,
  renderValue,
  className,
}: EvidenceSourcesListProps) {
  const listId = React.useId();
  const summaryId = React.useId();

  const verifiedCount = sources.filter((s) => s.verified).length;
  const disputedCount = sources.filter((s) => s.disputed).length;
  const onChainCount = sources.filter((s) => s.type === 'onchain').length;

  const summaryParts = [
    `${sources.length} evidence source${sources.length !== 1 ? 's' : ''}`,
    verifiedCount > 0 && `${verifiedCount} verified`,
    disputedCount > 0 && `${disputedCount} disputed`,
    onChainCount > 0 && `${onChainCount} on-chain`,
  ].filter(Boolean);

  if (isLoading) {
    return (
      <div
        className={cn('space-y-3', className)}
        role="status"
        aria-label="Loading evidence sources"
        aria-busy="true"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
        </div>
        <div className="space-y-2" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn('rounded-lg border border-destructive bg-destructive/10 p-4', className)}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 text-destructive shrink-0" aria-hidden="true" />
          <div>
            <h3 className="font-medium text-destructive">Failed to Load Evidence</h3>
            <p className="mt-1 text-sm text-destructive/90">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-muted/30 p-6 text-center', className)}
        role="status"
      >
        <FileText className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
        <h3 className="mt-3 font-medium text-foreground">No Evidence Available</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          No evidence sources have been submitted for this claim yet.
        </p>
      </div>
    );
  }

  const visibleSources = sources.slice(0, maxVisible);
  const hiddenCount = sources.length - maxVisible;

  return (
    <div
      id={listId}
      role="region"
      aria-label={title}
      aria-describedby={summaryId}
      className={cn('space-y-4', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span id={summaryId} className="sr-only" aria-live="polite" aria-atomic="true">
            {summaryParts.join(', ')}
          </span>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {sources.length} source{sources.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <ul className="space-y-2" role="list" aria-label={`${title} list`}>
        {visibleSources.map((source, index) => (
          <EvidenceSourceItem
            key={source.id}
            source={source}
            index={index}
            showVerification={showVerification}
            showOnChainDetails={showOnChainDetails}
            showContentHash={showContentHash}
            showDisputeStatus={showDisputeStatus}
            onClick={onSourceClick}
            renderValue={renderValue}
          />
        ))}
        {hiddenCount > 0 && (
          <li className="text-center text-xs text-muted-foreground py-2">
            And {hiddenCount} more source{hiddenCount !== 1 ? 's' : ''}…
          </li>
        )}
      </ul>

      <table
        className="w-full text-xs text-muted-foreground border-t border-border pt-2"
        role="table"
        aria-label="Evidence sources reference"
      >
        <thead>
          <tr>
            <th scope="col" className="text-left pb-1">Type</th>
            <th scope="col" className="text-left pb-1">Title</th>
            <th scope="col" className="text-left pb-1">Submitted By</th>
            <th scope="col" className="text-left pb-1">Status</th>
            <th scope="col" className="text-left pb-1">Time</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.id} className="border-t border-border/50">
              <td className="py-1 flex items-center gap-1">
                <span className={TYPE_CONFIG[source.type].tone} aria-hidden="true">
                  {TYPE_CONFIG[source.type].icon}
                </span>
                <span>{TYPE_CONFIG[source.type].label}</span>
              </td>
              <td className="py-1 max-w-xs truncate">{source.title}</td>
              <td className="py-1 font-mono">{source.submittedBy ?? '—'}</td>
              <td className="py-1">
                <span className={cn(
                  'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
                  source.verified ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                  source.disputed && 'bg-destructive/10 text-destructive'
                )}>
                  {source.verified && <> <span aria-hidden="true">✓</span>Verified </>}
                  {source.disputed && <> <span aria-hidden="true">⚠</span>Disputed </>}
                  {!source.verified && !source.disputed && 'Pending'}
                </span>
              </td>
              <td className="py-1">
                {source.submittedAt ? new Date(source.submittedAt).toLocaleString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvidenceSourceItem({
  source,
  index,
  showVerification,
  showOnChainDetails,
  showContentHash,
  showDisputeStatus,
  onClick,
  renderValue,
}: {
  source: EvidenceSource;
  index: number;
  showVerification: boolean;
  showOnChainDetails: boolean;
  showContentHash: boolean;
  showDisputeStatus: boolean;
  onClick?: (source: EvidenceSource) => void;
  renderValue?: (source: EvidenceSource) => React.ReactNode;
}) {
  const typeConfig = TYPE_CONFIG[source.type];
  const itemId = React.useId();
  const explorer = getExplorerForChain(source.chainId);

  const handleClick = () => onClick?.(source);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const renderTxLink = () => {
    if (!source.verificationTxHash || !explorer) return null;
    return (
      <a
        href={explorer.txUrl(source.verificationTxHash)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 hover:underline"
        aria-label={`View transaction ${source.verificationTxHash.slice(0, 10)}… on ${explorer.name}`}
      >
        <ExternalLink size={10} aria-hidden="true" />
        <span className="font-mono">Tx: {source.verificationTxHash.slice(0, 10)}…</span>
      </a>
    );
  };

  const renderBlockLink = () => {
    if (!source.blockNumber || !explorer) return null;
    return (
      <a
        href={explorer.blockUrl(source.blockNumber)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 hover:underline"
        aria-label={`View block ${source.blockNumber} on ${explorer.name}`}
      >
        <ExternalLink size={10} aria-hidden="true" />
        <span className="font-mono">Block {source.blockNumber.toString()}</span>
      </a>
    );
  };

  return (
    <li id={itemId} className="space-y-3 p-3 rounded-lg border bg-muted/30">
      <button
        type="button"
        className={cn(
          'w-full text-left p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          onClick && 'hover:bg-muted/50 cursor-pointer'
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={`Evidence ${index + 1}: ${source.title}`}
        disabled={!onClick}
      >
        <div className="flex flex-wrap items-start gap-3">
          <span
            className={cn('flex-shrink-0 size-8 rounded-full border flex items-center justify-center', typeConfig.tone)}
            aria-hidden="true"
          >
            {typeConfig.icon}
          </span>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-medium text-foreground truncate">{source.title}</h4>
              <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium', typeConfig.tone.replace('text-', 'bg-').replace('400', '/10') + ' ' + typeConfig.tone)}>
                {typeConfig.label}
              </span>
              {showDisputeStatus && source.disputed && (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-destructive/10 text-destructive border border-destructive/30">
                  <AlertCircle size={10} aria-hidden="true" />
                  Disputed
                </span>
              )}
              {showVerification && source.verified && (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-success/10 text-success border border-success/30">
                  <Shield size={10} aria-hidden="true" />
                  Verified
                </span>
              )}
            </div>

            {source.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{source.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {renderValue ? (
                <span className="flex-1 min-w-0">{renderValue(source)}</span>
              ) : (
                <span className="flex-1 min-w-0 truncate font-mono">{source.value}</span>
              )}

              {source.submittedBy && (
                <span className="flex items-center gap-1">
                  <span aria-hidden="true">👤</span>
                  <span>{source.submittedBy}</span>
                </span>
              )}

              {source.submittedAt && (
                <time dateTime={source.submittedAt} className="flex items-center gap-1">
                  <Clock size={10} aria-hidden="true" />
                  <span>{new Date(source.submittedAt).toLocaleString()}</span>
                </time>
              )}

              {showContentHash && source.contentHash && (
                <span className="flex items-center gap-1 font-mono">
                  <span aria-hidden="true">#</span>
                  <span>{source.contentHash.slice(0, 16)}…</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
      {showOnChainDetails && source.type === 'onchain' && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-2 border-t border-border/50 ml-11">
          {renderTxLink()}
          {renderBlockLink()}
          {!explorer && source.chainId && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground" title={`Unsupported chain: ${source.chainId}`}>
              <span aria-hidden="true">⛓</span>
              <span>Chain {source.chainId} (no explorer)</span>
            </span>
          )}
        </div>
      )}
    </li>
  );
}

export default EvidenceSourcesList;