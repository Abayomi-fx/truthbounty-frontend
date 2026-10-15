import { ComponentType } from 'react';
import {
  MdRssFeed,
  MdDashboard,
  MdAddCircleOutline,
  MdGavel,
  MdVerifiedUser,
  MdCardGiftcard,
  MdAdminPanelSettings,
  MdBadge,
} from 'react-icons/md';
import { HiOutlineQuestionMarkCircle } from 'react-icons/hi';
import type { FeatureFlag } from '@/config/feature-flags';

export const APP_ROUTES = {
  HOME: '/',
  DASHBOARD: '/',
  CLAIMS: '/',
  CLAIM_NEW: '/claims/new',
  NEW_CLAIM: '/claims/new',
  CLAIM_DETAIL: (id: string) => `/claims/${id}`,
  HOW_IT_WORKS: '/how-it-works',
  TREASURY: '/treasury',
  TREASURY_STAKE: '/treasury/stake',
  IDENTITY: '/identity',
  REWARDS: '/rewards',
  VERIFIER: '/verifier',
  DISPUTES: '/disputes',
  ANALYTICS: '/analytics',
  ADMIN: '/admin',
} as const;

export type NavigationGroupType = 'public' | 'personal' | 'verifier' | 'admin';

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string; size?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  group: NavigationGroupType;
  exact?: boolean;
  badge?: string;
  requiresAuth?: boolean;
  requiresRole?: 'verifier' | 'admin';
  featureFlag?: FeatureFlag;
}

export const NAV_ITEMS: readonly NavigationItem[] = [
  // Public Group
  {
    id: 'claims-feed',
    label: 'Claims Feed',
    href: APP_ROUTES.HOME,
    icon: MdRssFeed,
    group: 'public',
    exact: true,
  },
  {
    id: 'how-it-works',
    label: 'How it works',
    href: APP_ROUTES.HOW_IT_WORKS,
    icon: HiOutlineQuestionMarkCircle,
    group: 'public',
  },
  {
    id: 'treasury',
    label: 'Treasury & Stake',
    href: APP_ROUTES.TREASURY,
    icon: MdDashboard,
    group: 'public',
  },
  // Personal Group
  {
    id: 'identity',
    label: 'Identity & Trust',
    href: APP_ROUTES.IDENTITY,
    icon: MdBadge,
    group: 'personal',
    requiresAuth: true,
  },
  {
    id: 'rewards',
    label: 'Rewards & Claims',
    href: APP_ROUTES.REWARDS,
    icon: MdCardGiftcard,
    group: 'personal',
    requiresAuth: true,
  },
  // Verifier Group
  {
    id: 'verifier-queue',
    label: 'Verification Queue',
    href: APP_ROUTES.VERIFIER,
    icon: MdVerifiedUser,
    group: 'verifier',
    requiresAuth: true,
    requiresRole: 'verifier',
    featureFlag: 'CLAIM_VERIFICATION',
  },
  {
    id: 'disputes',
    label: 'Active Disputes',
    href: APP_ROUTES.DISPUTES,
    icon: MdGavel,
    group: 'verifier',
    requiresAuth: true,
    requiresRole: 'verifier',
    featureFlag: 'CLAIM_DISPUTES',
  },
  // Admin Group
  {
    id: 'admin-governance',
    label: 'Protocol Governance',
    href: APP_ROUTES.ADMIN,
    icon: MdAdminPanelSettings,
    group: 'admin',
    requiresAuth: true,
    requiresRole: 'admin',
  },
] as const;

export const PRIMARY_ACTION_ITEM: NavigationItem = {
  id: 'submit-claim',
  label: 'Submit Claim',
  href: APP_ROUTES.CLAIM_NEW,
  icon: MdAddCircleOutline,
  group: 'public',
  featureFlag: 'CLAIM_SUBMISSION',
};

export const RESOURCE_LINKS = {
  docs: 'https://github.com/DigiNodes/truthbounty-frontend/blob/main/docs/ARCHITECTURE.md',
  github: 'https://github.com/DigiNodes/truthbounty-frontend',
  discord: 'https://discord.gg/storybook',
  bugReport: 'https://github.com/DigiNodes/truthbounty-frontend/issues/new/choose',
} as const;

export type RouteDenialReason =
  | 'wallet_disconnected'
  | 'wrong_chain'
  | 'verifier_role_required'
  | 'admin_role_required'
  | 'feature_disabled';

export interface RouteAccessResult {
  isAllowed: boolean;
  denialReason: RouteDenialReason | null;
  requiredRole: 'verifier' | 'admin' | null;
}

export function isRouteAllowed(
  pathname: string,
  isConnected: boolean,
  isSupportedChain: boolean,
  roles: { isVerifier: boolean; isAdmin: boolean; isClaimant: boolean; isGuest: boolean },
  isFeatureEnabled?: (flag: string) => boolean,
): RouteAccessResult {
  const isEnabled = isFeatureEnabled || (() => true);

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

  // New claim route
  if (pathname === APP_ROUTES.CLAIM_NEW || pathname.startsWith('/claims/new')) {
    if (!isEnabled('CLAIM_SUBMISSION')) {
      return { isAllowed: false, denialReason: 'feature_disabled', requiredRole: null };
    }
    if (!isConnected) {
      return { isAllowed: false, denialReason: 'wallet_disconnected', requiredRole: null };
    }
    if (!isSupportedChain) {
      return { isAllowed: false, denialReason: 'wrong_chain', requiredRole: null };
    }
    return { isAllowed: true, denialReason: null, requiredRole: null };
  }

  // Public routes (default)
  return { isAllowed: true, denialReason: null, requiredRole: null };
}

