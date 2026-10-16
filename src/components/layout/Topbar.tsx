'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import TrustIndicator from '@/components/ui/TrustIndicator';
import { WebSocketIndicator } from '@/components/ui/WebSocketStatus';
import { PerformanceBudgetIndicator } from '@/components/features/PerformanceBudgetIndicator';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { WalletConnection } from '../WalletConnection';
import { FeatureFlagGate } from '@/components/providers';
import { NetworkContextSelector } from './NetworkContextSelector';
import { APP_ROUTES } from '@/config/navigation';

const Topbar = () => {
  const router = useRouter();

  return (
    <header
      className="flex items-center justify-between h-16 pl-16 pr-4 sm:pr-6 lg:pl-8 lg:pr-8 border-b border-border bg-card text-foreground"
      role="banner"
    >
      <div className="flex min-w-0 items-center space-x-2 sm:space-x-4">
        {/* Supported Optimism/EVM Network Context (replacing legacy All Chains) */}
        <NetworkContextSelector />

        {/* Advanced Time Filters (feature-flagged) */}
        <FeatureFlagGate flag="ADVANCED_FILTERS">
          <>
            <label className="sr-only" htmlFor="time-filter">
              Filter by time
            </label>
            <select
              id="time-filter"
              className="hidden min-w-0 bg-accent text-foreground px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm sm:block border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Filter by time"
            >
              <option value="all">All</option>
              <option value="30d">30d</option>
              <option value="7d">7d</option>
            </select>
          </>
        </FeatureFlagGate>
      </div>

      <div className="flex shrink-0 items-center space-x-2 sm:space-x-3 md:space-x-4">
        {/* WebSocket connection status (compact; secondary on mobile) */}
        <FeatureFlagGate flag="REALTIME_UPDATES">
          <span className="hidden sm:inline-flex">
            <WebSocketIndicator />
          </span>
        </FeatureFlagGate>

        {/* Frontend performance budget status */}
        <FeatureFlagGate flag="PERFORMANCE_BUDGETS">
          <PerformanceBudgetIndicator />
        </FeatureFlagGate>

        {/* Theme toggle */}
        <span className="hidden sm:inline-flex">
          <ThemeToggle />
        </span>

        {/* Brief trust indicator */}
        <FeatureFlagGate flag="TRUST_SCORE_DISPLAY">
          <span className="hidden items-center sm:inline-flex">
            <TrustIndicator />
          </span>
        </FeatureFlagGate>

        {/* Wallet connection */}
        <FeatureFlagGate flag="WALLET_CONNECTION">
          <WalletConnection />
        </FeatureFlagGate>

        {/* Submit Claim button: routes to canonical /claims/new */}
        <FeatureFlagGate flag="CLAIM_SUBMISSION">
          <button
            type="button"
            className="inline-flex items-center justify-center bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-md font-medium text-sm hover:bg-primary/90 transition-colors shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => router.push(APP_ROUTES.CLAIM_NEW)}
            aria-label="Submit a new claim"
          >
            <span className="hidden sm:inline">+ Submit Claim</span>
            <span className="sm:hidden">+ Claim</span>
          </button>
        </FeatureFlagGate>
      </div>
    </header>
  );
};

export default Topbar;
