/**
 * UI-FE-022 — Versioned protocol artifact for the dispute eligibility &
 * evidence-entry composition.
 *
 * The dispute contract interface is NOT frozen upstream, so this module pins
 * the exact interface this frontend was built against (`IDisputeRegistry`,
 * `IClaimRegistry`, ERC-20) under a single immutable `DISPUTE_ARTIFACT_VERSION`
 * string and the deployment release tag supplied through the environment.
 *
 * Fail-closed rules (mirroring V2-FE-013 / ADR-0001):
 *   - The dispute artifact is only `isPinned` when every required address is
 *     pinned via env for the active chain AND a real release tag is set.
 *   - Missing/empty/dummy/zero addresses produce explicit `disabledReasons`
 *     and every mutation path stays unavailable — UI context, wallet
 *     connection, API data, or fixtures never grant authority.
 */

'use client';

import { erc20Abi } from './verification-artifact';

export const DISPUTE_SUPPORTED_CHAINS = [10, 11155420] as const;
export type DisputeChainId = (typeof DISPUTE_SUPPORTED_CHAINS)[number];

/**
 * Immutable version of the pinned dispute interface. Bump this when the
 * upstream interface (IDisputeRegistry) changes and the ABI below is
 * regenerated.
 */
export const DISPUTE_ARTIFACT_VERSION = 'idispute-registry@v1.0.0';

// ---------------------------------------------------------------------------
// ABI fragments — generated from the canonical V2 dispute interface.
// `phase` is `IDisputeRegistry.ClaimPhase` enum-encoded as uint8
// (NONE = 0, VERIFICATION = 1, DISPUTE_WINDOW = 2, DISPUTE_ACTIVE = 3,
//  FINALIZED = 4).
// ---------------------------------------------------------------------------

export const disputeRegistryAbi = [
  {
    type: 'function',
    name: 'disputePhase',
    stateMutability: 'view',
    inputs: [{ name: 'claimId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'getDispute',
    stateMutability: 'view',
    inputs: [{ name: 'claimId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'disputeId', type: 'uint256' },
          { name: 'challenger', type: 'address' },
          { name: 'openedAt', type: 'uint64' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'disputeWindow',
    stateMutability: 'view',
    inputs: [{ name: 'claimId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'opensAt', type: 'uint64' },
          { name: 'closesAt', type: 'uint64' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'requiredDisputeBond',
    stateMutability: 'view',
    inputs: [{ name: 'claimId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'openDispute',
    stateMutability: 'payable',
    inputs: [
      { name: 'claimId', type: 'uint256' },
      { name: 'reasonDigest', type: 'string' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export { erc20Abi };

export interface DisputeArtifactAddresses {
  disputeRegistry: `0x${string}`;
  claimRegistry: `0x${string}`;
  bondToken: `0x${string}`;
}

export interface DisputeArtifact {
  chainId: DisputeChainId;
  releaseTag: string | null;
  artifactVersion: string;
  addresses: DisputeArtifactAddresses;
  /** True only when every required address AND the release tag are pinned. */
  isPinned: boolean;
  disabledReasons: string[];
}

/**
 * Environment snapshot used to resolve the artifact. Keys mirror
 * `NEXT_PUBLIC_*` env vars with optional per-chain suffixes (`_10`,
 * `_11155420`) that take precedence over the chain-agnostic value.
 */
export interface DisputeArtifactEnv {
  NEXT_PUBLIC_TRUTHBOUNTY_PROTOCOL_RELEASE_TAG?: string;
  NEXT_PUBLIC_TRUTHBOUNTY_DISPUTE_REGISTRY_ADDRESS?: string;
  NEXT_PUBLIC_TRUTHBOUNTY_CLAIM_REGISTRY_ADDRESS?: string;
  NEXT_PUBLIC_TRUTHBOUNTY_STAKING_TOKEN_ADDRESS?: string;
  [key: string]: string | undefined;
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const FORBIDDEN_RELEASE_TAGS = /dummy|placeholder|zero|todo|example/i;

function isUnsupportedChain(chainId: number): boolean {
  return !(DISPUTE_SUPPORTED_CHAINS as readonly number[]).includes(chainId);
}

/**
 * Pure artifact resolver. Exported separately from `getDisputeArtifact` so
 * tests can exercise it with a fabricated environment.
 */
export function resolveDisputeArtifact(
  env: DisputeArtifactEnv,
  chainId: number
): DisputeArtifact {
  const disabledReasons: string[] = [];

  if (isUnsupportedChain(chainId)) {
    disabledReasons.push(`chain ${chainId} is not a supported dispute chain`);
  }

  const chainSuffix = String(chainId);
  const readAddress = (baseKey: string): string | undefined => {
    const perChain = env[`${baseKey}_${chainSuffix}`];
    if (perChain && perChain.trim() !== '') return perChain.trim();
    const generic = env[baseKey];
    if (generic && generic.trim() !== '') return generic.trim();
    return undefined;
  };

  const rawDisputeRegistry = readAddress(
    'NEXT_PUBLIC_TRUTHBOUNTY_DISPUTE_REGISTRY_ADDRESS'
  );
  const rawClaimRegistry = readAddress(
    'NEXT_PUBLIC_TRUTHBOUNTY_CLAIM_REGISTRY_ADDRESS'
  );
  const rawBondToken = readAddress(
    'NEXT_PUBLIC_TRUTHBOUNTY_STAKING_TOKEN_ADDRESS'
  );
  const releaseTag =
    env.NEXT_PUBLIC_TRUTHBOUNTY_PROTOCOL_RELEASE_TAG?.trim() || null;

  const validate = (
    raw: string | undefined,
    label: string,
    reasons: string[]
  ): `0x${string}` | null => {
    if (!raw) {
      reasons.push(`${label} address is not pinned in the deployment release`);
      return null;
    }
    if (!EVM_ADDRESS_RE.test(raw)) {
      reasons.push(`${label} address is not a valid EVM address`);
      return null;
    }
    return raw.toLowerCase() as `0x${string}`;
  };

  const disputeRegistry = validate(
    rawDisputeRegistry,
    'DisputeRegistry',
    disabledReasons
  );
  const claimRegistry = validate(
    rawClaimRegistry,
    'ClaimRegistry',
    disabledReasons
  );
  const bondToken = validate(rawBondToken, 'BondToken', disabledReasons);

  if (!releaseTag) {
    disabledReasons.push(
      'protocol release tag is not pinned (NEXT_PUBLIC_TRUTHBOUNTY_PROTOCOL_RELEASE_TAG)'
    );
  } else if (FORBIDDEN_RELEASE_TAGS.test(releaseTag)) {
    disabledReasons.push(`release tag "${releaseTag}" is not a real release`);
  }

  return {
    chainId: chainId as DisputeChainId,
    releaseTag,
    artifactVersion: DISPUTE_ARTIFACT_VERSION,
    addresses: {
      disputeRegistry: disputeRegistry ?? ('' as `0x${string}`),
      claimRegistry: claimRegistry ?? ('' as `0x${string}`),
      bondToken: bondToken ?? ('' as `0x${string}`),
    },
    isPinned:
      disabledReasons.length === 0 &&
      Boolean(disputeRegistry && claimRegistry && bondToken && releaseTag),
    disabledReasons,
  };
}

/**
 * Resolve the active dispute artifact from the process environment.
 * Fails closed when the deployment release is not pinned for the chain.
 */
export function getDisputeArtifact(chainId: number): DisputeArtifact {
  return resolveDisputeArtifact(process.env as DisputeArtifactEnv, chainId);
}
