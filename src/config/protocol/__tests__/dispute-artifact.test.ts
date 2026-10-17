import {
  DISPUTE_ARTIFACT_VERSION,
  DISPUTE_SUPPORTED_CHAINS,
  resolveDisputeArtifact,
  DisputeArtifact,
  DisputeArtifactEnv,
} from '@/config/protocol/dispute-artifact';

const PINNED_ENV: DisputeArtifactEnv = {
  NEXT_PUBLIC_TRUTHBOUNTY_PROTOCOL_RELEASE_TAG: 'v2-dispute@v0.1.0',
  NEXT_PUBLIC_TRUTHBOUNTY_DISPUTE_REGISTRY_ADDRESS:
    '0x1111111111111111111111111111111111111111',
  NEXT_PUBLIC_TRUTHBOUNTY_CLAIM_REGISTRY_ADDRESS:
    '0x2222222222222222222222222222222222222222',
  NEXT_PUBLIC_TRUTHBOUNTY_STAKING_TOKEN_ADDRESS:
    '0x3333333333333333333333333333333333333333',
};

const expectUnpinned = (artifact: DisputeArtifact, reason: RegExp) => {
  expect(artifact.isPinned).toBe(false);
  expect(artifact.disabledReasons.length).toBeGreaterThan(0);
  expect(artifact.disabledReasons.join('; ')).toMatch(reason);
};

describe('resolveDisputeArtifact', () => {
  it('resolves a pinned artifact when every address and the release tag are pinned', () => {
    const artifact = resolveDisputeArtifact(PINNED_ENV, 11155420);

    expect(artifact.isPinned).toBe(true);
    expect(artifact.chainId).toBe(11155420);
    expect(artifact.releaseTag).toBe('v2-dispute@v0.1.0');
    expect(artifact.artifactVersion).toBe(DISPUTE_ARTIFACT_VERSION);
    expect(artifact.disabledReasons).toHaveLength(0);
  });

  it('supports Optimism mainnet and Sepolia only', () => {
    expect([...DISPUTE_SUPPORTED_CHAINS]).toEqual([10, 11155420]);
    expect(resolveDisputeArtifact(PINNED_ENV, 10).isPinned).toBe(true);
  });

  it('normalizes addresses to lowercase', () => {
    const artifact = resolveDisputeArtifact(PINNED_ENV, 11155420);

    expect(artifact.addresses.disputeRegistry).toBe(
      '0x1111111111111111111111111111111111111111'
    );
  });

  it('prefers per-chain address suffixes over generic values', () => {
    const artifact = resolveDisputeArtifact(
      {
        ...PINNED_ENV,
        NEXT_PUBLIC_TRUTHBOUNTY_DISPUTE_REGISTRY_ADDRESS_10:
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      10
    );

    expect(artifact.addresses.disputeRegistry).toBe(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
  });

  it('fails closed on an unsupported chain', () => {
    const artifact = resolveDisputeArtifact(PINNED_ENV, 1);
    expectUnpinned(artifact, /not a supported dispute chain/);
  });

  it('fails closed when nothing is pinned at all', () => {
    expectUnpinned(resolveDisputeArtifact({}, 10), /not pinned/);
  });

  it('fails closed when the release tag is missing', () => {
    const env: DisputeArtifactEnv = { ...PINNED_ENV };
    delete env.NEXT_PUBLIC_TRUTHBOUNTY_PROTOCOL_RELEASE_TAG;
    expectUnpinned(resolveDisputeArtifact(env, 10), /release tag/);
  });

  it('fails closed on dummy/placeholder release tags', () => {
    expectUnpinned(
      resolveDisputeArtifact(
        {
          ...PINNED_ENV,
          NEXT_PUBLIC_TRUTHBOUNTY_PROTOCOL_RELEASE_TAG: 'placeholder-v2',
        },
        10
      ),
      /not a real release/
    );
    expectUnpinned(
      resolveDisputeArtifact(
        {
          ...PINNED_ENV,
          NEXT_PUBLIC_TRUTHBOUNTY_PROTOCOL_RELEASE_TAG: 'TODO-dispute',
        },
        10
      ),
      /not a real release/
    );
  });

  it('fails closed when the dispute registry is not pinned', () => {
    const env: DisputeArtifactEnv = { ...PINNED_ENV };
    delete env.NEXT_PUBLIC_TRUTHBOUNTY_DISPUTE_REGISTRY_ADDRESS;
    expectUnpinned(resolveDisputeArtifact(env, 10), /DisputeRegistry/);
  });

  it('fails closed when the claim registry is not pinned', () => {
    const env: DisputeArtifactEnv = { ...PINNED_ENV };
    delete env.NEXT_PUBLIC_TRUTHBOUNTY_CLAIM_REGISTRY_ADDRESS;
    expectUnpinned(resolveDisputeArtifact(env, 10), /ClaimRegistry/);
  });

  it('fails closed when the bond token is not pinned', () => {
    const env: DisputeArtifactEnv = { ...PINNED_ENV };
    delete env.NEXT_PUBLIC_TRUTHBOUNTY_STAKING_TOKEN_ADDRESS;
    expectUnpinned(resolveDisputeArtifact(env, 10), /BondToken/);
  });

  it('fails closed on malformed addresses', () => {
    expectUnpinned(
      resolveDisputeArtifact(
        {
          ...PINNED_ENV,
          NEXT_PUBLIC_TRUTHBOUNTY_DISPUTE_REGISTRY_ADDRESS: '0xdeadbeef',
        },
        10
      ),
      /not a valid EVM address/
    );
  });
});
