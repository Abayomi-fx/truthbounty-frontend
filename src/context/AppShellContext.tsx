'use client';

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import { useAccount, useChainId } from 'wagmi';
import { OPTIMISM_CHAIN_IDS } from '@/lib/transaction-machine/transaction-machine.types';
import { useFeatureFlags } from '@/components/providers';
import { APP_ROUTES, type NavigationGroupType } from '@/config/navigation';

export type RouteDenialReason =
  | 'wallet_disconnected'
  | 'wrong_chain'
  | 'verifier_role_required'
  | 'admin_role_required'
  | 'feature_disabled';

export interface RouteAccessStatus {
  isAllowed: boolean;
  denialReason: RouteDenialReason | null;
  requiredRole: 'verifier' | 'admin' | null;
}

export interface AppShellRoles {
  isVerifier: boolean;
  isAdmin: boolean;
  isClaimant: boolean;
  isGuest: boolean;
}

export interface AppShellCapabilities {
  canCreateClaim: boolean;
  canVerify: boolean;
  canDispute: boolean;
  canClaimRewards: boolean;
  canAdminister: boolean;
}

export interface AppShellContextValue {
  currentRoute: string;
  account: `0x${string}` | null;
  chainId: number | undefined;
  isConnected: boolean;
  isSupportedChain: boolean;
  chainName: string;
  roles: AppShellRoles;
  capabilities: AppShellCapabilities;
  activeGroup: NavigationGroupType;
  routeAccess: RouteAccessStatus;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  invalidateProtectedContext: () => void;
}

const defaultAppShellContext: AppShellContextValue = {
  currentRoute: '/',
  account: null,
  chainId: undefined,
  isConnected: false,
  isSupportedChain: false,
  chainName: 'Optimism',
  roles: { isVerifier: false, isAdmin: false, isClaimant: false, isGuest: true },
  capabilities: {
    canCreateClaim: false,
    canVerify: false,
    canDispute: false,
    canClaimRewards: false,
    canAdminister: false,
  },
  activeGroup: 'public',
  routeAccess: { isAllowed: true, denialReason: null, requiredRole: null },
  isMobileMenuOpen: false,
  setIsMobileMenuOpen: () => {},
  toggleMobileMenu: () => {},
  invalidateProtectedContext: () => {},
};

const AppShellContext = createContext<AppShellContextValue>(defaultAppShellContext);

export interface AppShellProviderProps {
  children: React.ReactNode;
  /** Test override for current route pathname */
  overridePathname?: string;
  /** Test override for connection status */
  overrideIsConnected?: boolean;
  /** Test override for wallet address */
  overrideAddress?: string | null;
  /** Test override for chain ID */
  overrideChainId?: number;
  /** Test override for verifier role */
  overrideIsVerifier?: boolean;
  /** Test override for admin role */
  overrideIsAdmin?: boolean;
}

export function AppShellProvider({
  children,
  overridePathname,
  overrideIsConnected,
  overrideAddress,
  overrideChainId,
  overrideIsVerifier,
  overrideIsAdmin,
}: AppShellProviderProps) {
  const currentPathname = usePathname();
  const pathname = overridePathname || currentPathname || '/';
  const wagmiAccount = useAccount();
  const rawWagmiChainId = useChainId();

  const isConnected =
    overrideIsConnected !== undefined ? overrideIsConnected : wagmiAccount.isConnected;
  const address =
    overrideAddress !== undefined ? (overrideAddress ?? undefined) : wagmiAccount.address;
  const rawChainId =
    overrideChainId !== undefined ? overrideChainId : rawWagmiChainId;
  const { isEnabled } = useFeatureFlags();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [invalidationEpoch, setInvalidationEpoch] = useState(0);

  const prevAccountRef = useRef<string | undefined>(address);
  const prevChainIdRef = useRef<number | undefined>(rawChainId);

  // Invalidate protected context when account or chain changes
  const invalidateProtectedContext = useCallback(() => {
    setInvalidationEpoch((epoch) => epoch + 1);
  }, []);

  useEffect(() => {
    if (address !== prevAccountRef.current || rawChainId !== prevChainIdRef.current) {
      prevAccountRef.current = address;
      prevChainIdRef.current = rawChainId;
      invalidateProtectedContext();
    }
  }, [address, rawChainId, invalidateProtectedContext]);

  // Chain validation
  const chainId = rawChainId;
  const isSupportedChain = useMemo(() => {
    if (!chainId) return false;
    const isProdOptimism = OPTIMISM_CHAIN_IDS.includes(chainId as 10 | 11155420);
    const isDevChain = process.env.NODE_ENV !== 'production' && chainId === 31337;
    return isProdOptimism || isDevChain;
  }, [chainId]);

  const chainName = useMemo(() => {
    if (chainId === 10) return 'Optimism';
    if (chainId === 11155420) return 'OP Sepolia';
    if (chainId === 31337) return 'Hardhat Dev';
    if (isConnected) return 'Unsupported Network';
    return 'Optimism';
  }, [chainId, isConnected]);

  // Roles determination
  const roles = useMemo<AppShellRoles>(() => {
    // InvalidationEpoch is a dependency to ensure fresh evaluation
    void invalidationEpoch;

    if (!isConnected || !address) {
      return {
        isVerifier: false,
        isAdmin: false,
        isClaimant: false,
        isGuest: true,
      };
    }

    const adminEnv = process.env.NEXT_PUBLIC_ADMIN_ADDRESS?.toLowerCase();
    const isAdminUser =
      overrideIsAdmin !== undefined
        ? overrideIsAdmin
        : Boolean(adminEnv && address.toLowerCase() === adminEnv);

    const isVerifierUser =
      overrideIsVerifier !== undefined
        ? overrideIsVerifier
        : Boolean(isEnabled('CLAIM_VERIFICATION') && isSupportedChain);

    return {
      isVerifier: isVerifierUser,
      isAdmin: isAdminUser,
      isClaimant: true,
      isGuest: false,
    };
  }, [
    isConnected,
    address,
    isSupportedChain,
    isEnabled,
    overrideIsAdmin,
    overrideIsVerifier,
    invalidationEpoch,
  ]);

  // Active capabilities determination
  const capabilities = useMemo<AppShellCapabilities>(() => {
    return {
      canCreateClaim: Boolean(
        isEnabled('CLAIM_SUBMISSION') && isConnected && isSupportedChain,
      ),
      canVerify: Boolean(
        isEnabled('CLAIM_VERIFICATION') && isConnected && isSupportedChain && roles.isVerifier,
      ),
      canDispute: Boolean(
        isEnabled('CLAIM_DISPUTES') && isConnected && isSupportedChain,
      ),
      canClaimRewards: Boolean(isConnected && isSupportedChain),
      canAdminister: Boolean(isConnected && isSupportedChain && roles.isAdmin),
    };
  }, [isEnabled, isConnected, isSupportedChain, roles]);

  // Determine active navigation group
  const activeGroup = useMemo<NavigationGroupType>(() => {
    if (pathname === APP_ROUTES.ADMIN || pathname.startsWith('/admin/')) {
      return 'admin';
    }
    if (
      pathname === APP_ROUTES.VERIFIER ||
      pathname.startsWith('/verifier/') ||
      pathname === APP_ROUTES.DISPUTES ||
      pathname.startsWith('/disputes/')
    ) {
      return 'verifier';
    }
    if (
      pathname === APP_ROUTES.IDENTITY ||
      pathname.startsWith('/identity/') ||
      pathname === APP_ROUTES.REWARDS ||
      pathname.startsWith('/rewards/')
    ) {
      return 'personal';
    }
    return 'public';
  }, [pathname]);

  // Evaluate route access permissions for the current route
  const routeAccess = useMemo<RouteAccessStatus>(() => {
    // Admin routes
    if (pathname === APP_ROUTES.ADMIN || pathname.startsWith('/admin/')) {
      if (!isConnected) {
        return { isAllowed: false, denialReason: 'wallet_disconnected', requiredRole: 'admin' };
      }
      if (!isSupportedChain) {
        return { isAllowed: false, denialReason: 'wrong_chain', requiredRole: 'admin' };
      }
      if (!roles.isAdmin) {
        return { isAllowed: false, denialReason: 'admin_role_required', requiredRole: 'admin' };
      }
      return { isAllowed: true, denialReason: null, requiredRole: null };
    }

    // Verifier routes
    if (pathname === APP_ROUTES.VERIFIER || pathname.startsWith('/verifier/')) {
      if (!isEnabled('CLAIM_VERIFICATION')) {
        return { isAllowed: false, denialReason: 'feature_disabled', requiredRole: 'verifier' };
      }
      if (!isConnected) {
        return { isAllowed: false, denialReason: 'wallet_disconnected', requiredRole: 'verifier' };
      }
      if (!isSupportedChain) {
        return { isAllowed: false, denialReason: 'wrong_chain', requiredRole: 'verifier' };
      }
      if (!roles.isVerifier) {
        return { isAllowed: false, denialReason: 'verifier_role_required', requiredRole: 'verifier' };
      }
      return { isAllowed: true, denialReason: null, requiredRole: null };
    }

    // Disputes route
    if (pathname === APP_ROUTES.DISPUTES || pathname.startsWith('/disputes/')) {
      if (!isEnabled('CLAIM_DISPUTES')) {
        return { isAllowed: false, denialReason: 'feature_disabled', requiredRole: null };
      }
      return { isAllowed: true, denialReason: null, requiredRole: null };
    }

    // Personal routes (identity, rewards)
    if (
      pathname === APP_ROUTES.IDENTITY ||
      pathname.startsWith('/identity/') ||
      pathname === APP_ROUTES.REWARDS ||
      pathname.startsWith('/rewards/')
    ) {
      if (!isConnected) {
        return { isAllowed: false, denialReason: 'wallet_disconnected', requiredRole: null };
      }
      if (!isSupportedChain) {
        return { isAllowed: false, denialReason: 'wrong_chain', requiredRole: null };
      }
      return { isAllowed: true, denialReason: null, requiredRole: null };
    }

    // Public routes (default allowed)
    return { isAllowed: true, denialReason: null, requiredRole: null };
  }, [pathname, isConnected, isSupportedChain, roles, isEnabled]);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((open) => !open);
  }, []);

  const value = useMemo<AppShellContextValue>(() => ({
    currentRoute: pathname,
    account: (address as `0x${string}`) || null,
    chainId,
    isConnected,
    isSupportedChain,
    chainName,
    roles,
    capabilities,
    activeGroup,
    routeAccess,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    toggleMobileMenu,
    invalidateProtectedContext,
  }), [
    pathname,
    address,
    chainId,
    isConnected,
    isSupportedChain,
    chainName,
    roles,
    capabilities,
    activeGroup,
    routeAccess,
    isMobileMenuOpen,
    toggleMobileMenu,
    invalidateProtectedContext,
  ]);

  return (
    <AppShellContext.Provider value={value}>
      {children}
    </AppShellContext.Provider>
  );
}

export function useAppShellContext(): AppShellContextValue {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error('useAppShellContext must be used within an AppShellProvider');
  }
  return context;
}
