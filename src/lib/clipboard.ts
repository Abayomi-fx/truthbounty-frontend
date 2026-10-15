import { getAddress, isAddress, isHex } from 'viem';

export type ClipboardResult = 'copied' | 'unavailable' | 'denied' | 'invalid';

export interface ClipboardWriter {
  writeText(value: string): Promise<void>;
}

/** Copy a full public identifier verbatim. Callers pass the source value, never its display form. */
export async function copyPublicIdentifier(
  value: string,
  kind: PastedIdentifierKind,
  clipboard: ClipboardWriter | null | undefined =
    typeof navigator === 'undefined' ? undefined : navigator.clipboard,
): Promise<ClipboardResult> {
  if (!validatePastedIdentifier(kind, value).ok) return 'invalid';
  if (!value || !clipboard || typeof clipboard.writeText !== 'function') return 'unavailable';
  try {
    await clipboard.writeText(value);
    return 'copied';
  } catch {
    return 'denied';
  }
}

export type PastedIdentifierKind = 'address' | 'hash' | 'cid' | 'claim-id' | 'calldata' | 'support-reference';
export type PasteValidationError = 'empty' | 'unsafe-characters' | 'whitespace' | 'invalid-format' | 'wrong-chain';

export type PastedIdentifierResult =
  | { ok: true; value: string }
  | { ok: false; reason: PasteValidationError };

export interface PasteValidationOptions {
  /** Chain encoded in a pasted `eip155:<chainId>:<address>` value, when present. */
  expectedChainId?: number;
  /** Connected chain; a supplied value must match the expected chain before use. */
  currentChainId?: number;
}

const CID_PATTERN = /^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,}|B[A-Z2-7]{20,}|z[1-9A-HJ-NP-Za-km-z]{20,}|F[0-9A-F]{20,})$/;
const CLAIM_ID_PATTERN = /^(?:[0-9]+|0x[0-9a-fA-F]{64}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$/;
const SUPPORT_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** Trim harmless outer whitespace, but reject ambiguous or executable pasted identifiers. */
export function validatePastedIdentifier(
  kind: PastedIdentifierKind,
  input: string,
  options: PasteValidationOptions = {},
): PastedIdentifierResult {
  const value = input.trim();
  if (!value) return { ok: false, reason: 'empty' };
  // Reject controls, bidi overrides, zero-width characters, and non-ASCII lookalikes.
  if (/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\uff00-\uffef]|[^\x00-\x7f]/u.test(value)) {
    return { ok: false, reason: 'unsafe-characters' };
  }
  if (/\s/.test(value)) return { ok: false, reason: 'whitespace' };

  if (options.expectedChainId !== undefined && options.currentChainId !== options.expectedChainId) {
    return { ok: false, reason: 'wrong-chain' };
  }

  let normalized = value;
  if (kind === 'address') {
    const scoped = /^eip155:([0-9]+):(0x[0-9a-fA-F]{40})$/.exec(value);
    if (scoped) {
      const pastedChainId = Number(scoped[1]);
      if (options.expectedChainId === undefined || pastedChainId !== options.expectedChainId) {
        return { ok: false, reason: 'wrong-chain' };
      }
      normalized = scoped[2];
    }
    if (!isAddress(normalized, { strict: false })) return { ok: false, reason: 'invalid-format' };
    normalized = getAddress(normalized.toLowerCase());
  } else if (kind === 'hash') {
    if (!isHex(value) || value.length !== 66) return { ok: false, reason: 'invalid-format' };
    normalized = value.toLowerCase();
  } else if (kind === 'cid') {
    if (!CID_PATTERN.test(value)) return { ok: false, reason: 'invalid-format' };
  } else if (kind === 'claim-id') {
    if (!CLAIM_ID_PATTERN.test(value)) return { ok: false, reason: 'invalid-format' };
    if (/^0x/i.test(value)) normalized = value.toLowerCase();
  } else if (kind === 'calldata') {
    if (!isHex(value) || value.length < 10 || value.length % 2 !== 0) return { ok: false, reason: 'invalid-format' };
  } else if (!SUPPORT_REFERENCE_PATTERN.test(value)) {
    return { ok: false, reason: 'invalid-format' };
  }

  return { ok: true, value: normalized };
}
