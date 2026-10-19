/**
 * @jest-environment node
 */
import { DEFAULT_CSP_ALLOWLIST, renderCspHeader } from '../csp-allowlist';

describe('DEFAULT_CSP_ALLOWLIST', () => {
  it('includes canonical Optimism RPC origins in connectSrc', () => {
    expect(DEFAULT_CSP_ALLOWLIST.connectSrc).toContain('https://mainnet.optimism.io');
    expect(DEFAULT_CSP_ALLOWLIST.connectSrc).toContain('https://sepolia.optimism.io');
    expect(DEFAULT_CSP_ALLOWLIST.connectSrc).not.toContain('https://optimistic.etherscan.io');
  });

  it('includes WalletConnect + Worldcoin origins in connectSrc', () => {
    expect(DEFAULT_CSP_ALLOWLIST.connectSrc).toContain('wss://relay.walletconnect.com');
    expect(DEFAULT_CSP_ALLOWLIST.connectSrc).toContain('https://id.worldcoin.org');
  });

  it('includes IPFS gateways in imgSrc', () => {
    expect(DEFAULT_CSP_ALLOWLIST.imgSrc).toContain('https://ipfs.io');
  });
});

describe('renderCspHeader', () => {
  it('renders strict defaults with nonce; no unsafe-inline in script-src in production', () => {
    const header = renderCspHeader({ nonce: 'abc123' });
    expect(header).toContain("frame-ancestors 'none'");
    expect(header).toContain("object-src 'none'");
    expect(header).toContain("base-uri 'self'");
    expect(header).toContain("form-action 'self'");
    expect(header).toContain("'nonce-abc123'");
    expect(header).not.toMatch(/script-src [^;]*unsafe-inline/);
  });

  it('refuses undeclared environment URLs instead of widening CSP', () => {
    expect(() => renderCspHeader({ nonce: 'x', envConnectUrls: ['https://api.example.com'] })).toThrow(/review/);
    expect(() => renderCspHeader({ nonce: 'x', envImgUrls: ['https://img.example.com'] })).toThrow(/review/);
    expect(renderCspHeader({ nonce: 'x', envConnectUrls: ['https://mainnet.optimism.io'] })).toContain('https://mainnet.optimism.io');
  });

  it('adds development relaxations only when development=true', () => {
    const prod = renderCspHeader({ nonce: 'n', development: false });
    const dev = renderCspHeader({ nonce: 'n', development: true });
    expect(prod).not.toContain("'unsafe-eval'");
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toMatch(/style-src [^;]*unsafe-inline/);
    expect(prod).not.toMatch(/script-src [^;]*unsafe-inline/);
  });
});
