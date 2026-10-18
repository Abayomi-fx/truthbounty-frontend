/**
 * UI-FE-059 — Cross-tab transport for the shared context protocol.
 *
 * Prefers `BroadcastChannel` and falls back to `localStorage` `storage`
 * events. Two guarantees keep tabs converging without storms:
 *
 *  1. Loop suppression — a tab never processes an event it emitted itself.
 *  2. Replay suppression — a monotonic per-sender sequence number; an event
 *     whose `seq` is not newer than the last accepted one from that sender is
 *     dropped. Sender bookkeeping is bounded so a hostile frame cannot grow it
 *     without limit.
 *
 * Every frame is serialized through `serializeCrossTabEvent` (size bound +
 * protected-material scan) before it touches the wire, and every inbound frame
 * is re-validated through `parseCrossTabEvent`.
 */

import {
  buildCrossTabEvent,
  parseCrossTabEvent,
  serializeCrossTabEvent,
  type CrossTabEvent,
  type CrossTabPayload,
  type CrossTabStamp,
} from './protocol';

export const CROSS_TAB_CHANNEL_NAME = 'truthbounty:cross-tab:v1';
export const CROSS_TAB_STORAGE_KEY = 'truthbounty:cross-tab:sync:v1';

/** Bounded number of distinct senders tracked for replay suppression. */
export const CROSS_TAB_MAX_TRACKED_SENDERS = 32;

/** Minimal structural interface for a `BroadcastChannel` (test-injectable). */
export interface BroadcastChannelLike {
  postMessage(data: unknown): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  close(): void;
}

export interface CrossTabChannelEnvironment {
  /** Explicit channel (or null to disable BroadcastChannel). */
  channel?: BroadcastChannelLike | null;
  /** Storage used for the fallback transport. */
  storage?: Pick<Storage, 'setItem' | 'getItem'> | null;
  /** Event target that receives storage events from other tabs. */
  eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'> | null;
}

export interface CreateCrossTabChannelOptions {
  senderId: string;
  channelName?: string;
  storageKey?: string;
  env?: CrossTabChannelEnvironment;
  /** Injectable clock for deterministic `at` stamps. */
  now?: () => number;
}

export interface CrossTabChannel {
  readonly senderId: string;
  /** Publish an allow-listed payload. Stamps and validates before sending. */
  publish(payload: CrossTabPayload): void;
  /** Subscribe to validated events from sibling tabs. */
  subscribe(handler: (event: CrossTabEvent) => void): () => void;
  /** Release transports and listeners. */
  close(): void;
}

/** Generate a stable, non-sensitive tab identifier. */
export function createSenderId(random: () => number = Math.random): string {
  return `tab-${Math.floor(random() * 0xffffffff).toString(36)}-${Date.now().toString(36)}`;
}

function defaultChannel(channelName: string): BroadcastChannelLike | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(channelName) as unknown as BroadcastChannelLike;
  } catch {
    return null;
  }
}

class SenderLedger {
  private readonly seen = new Map<string, number>();

  /** Returns true when the (sender, seq) pair is new and should be delivered. */
  accept(sender: string, seq: number): boolean {
    const last = this.seen.get(sender);
    if (last !== undefined && seq <= last) return false;
    this.seen.set(sender, seq);
    // Re-insertion moves the sender to the end: bounded LRU.
    this.seen.delete(sender);
    this.seen.set(sender, seq);
    while (this.seen.size > CROSS_TAB_MAX_TRACKED_SENDERS) {
      const oldest = this.seen.keys().next().value;
      if (oldest === undefined) break;
      this.seen.delete(oldest);
    }
    return true;
  }
}

/**
 * Create a validated cross-tab channel. Inbound frames are parsed and
 * replay-checked before any subscriber sees them.
 */
export function createCrossTabChannel(
  options: CreateCrossTabChannelOptions,
): CrossTabChannel {
  const senderId = options.senderId;
  const channelName = options.channelName ?? CROSS_TAB_CHANNEL_NAME;
  const storageKey = options.storageKey ?? CROSS_TAB_STORAGE_KEY;
  const env = options.env ?? {};
  const now = options.now ?? Date.now;

  const channel =
    env.channel !== undefined ? env.channel : defaultChannel(channelName);
  const storage =
    env.storage !== undefined
      ? env.storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;
  const eventTarget =
    env.eventTarget !== undefined
      ? env.eventTarget
      : typeof window !== 'undefined'
        ? window
        : null;

  const handlers = new Set<(event: CrossTabEvent) => void>();
  const ledger = new SenderLedger();
  let seq = 0;

  const dispatch = (raw: unknown) => {
    const event = parseCrossTabEvent(raw);
    if (!event) return;
    if (event.sender === senderId) return; // never process our own events
    if (!ledger.accept(event.sender, event.seq)) return; // stale/replayed
    for (const handler of handlers) handler(event);
  };

  const onBroadcast = (event: { data: unknown }) => dispatch(event.data);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey || !event.newValue) return;
    try {
      dispatch(JSON.parse(event.newValue));
    } catch {
      // Malformed payload — ignore (never trust cross-tab input).
    }
  };

  channel?.addEventListener('message', onBroadcast);
  eventTarget?.addEventListener('storage', onStorage as EventListener);

  const transmit = (payload: CrossTabPayload) => {
    seq += 1;
    const stamp: CrossTabStamp = { sender: senderId, seq, at: now() };
    const event = buildCrossTabEvent(payload, stamp);
    const serialized = serializeCrossTabEvent(event);
    if (!serialized.ok || !serialized.value) {
      // Fail closed: never transmit an oversized or secret-bearing frame.
      return;
    }
    if (channel) {
      channel.postMessage(event);
      return;
    }
    if (storage) {
      try {
        storage.setItem(storageKey, serialized.value);
      } catch {
        // Storage unavailable — cross-tab sync is best-effort.
      }
    }
  };

  return {
    senderId,
    publish: transmit,
    subscribe(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    close() {
      channel?.removeEventListener('message', onBroadcast);
      eventTarget?.removeEventListener('storage', onStorage as EventListener);
      channel?.close();
      handlers.clear();
    },
  };
}
