'use client';

/**
 * UI-FE-059 — useCrossTabSync
 *
 * Binds the connected wallet context to a bounded cross-tab channel so sibling
 * tabs converge on one account/chain/session view:
 *
 *  - local connect/disconnect/account/chain transitions are published
 *    (identity + epoch only — never a token or signature);
 *  - a remote revocation is adopted authoritatively and fails this tab closed;
 *  - a tab that was suspended (throttled/backgrounded) re-reads the shared
 *    resume snapshot and reconciles on wake;
 *  - a mutation captures the context epoch at prepare time and must re-check
 *    it before submitting, so a stale tab cannot mutate after revocation.
 *
 * The hook never fabricates wallet, session, consent, or transaction state: it
 * only relays the provider's canonical identity and terminal reasons.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';

import { useIsMounted } from '@/hooks/useIsMounted';
import {
  classifyContextTransition,
  buildWalletContextSnapshot,
  contextAllowsMutation,
  createContextGuard,
  describeContextRecovery,
  normalizeContextIdentity,
  readWalletContextSnapshot,
  transitionRevokesContext,
  walletContextKey,
  writeWalletContextSnapshot,
  type ContextGuard,
  type WalletContextSnapshot,
  type WalletIdentityTransition,
} from '@/lib/sync/wallet-context';
import {
  createCrossTabChannel,
  createSenderId,
  type CrossTabChannel,
} from '@/lib/sync/channel';
import type {
  ConsentChoice,
  CrossTabEvent,
  PendingTransactionAction,
  SessionStateReason,
} from '@/lib/sync/protocol';
import type { WalletIdentity } from '@/lib/wallet/identity';

export interface UseCrossTabSyncOptions {
  /** Explicit channel; otherwise one is created for this tab. */
  channel?: CrossTabChannel | null;
  /** Stable tab identifier override (tests). */
  senderId?: string;
  /** Disable the channel entirely (read-only hosts). Default: enabled. */
  enabled?: boolean;
  /** Injectable clock for deterministic snapshots. */
  now?: () => number;
  /** Override the connected account (tests / non-wagmi hosts). */
  accountOverride?: string | null;
  /** Override the connected chain id (tests / non-wagmi hosts). */
  chainIdOverride?: number | null;
  /** Notified when a sibling tab reaches a terminal session state. */
  onSessionState?: (reason: SessionStateReason) => void;
  /** Notified when a sibling tab changes analytics consent. */
  onConsent?: (choice: ConsentChoice) => void;
  /** Notified when a sibling tab registers/settles a pending transaction. */
  onPendingTransaction?: (
    action: PendingTransactionAction,
    id: string,
    chainId: number | null,
  ) => void;
}

export interface UseCrossTabSyncReturn {
  /** Authoritative context this tab must operate under. */
  context: WalletContextSnapshot;
  /** Transition that revoked the prior context (or `none`). */
  pendingTransition: WalletIdentityTransition;
  /** True after a revocation until the user explicitly acknowledges it. */
  requiresRecovery: boolean;
  /** Explicit, user-visible recovery guidance (null when none is required). */
  recoveryMessage: string | null;
  /** Most recent event accepted from a sibling tab. */
  lastRemoteEvent: CrossTabEvent | null;
  /** True only while the live scope matches the context and no recovery pending. */
  canMutate: boolean;
  /** Capture/re-check guard for a mutation's context epoch. */
  guard: ContextGuard;
  /** Acknowledge recovery once the user has reconciled the tab. */
  acknowledge: () => void;
  /** Subscribe to validated cross-tab events. */
  subscribe: (handler: (event: CrossTabEvent) => void) => () => void;
  publishSessionState: (reason: SessionStateReason) => void;
  publishConsent: (choice: ConsentChoice) => void;
  publishPendingTransaction: (
    action: PendingTransactionAction,
    id: string,
    chainId?: number | null,
  ) => void;
}

const INITIAL_CONTEXT: WalletContextSnapshot = {
  account: null,
  chainId: null,
  epoch: 0,
  reason: 'none',
  updatedAt: 0,
};

export function useCrossTabSync(
  options: UseCrossTabSyncOptions = {},
): UseCrossTabSyncReturn {
  const {
    channel: channelOption,
    senderId: senderIdOption,
    enabled = true,
    now,
    accountOverride,
    chainIdOverride,
  } = options;

  const mounted = useIsMounted();
  const { address, isConnecting, isReconnecting, status } = useAccount();
  const wagmiChainId = useChainId();

  const nowRef = useRef(now ?? (() => Date.now()));
  const callbacksRef = useRef({
    onSessionState: options.onSessionState,
    onConsent: options.onConsent,
    onPendingTransaction: options.onPendingTransaction,
  });
  useEffect(() => {
    nowRef.current = now ?? (() => Date.now());
    callbacksRef.current = {
      onSessionState: options.onSessionState,
      onConsent: options.onConsent,
      onPendingTransaction: options.onPendingTransaction,
    };
  }, [now, options.onSessionState, options.onConsent, options.onPendingTransaction]);

  const senderId = useMemo(
    () => senderIdOption ?? createSenderId(),
    [senderIdOption],
  );

  const channel = useMemo<CrossTabChannel | null>(() => {
    if (!enabled) return null;
    return channelOption ?? createCrossTabChannel({ senderId });
  }, [enabled, channelOption, senderId]);

  useEffect(() => {
    if (!enabled || channelOption) return;
    return () => channel?.close();
  }, [enabled, channelOption, channel]);

  const [context, setContext] = useState<WalletContextSnapshot>(INITIAL_CONTEXT);
  const [requiresRecovery, setRequiresRecovery] = useState(false);
  const [pendingTransition, setPendingTransition] =
    useState<WalletIdentityTransition>('none');
  const [lastRemoteEvent, setLastRemoteEvent] = useState<CrossTabEvent | null>(null);

  const contextRef = useRef<WalletContextSnapshot>(INITIAL_CONTEXT);
  const contextSenderRef = useRef<string>(senderId);
  const requiresRecoveryRef = useRef(false);
  const identityRef = useRef<WalletIdentity>({ address: null, chainId: null });
  const seededRef = useRef(false);

  const applyContext = useCallback(
    (
      next: WalletContextSnapshot,
      originSender: string,
      revoke: boolean,
    ) => {
      contextRef.current = next;
      contextSenderRef.current = originSender;
      setContext(next);
      writeWalletContextSnapshot(next);
      if (revoke) {
        requiresRecoveryRef.current = true;
        setRequiresRecovery(true);
        setPendingTransition(next.reason);
      }
    },
    [],
  );

  const clearRecovery = useCallback(() => {
    requiresRecoveryRef.current = false;
    setRequiresRecovery(false);
    setPendingTransition('none');
  }, []);

  // Live identity (provider is authoritative) or an explicit test override.
  const effectiveAccount =
    accountOverride !== undefined ? accountOverride : address ?? null;
  const effectiveChainId =
    chainIdOverride !== undefined ? chainIdOverride : wagmiChainId ?? null;
  const identity = useMemo(
    () => normalizeContextIdentity(effectiveAccount, effectiveChainId),
    [effectiveAccount, effectiveChainId],
  );

  const settled =
    accountOverride !== undefined ||
    chainIdOverride !== undefined ||
    (mounted && !isConnecting && !isReconnecting && status !== 'connecting');

  // Local identity changes → publish and seed the context.
  useEffect(() => {
    if (!settled) return;

    if (!seededRef.current) {
      seededRef.current = true;
      identityRef.current = identity;
      const seed = buildWalletContextSnapshot(
        identity,
        0,
        'none',
        nowRef.current(),
      );
      contextRef.current = seed;
      contextSenderRef.current = senderId;
      setContext(seed);
      writeWalletContextSnapshot(seed);
      return;
    }

    const transition = classifyContextTransition(identityRef.current, identity);
    if (transition === 'none') return;
    identityRef.current = identity;

    const next: WalletContextSnapshot = buildWalletContextSnapshot(
      identity,
      contextRef.current.epoch + 1,
      transition,
      nowRef.current(),
    );
    const revoke = transitionRevokesContext(transition);
    applyContext(next, senderId, revoke);

    channel?.publish({
      kind: 'wallet-context',
      reason: transition,
      account: next.account,
      chainId: next.chainId,
      epoch: next.epoch,
    });
  }, [settled, identity, applyContext, channel, senderId]);

  // Inbound cross-tab events.
  useEffect(() => {
    if (!channel) return;
    return channel.subscribe((event) => {
      setLastRemoteEvent(event);

      if (event.kind === 'wallet-context') {
        const remoteIdentity = normalizeContextIdentity(
          event.account,
          event.chainId,
        );
        const current = contextRef.current;
        const remoteKey = walletContextKey(remoteIdentity);
        const currentKey = walletContextKey({
          address: current.account,
          chainId: current.chainId,
        });

        const newerEpoch = event.epoch > current.epoch;
        const sameEpochConflict =
          event.epoch === current.epoch &&
          remoteKey !== currentKey &&
          event.sender > contextSenderRef.current;
        if (!newerEpoch && !sameEpochConflict) return;

        const remote: WalletContextSnapshot = buildWalletContextSnapshot(
          remoteIdentity,
          event.epoch,
          event.reason,
          nowRef.current(),
        );
        applyContext(
          remote,
          event.sender,
          transitionRevokesContext(event.reason),
        );
        return;
      }

      if (event.kind === 'session-state') {
        requiresRecoveryRef.current = true;
        setRequiresRecovery(true);
        callbacksRef.current.onSessionState?.(event.reason);
        return;
      }

      if (event.kind === 'consent') {
        callbacksRef.current.onConsent?.(event.choice);
        return;
      }

      callbacksRef.current.onPendingTransaction?.(
        event.action,
        event.id,
        event.chainId,
      );
    });
  }, [channel, applyContext]);

  // Suspended-tab resume: reconcile from the shared snapshot on wake.
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const snapshot = readWalletContextSnapshot();
      if (!snapshot) return;
      const current = contextRef.current;
      if (snapshot.epoch <= current.epoch) return;
      const identitySnapshot: WalletIdentity = {
        address: snapshot.account,
        chainId: snapshot.chainId,
      };
      applyContext(
        {
          ...snapshot,
          updatedAt: nowRef.current(),
          reason: snapshot.reason,
        },
        `snapshot:${walletContextKey(identitySnapshot)}`,
        transitionRevokesContext(snapshot.reason),
      );
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, applyContext]);

  const guard = useMemo(
    () => createContextGuard(() => contextRef.current.epoch),
    [],
  );

  const recoveryMessage = useMemo(() => {
    if (!requiresRecovery) return null;
    const wallet = describeContextRecovery(pendingTransition);
    if (wallet) return wallet.message;
    return 'Your session ended in another tab. Sign in again to continue.';
  }, [requiresRecovery, pendingTransition]);

  const canMutate = useMemo(
    () => contextAllowsMutation(identity, context, requiresRecovery),
    [identity, context, requiresRecovery],
  );

  const subscribe = useCallback(
    (handler: (event: CrossTabEvent) => void) =>
      channel ? channel.subscribe(handler) : () => undefined,
    [channel],
  );

  const publishSessionState = useCallback(
    (reason: SessionStateReason) => {
      channel?.publish({
        kind: 'session-state',
        reason,
        epoch: contextRef.current.epoch + 1,
      });
    },
    [channel],
  );

  const publishConsent = useCallback(
    (choice: ConsentChoice) => {
      channel?.publish({ kind: 'consent', choice });
    },
    [channel],
  );

  const publishPendingTransaction = useCallback(
    (
      action: PendingTransactionAction,
      id: string,
      chainId: number | null = null,
    ) => {
      channel?.publish({ kind: 'pending-transaction', action, id, chainId });
    },
    [channel],
  );

  return {
    context,
    pendingTransition,
    requiresRecovery,
    recoveryMessage,
    lastRemoteEvent,
    canMutate,
    guard,
    acknowledge: clearRecovery,
    subscribe,
    publishSessionState,
    publishConsent,
    publishPendingTransaction,
  };
}
