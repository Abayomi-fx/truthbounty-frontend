'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaGithub, FaDiscord, FaBug } from 'react-icons/fa';
import { MdPendingActions } from 'react-icons/md';
import { useFeatureFlags } from '@/components/providers';
import {
  getPendingTransactions,
  subscribeToPendingTransactions,
  type PendingTransactionEntry,
} from '@/lib/pending-transactions';
import { useAppShellContext } from '@/context/AppShellContext';
import {
  NAV_ITEMS,
  PRIMARY_ACTION_ITEM,
  RESOURCE_LINKS,
  APP_ROUTES,
  type NavigationItem,
  type NavigationGroupType,
} from '@/config/navigation';

const GROUP_LABELS: Record<NavigationGroupType, string> = {
  public: 'Public Explore',
  personal: 'Personal',
  verifier: 'Consensus & Verifier',
  admin: 'Administration',
};

const Sidebar = () => {
  const router = useRouter();
  const { isEnabled } = useFeatureFlags();
  const {
    currentRoute,
    account,
    isConnected,
    roles,
    capabilities,
    isMobileMenuOpen: contextIsMobileMenuOpen,
    setIsMobileMenuOpen: contextSetIsMobileMenuOpen,
  } = useAppShellContext();
  const pathname = currentRoute || '/';

  const [localIsMobileOpen, setLocalIsMobileOpen] = useState(false);
  const isMobileMenuOpen = contextIsMobileMenuOpen || localIsMobileOpen;
  const setIsMobileMenuOpen = useCallback(
    (open: boolean | ((prev: boolean) => boolean)) => {
      setLocalIsMobileOpen((prev) => {
        const next = typeof open === 'function' ? open(prev) : open;
        contextSetIsMobileMenuOpen(next);
        return next;
      });
    },
    [contextSetIsMobileMenuOpen],
  );

  const [pendingTransactions, setPendingTransactions] = useState<PendingTransactionEntry[]>(
    () => getPendingTransactions(),
  );

  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);

  useEffect(() => {
    return subscribeToPendingTransactions(setPendingTransactions);
  }, []);

  // Document-level Escape listener to close mobile drawer from anywhere
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleDocumentKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => document.removeEventListener('keydown', handleDocumentKeyDown);
  }, [isMobileMenuOpen, setIsMobileMenuOpen]);

  // Filter navigation items by role and capability
  const visibleNavItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      // Feature flag check
      if (item.featureFlag && !isEnabled(item.featureFlag)) {
        return false;
      }
      // Role requirement check
      if (item.requiresRole === 'admin' && !roles.isAdmin) {
        return false;
      }
      if (item.requiresRole === 'verifier' && !capabilities.canVerify) {
        return false;
      }
      return true;
    });
  }, [isEnabled, roles.isAdmin, capabilities.canVerify]);

  // Group filtered items
  const groupedItems = useMemo(() => {
    const groups: { type: NavigationGroupType; label: string; items: NavigationItem[] }[] = [];
    const groupTypes: NavigationGroupType[] = ['public', 'personal', 'verifier', 'admin'];

    for (const type of groupTypes) {
      const items = visibleNavItems.filter((item) => item.group === type);
      if (items.length > 0) {
        groups.push({
          type,
          label: GROUP_LABELS[type],
          items,
        });
      }
    }
    return groups;
  }, [visibleNavItems]);

  const handleNavClick = useCallback(
    (href: string) => {
      setIsMobileMenuOpen(false);
      router.push(href);
    },
    [router, setIsMobileMenuOpen],
  );

  // Focus management for mobile drawer
  useEffect(() => {
    if (isMobileMenuOpen) {
      // Focus first focusable element inside the drawer
      firstFocusableRef.current?.focus();
    }
  }, [isMobileMenuOpen]);

  // Keyboard navigation: Escape key to close and trap focus
  const handleSidebarKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        hamburgerRef.current?.focus();
        return;
      }

      if (e.key === 'Tab' && isMobileMenuOpen && sidebarRef.current) {
        const focusableElements = sidebarRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [isMobileMenuOpen, setIsMobileMenuOpen],
  );

  const isCurrentActive = useCallback(
    (item: NavigationItem) => {
      if (item.exact) {
        return pathname === item.href;
      }
      return pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
    },
    [pathname],
  );

  return (
    <>
      {/* Mobile Drawer Hamburger Trigger */}
      <button
        ref={hamburgerRef}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-card rounded-lg border border-border text-foreground shadow-md hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle navigation menu"
        aria-expanded={isMobileMenuOpen}
        aria-controls="sidebar-navigation"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          {isMobileMenuOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Backdrop overlay for mobile drawer */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity"
          onClick={() => {
            setIsMobileMenuOpen(false);
            hamburgerRef.current?.focus();
          }}
          role="presentation"
        />
      )}

      {/* Sidebar / Mobile Drawer Navigation */}
      <aside
        ref={sidebarRef}
        id="sidebar-navigation"
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          flex flex-col w-64 h-full bg-card border-r border-border text-foreground
          transform transition-transform duration-300 ease-in-out motion-reduce:transition-none
          ${
            isMobileMenuOpen
              ? 'visible translate-x-0'
              : 'invisible -translate-x-full lg:visible lg:translate-x-0'
          }
        `}
        aria-label="Sidebar navigation"
        role={isMobileMenuOpen ? 'dialog' : undefined}
        aria-modal={isMobileMenuOpen ? true : undefined}
        tabIndex={isMobileMenuOpen ? -1 : undefined}
        onKeyDown={handleSidebarKeyDown}
      >
        {/* Brand / Logo */}
        <div className="flex items-center h-16 px-6 py-6 font-bold text-lg tracking-tight border-b border-border">
          <Link
            href={APP_ROUTES.HOME}
            className="flex items-center text-foreground hover:opacity-90 transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span
              className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mr-2 shadow-sm font-bold"
              aria-hidden="true"
            >
              T
            </span>
            TruthBounty
          </Link>
        </div>

        {/* Primary Action Button: Submit Claim */}
        {(!PRIMARY_ACTION_ITEM.featureFlag ||
          isEnabled(PRIMARY_ACTION_ITEM.featureFlag)) && (
          <div className="p-4 pb-2">
            <button
              type="button"
              onClick={() => handleNavClick(PRIMARY_ACTION_ITEM.href)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Submit Claim"
            >
              <PRIMARY_ACTION_ITEM.icon className="w-4 h-4" aria-hidden="true" />
              <span>{PRIMARY_ACTION_ITEM.label}</span>
            </button>
          </div>
        )}

        {/* Navigation Groups */}
        <nav className="flex-1 px-4 py-3 space-y-5 overflow-y-auto" aria-label="Main Navigation">
          {groupedItems.map((group) => (
            <div key={group.type} className="space-y-1">
              <div className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                {group.label}
              </div>
              <ul className="space-y-1" role="list">
                {group.items.map((item, index) => {
                  const active = isCurrentActive(item);
                  return (
                    <li key={item.id}>
                      <Link
                        ref={(el) => {
                          if (!firstFocusableRef.current && index === 0) {
                            firstFocusableRef.current = el;
                          }
                        }}
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          active
                            ? 'bg-accent text-accent-foreground font-semibold shadow-xs'
                            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                        }`}
                      >
                        <item.icon
                          className={`w-5 h-5 shrink-0 ${
                            active ? 'text-primary' : 'text-muted-foreground'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="ml-3 truncate">{item.label}</span>
                        {item.requiresAuth && !isConnected && (
                          <span
                            className="ml-auto text-[10px] uppercase font-semibold text-muted-foreground/60 border border-border rounded px-1"
                            title="Wallet required"
                          >
                            Auth
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Pending Transactions Status Center */}
          <div
            className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"
            data-testid="sidebar-pending-transactions"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-500 dark:text-amber-200">
              <MdPendingActions className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Pending transactions</span>
              {pendingTransactions.length > 0 && (
                <span className="ml-auto inline-flex items-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs font-bold text-amber-500 dark:text-amber-200">
                  {pendingTransactions.length}
                </span>
              )}
            </div>
            {pendingTransactions.length === 0 ? (
              <p className="mt-2 text-xs text-amber-700/80 dark:text-amber-100/70">
                No transactions are waiting for confirmation right now.
              </p>
            ) : (
              <ul className="mt-3 space-y-2" role="list">
                {pendingTransactions.slice(0, 3).map((transaction) => (
                  <li
                    key={transaction.id}
                    className="rounded-lg border border-amber-400/20 bg-background/50 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-foreground">{transaction.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{transaction.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* External Protocol Resources */}
          <div className="pt-2 border-t border-border">
            <div className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1">
              Resources
            </div>
            <ul className="space-y-1" role="list">
              <li>
                <Link
                  href={RESOURCE_LINKS.docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  aria-label="Documentation (opens in new tab)"
                >
                  <svg
                    className="w-4 h-4 text-muted-foreground shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="ml-3 truncate">Documentation</span>
                </Link>
              </li>
              <li>
                <a
                  href={RESOURCE_LINKS.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  aria-label="GitHub (opens in new tab)"
                >
                  <FaGithub className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="ml-3 truncate">GitHub</span>
                </a>
              </li>
              <li>
                <a
                  href={RESOURCE_LINKS.discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  aria-label="Discord (opens in new tab)"
                >
                  <FaDiscord className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="ml-3 truncate">Discord</span>
                </a>
              </li>
              <li>
                <a
                  href={RESOURCE_LINKS.bugReport}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  aria-label="Report Bug (opens in new tab)"
                >
                  <FaBug className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
                  <span className="ml-3 truncate">Report Bug</span>
                </a>
              </li>
            </ul>
          </div>
        </nav>

        {/* Footer Identity & Session View (Replacing placeholder buttons) */}
        <div className="p-4 border-t border-border">
          <Link
            href={APP_ROUTES.IDENTITY}
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring text-left"
            aria-label={isConnected ? `User profile for ${account}` : 'User profile and identity'}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0 shadow-xs">
              {isConnected && account ? account.slice(2, 4).toUpperCase() : '🪪'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">
                {isConnected && account
                  ? `${account.slice(0, 6)}...${account.slice(-4)}`
                  : 'Identity & Trust'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {isConnected ? (roles.isAdmin ? 'Admin' : roles.isVerifier ? 'Verifier' : 'Connected') : 'Connect Wallet'}
              </p>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;