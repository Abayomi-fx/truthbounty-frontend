/** Required production browser observations, NOT evidence that a rehearsal has passed.
 * Each tuple must be exercised by its named UI flow in test:csp-browser.
 * Keep this separate from permissions so appending an origin cannot inherit evidence. */
export const requiredProviderUsage = [
  {
    "provider": "optimism",
    "origin": "https://mainnet.optimism.io",
    "directive": "connect-src",
    "scenario": "rpc"
  },
  {
    "provider": "optimism",
    "origin": "https://sepolia.optimism.io",
    "directive": "connect-src",
    "scenario": "rpc"
  },
  {
    "provider": "alchemy",
    "origin": "https://opt-mainnet.g.alchemy.com",
    "directive": "connect-src",
    "scenario": "rpc"
  },
  {
    "provider": "indexer",
    "origin": "https://api.thegraph.com",
    "directive": "connect-src",
    "scenario": "projection"
  },
  {
    "provider": "wallet-relay",
    "origin": "https://relay.walletconnect.com",
    "directive": "connect-src",
    "scenario": "walletconnect"
  },
  {
    "provider": "wallet-relay",
    "origin": "wss://relay.walletconnect.com",
    "directive": "connect-src",
    "scenario": "walletconnect"
  },
  {
    "provider": "wallet-relay",
    "origin": "https://rpc.walletconnect.com",
    "directive": "connect-src",
    "scenario": "walletconnect"
  },
  {
    "provider": "wallet-verify",
    "origin": "https://verify.walletconnect.com",
    "directive": "connect-src",
    "scenario": "walletconnect"
  },
  {
    "provider": "wallet-verify",
    "origin": "https://verify.walletconnect.com",
    "directive": "frame-src",
    "scenario": "walletconnect"
  },
  {
    "provider": "wallet-verify",
    "origin": "https://verify.walletconnect.org",
    "directive": "connect-src",
    "scenario": "walletconnect"
  },
  {
    "provider": "wallet-verify",
    "origin": "https://verify.walletconnect.org",
    "directive": "frame-src",
    "scenario": "walletconnect"
  },
  {
    "provider": "wallet-images",
    "origin": "https://explorer-api.walletconnect.com",
    "directive": "connect-src",
    "scenario": "walletconnect"
  },
  {
    "provider": "wallet-images",
    "origin": "https://explorer-api.walletconnect.com",
    "directive": "img-src",
    "scenario": "walletconnect"
  },
  {
    "provider": "world-id",
    "origin": "https://id.worldcoin.org",
    "directive": "connect-src",
    "scenario": "world-id"
  },
  {
    "provider": "world-id",
    "origin": "https://id.worldcoin.org",
    "directive": "frame-src",
    "scenario": "world-id"
  },
  {
    "provider": "ipfs",
    "origin": "https://ipfs.io",
    "directive": "connect-src",
    "scenario": "evidence"
  },
  {
    "provider": "ipfs",
    "origin": "https://ipfs.io",
    "directive": "img-src",
    "scenario": "evidence"
  },
  {
    "provider": "dweb",
    "origin": "https://dweb.link",
    "directive": "connect-src",
    "scenario": "evidence"
  },
  {
    "provider": "dweb",
    "origin": "https://dweb.link",
    "directive": "img-src",
    "scenario": "evidence"
  }
];
