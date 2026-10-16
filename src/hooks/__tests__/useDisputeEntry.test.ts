import { renderHook } from '@testing-library/react';
import { useAccount, useBlockNumber, useChainId, useReadContract } from 'wagmi';
import { useDisputeEntry } from '@/hooks/useDisputeEntry';

jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useBlockNumber: jest.fn(),
  useChainId: jest.fn(),
  useReadContract: jest.fn(),
}));

const mockedUseAccount = useAccount as jest.Mock;
const mockedUseBlockNumber = useBlockNumber as jest.Mock;
const mockedUseChainId = useChainId as jest.Mock;
const mockedUseReadContract = useReadContract as jest.Mock;

const WALLET = '0x000000000000000000000000000000000000000a';
const CHAIN = 11155420;
const BOND = 10n ** 18n;
const BALANCE = 5n * BOND;
const NOW = 1_800_000_000n;

const DISPUTE_REGISTRY = '0x1111111111111111111111111111111111111111';
const CLAIM_REGISTRY = '0x2222222222222222222222222222222222222222';
const BOND_TOKEN = '0x3333333333333333333333333333333333333333';

const readRefetch = jest.fn(async () => undefined);

interface ReadResult {
  data: unknown;
  isLoading: boolean;
  refetch: jest.Mock;
}

let readStore: Record<string, () => ReadResult>;
let positionalTuples = false;

function installMocks() {
  mockedUseReadContract.mockImplementation(
    ({ functionName }: { functionName: string }) =>
      readStore[functionName]?.() ?? {
        data: undefined,
        isLoading: false,
        refetch: readRefetch,
      }
  );
  mockedUseAccount.mockReturnValue({ address: WALLET, isConnected: true });
  mockedUseChainId.mockReturnValue(CHAIN);
  mockedUseBlockNumber.mockReturnValue({ data: 1234n });
}

function setDefaultReads(
  overrides: Partial<Record<string, () => ReadResult>> = {}
) {
  readStore = {
    disputePhase: () => ({ data: 2, isLoading: false, refetch: readRefetch }),
    getDispute: () => ({
      data: positionalTuples
        ? [0n, '0x0000000000000000000000000000000000000000', 0n]
        : {
            disputeId: 0n,
            challenger: '0x0000000000000000000000000000000000000000',
            openedAt: 0n,
          },
      isLoading: false,
      refetch: readRefetch,
    }),
    disputeWindow: () => ({
      data: positionalTuples
        ? [NOW - 3600n, NOW + 3600n]
        : { opensAt: NOW - 3600n, closesAt: NOW + 3600n },
      isLoading: false,
      refetch: readRefetch,
    }),
    requiredDisputeBond: () => ({ data: BOND, isLoading: false, refetch: readRefetch }),
    balanceOf: () => ({ data: BALANCE, isLoading: false, refetch: readRefetch }),
    ...overrides,
  };
}

function pinEnv() {
  process.env.NEXT_PUBLIC_TRUTHBOUNTY_PROTOCOL_RELEASE_TAG = 'v2-dispute@v0.1.0';
  process.env.NEXT_PUBLIC_TRUTHBOUNTY_DISPUTE_REGISTRY_ADDRESS = DISPUTE_REGISTRY;
  process.env.NEXT_PUBLIC_TRUTHBOUNTY_CLAIM_REGISTRY_ADDRESS = CLAIM_REGISTRY;
  process.env.NEXT_PUBLIC_TRUTHBOUNTY_STAKING_TOKEN_ADDRESS = BOND_TOKEN;
}

function unpinEnv() {
  delete process.env.NEXT_PUBLIC_TRUTHBOUNTY_PROTOCOL_RELEASE_TAG;
  delete process.env.NEXT_PUBLIC_TRUTHBOUNTY_DISPUTE_REGISTRY_ADDRESS;
  delete process.env.NEXT_PUBLIC_TRUTHBOUNTY_CLAIM_REGISTRY_ADDRESS;
  delete process.env.NEXT_PUBLIC_TRUTHBOUNTY_STAKING_TOKEN_ADDRESS;
}

function renderEntry(overrides: Record<string, unknown> = {}) {
  return renderHook(() =>
    useDisputeEntry({
      claimId: '42',
      nowSecondsOverride: NOW,
      ...overrides,
    } as Parameters<typeof useDisputeEntry>[0])
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  positionalTuples = false;
  setDefaultReads();
  installMocks();
  pinEnv();
});

afterEach(() => {
  unpinEnv();
});

describe('useDisputeEntry', () => {
  it('derives eligibility from contract reads on a fully pinned chain', () => {
    const { result } = renderEntry();

    expect(result.current.artifact.isPinned).toBe(true);
    expect(result.current.eligibility.status).toBe('eligible');
    expect(result.current.canAttemptMutation).toBe(true);
    expect(result.current.snapshot?.requiredBond).toBe(BOND);
    expect(result.current.snapshot?.observedAtBlock).toBe(1234n);
  });

  it('issues no reads at all when the contract authority is not pinned', () => {
    unpinEnv();
    const { result } = renderEntry();

    expect(result.current.eligibility.status).toBe('protocol-unpinned');
    expect(result.current.canAttemptMutation).toBe(false);
    expect(mockedUseReadContract).toHaveBeenCalled();
    for (const call of mockedUseReadContract.mock.calls) {
      expect(call[0].query?.enabled).toBe(false);
    }
  });

  it('reads the pinned registry and bond token addresses', () => {
    renderEntry();

    const registryCalls = mockedUseReadContract.mock.calls
      .map((call) => call[0])
      .filter((args) => args.functionName === 'disputePhase');
    expect(registryCalls[0].address).toBe(DISPUTE_REGISTRY.toLowerCase());

    const balanceCall = mockedUseReadContract.mock.calls
      .map((call) => call[0])
      .find((args) => args.functionName === 'balanceOf');
    expect(balanceCall.address).toBe(BOND_TOKEN.toLowerCase());
  });

  it('derives existing-dispute from the contract dispute record', () => {
    setDefaultReads({
      getDispute: () => ({
        data: {
          disputeId: 7n,
          challenger: '0x000000000000000000000000000000000000000b',
          openedAt: NOW - 60n,
        },
        isLoading: false,
        refetch: readRefetch,
      }),
    });
    installMocks();

    const { result } = renderEntry();
    expect(result.current.eligibility).toEqual(
      expect.objectContaining({
        status: 'existing-dispute',
        disputeId: '7',
        challenger: '0x000000000000000000000000000000000000000b',
      })
    );
    expect(result.current.canAttemptMutation).toBe(false);
  });

  it('derives unsupported-phase from the contract phase', () => {
    setDefaultReads({
      disputePhase: () => ({ data: 4, isLoading: false, refetch: readRefetch }),
    });
    installMocks();

    const { result } = renderEntry();
    expect(result.current.eligibility).toEqual(
      expect.objectContaining({ status: 'unsupported-phase', phase: 'FINALIZED' })
    );
  });

  it('derives expired-window from the contract window', () => {
    setDefaultReads({
      disputeWindow: () => ({
        data: { opensAt: NOW - 7200n, closesAt: NOW - 1n },
        isLoading: false,
        refetch: readRefetch,
      }),
    });
    installMocks();

    const { result } = renderEntry();
    expect(result.current.eligibility.status).toBe('expired-window');
  });

  it('derives bond-changed when the draft bond no longer matches the contract', () => {
    const { result } = renderEntry({ bondAtDraft: BOND - 1n });

    expect(result.current.eligibility).toEqual(
      expect.objectContaining({
        status: 'bond-changed',
        requiredBond: BOND.toString(),
        bondAtDraft: (BOND - 1n).toString(),
      })
    );
    expect(result.current.canAttemptMutation).toBe(false);
  });

  it('derives insufficient-balance from the bond-token balance read', () => {
    setDefaultReads({
      balanceOf: () => ({ data: 1n, isLoading: false, refetch: readRefetch }),
    });
    installMocks();

    const { result } = renderEntry();
    expect(result.current.eligibility.status).toBe('insufficient-balance');
  });

  it('reports unsupported-chain from the active wallet chain', () => {
    mockedUseChainId.mockReturnValue(1);
    const { result } = renderEntry();

    expect(result.current.eligibility.status).toBe('unsupported-chain');
    expect(result.current.canAttemptMutation).toBe(false);
  });

  it('reports wallet-not-connected without an account', () => {
    mockedUseAccount.mockReturnValue({ address: undefined, isConnected: false });
    const { result } = renderEntry();

    expect(result.current.eligibility.status).toBe('wallet-not-connected');
  });

  it('fails closed to loading for an unresolvable claim id', () => {
    const { result } = renderEntry({ claimId: 'claim-xyz' });

    expect(result.current.snapshot).toBeNull();
    expect(result.current.eligibility.status).toBe('loading');
    expect(result.current.canAttemptMutation).toBe(false);
  });

  it('accepts "claim-N" style ids and positional tuples', () => {
    positionalTuples = true;
    const { result } = renderEntry({ claimId: 'claim-42' });

    expect(result.current.eligibility.status).toBe('eligible');
    expect(result.current.snapshot?.dispute.disputeId).toBe(0n);
  });

  it('stays in loading while a required read is still resolving', () => {
    setDefaultReads({
      requiredDisputeBond: () => ({
        data: undefined,
        isLoading: true,
        refetch: readRefetch,
      }),
    });
    installMocks();

    const { result } = renderEntry();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.eligibility.status).toBe('loading');
  });

  it('refetches every canonical read through refreshState', async () => {
    const { result } = renderEntry();
    await result.current.refreshState();

    expect(readRefetch).toHaveBeenCalledTimes(5);
  });
});
