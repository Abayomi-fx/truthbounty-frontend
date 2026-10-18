/**
 * UI-FE-059 — Cross-tab protocol unit tests.
 *
 * Focus: bounded frames, strict re-validation of untrusted input, and the
 * privacy guarantee that no token/signature/protected payload can traverse the
 * channel.
 */

import {
  CROSS_TAB_MAX_BYTES,
  CROSS_TAB_PROTOCOL_VERSION,
  buildCrossTabEvent,
  containsProtectedMaterial,
  parseCrossTabEvent,
  serializeCrossTabEvent,
  type CrossTabEvent,
  type CrossTabPayload,
} from '../protocol';

const SENDER = 'tab-a';
const STAMP = { sender: SENDER, seq: 1, at: 1_700_000_000_000 };
const ACCOUNT = '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E';

function walletPayload(): CrossTabPayload {
  return {
    kind: 'wallet-context',
    reason: 'account-change',
    account: ACCOUNT,
    chainId: 10,
    epoch: 3,
  };
}

describe('cross-tab protocol — building & parsing', () => {
  it('round-trips a wallet-context event without extra fields', () => {
    const event = buildCrossTabEvent(walletPayload(), STAMP);
    expect(event.v).toBe(CROSS_TAB_PROTOCOL_VERSION);
    expect(event.sender).toBe(SENDER);
    expect(event.seq).toBe(1);

    const parsed = parseCrossTabEvent(event);
    expect(parsed).toEqual(event);
  });

  it('drops unknown/extra properties on parse', () => {
    const parsed = parseCrossTabEvent({
      ...buildCrossTabEvent(walletPayload(), STAMP),
      injected: 'x',
      admin: true,
    });
    expect(parsed).not.toBeNull();
    expect(parsed).not.toHaveProperty('injected');
    expect(parsed).not.toHaveProperty('admin');
  });

  it.each([
    ['wrong version', { ...buildCrossTabEvent(walletPayload(), STAMP), v: 2 }],
    ['unknown kind', { ...buildCrossTabEvent(walletPayload(), STAMP), kind: 'nope' }],
    ['unknown reason', { ...buildCrossTabEvent(walletPayload(), STAMP), reason: 'hijack' }],
    ['missing sender', { ...buildCrossTabEvent(walletPayload(), STAMP), sender: '' }],
    ['negative epoch', { ...buildCrossTabEvent(walletPayload(), STAMP), epoch: -1 }],
    ['non-number chain', { ...buildCrossTabEvent(walletPayload(), STAMP), chainId: '10' }],
    ['null payload', null],
    ['array payload', []],
  ])('rejects malformed frame: %s', (_label, frame) => {
    expect(parseCrossTabEvent(frame)).toBeNull();
  });

  it('rejects an account that is not a canonical 20-byte address', () => {
    const event = buildCrossTabEvent(
      { ...walletPayload(), account: '0x1234' as `0x${string}` },
      STAMP,
    );
    expect(parseCrossTabEvent(event)).toBeNull();
  });

  it('validates session-state, consent, and pending-transaction events', () => {
    expect(
      parseCrossTabEvent(
        buildCrossTabEvent(
          { kind: 'session-state', reason: 'expired', epoch: 2 },
          STAMP,
        ),
      ),
    ).toMatchObject({ kind: 'session-state', reason: 'expired' });

    expect(
      parseCrossTabEvent(
        buildCrossTabEvent({ kind: 'consent', choice: 'denied' }, STAMP),
      ),
    ).toMatchObject({ kind: 'consent', choice: 'denied' });

    expect(
      parseCrossTabEvent(
        buildCrossTabEvent(
          { kind: 'pending-transaction', action: 'registered', id: 'tx-1', chainId: 10 },
          STAMP,
        ),
      ),
    ).toMatchObject({ kind: 'pending-transaction', id: 'tx-1' });
  });
});

describe('cross-tab protocol — privacy guarantees', () => {
  it('flags secret-like keys and long hex signatures', () => {
    expect(containsProtectedMaterial('{"token":"abc"}')).toBe(true);
    expect(containsProtectedMaterial('{"signature":"0xdeadbeef"}')).toBe(true);
    expect(containsProtectedMaterial(`0x${'a'.repeat(64)}`)).toBe(true);
    expect(containsProtectedMaterial(`{"account":"${ACCOUNT}"}`)).toBe(false);
  });

  it('refuses to serialize a frame carrying a token', () => {
    const tainted = {
      ...buildCrossTabEvent({ kind: 'consent', choice: 'granted' }, STAMP),
      token: 'session-secret',
    } as unknown as CrossTabEvent;
    expect(serializeCrossTabEvent(tainted)).toEqual({ ok: false, value: null });
  });

  it('refuses to serialize a frame carrying a wallet signature', () => {
    const tainted = {
      ...buildCrossTabEvent({ kind: 'consent', choice: 'granted' }, STAMP),
      result: `0x${'b'.repeat(130)}`,
    } as unknown as CrossTabEvent;
    expect(serializeCrossTabEvent(tainted).ok).toBe(false);
  });

  it('rejects an oversized frame before it reaches a transporter', () => {
    const huge = {
      ...buildCrossTabEvent(
        { kind: 'pending-transaction', action: 'registered', id: 'x'.repeat(5000), chainId: 10 },
        STAMP,
      ),
    } as unknown as CrossTabEvent & { blob: string };
    huge.blob = 'z'.repeat(CROSS_TAB_MAX_BYTES + 1);
    expect(serializeCrossTabEvent(huge).ok).toBe(false);
    expect(parseCrossTabEvent(huge)).toBeNull();
  });

  it('serializes a clean frame', () => {
    const event = buildCrossTabEvent(walletPayload(), STAMP);
    const result = serializeCrossTabEvent(event);
    expect(result.ok).toBe(true);
    expect(result.value).toBeTruthy();
  });
});
