import {
  AppealProjectionError,
  loadAppealProjection,
  parseAppealProjection,
} from '@/lib/appeals/projection';
import {
  buildAppealProjection,
  FIXTURE_APPEAL_ID,
  FIXTURE_WALLET,
} from '@/__tests__/fixtures/appealProjection';
import type { AppealDecision } from '@/app/types/appeal';

const options = {
  appealId: FIXTURE_APPEAL_ID,
  userAddress: FIXTURE_WALLET,
  expectedChainId: 11155420,
};

describe('parseAppealProjection', () => {
  it('accepts a coherent projection', () => {
    const parsed = parseAppealProjection(buildAppealProjection(), options);

    expect(parsed.snapshot.appealId).toBe(FIXTURE_APPEAL_ID);
    expect(parsed.deadline.isActive).toBe(true);
    expect(parsed.stakeBounds.minStake).toBe('100000000000000000');
    expect(parsed.walletPosition.hasParticipated).toBe(false);
  });

  it.each([
    ['appealId mismatch', { appealId: '0x' + 'ff'.repeat(32) }, 'MALFORMED'],
    ['chain mismatch', { chainId: 10 }, 'CHAIN_MISMATCH'],
  ])('rejects %s', (_label, override, code) => {
    expect(() =>
      parseAppealProjection(buildAppealProjection(override), options)
    ).toThrow(expect.objectContaining({ code }));
  });

  it('rejects a non-object payload', () => {
    expect(() => parseAppealProjection('nope', options)).toThrow(
      AppealProjectionError
    );
  });

  it('rejects a position belonging to another wallet', () => {
    const payload = buildAppealProjection();
    payload.position.userAddress = `0x${'22'.repeat(20)}`;

    expect(() => parseAppealProjection(payload, options)).toThrow(
      /does not match the connected wallet/i
    );
  });

  it('rejects hasParticipated without existingDecision', () => {
    expect(() =>
      parseAppealProjection(
        buildAppealProjection({ position: { hasParticipated: true } }),
        options
      )
    ).toThrow(/existingDecision is required/i);
  });

  it('rejects existingDecision when the wallet has not participated', () => {
    expect(() =>
      parseAppealProjection(
        buildAppealProjection({
          position: { hasParticipated: false, existingDecision: 'SUPPORT' },
        }),
        options
      )
    ).toThrow(/must be absent/i);
  });

  it('rejects an invalid existingDecision', () => {
    expect(() =>
      parseAppealProjection(
        buildAppealProjection({
          position: {
            hasParticipated: true,
            existingDecision: 'MAYBE' as unknown as AppealDecision,
          },
        }),
        options
      )
    ).toThrow(/existingDecision is invalid/i);
  });

  it('rejects contradictory deadline flags', () => {
    const payload = buildAppealProjection();
    payload.deadline.isActive = false;

    expect(() => parseAppealProjection(payload, options)).toThrow(
      /contradictory/i
    );
  });

  it('rejects negative blocksRemaining', () => {
    const payload = buildAppealProjection();
    payload.deadline.blocksRemaining = -1;

    expect(() => parseAppealProjection(payload, options)).toThrow(
      /must not be negative/i
    );
  });

  it('rejects a malformed stake amount', () => {
    const payload = buildAppealProjection();
    payload.stakeBounds.minStake = '0.1 ETH';

    expect(() => parseAppealProjection(payload, options)).toThrow(
      /unexpected format/i
    );
  });

  it('rejects a malformed initiator address', () => {
    const payload = buildAppealProjection();
    payload.snapshot.initiatorAddress = '0xnothex';

    expect(() => parseAppealProjection(payload, options)).toThrow(
      /unexpected format/i
    );
  });

  it('rejects an unknown first round decision', () => {
    const payload = buildAppealProjection();
    (payload.snapshot as { firstRoundDecision: string }).firstRoundDecision =
      'PENDING';

    expect(() => parseAppealProjection(payload, options)).toThrow(
      /firstRoundDecision is invalid/i
    );
  });

  it('rejects a cross-section appealId mismatch', () => {
    const payload = buildAppealProjection();
    payload.deadline.appealId = `0x${'ff'.repeat(32)}`;

    expect(() => parseAppealProjection(payload, options)).toThrow(
      /deadline.appealId does not match/i
    );
  });
});

describe('loadAppealProjection', () => {
  it('loads through the injected fetcher', async () => {
    const fetcher = jest.fn(async () => buildAppealProjection());

    await expect(
      loadAppealProjection(FIXTURE_APPEAL_ID, { ...options, fetcher })
    ).resolves.toMatchObject({ snapshot: { appealId: FIXTURE_APPEAL_ID } });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the projection endpoint is missing', async () => {
    const fetcher = async () => {
      throw new AppealProjectionError('NOT_FOUND', 'Appeal not found.');
    };

    await expect(
      loadAppealProjection(FIXTURE_APPEAL_ID, { ...options, fetcher })
    ).rejects.toThrow(/Appeal not found/);
  });

  it('fails closed when the transport throws', async () => {
    const fetcher = async () => {
      throw new Error('network down');
    };

    await expect(
      loadAppealProjection(FIXTURE_APPEAL_ID, { ...options, fetcher })
    ).rejects.toThrow(/network down/);
  });
});

describe('default fetcher', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('reports NOT_FOUND for 404', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 404 })) as never;

    await expect(
      loadAppealProjection(FIXTURE_APPEAL_ID, options)
    ).rejects.toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
  });

  it('reports UNAUTHORIZED for 403', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 403 })) as never;

    await expect(
      loadAppealProjection(FIXTURE_APPEAL_ID, options)
    ).rejects.toThrow(expect.objectContaining({ code: 'UNAUTHORIZED' }));
  });

  it('reports UNAVAILABLE for a server error', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 502 })) as never;

    await expect(
      loadAppealProjection(FIXTURE_APPEAL_ID, options)
    ).rejects.toThrow(expect.objectContaining({ code: 'UNAVAILABLE' }));
  });

  it('reports UNAVAILABLE when the request cannot be sent', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as never;

    await expect(
      loadAppealProjection(FIXTURE_APPEAL_ID, options)
    ).rejects.toThrow(expect.objectContaining({ code: 'UNAVAILABLE' }));
  });

  it('reports MALFORMED when the body is not JSON', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Unexpected token');
      },
    })) as never;

    await expect(
      loadAppealProjection(FIXTURE_APPEAL_ID, options)
    ).rejects.toThrow(expect.objectContaining({ code: 'MALFORMED' }));
  });

  it('requests the appeal endpoint with no-store semantics', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => buildAppealProjection(),
    })) as never;

    await loadAppealProjection(FIXTURE_APPEAL_ID, options);

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/appeals/${FIXTURE_APPEAL_ID}`,
      expect.objectContaining({ cache: 'no-store' })
    );
  });
});
