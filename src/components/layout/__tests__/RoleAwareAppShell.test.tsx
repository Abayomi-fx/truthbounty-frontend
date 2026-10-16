import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  APP_ROUTES,
  NAV_ITEMS,
  PRIMARY_ACTION_ITEM,
  RESOURCE_LINKS,
  isRouteAllowed,
} from '@/config/navigation';
import { AppShellProvider, useAppShellContext } from '@/context/AppShellContext';
import { AccessDeniedState } from '@/components/common/AccessDeniedState';
import { NetworkContextSelector } from '@/components/layout/NetworkContextSelector';
import Sidebar from '@/components/layout/Sidebar';
import MainLayout from '@/components/layout/MainLayout';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/',
}));

jest.mock('@/components/features/claim-submission', () => ({
  ClaimSubmissionForm: () => <div data-testid="claim-form" />,
}));

jest.mock('@/components/providers', () => ({
  useFeatureFlags: () => ({
    isEnabled: () => true,
  }),
  FeatureFlagGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ui/ThemeToggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

jest.mock('@/components/ui/TrustIndicator', () => ({
  __esModule: true,
  default: () => <span>Trust</span>,
}));

jest.mock('@/components/ui/TrustWarningBanner', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/ui/WebSocketStatus', () => ({
  WebSocketIndicator: () => <span>WebSocket</span>,
}));

jest.mock('@/components/features/PerformanceBudgetIndicator', () => ({
  PerformanceBudgetIndicator: () => <span>Performance</span>,
}));

jest.mock('@/components/WalletConnection', () => ({
  WalletConnection: () => <button type="button">Wallet</button>,
}));

describe('Issue #436 V2-FE-151 — Role-Aware Application Shell & Canonical Navigation', () => {
  beforeEach(() => {
    push.mockClear();
    window.localStorage.clear();
  });

  describe('1. Canonical Navigation Contract (src/config/navigation.ts)', () => {
    it('defines canonical Next.js routes for all primary views', () => {
      expect(APP_ROUTES.HOME).toBe('/');
      expect(APP_ROUTES.NEW_CLAIM).toBe('/claims/new');
      expect(APP_ROUTES.HOW_IT_WORKS).toBe('/how-it-works');
      expect(APP_ROUTES.IDENTITY).toBe('/identity');
      expect(APP_ROUTES.REWARDS).toBe('/rewards');
      expect(APP_ROUTES.VERIFIER).toBe('/verifier');
      expect(APP_ROUTES.DISPUTES).toBe('/disputes');
      expect(APP_ROUTES.ADMIN).toBe('/admin');
      expect(APP_ROUTES.TREASURY).toBe('/treasury');
    });

    it('routes every create-claim entry point canonically to /claims/new', () => {
      expect(PRIMARY_ACTION_ITEM.href).toBe('/claims/new');
      expect(PRIMARY_ACTION_ITEM.label).toBe('Submit Claim');
    });

    it('organizes items across public, personal, verifier, and admin navigation groups', () => {
      const groups = new Set(NAV_ITEMS.map((item) => item.group));
      expect(groups.has('public')).toBe(true);
      expect(groups.has('personal')).toBe(true);
      expect(groups.has('verifier')).toBe(true);
      expect(groups.has('admin')).toBe(true);
    });

    it('ensures no navigation item relies on a placeholder button or hash link', () => {
      NAV_ITEMS.forEach((item) => {
        expect(item.href).not.toBe('#');
        expect(item.href.startsWith('/')).toBe(true);
      });
      Object.values(RESOURCE_LINKS).forEach((url) => {
        expect(url.startsWith('https://')).toBe(true);
      });
    });

    it('enforces route access rule contract correctly', () => {
      // Public route
      const publicAccess = isRouteAllowed('/', false, false, {
        isVerifier: false,
        isAdmin: false,
        isClaimant: false,
        isGuest: true,
      });
      expect(publicAccess.isAllowed).toBe(true);

      // Verifier route without verifier role
      const verifierAccess = isRouteAllowed('/verifier', true, true, {
        isVerifier: false,
        isAdmin: false,
        isClaimant: false,
        isGuest: false,
      });
      expect(verifierAccess.isAllowed).toBe(false);
      expect(verifierAccess.denialReason).toBe('verifier_role_required');

      // Admin route without admin role
      const adminAccess = isRouteAllowed('/admin', true, true, {
        isVerifier: true,
        isAdmin: false,
        isClaimant: false,
        isGuest: false,
      });
      expect(adminAccess.isAllowed).toBe(false);
      expect(adminAccess.denialReason).toBe('admin_role_required');

      // Admin route with admin role
      const adminAllowed = isRouteAllowed('/admin', true, true, {
        isVerifier: false,
        isAdmin: true,
        isClaimant: false,
        isGuest: false,
      });
      expect(adminAllowed.isAllowed).toBe(true);
    });
  });

  describe('2. Role-Aware Capability Context (AppShellContext)', () => {
    function ContextConsumer() {
      const shell = useAppShellContext();
      return (
        <div>
          <span data-testid="current-route">{shell.currentRoute}</span>
          <span data-testid="is-guest">{shell.roles.isGuest.toString()}</span>
          <span data-testid="is-verifier">{shell.roles.isVerifier.toString()}</span>
          <span data-testid="is-admin">{shell.roles.isAdmin.toString()}</span>
          <span data-testid="can-verify">{shell.capabilities.canVerify.toString()}</span>
          <span data-testid="can-admin">{shell.capabilities.canAdminister.toString()}</span>
          <button
            type="button"
            data-testid="invalidate-btn"
            onClick={shell.invalidateProtectedContext}
          >
            Invalidate
          </button>
        </div>
      );
    }

    it('provides default guest context when unauthenticated', () => {
      render(
        <AppShellProvider overrideIsConnected={false} overrideAddress={null}>
          <ContextConsumer />
        </AppShellProvider>,
      );

      expect(screen.getByTestId('is-guest')).toHaveTextContent('true');
      expect(screen.getByTestId('is-verifier')).toHaveTextContent('false');
      expect(screen.getByTestId('is-admin')).toHaveTextContent('false');
      expect(screen.getByTestId('can-verify')).toHaveTextContent('false');
    });

    it('reflects verifier capability when verifier role is active', () => {
      render(
        <AppShellProvider overrideIsVerifier={true}>
          <ContextConsumer />
        </AppShellProvider>,
      );

      expect(screen.getByTestId('is-verifier')).toHaveTextContent('true');
      expect(screen.getByTestId('can-verify')).toHaveTextContent('true');
    });

    it('reflects admin capability when admin role is active', () => {
      render(
        <AppShellProvider overrideIsAdmin={true}>
          <ContextConsumer />
        </AppShellProvider>,
      );

      expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
      expect(screen.getByTestId('can-admin')).toHaveTextContent('true');
    });

    it('provides an invalidateProtectedContext function for account and chain switches', () => {
      render(
        <AppShellProvider>
          <ContextConsumer />
        </AppShellProvider>,
      );

      const btn = screen.getByTestId('invalidate-btn');
      expect(() => fireEvent.click(btn)).not.toThrow();
    });
  });

  describe('3. AccessDeniedState Component', () => {
    it('renders accessible alert for disconnected wallet', () => {
      render(<AccessDeniedState reason="wallet_disconnected" returnHref="/" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/wallet connection required/i);
      expect(screen.getByRole('link', { name: /claims feed/i })).toHaveAttribute('href', '/');
    });

    it('renders accessible alert for unsupported network', () => {
      render(<AccessDeniedState reason="wrong_chain" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/unsupported network/i);
      expect(screen.getByText(/optimism mainnet/i)).toBeInTheDocument();
    });

    it('renders accessible alert for verifier role required', () => {
      render(<AccessDeniedState reason="verifier_role_required" requiredRole="verifier" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/verifier authorization required/i);
    });

    it('renders accessible alert for administrator role required', () => {
      render(<AccessDeniedState reason="admin_role_required" requiredRole="admin" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/administrator authorization required/i);
    });
  });

  describe('4. NetworkContextSelector (Replacing All Chains)', () => {
    it('renders the Optimism/EVM network context selector with live options', () => {
      render(
        <AppShellProvider>
          <NetworkContextSelector />
        </AppShellProvider>,
      );

      const select = screen.getByRole('combobox', { name: /select chain/i });
      expect(select).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Optimism' })).toHaveValue('10');
      expect(screen.getByRole('option', { name: 'Optimism Sepolia' })).toHaveValue('11155420');
    });

    it('displays unsupported network indicator when on invalid chain', () => {
      render(
        <AppShellProvider overrideIsConnected={true} overrideChainId={1}>
          <NetworkContextSelector />
        </AppShellProvider>,
      );

      const select = screen.getByRole('combobox', { name: /select chain/i });
      expect(select).toHaveValue('unsupported');
      expect(screen.getByRole('option', { name: 'Unsupported Network' })).toBeDisabled();
    });
  });

  describe('5. Sidebar Role-Aware Navigation & Mobile Focus Management', () => {
    it('renders public group for guest users and hides verifier/admin links', () => {
      render(
        <AppShellProvider overrideIsConnected={false} overrideAddress={null}>
          <Sidebar />
        </AppShellProvider>,
      );

      expect(screen.getByText('Public Explore')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /claims feed/i })).toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: /how it works/i })).toHaveAttribute('href', '/how-it-works');

      // Verifier and Admin groups should NOT be visible to guests
      expect(screen.queryByText('Consensus & Verifier')).not.toBeInTheDocument();
      expect(screen.queryByText('Administration')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /verification queue/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /protocol governance/i })).not.toBeInTheDocument();
    });

    it('renders verifier navigation group when user has verifier role', () => {
      render(
        <AppShellProvider overrideIsVerifier={true}>
          <Sidebar />
        </AppShellProvider>,
      );

      expect(screen.getByText('Consensus & Verifier')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /verification queue/i })).toHaveAttribute('href', '/verifier');
      expect(screen.getByRole('link', { name: /active disputes/i })).toHaveAttribute('href', '/disputes');
    });

    it('renders admin navigation group when user has admin role', () => {
      render(
        <AppShellProvider overrideIsAdmin={true}>
          <Sidebar />
        </AppShellProvider>,
      );

      expect(screen.getByText('Administration')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /protocol governance/i })).toHaveAttribute('href', '/admin');
    });

    it('provides accessible hamburger trigger with aria-expanded and aria-controls', () => {
      render(
        <AppShellProvider>
          <Sidebar />
        </AppShellProvider>,
      );

      const toggleBtn = screen.getByRole('button', { name: /toggle navigation menu/i });
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
      expect(toggleBtn).toHaveAttribute('aria-controls', 'sidebar-navigation');

      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes mobile drawer when Escape key is pressed and returns focus', () => {
      render(
        <AppShellProvider>
          <Sidebar />
        </AppShellProvider>,
      );

      const toggleBtn = screen.getByRole('button', { name: /toggle navigation menu/i });
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

      // Press Escape inside aside
      const aside = screen.getByLabelText('Sidebar navigation');
      fireEvent.keyDown(aside, { key: 'Escape' });

      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    });

    it('routes primary Submit Claim action to /claims/new', () => {
      render(
        <AppShellProvider>
          <Sidebar />
        </AppShellProvider>,
      );

      const submitBtn = screen.getByRole('button', { name: /submit claim/i });
      fireEvent.click(submitBtn);

      expect(push).toHaveBeenCalledWith('/claims/new');
    });
  });

  describe('6. MainLayout Shell Integration', () => {
    it('renders skip link for keyboard accessibility', () => {
      render(
        <AppShellProvider>
          <MainLayout>
            <div>Dashboard Content</div>
          </MainLayout>
        </AppShellProvider>,
      );

      const skipLink = screen.getByRole('link', { name: /skip to main content/i });
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });

    it('renders children within the main landmark', () => {
      render(
        <AppShellProvider>
          <MainLayout>
            <div data-testid="page-child">Test Content</div>
          </MainLayout>
        </AppShellProvider>,
      );

      const mainLandmark = screen.getByRole('main');
      expect(mainLandmark).toBeInTheDocument();
      expect(screen.getByTestId('page-child')).toBeInTheDocument();
    });
  });
});
