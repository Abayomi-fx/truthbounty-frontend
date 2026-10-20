'use client';

/**
 * UI-FE-028 — Governance Proposal Register.
 *
 * Implements Board 07: designs/frontend-v2/privileged/boards/07-governance-proposal-register.svg
 * Stable regions: ["main#main-content", ".governance-proposal-list"]
 *
 * Sourced from Governor and Timelock contract logs and freshness-labelled API projections.
 * All states rendered: draft, active, succeeded, queued, executable, expired, and cancelled.
 */

import React, { useId } from 'react';
import {
  Search,
  Filter,
  Clock,
  Shield,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCode,
  Vote,
  RefreshCw,
} from 'lucide-react';
import type {
  GovernanceProposal,
  GovernanceProposalState,
  ProposalRiskTier,
} from '@/lib/governance-proposals/types';
import { formatProposalCountdown } from '@/lib/governance-proposals/governance-proposals';
import { cn } from '@/lib/utils';

export interface GovernanceProposalRegisterProps {
  proposals: readonly GovernanceProposal[];
  selectedProposalId: string | null;
  onSelectProposal: (id: string) => void;
  stateFilter: GovernanceProposalState | 'all';
  onStateFilterChange: (filter: GovernanceProposalState | 'all') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading?: boolean;
  isStale?: boolean;
  onRefresh?: () => void;
  className?: string;
}

const STATE_TABS: readonly {
  id: GovernanceProposalState | 'all';
  label: string;
}[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'executable', label: 'Executable' },
  { id: 'queued', label: 'Queued' },
  { id: 'succeeded', label: 'Succeeded' },
  { id: 'draft', label: 'Draft' },
  { id: 'expired', label: 'Expired' },
  { id: 'cancelled', label: 'Cancelled' },
];

export function GovernanceProposalRegister({
  proposals,
  selectedProposalId,
  onSelectProposal,
  stateFilter,
  onStateFilterChange,
  searchQuery,
  onSearchChange,
  isLoading = false,
  isStale = false,
  onRefresh,
  className = '',
}: GovernanceProposalRegisterProps) {
  const searchInputId = useId();

  return (
    <section
      aria-labelledby="governance-proposal-register-heading"
      className={cn('space-y-4', className)}
      data-testid="governance-proposal-register"
    >
      {/* Header with Title and Telemetry Freshness */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2
              id="governance-proposal-register-heading"
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              Governance Proposal Register
            </h2>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
              data-mask="dynamic-data"
            >
              {proposals.length} total
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Canonical on-chain governor and timelock proposals with verified calls, simulation, and blast radius.
          </p>
        </div>

        {onRefresh && (
          <div className="flex items-center gap-2 self-start sm:self-center">
            {isStale && (
              <span
                role="status"
                data-testid="proposal-register-stale-banner"
                className="text-xs text-amber-500 font-medium flex items-center gap-1"
              >
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                Projection stale
              </span>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-accent text-foreground transition-colors disabled:opacity-50"
              aria-label="Refresh governance proposals register"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} aria-hidden="true" />
              <span>Sync</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* State Filter Tabs */}
          <div
            role="tablist"
            aria-label="Filter proposals by state"
            className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none"
          >
            {STATE_TABS.map((tab) => {
              const isSelected = stateFilter === tab.id;
              const count =
                tab.id === 'all'
                  ? proposals.length
                  : proposals.filter((p) => p.state === tab.id).length;

              return (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  id={`proposal-filter-tab-${tab.id}`}
                  aria-selected={isSelected}
                  onClick={() => onStateFilterChange(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0',
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                      : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60',
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded-full text-[10px]',
                      isSelected
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px] max-w-sm">
            <label htmlFor={searchInputId} className="sr-only">
              Search proposals by title, target, or ID
            </label>
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <input
              id={searchInputId}
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search title, target, ID…"
              className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                aria-label="Clear search input"
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stable Region: .governance-proposal-list (required by board conformity test) */}
      <div
        className="governance-proposal-list rounded-xl border border-border bg-card shadow-xs overflow-hidden"
        data-testid="governance-proposal-list"
      >
        {isLoading ? (
          <div
            role="status"
            className="p-8 text-center text-xs text-muted-foreground space-y-2"
          >
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" aria-hidden="true" />
            <p>Loading canonical governance proposals…</p>
          </div>
        ) : proposals.length === 0 ? (
          <div
            role="status"
            data-testid="proposal-register-empty"
            className="p-8 text-center text-xs text-muted-foreground space-y-2"
          >
            <FileCode className="h-8 w-8 mx-auto text-muted-foreground/60" aria-hidden="true" />
            <p className="font-semibold text-foreground text-sm">No proposals in registry</p>
            <p>No governance proposals have been detected from Governor or Timelock contracts.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {proposals.map((proposal) => {
              const isSelected = proposal.id === selectedProposalId;

              return (
                <div
                  key={proposal.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => onSelectProposal(proposal.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectProposal(proposal.id);
                    }
                  }}
                  className={cn(
                    'group p-4 transition-colors text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer focus:outline-none focus-visible:bg-accent/40',
                    isSelected
                      ? 'bg-primary/5 border-l-4 border-l-primary'
                      : 'hover:bg-muted/40 border-l-4 border-l-transparent',
                  )}
                  data-testid={`proposal-item-${proposal.id}`}
                >
                  {/* Left: ID, Title, Targets summary */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">
                        {proposal.id}
                      </span>
                      <ProposalStateBadge state={proposal.state} />
                      <ProposalRiskBadge risk={proposal.blastRadius.riskTier} />
                      <span
                        className="text-[11px] text-muted-foreground"
                        data-testid={`timestamp-${proposal.id}`}
                      >
                        <time dateTime={proposal.createdAt}>
                          {new Date(proposal.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </time>
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                      {proposal.title}
                    </h3>

                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {proposal.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                      <span className="flex items-center gap-1 font-mono">
                        <FileCode className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                        {proposal.calls.length} {proposal.calls.length === 1 ? 'call' : 'calls'}
                        {proposal.calls[0] && (
                          <span className="text-foreground/80">
                            ({proposal.calls[0].contractName}#{proposal.calls[0].methodName.split('(')[0]})
                          </span>
                        )}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1 font-mono">
                        Proposer: {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}
                      </span>
                    </div>
                  </div>

                  {/* Right: Voting tally or Timelock Countdown */}
                  <div className="shrink-0 flex sm:flex-col sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/40">
                    {proposal.state === 'active' ? (
                      <div className="space-y-1 text-right">
                        <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                          <Vote className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          <span>For: {proposal.voting.forPercent}%</span>
                        </div>
                        <div
                          className="w-24 h-1.5 rounded-full bg-muted overflow-hidden"
                          aria-label={`Voting tally: ${proposal.voting.forPercent}% in favor`}
                          data-testid={`voting-mini-bar-${proposal.id}`}
                        >
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(proposal.voting.forPercent, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {proposal.voting.quorumReached ? 'Quorum met' : 'Quorum pending'}
                        </span>
                      </div>
                    ) : proposal.state === 'queued' ? (
                      <div className="space-y-0.5 sm:text-right" data-testid={`proposal-countdown-${proposal.id}`}>
                        <div className="flex items-center gap-1 text-xs font-mono font-medium text-amber-500">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          <span data-mask="dynamic-data">
                            {formatProposalCountdown(proposal.timelock.secondsRemaining)}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground block">
                          Timelock delay
                        </span>
                      </div>
                    ) : proposal.state === 'executable' ? (
                      <div className="space-y-0.5 sm:text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Ready to execute
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          Timelock elapsed
                        </span>
                      </div>
                    ) : (
                      <div className="text-right text-xs text-muted-foreground">
                        <span>{proposal.calls.length} target actions</span>
                      </div>
                    )}

                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-md border text-center transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary font-semibold'
                          : 'bg-card text-muted-foreground border-border group-hover:border-foreground/30',
                      )}
                    >
                      {isSelected ? 'Inspecting' : 'Review'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function ProposalStateBadge({ state }: { state: GovernanceProposalState }) {
  const config: Record<
    GovernanceProposalState,
    { label: string; bg: string; text: string; border: string }
  > = {
    draft: {
      label: 'Draft',
      bg: 'bg-muted',
      text: 'text-muted-foreground',
      border: 'border-border',
    },
    active: {
      label: 'Active voting',
      bg: 'bg-blue-500/10',
      text: 'text-blue-500',
      border: 'border-blue-500/30',
    },
    succeeded: {
      label: 'Succeeded',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-500',
      border: 'border-emerald-500/30',
    },
    queued: {
      label: 'Queued (Timelock)',
      bg: 'bg-amber-500/10',
      text: 'text-amber-500',
      border: 'border-amber-500/30',
    },
    executable: {
      label: 'Executable',
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-500',
      border: 'border-cyan-500/30',
    },
    expired: {
      label: 'Expired',
      bg: 'bg-muted/80',
      text: 'text-muted-foreground/80',
      border: 'border-border/60',
    },
    cancelled: {
      label: 'Cancelled',
      bg: 'bg-destructive/10',
      text: 'text-destructive',
      border: 'border-destructive/30',
    },
  };

  const c = config[state] || config.draft;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border tracking-wide uppercase',
        c.bg,
        c.text,
        c.border,
      )}
      data-testid={`status-badge-${state}`}
      data-badge-role="proposal-state-badge"
    >
      {c.label}
    </span>
  );
}

export function ProposalRiskBadge({ risk }: { risk: ProposalRiskTier }) {
  const styles: Record<ProposalRiskTier, string> = {
    low: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    medium: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    high: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    critical: 'bg-destructive/10 text-destructive border-destructive/30 font-bold',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] uppercase font-semibold border',
        styles[risk],
      )}
      data-testid={`risk-badge-${risk}`}
    >
      <Shield className="h-2.5 w-2.5" aria-hidden="true" />
      <span>{risk}</span>
    </span>
  );
}
