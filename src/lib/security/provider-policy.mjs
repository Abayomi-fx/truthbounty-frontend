/** Reviewed browser egress. Adding an SDK is not permission to contact every host it knows. */
export const providers = [
  { id: 'optimism', owner: 'wallet', purpose: 'Supported Optimism RPC transports', source: 'src/config/wagmi.ts', evidence: 'optimism', directives: ['connect-src'], origins: ['https://mainnet.optimism.io', 'https://sepolia.optimism.io'] },
  { id: 'alchemy', owner: 'wallet', purpose: 'Existing Optimism RPC fallback', source: 'src/config/chains.ts', evidence: 'https://opt-mainnet.g.alchemy.com', directives: ['connect-src'], origins: ['https://opt-mainnet.g.alchemy.com'] },
  { id: 'indexer', owner: 'projections', purpose: 'Configured graph projection and health requests', source: 'src/config/chains.ts', evidence: 'https://api.thegraph.com', directives: ['connect-src'], origins: ['https://api.thegraph.com'] },
  { id: 'wallet-relay', owner: 'wallet', purpose: 'WalletConnect encrypted session relay', source: 'src/config/wagmi.ts', evidence: '@rainbow-me/rainbowkit', directives: ['connect-src'], origins: ['https://relay.walletconnect.com', 'wss://relay.walletconnect.com', 'https://rpc.walletconnect.com'] },
  { id: 'wallet-verify', owner: 'wallet', purpose: 'WalletConnect origin verification frame', source: 'src/config/wagmi.ts', evidence: '@rainbow-me/rainbowkit', directives: ['connect-src', 'frame-src'], origins: ['https://verify.walletconnect.com', 'https://verify.walletconnect.org'] },
  { id: 'wallet-images', owner: 'wallet', purpose: 'WalletConnect wallet metadata and icons', source: 'src/config/wagmi.ts', evidence: '@rainbow-me/rainbowkit', directives: ['connect-src', 'img-src'], origins: ['https://explorer-api.walletconnect.com'] },
  { id: 'world-id', owner: 'identity', purpose: 'Existing World ID verification integration', source: 'src/components/features/worldcoin/WorldcoinVerifyButton.tsx', evidence: '@worldcoin/idkit', directives: ['connect-src', 'frame-src'], origins: ['https://id.worldcoin.org'] },
  { id: 'ipfs', owner: 'evidence', purpose: 'Explicit evidence gateway conversion', source: 'src/lib/security/evidence-sanitizer.ts', evidence: 'https://ipfs.io', directives: ['connect-src', 'img-src'], origins: ['https://ipfs.io'] },
  { id: 'dweb', owner: 'evidence', purpose: 'Canonical evidence URI gateway conversion', source: 'src/lib/validation/evidenceUri.ts', evidence: 'https://dweb.link', directives: ['connect-src', 'img-src'], origins: ['https://dweb.link'] },
];

export function validateProviders(entries = providers) {
  const ids = new Set();
  const permittedDirectives = new Set(['connect-src', 'img-src', 'frame-src', 'worker-src', 'style-src', 'font-src']);
  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id) || !entry.owner?.trim() || !entry.purpose?.trim() || !entry.source || !entry.evidence || !entry.origins.length || !entry.directives.length) {
      throw new Error('Provider needs a unique id, owner, purpose, usage evidence and scoped origins');
    }
    ids.add(entry.id);
    for (const directive of entry.directives) {
      if (!permittedDirectives.has(directive)) throw new Error('Invalid provider directive');
    }
    for (const origin of entry.origins) {
      const url = new URL(origin);
      if (!['https:', 'wss:'].includes(url.protocol) || url.origin !== origin || origin.includes('*') || url.username || url.password) {
        throw new Error('Provider origin must be an exact secure origin without credentials, paths or wildcards');
      }
      if (url.protocol === 'wss:' && entry.directives.some((d) => d !== 'connect-src')) throw new Error('WebSocket origins are connect-src only');
    }
  }
}

export function providerSources(directive) {
  validateProviders();
  return [...new Set(providers.filter((p) => p.directives.includes(directive)).flatMap((p) => p.origins))];
}

/** Environment values select reviewed origins; they never expand the policy. Do not echo URLs containing keys. */
export function assertReviewedEndpoint(value, directive = 'connect-src', development = false) {
  if (!value || (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\'))) return;
  let url;
  try { url = new URL(value); } catch { throw new Error('Malformed provider endpoint'); }
  if (url.username || url.password) throw new Error('Provider endpoint contains credentials');
  if (development && ['localhost', '127.0.0.1'].includes(url.hostname) && ['http:', 'ws:'].includes(url.protocol)) return;
  if (!providerSources(directive).includes(url.origin)) throw new Error('Undeclared provider endpoint: policy review required');
}
