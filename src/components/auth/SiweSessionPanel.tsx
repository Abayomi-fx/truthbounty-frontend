'use client';

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { Button } from '@/components/ui/button';
import { ConnectButton } from '@/components/ui/ConnectButton';
import { useSiweAuth, type UseSiweAuthOptions } from '@/hooks/useSiweAuth';
import {
  describeSiweFailure,
  siweStatusAnnouncement,
  toSiweSignInIntent,
  type SiweSignInIntent,
} from '@/lib/auth/siwe-presentation';
import type {
  SiweFailure,
  SiweSession,
  SiweStatus,
} from '@/lib/auth/siwe-types';

export interface SiweSessionPanelViewProps {
  status: SiweStatus;
  intent: SiweSignInIntent | null;
  error: SiweFailure | null;
  session: SiweSession | null;
  address: string | null;
  isBusy?: boolean;
  onBegin: () => void;
  onSign: () => void;
  onLogout: () => void;
  onReset: () => void;
  connectSlot?: ReactNode;
  className?: string;
}

function formatDateTime(value: string | number): string {
  const date = typeof value === 'number' ? new Date(value) : new Date(Date.parse(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function IntentField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="text-sm text-gray-900 dark:text-gray-100 break-words">{children}</dd>
    </div>
  );
}

/**
 * Presentational SIWE session UX. Renders the exact backend sign-in message and
 * every safety-relevant field, and only enables signing after the user
 * explicitly confirms they reviewed the message (no blind signing).
 */
export function SiweSessionPanelView({
  status,
  intent,
  error,
  session,
  address,
  isBusy = false,
  onBegin,
  onSign,
  onLogout,
  onReset,
  connectSlot,
  className,
}: SiweSessionPanelViewProps) {
  const [reviewed, setReviewed] = useState(false);
  const consentId = useId();

  // Require a fresh review for each new challenge.
  useEffect(() => {
    setReviewed(false);
  }, [intent?.nonce]);

  const announcement = siweStatusAnnouncement(status, error);
  const failure = status === 'error' && error ? describeSiweFailure(error) : null;

  const handleRetry = useCallback(() => onSign(), [onSign]);
  const handleNewChallenge = useCallback(() => onBegin(), [onBegin]);

  const renderBody = () => {
    if (address === null) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Connect your wallet to review and sign the exact sign-in message.
          </p>
          {connectSlot}
        </div>
      );
    }

    if (status === 'authenticated' && session) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            You are signed in. This session authenticates your wallet for
            wallet-scoped actions.
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <IntentField label="Account">
              <span className="font-mono" data-testid="siwe-session-address">
                {session.address}
              </span>
            </IntentField>
            <IntentField label="Chain">
              <span data-testid="siwe-session-chain">{session.chainId}</span>
            </IntentField>
            <IntentField label="Session expires">
              <span data-testid="siwe-session-expiry">
                {formatDateTime(session.expiresAt)}
              </span>
            </IntentField>
          </dl>
          <Button variant="outline" size="sm" onClick={onLogout} aria-label="Sign out">
            Sign out
          </Button>
        </div>
      );
    }

    if (failure) {
      return (
        <div className="space-y-3">
          <div
            role="alert"
            data-testid="siwe-error"
            className="rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3"
          >
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">
              {failure.title}
            </p>
            <p className="text-sm text-red-700 dark:text-red-300">{failure.message}</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {failure.recovery}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {failure.canRetry && (
              <Button size="sm" onClick={handleRetry} aria-label="Try signing in again">
                Try again
              </Button>
            )}
            {failure.canRequestNewChallenge && (
              <Button
                size="sm"
                variant={failure.canRetry ? 'outline' : 'default'}
                onClick={handleNewChallenge}
                aria-label="Request a new sign-in request"
              >
                Request new sign-in
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onReset} aria-label="Dismiss sign-in error">
              Dismiss
            </Button>
          </div>
        </div>
      );
    }

    if (status === 'ready-to-sign' && intent) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Review the exact sign-in request below. Your wallet will sign this
            message verbatim.
          </p>

          {intent.statement && (
            <p
              className="text-sm italic text-gray-700 dark:text-gray-300"
              data-testid="siwe-statement"
            >
              {intent.statement}
            </p>
          )}

          <dl
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border border-gray-200 dark:border-gray-700 p-3"
            data-testid="siwe-intent"
          >
            <IntentField label="Domain">
              <span data-testid="siwe-domain">{intent.domain}</span>
            </IntentField>
            <IntentField label="URI">
              <span data-testid="siwe-uri">{intent.uri}</span>
            </IntentField>
            <IntentField label="Account">
              <span className="font-mono">{intent.address}</span>
            </IntentField>
            <IntentField label="Chain ID">
              <span data-testid="siwe-chain">{intent.chainId}</span>
            </IntentField>
            <IntentField label="Nonce">
              <span className="font-mono" data-testid="siwe-nonce">
                {intent.nonce}
              </span>
            </IntentField>
            <IntentField label="Issued at">
              <span>{formatDateTime(intent.issuedAt)}</span>
            </IntentField>
            <IntentField label="Expires">
              <span data-testid="siwe-expiry">
                {formatDateTime(intent.expirationTime)}
              </span>
            </IntentField>
            <IntentField label="Version">
              <span>{intent.version}</span>
            </IntentField>
          </dl>

          {intent.resources.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Resources
              </p>
              <ul
                className="list-disc pl-5 text-sm text-gray-900 dark:text-gray-100"
                aria-label="Sign-in resources"
                data-testid="siwe-resources"
              >
                {intent.resources.map((resource) => (
                  <li key={resource} className="break-all">
                    {resource}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Exact message to sign
            </p>
            <pre
              data-testid="siwe-message"
              aria-label="Exact sign-in message to review"
              className="whitespace-pre-wrap break-words rounded-md bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 p-3 text-xs text-gray-900 dark:text-gray-100"
            >
              {intent.message}
            </pre>
          </div>

          <label htmlFor={consentId} className="flex items-start gap-2 text-sm">
            <input
              id={consentId}
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
              className="mt-1"
              data-testid="siwe-consent"
            />
            <span className="text-gray-700 dark:text-gray-300">
              I have reviewed the exact message above and consent to sign it.
            </span>
          </label>

          <Button
            onClick={onSign}
            disabled={!reviewed || isBusy}
            aria-label="Sign the reviewed message"
          >
            Sign message
          </Button>
        </div>
      );
    }

    if (
      status === 'requesting-challenge' ||
      status === 'signing' ||
      status === 'submitting' ||
      isBusy
    ) {
      return (
        <p className="text-sm text-gray-600 dark:text-gray-400" data-testid="siwe-busy">
          {announcement}
        </p>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Sign in with your Ethereum wallet to authenticate wallet-scoped
          actions. You will review the exact message before signing.
        </p>
        <Button onClick={onBegin} aria-label="Sign in with Ethereum">
          Sign in with Ethereum
        </Button>
      </div>
    );
  };

  return (
    <section
      aria-label="Sign in with Ethereum"
      data-testid="siwe-panel"
      data-state={status}
      className={className}
    >
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="siwe-status"
      >
        {announcement}
      </p>
      {renderBody()}
    </section>
  );
}

export interface SiweSessionPanelProps {
  className?: string;
  /** Inject auth client/overrides for tests or non-wagmi hosts. */
  authOptions?: UseSiweAuthOptions;
}

/**
 * Container that wires the real SIWE auth hook into the presentational panel.
 */
export function SiweSessionPanel({ className, authOptions }: SiweSessionPanelProps) {
  const auth = useSiweAuth(authOptions);
  const intent = useMemo(
    () =>
      auth.challenge
        ? toSiweSignInIntent(auth.challenge, authOptions?.now?.() ?? Date.now())
        : null,
    [auth.challenge, authOptions?.now],
  );

  return (
    <SiweSessionPanelView
      className={className}
      status={auth.status}
      intent={intent}
      error={auth.error}
      session={auth.session}
      address={auth.address}
      isBusy={auth.isBusy}
      onBegin={auth.begin}
      onSign={auth.signAndSubmit}
      onLogout={auth.clear}
      onReset={auth.resetError}
      connectSlot={<ConnectButton label="Connect Wallet" />}
    />
  );
}

export default SiweSessionPanel;
