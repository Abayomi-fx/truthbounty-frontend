'use client';

import React, { useMemo } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import TrustWarningBanner from '@/components/ui/TrustWarningBanner';
import OfflineBanner from '@/components/ui/OfflineBanner';
import { AppShellProvider, useAppShellContext } from '@/context/AppShellContext';
import { AccessDeniedState } from '@/components/common/AccessDeniedState';
import { DeploymentPreviewBanner } from '@/components/preview/DeploymentPreviewBanner';
import { DeploymentPreviewGuard } from '@/components/preview/DeploymentPreviewGuard';
import {
  verifyPreviewDeployment,
  type PreviewVerificationResult,
} from '@/lib/deployment/preview-verification';

function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const { routeAccess, invalidateProtectedContext } = useAppShellContext();

  // V2-FE-064: verify preview deployment once at the application boundary.
  // Result is memoised — verifyPreviewDeployment reads env vars which are
  // stable for the lifetime of the build, so this never changes mid-session.
  const previewResult: PreviewVerificationResult = useMemo(
    () => verifyPreviewDeployment(),
    [],
  );

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

        {/*
          V2-FE-064: Deployment preview provenance banner.
          Rendered above all content so reviewers see provenance immediately.
          Returns null when not a preview build — zero DOM overhead in production.
        */}
        <DeploymentPreviewBanner
          verificationResult={previewResult}
          dismissible={previewResult.status === 'verified'}
        />

        {/*
          V2-FE-064: Preview guard gates the entire main content area.
          When blocked, no mutation surface inside children is reachable.
          When not_preview or verified, children pass through unmodified.
        */}
        <DeploymentPreviewGuard verificationResult={previewResult}>
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
        </DeploymentPreviewGuard>
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
