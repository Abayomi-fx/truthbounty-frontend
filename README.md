
# 🔍 TruthBounty Frontend

![License:  MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF? logo=github-actions)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

Decentralized news verification platform and public-good interface for community-driven fact-checking on Optimism (EVM).

## 🌍 Why TruthBounty Frontend?

The TruthBounty Frontend is designed to make decentralized news verification **accessible, transparent, and usable** for everyone — not just blockchain experts.

It provides a clean, intuitive interface for:
- Submitting and verifying news claims
- Understanding verification outcomes
- Tracking reputation and rewards
- Participating in truth verification as a public good

This frontend translates complex cryptoeconomic systems into a **human-centered experience**.

## 🚀 Features

- ✅ **Submit & Verify Claims** - Community-driven fact-checking interface
- ✅ **Event-Derived Lifecycle Timeline** - Canonical claim state tracking with real-time updates (V2-FE-014)
- 🎯 **Reputation Dashboard** - Real-time reputation scoring and leaderboard

### Trust & Sybil warnings

A set of UI components warn users when their account is considered "low
trust" based on missing identity verification, low reputation, suspicious
patterns or a very new wallet.  Banners appear in the layout, and
explanations are available via tooltips and a modal.

You can simulate different states by storing a JSON object under
`localStorage.trustInfo`.  Example:

```js
localStorage.setItem('trustInfo', JSON.stringify({
  isVerified: false,
  reputation: 15,
  accountAgeDays: 2,
  suspicious: true,
}));
```

Reload the page to see how the warnings change.
- 💎 **Token Rewards** - Track and claim ERC-20 rewards on Optimism
- 🔐 **Worldcoin Authentication** - Sybil-resistant identity verification
- 📁 **IPFS Evidence Viewer** - Decentralized evidence storage and retrieval
- 🌓 **Dark/Light Mode** - Customizable user experience
- 📱 **Responsive Design** - Mobile-first, accessible UI
- ⚡ **Real-time Updates** - Live verification status and notifications

## 🧭 Core User Flow

1. User connects an EVM wallet (e.g. MetaMask, Coinbase Wallet) via RainbowKit
2. User authenticates via Worldcoin ID
3. News claims are submitted or reviewed
4. Verifications are performed with evidence
5. Reputation updates in real time
6. Rewards are tracked and claimed on-chain

## 🌱 Ecosystem Alignment (EVM, IPFS & Public Goods)

TruthBounty Frontend is aligned with open-source and public-good ecosystems:

- **Ethereum & Optimism** – secure, scalable reward settlement
- **EVM Wallets** – RainbowKit connect modal for all EVM-compatible wallets
- **IPFS** – decentralized evidence access
- **Worldcoin ID** – Sybil-resistant identity
- **Drips Network** – sustainable open-source maintenance

The UI is intentionally chain-agnostic, enabling seamless expansion across ecosystems without redesign.

## 🔐 Security & Threat Model

TruthBounty Frontend publishes its security posture as reviewable V2 artifacts:

- **[docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md)** — trust boundaries, threat actors, threat/mitigation matrix, fail-closed posture, telemetry redaction rules, and maintainer sign-off.
- **[docs/UI_STATE_MODEL.md](./docs/UI_STATE_MODEL.md)** — canonical UI state model (loading, empty, stale, rejected, failed, pending, confirmed, finalized, reorged) with per-surface applicability and accessibility contracts.

**Authority model:** smart contracts are authoritative for protocol mutation; the API is a projection / read layer; the frontend never fabricates protocol outcomes and fails closed on integrity uncertainty.

**Privacy protections:** Evidence URLs and metadata are displayed in privacy-preserving format to prevent tracking and metadata leakage while maintaining verifiability. Full URLs available via clipboard. See [EVIDENCE_PRIVACY_MODEL.md](./docs/EVIDENCE_PRIVACY_MODEL.md) and [IMPLEMENTATION_V2_FE_EVIDENCE_PRIVACY.md](./IMPLEMENTATION_V2_FE_EVIDENCE_PRIVACY.md).

Related security references: [SECURITY_HEADERS.md](./docs/SECURITY_HEADERS.md), [SIWE_AUTH.md](./docs/SIWE_AUTH.md), [CONTRACT_ARTIFACTS.md](./docs/CONTRACT_ARTIFACTS.md).

## ⚙️ Tech Stack

### Frontend Core

| Technology | Purpose |
|------------|---------|
| **Next.js 14+** | React framework with App Router |
| **TypeScript** | Type-safe development |
