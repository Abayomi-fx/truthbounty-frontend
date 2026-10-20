'use client';

/**
 * UI-FE-028 — Governance Proposal Detail & Timelock Status.
 *
 * Implements Board 08: designs/frontend-v2/privileged/boards/08-governance-proposal-detail.svg
 * Stable regions: ["main#main-content", ".proposal-detail-card"]
 * Masked regions: ["[data-mask='dynamic-data']", "[data-testid*='countdown']", "[data-testid*='timestamp']", "time"]
 *
 * Displays:
 * - Exact targets, calls, decoded parameters, and hex calldata
 * - Voting outcome and quorum tracking
 * - Timelock lifecycle and countdown timer
 * - Simulation status, gas estimate, and execution trace
 * - Affected contracts and blast radius (scope, user impact, reversibility)
 * - Canonical receipts with modal inspection
 * - Fail-closed action controls: missing release/ABI blocks execution
 */

import React, { useState } from 'react';
import {
  Shield,
  Clock,
  Layers,
  FileCode,
  Vote,
  Terminal,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Receipt,
  AlertOctagon,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import type {
  GovernanceProposal,
  ProposalActionGate,
} from '@/lib/governance-proposals/types';
import { formatProposalCountdown } from '@/lib/governance-proposals/governance-proposals';
import { ProposalStateBadge, ProposalRiskBadge } from './GovernanceProposalRegister';
import { TransactionReceiptModal } from '@/components/receipts/TransactionReceiptModal';
import { cn } from '@/lib/utils';

export interface GovernanceProposalDetailProps {
  proposal: GovernanceProposal;
  actionGate?: ProposalActionGate | null;
  onQueue?: (proposalId: string) => void;
  onExecute?: (proposalId: string) => void;
  onCancel?: (proposalId: string) => void;
  pendingAction?: boolean;
  className?: string;
}

export function GovernanceProposalDetail({
  proposal,
  actionGate,
  onQueue,
  onExecute,
  onCancel,
  pendingAction = false,
  className = '',
}: GovernanceProposalDetailProps) {
  const [copiedCalldataIndex, setCopiedCalldataIndex] = useState<number | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const handleCopyCalldata = async (calldata: string, index: number) => {
    try {
      await navigator.clipboard.writeText(calldata);
      setCopiedCalldataIndex(index);
      setTimeout(() => setCopiedCalldataIndex(null), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const hasMissingAbi = proposal.calls.some((c) => !c.abiVerified);

  return (
    <article
      aria-labelledby="proposal-detail-heading"
      className={cn('space-y-6', className)}
      data-testid="governance-proposal-detail"
    >
      {/* Stable Region: .proposal-detail-card (required by Board 08 conformity test) */}
      <div
        className="proposal-detail-card rounded-xl border border-border bg-card p-6 shadow-sm space-y-6"
        data-testid="proposal-detail-card"
      >
        {/* Proposal Header */}
        <header className="space-y-3 pb-5 border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-primary">
                {proposal.id}
              </span>
              <ProposalStateBadge state={proposal.state} />
              <ProposalRiskBadge risk={proposal.blastRadius.riskTier} />
            </div>

            <div
              className="text-xs text-muted-foreground"
              data-testid={`timestamp-${proposal.id}`}
            >
              Created:{' '}
              <time dateTime={proposal.createdAt}>
                {new Date(proposal.createdAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
          </div>

          <div>
            <h1
              id="proposal-detail-heading"
              className="text-xl sm:text-2xl font-bold tracking-tight text-foreground"
            >
              {proposal.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {proposal.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1 font-mono">
              <span className="text-muted-foreground/70">Proposer:</span>
              <span className="text-foreground">{proposal.proposer}</span>
            </span>
            <span>·</span>
            <span>
              Source:{' '}
              <span className="text-foreground font-medium">
                {proposal.sourceClass}
              </span>
            </span>
          </div>

          {/* Cancellation Notice if Cancelled */}
          {proposal.state === 'cancelled' && proposal.cancelReason && (
            <div
              role="alert"
              className="p-3.5 rounded-lg border border-destructive/40 bg-destructive/10 text-xs text-destructive flex items-start gap-2.5"
            >
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">Proposal was cancelled</p>
                <p className="mt-0.5 text-muted-foreground">{proposal.cancelReason}</p>
              </div>
            </div>
          )}
        </header>

        {/* Missing ABI Warning Banner (Fails Closed) */}
        {hasMissingAbi && (
          <div
            role="alert"
            data-testid="missing-abi-alert"
            className="p-4 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive flex items-start gap-3"
          >
            <AlertOctagon className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Missing Verified Contract ABI</h2>
              <p className="text-xs text-foreground/80">
                One or more target contract calls in this proposal lack a verified release ABI in the pinned manifest.
                Per protocol security invariants, unverified call execution fails closed and all mutations are disabled.
              </p>
            </div>
          </div>
        )}

        {/* Section 1: Exact Targets & Calls (The Core Acceptance Criterion) */}
        <section
          aria-labelledby="exact-calls-heading"
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 id="exact-calls-heading" className="text-base font-semibold text-foreground">
              Exact Targets & Calldata ({proposal.calls.length})
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            All target contracts, function selectors, decoded parameters, and exact calldata inspectable before execution.
          </p>

          <div className="space-y-3">
            {proposal.calls.map((call, idx) => (
              <div
                key={`${call.target}-${idx}`}
                className="rounded-lg border border-border bg-background p-4 space-y-3 text-xs"
                data-testid={`call-card-${idx}`}
              >
                {/* Contract & Function Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                  <div>
                    <span className="text-[11px] font-mono text-muted-foreground uppercase">
                      Call #{idx + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground font-mono">
                      {call.contractName}#{call.methodName}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase border',
                        call.abiVerified
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                          : 'bg-destructive/10 text-destructive border-destructive/30',
                      )}
                    >
                      {call.abiVerified ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          <span>ABI Verified</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          <span>ABI Unverified</span>
                        </>
                      )}
                    </span>

                    <span className="font-mono text-[11px] text-muted-foreground">
                      Selector: {call.selector}
                    </span>
                  </div>
                </div>

                {!call.abiVerified && call.abiMissingReason && (
                  <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-mono space-y-0.5">
                    <p className="font-semibold">Release Verification Failure:</p>
                    <p>{call.abiMissingReason}</p>
                  </div>
                )}

                {/* Target address & value */}
                <dl className="grid gap-2 sm:grid-cols-2 font-mono text-[11px]">
                  <div>
                    <dt className="text-muted-foreground">Target Address:</dt>
                    <dd className="text-foreground break-all">{call.target}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Value (ETH):</dt>
                    <dd className="text-foreground">{call.value} wei</dd>
                  </div>
                </dl>

                {/* Decoded Parameters Table */}
                {call.parameters.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-foreground">
                      Decoded Parameters:
                    </span>
                    <div className="rounded-md border border-border/60 overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-medium">
                            <th scope="col" className="p-2">Name</th>
                            <th scope="col" className="p-2">Type</th>
                            <th scope="col" className="p-2">Decoded Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-mono">
                          {call.parameters.map((param, pIdx) => (
                            <tr key={`${param.name}-${pIdx}`} className="hover:bg-muted/20">
                              <td className="p-2 font-semibold text-foreground">{param.name}</td>
                              <td className="p-2 text-muted-foreground">{param.type}</td>
                              <td className="p-2 text-primary break-all">{String(param.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Raw Calldata Hex Display */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-foreground">
                      Raw Calldata:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCalldata(call.calldata, idx)}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={`Copy calldata for call #${idx + 1}`}
                    >
                      {copiedCalldataIndex === idx ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                          <span className="text-emerald-500 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" aria-hidden="true" />
                          <span>Copy hex</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre
                    className="p-2.5 rounded bg-muted/50 text-[10px] font-mono break-all text-muted-foreground overflow-x-auto"
                    data-testid={`raw-calldata-${idx}`}
                  >
                    {call.calldata}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Voting Outcome & Timelock Lifecycle Grid */}
        <div className="grid gap-4 md:grid-cols-2 pt-2">
          {/* Voting Outcome */}
          <section
            aria-labelledby="voting-outcome-heading"
            className="rounded-lg border border-border bg-background p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Vote className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 id="voting-outcome-heading" className="text-sm font-semibold text-foreground">
                Voting Outcome & Quorum
              </h2>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">For Votes:</span>
                <span className="font-semibold text-emerald-500">
                  {proposal.voting.forVotes} ({proposal.voting.forPercent}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Against Votes:</span>
                <span className="font-semibold text-destructive">
                  {proposal.voting.againstVotes} ({proposal.voting.againstPercent}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Abstain:</span>
                <span className="text-muted-foreground font-mono">
                  {proposal.voting.abstainVotes}
                </span>
              </div>

              {/* Quorum Progress Bar */}
              <div className="pt-2 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Quorum Progress:</span>
                  <span
                    className={cn(
                      'font-medium',
                      proposal.voting.quorumReached ? 'text-emerald-500' : 'text-amber-500',
                    )}
                  >
                    {proposal.voting.quorumReached ? 'Quorum Reached' : 'Quorum Pending'}
                  </span>
                </div>
                <div
                  className="w-full h-2 rounded-full bg-muted overflow-hidden"
                  aria-label={`Quorum progress: ${Math.min(proposal.voting.quorumPercent, 100)}%`}
                >
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      proposal.voting.quorumReached ? 'bg-emerald-500' : 'bg-amber-500',
                    )}
                    style={{ width: `${Math.min(proposal.voting.quorumPercent, 100)}%` }}
                  />
                </div>
              </div>

              {proposal.voting.votingEndsAt && (
                <div className="text-[11px] text-muted-foreground pt-1">
                  Voting deadline:{' '}
                  <time dateTime={proposal.voting.votingEndsAt}>
                    {new Date(proposal.voting.votingEndsAt).toLocaleDateString()}
                  </time>
                </div>
              )}
            </div>
          </section>

          {/* Timelock Lifecycle */}
          <section
            aria-labelledby="timelock-lifecycle-heading"
            className="rounded-lg border border-border bg-background p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 id="timelock-lifecycle-heading" className="text-sm font-semibold text-foreground">
                Timelock Lifecycle Status
              </h2>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timelock State:</span>
                <span className="font-semibold uppercase text-foreground">
                  {proposal.state === 'queued'
                    ? 'Queued (Enforcing Delay)'
                    : proposal.state === 'executable'
                      ? 'Delay Elapsed (Ready)'
                      : proposal.timelock.executedAt
                        ? 'Executed'
                        : 'Not Queued'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Enforced Delay:</span>
                <span className="font-mono text-foreground">
                  {proposal.timelock.delaySeconds
                    ? `${proposal.timelock.delaySeconds / 3600} Hours (48h timelock)`
                    : '48 Hours (Standard)'}
                </span>
              </div>

              {/* Countdown / Ready Timer (Masked for board conformity) */}
              <div
                className="p-3 rounded-lg border border-border/80 bg-card text-center space-y-1"
                data-testid={`countdown-${proposal.id}`}
              >
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                  Execution Readiness Window
                </span>
                <span
                  role="status"
                  aria-live="polite"
                  className={cn(
                    'font-mono text-base font-bold',
                    proposal.state === 'executable'
                      ? 'text-emerald-500'
                      : proposal.state === 'queued'
                        ? 'text-amber-500'
                        : 'text-muted-foreground',
                  )}
                  data-mask="dynamic-data"
                >
                  {proposal.state === 'executable'
                    ? 'READY FOR EXECUTION'
                    : proposal.state === 'queued'
                      ? formatProposalCountdown(proposal.timelock.secondsRemaining)
                      : 'TIMELOCK NOT ACTIVE'}
                </span>
                {proposal.timelock.eta && (
                  <span className="text-[10px] text-muted-foreground block">
                    ETA: {new Date(proposal.timelock.eta).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Section 3: Transaction Simulation */}
        <section
          aria-labelledby="simulation-heading"
          className="rounded-lg border border-border bg-background p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 id="simulation-heading" className="text-sm font-semibold text-foreground">
                Transaction Simulation
              </h2>
            </div>
            <SimulationBadge status={proposal.simulation.status} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <div>
              <span className="text-muted-foreground">Estimated Gas:</span>
              <span className="ml-2 font-mono font-medium text-foreground" data-mask="dynamic-data">
                {proposal.simulation.gasEstimate || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Simulation Result:</span>
              <span className="ml-2 font-medium capitalize text-foreground">
                {proposal.simulation.status === 'success'
                  ? 'All calls simulated successfully without revert'
                  : proposal.simulation.revertReason || 'Not yet simulated on fork'}
              </span>
            </div>
          </div>

          {/* Trace Summary */}
          {proposal.simulation.traceSummary.length > 0 && (
            <div className="space-y-1 pt-1 text-xs">
              <span className="text-[11px] font-semibold text-foreground">
                Simulated Execution Trace:
              </span>
              <ul className="space-y-1 font-mono text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded border border-border/40">
                {proposal.simulation.traceSummary.map((step, sIdx) => (
                  <li key={sIdx} className="flex items-start gap-1.5">
                    <ArrowRight className="h-3 w-3 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="break-all">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Section 4: Affected Contracts & Blast Radius */}
        <section
          aria-labelledby="blast-radius-heading"
          className="rounded-lg border border-border bg-background p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 id="blast-radius-heading" className="text-sm font-semibold text-foreground">
                Affected Contracts & Blast Radius
              </h2>
            </div>
            <ProposalRiskBadge risk={proposal.blastRadius.riskTier} />
          </div>

          {/* Blast Radius Metadata */}
          <dl className="grid gap-3 sm:grid-cols-3 text-xs border-b border-border/40 pb-3">
            <div>
              <dt className="text-muted-foreground">Scope:</dt>
              <dd className="font-semibold text-foreground capitalize mt-0.5">
                {proposal.blastRadius.scope.replace('-', ' ')}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">State Mutability:</dt>
              <dd className="font-semibold text-foreground capitalize mt-0.5">
                {proposal.blastRadius.stateMutability.replace('-', ' ')}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Reversibility:</dt>
              <dd className="font-semibold text-foreground capitalize mt-0.5">
                {proposal.blastRadius.reversibility.replace(/-/g, ' ')}
              </dd>
            </div>
            <div className="sm:col-span-3">
              <dt className="text-muted-foreground">User & System Impact:</dt>
              <dd className="text-foreground mt-0.5 leading-relaxed">
                {proposal.blastRadius.userImpact}
              </dd>
            </div>
          </dl>

          {/* Affected Contracts List */}
          <div className="space-y-2 pt-1 text-xs">
            <span className="text-[11px] font-semibold text-foreground">
              Directly Affected Contracts ({proposal.affectedContracts.length}):
            </span>
            <div className="space-y-2">
              {proposal.affectedContracts.map((c) => (
                <div
                  key={c.address}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded bg-muted/30 border border-border/40 font-mono text-[11px]"
                >
                  <div>
                    <span className="font-bold text-foreground">{c.name}</span>
                    <span className="ml-2 text-muted-foreground">{c.role}</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{c.address}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-emerald-500 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      {c.verificationStatus}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {c.functionsCalled.join(', ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5: Canonical Receipts (if queued or executed) */}
        {proposal.receipt.txHash && (
          <section
            aria-labelledby="canonical-receipt-heading"
            className="rounded-lg border border-border bg-background p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 id="canonical-receipt-heading" className="text-sm font-semibold text-foreground">
                  Canonical Transaction Receipt
                </h2>
              </div>
              <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Canonical On-Chain Receipt
              </span>
            </div>

            <dl className="grid gap-2 sm:grid-cols-2 text-xs font-mono">
              <div>
                <dt className="text-muted-foreground">Tx Hash:</dt>
                <dd className="text-foreground break-all" data-mask="dynamic-data">
                  {proposal.receipt.txHash}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Block Number:</dt>
                <dd className="text-foreground" data-mask="dynamic-data">
                  #{proposal.receipt.blockNumber} ({proposal.receipt.confirmations} confirmations)
                </dd>
              </div>
            </dl>

            {proposal.receipt.receipt && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                >
                  <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Inspect Canonical Receipt</span>
                </button>
              </div>
            )}
          </section>
        )}

        {/* Section 6: Action Controls (Queue / Execute / Cancel) */}
        <section
          aria-labelledby="action-controls-heading"
          className="pt-4 border-t border-border/60 space-y-3"
        >
          <h2 id="action-controls-heading" className="sr-only">
            Governance Action Controls
          </h2>

          {/* Blocking Reasons Alert if any */}
          {actionGate && !actionGate.isActionable && actionGate.blockingReasons.length > 0 && (
            <div
              role="alert"
              className="p-3.5 rounded-lg border border-border bg-muted/40 text-xs space-y-1 text-muted-foreground"
            >
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                Action Unavailable
              </p>
              <ul className="list-disc pl-5 space-y-0.5">
                {actionGate.blockingReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {/* Queue Button (for succeeded proposals) */}
            {proposal.state === 'succeeded' && onQueue && (
              <button
                type="button"
                onClick={() => onQueue(proposal.id)}
                disabled={!actionGate?.canQueue || pendingAction}
                data-testid="queue-proposal-button"
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors',
                  actionGate?.canQueue
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60',
                )}
              >
                <Clock className="h-4 w-4" aria-hidden="true" />
                <span>Queue in Timelock</span>
              </button>
            )}

            {/* Execute Button (for executable proposals) */}
            {proposal.state === 'executable' && onExecute && (
              <button
                type="button"
                onClick={() => onExecute(proposal.id)}
                disabled={!actionGate?.canExecute || pendingAction}
                data-testid="execute-proposal-button"
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors',
                  actionGate?.canExecute
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60',
                )}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>Execute Proposal</span>
              </button>
            )}

            {/* Cancel Button */}
            {['draft', 'active', 'succeeded', 'queued'].includes(proposal.state) && onCancel && (
              <button
                type="button"
                onClick={() => onCancel(proposal.id)}
                disabled={!actionGate?.canCancel || pendingAction}
                data-testid="cancel-proposal-button"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 border border-destructive/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cancel Proposal</span>
              </button>
            )}

            {pendingAction && (
              <span role="status" className="text-xs text-muted-foreground animate-pulse">
                Submitting governance transaction to Optimism…
              </span>
            )}
          </div>
        </section>
      </div>

      {/* Canonical Receipt Modal */}
      {proposal.receipt.receipt && (
        <TransactionReceiptModal
          receipt={proposal.receipt.receipt}
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
        />
      )}
    </article>
  );
}

function SimulationBadge({ status }: { status: string }) {
  const styles: Record<string, { label: string; class: string }> = {
    success: {
      label: 'Simulation Success',
      class: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    },
    revert: {
      label: 'Simulation Reverted',
      class: 'bg-destructive/10 text-destructive border-destructive/30',
    },
    unsimulated: {
      label: 'Unsimulated',
      class: 'bg-muted text-muted-foreground border-border',
    },
    simulating: {
      label: 'Simulating…',
      class: 'bg-primary/10 text-primary border-primary/30',
    },
  };

  const s = styles[status] || styles.unsimulated;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border',
        s.class,
      )}
      data-testid={`simulation-badge-${status}`}
    >
      <Activity className="h-3 w-3" aria-hidden="true" />
      <span>{s.label}</span>
    </span>
  );
}
