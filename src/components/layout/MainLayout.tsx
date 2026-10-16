'use client';

import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import TrustWarningBanner from '@/components/ui/TrustWarningBanner';
import OfflineBanner from '@/components/ui/OfflineBanner';
import { AppShellProvider, useAppShellContext } from '@/context/AppShellContext';
import { AccessDeniedState } from '@/components/common/AccessDeniedState';

function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const { routeAccess, invalidateProtectedContext } = useAppShellContext();

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Skip link for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Role-aware Sidebar Navigation */}
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Topbar with network context & actions */}
        <Topbar />

        {/* Network offline and low-bandwidth read notice (V2-FE-129) */}
        <OfflineBanner />

        {/* Banner warns about Sybil/low-trust accounts */}
        <TrustWarningBanner />

        {/* Main application content area */}
        <main
          id="main-content"
          role="main"
          className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-background focus:outline-none"
          tabIndex={-1}
        >
          {!routeAccess.isAllowed ? (
            <AccessDeniedState
              reason={routeAccess.denialReason}
              requiredRole={routeAccess.requiredRole}
              onRetry={invalidateProtectedContext}
            />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

export interface MainLayoutProps {
  children: React.ReactNode;
  overrideIsVerifier?: boolean;
  overrideIsAdmin?: boolean;
}

const MainLayout = ({
  children,
  overrideIsVerifier,
  overrideIsAdmin,
}: MainLayoutProps) => {
  return (
    <AppShellProvider
      overrideIsVerifier={overrideIsVerifier}
      overrideIsAdmin={overrideIsAdmin}
    >
      <MainLayoutContent>{children}</MainLayoutContent>
    </AppShellProvider>
  );
};

export default MainLayout;
