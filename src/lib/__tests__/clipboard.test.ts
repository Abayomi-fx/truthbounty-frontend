import { copyPublicIdentifier, validatePastedIdentifier } from '../clipboard';

describe('copyPublicIdentifier', () => {
  it('copies the full source value, never a truncated display string', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    const result = await copyPublicIdentifier('0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E', 'address', { writeText });
    expect(result).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E');
  });

  it('reports unavailable and denied clipboard access without throwing', async () => {
    expect(await copyPublicIdentifier('0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E', 'address', null)).toBe('unavailable');
    expect(await copyPublicIdentifier('0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E', 'address', { writeText: jest.fn().mockRejectedValue(new Error('denied')) })).toBe('denied');
  });

  it('refuses to copy a value that does not match its declared identifier type', async () => {
    const writeText = jest.fn();
    expect(await copyPublicIdentifier('javascript:alert(1)', 'support-reference', { writeText })).toBe('invalid');
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe('validatePastedIdentifier', () => {
  it('trims outer whitespace and validates addresses while rejecting inner whitespace', () => {
    const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E';
    expect(validatePastedIdentifier('address', `  ${address}\n`)).toEqual({ ok: true, value: '0x742D35Cc6634c0532925A3b844BC9E7595f0eB1e' });
    expect(validatePastedIdentifier('address', `${address.slice(0, 10)} ${address.slice(10)}`)).toEqual({ ok: false, reason: 'whitespace' });
  });

  it('rejects Unicode confusables and paste injection', () => {
    expect(validatePastedIdentifier('support-reference', 'REF-１２３')).toEqual({ ok: false, reason: 'unsafe-characters' });
    expect(validatePastedIdentifier('support-reference', 'javascript:alert(1)')).toEqual({ ok: false, reason: 'invalid-format' });
    expect(validatePastedIdentifier('address', '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1Ｅ')).toEqual({ ok: false, reason: 'unsafe-characters' });
  });

  it('rejects addresses scoped to the wrong chain and a mismatched connected chain', () => {
    const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E';
    expect(validatePastedIdentifier('address', `eip155:1:${address}`, { expectedChainId: 10, currentChainId: 10 })).toEqual({ ok: false, reason: 'wrong-chain' });
    expect(validatePastedIdentifier('address', address, { expectedChainId: 10, currentChainId: 1 })).toEqual({ ok: false, reason: 'wrong-chain' });
  });

  it('validates and normalizes hashes, claims, calldata, CIDs, and references', () => {
    expect(validatePastedIdentifier('hash', `0x${'AB'.repeat(32)}`)).toEqual({ ok: true, value: `0x${'ab'.repeat(32)}` });
    expect(validatePastedIdentifier('claim-id', '42')).toEqual({ ok: true, value: '42' });
    expect(validatePastedIdentifier('calldata', '0x12345678')).toEqual({ ok: true, value: '0x12345678' });
    expect(validatePastedIdentifier('cid', 'QmYwAPJzv5CZsnAzt8auVZRn2tQQkDdqBvHThY6WxF8xFk').ok).toBe(true);
    expect(validatePastedIdentifier('support-reference', 'SUP-42_a.1')).toEqual({ ok: true, value: 'SUP-42_a.1' });
    expect(validatePastedIdentifier('calldata', '0x123')).toEqual({ ok: false, reason: 'invalid-format' });
  });
});
