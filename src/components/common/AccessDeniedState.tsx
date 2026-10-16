'use client';

import React from 'react';
import Link from 'next/link';
import { useSwitchChain } from 'wagmi';
import { MdLock, MdNetworkCheck, MdSecurity, MdBlock, MdArrowBack } from 'react-icons/md';
import type { RouteDenialReason } from '@/context/AppShellContext';
import { APP_ROUTES } from '@/config/navigation';

export interface AccessDeniedStateProps {
  reason: RouteDenialReason | null;
  requiredRole?: 'verifier' | 'admin' | null;
  returnHref?: string;
  onRetry?: () => void;
  /** Optional freshness/source metadata for the denial decision. */
  source?: string;
  freshnessLabel?: string;
  /** Optional recoverable identifier (e.g. dispute ID) to preserve context. */
  recoverableId?: string;
}

const PRIMARY_ACTION_CLASS =
  'inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const SECONDARY_ACTION_CLASS =
  'inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function AccessDeniedState({
  reason,
  requiredRole,
  returnHref = APP_ROUTES.HOME,
  onRetry,
  source,
  freshnessLabel,
  recoverableId,
}: AccessDeniedStateProps) {
  const { switchChain } = useSwitchChain();

  let Icon = MdLock;
  let title = 'Access Restricted';
  let description =
    'You do not have permission to view this route or your session does not meet protocol requirements.';
  let primaryAction: React.ReactNode = null;
  let statusLabel = 'Access denied';

  switch (reason) {
    case 'wallet_disconnected':
      Icon = MdLock;
      title = 'Wallet Connection Required';
      statusLabel = 'Access denied - wallet not connected';
      description =
        'This route requires an authenticated wallet. Connect your wallet to access personal dashboard, rewards, and participation capabilities.';
      primaryAction = (
        <Link href={APP_ROUTES.IDENTITY} className={PRIMARY_ACTION_CLASS}>
          Connect or Verify Identity
        </Link>
      );
      break;

    case 'wrong_chain':
      Icon = MdNetworkCheck;
      title = 'Unsupported Network';
      statusLabel = 'Access denied - unsupported network';
      description =
        'TruthBounty operates exclusively on Optimism. Please switch your wallet to Optimism Mainnet (10) or OP Sepolia (11155420) to view this section.';
      primaryAction = (
        <button
          type="button"
          onClick={() => {
            if (switchChain) {
              switchChain({ chainId: 10 });
            }
            onRetry?.();
          }}
          className={PRIMARY_ACTION_CLASS}
        >
          Switch to Optimism
        </button>
      );
      break;

    case 'verifier_role_required':
      Icon = MdSecurity;
      title = 'Verifier Authorization Required';
      statusLabel = 'Access denied - verifier role required';
      description =
        'The verification queue and active dispute assessments require an authorized verifier role. Complete identity verification or stake to participate in consensus.';
      primaryAction = (
        <Link href={APP_ROUTES.IDENTITY} className={PRIMARY_ACTION_CLASS}>
          View Verifier Requirements
        </Link>
      );
      break;

    case 'admin_role_required':
      Icon = MdBlock;
      title = 'Administrator Authorization Required';
      statusLabel = 'Access denied - administrator role required';
      description =
        'Protocol governance and parameters are restricted to verified administrative addresses. Your connected account does not possess administrator privileges.';
      primaryAction = (
        <Link href={APP_ROUTES.HOME} className={PRIMARY_ACTION_CLASS}>
          Return to Claims Feed
        </Link>
      );
      break;

    case 'feature_disabled':
      Icon = MdBlock;
      title = 'Capability Unavailable';
      statusLabel = 'Access denied - capability unavailable';
      description =
        'This feature is currently disabled or pending deployment by protocol governance configuration.';
      primaryAction = (
        <Link href={APP_ROUTES.HOME} className={PRIMARY_ACTION_CLASS}>
          Return to Claims Feed
        </Link>
      );
      break;

    default:
      if (requiredRole === 'admin') {
        Icon = MdBlock;
        title = 'Administrator Access Required';
        statusLabel = 'Access denied - administrator access required';
        description = 'This route requires protocol administrator authorization.';
      } else if (requiredRole === 'verifier') {
        Icon = MdSecurity;
        title = 'Verifier Access Required';
        statusLabel = 'Access denied - verifier access required';
        description = 'This route requires active verifier eligibility.';
      }
      primaryAction = (
        <Link href={APP_ROUTES.HOME} className={PRIMARY_ACTION_CLASS}>
          Return to Claims Feed
        </Link>
      );
      break;
  }

  const hasMetadata = Boolean(source || freshnessLabel || recoverableId);

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-label={statusLabel}
      className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center"
      data-testid="access-denied-state"
      data-state="denied"
    >
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-sm">
        <Icon className="h-8 w-8 text-primary" aria-hidden="true" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>

      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>

      {hasMetadata ? (
        <dl
          className="mt-4 max-w-md rounded-lg border border-border bg-card px-4 py-3 text-left text-xs text-muted-foreground"
          data-testid="access-denied-metadata"
        >
          {source ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="font-medium text-foreground">Source</dt>
              <dd className="text-right">{source}</dd>
            </div>
          ) : null}
          {freshnessLabel ? (
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <dt className="font-medium text-foreground">Freshness</dt>
              <dd className="text-right">{freshnessLabel}</dd>
            </div>
          ) : null}
          {recoverableId ? (
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <dt className="font-medium text-foreground">Reference</dt>
              <dd className="text-right font-mono truncate" title={recoverableId}>
                {recoverableId}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {primaryAction}
        <Link href={returnHref} className={SECONDARY_ACTION_CLASS}>
          <MdArrowBack className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Return to Claims Feed
        </Link>
      </div>
    </div>
  );
}
