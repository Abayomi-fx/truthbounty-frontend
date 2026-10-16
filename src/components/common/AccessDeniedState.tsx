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
}

export function AccessDeniedState({
  reason,
  requiredRole,
  returnHref = APP_ROUTES.HOME,
  onRetry,
}: AccessDeniedStateProps) {
  const { switchChain } = useSwitchChain();

  let Icon = MdLock;
  let title = 'Access Restricted';
  let description =
    'You do not have permission to view this route or your session does not meet protocol requirements.';
  let primaryAction: React.ReactNode = null;

  switch (reason) {
    case 'wallet_disconnected':
      Icon = MdLock;
      title = 'Wallet Connection Required';
      description =
        'This route requires an authenticated wallet. Connect your wallet to access personal dashboard, rewards, and participation capabilities.';
      primaryAction = (
        <Link
          href={APP_ROUTES.IDENTITY}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Connect or Verify Identity
        </Link>
      );
      break;

    case 'wrong_chain':
      Icon = MdNetworkCheck;
      title = 'Unsupported Network';
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
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Switch to Optimism
        </button>
      );
      break;

    case 'verifier_role_required':
      Icon = MdSecurity;
      title = 'Verifier Authorization Required';
      description =
        'The verification queue and active dispute assessments require an authorized verifier role. Complete identity verification or stake to participate in consensus.';
      primaryAction = (
        <Link
          href={APP_ROUTES.IDENTITY}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View Verifier Requirements
        </Link>
      );
      break;

    case 'admin_role_required':
      Icon = MdBlock;
      title = 'Administrator Authorization Required';
      description =
        'Protocol governance and parameters are restricted to verified administrative addresses. Your connected account does not possess administrator privileges.';
      primaryAction = (
        <Link
          href={APP_ROUTES.HOME}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Return to Claims Feed
        </Link>
      );
      break;

    case 'feature_disabled':
      Icon = MdBlock;
      title = 'Capability Unavailable';
      description =
        'This feature is currently disabled or pending deployment by protocol governance configuration.';
      primaryAction = (
        <Link
          href={APP_ROUTES.HOME}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Return to Claims Feed
        </Link>
      );
      break;

    default:
      if (requiredRole === 'admin') {
        Icon = MdBlock;
        title = 'Administrator Access Required';
        description = 'This route requires protocol administrator authorization.';
      } else if (requiredRole === 'verifier') {
        Icon = MdSecurity;
        title = 'Verifier Access Required';
        description = 'This route requires active verifier eligibility.';
      }
      primaryAction = (
        <Link
          href={APP_ROUTES.HOME}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Return to Claims Feed
        </Link>
      );
      break;
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center"
      data-testid="access-denied-state"
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

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {primaryAction}
        <Link
          href={returnHref}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MdArrowBack className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Claims Feed
        </Link>
      </div>
    </div>
  );
}
