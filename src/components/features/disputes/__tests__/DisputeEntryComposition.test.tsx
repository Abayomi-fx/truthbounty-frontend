import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAccount, useBlockNumber, useChainId, useReadContract } from 'wagmi';
import { DisputeEntryComposition } from '@/components/features/disputes/DisputeEntryComposition';
import { disputeDraftStorageKey } from '@/lib/dispute/draft';
import { DISPUTE_DRAFT_VERSION } from '@/app/types/dispute-entry';

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

const CLAIM = '42';
const WALLET = '0x000000000000000000000000000000000000000a';
const CHAIN = 11155420;
const BOND = 10n ** 18n;
const REASON = 'The provisional outcome double counted a verifier stake.';

const NOW_SECONDS = BigInt(Math.floor(Date.now() / 1000));

const DISPUTE_REGISTRY = '0x1111111111111111111111111111111111111111';
const CLAIM_REGISTRY = '0x2222222222222222222222222222222222222222';
const BOND_TOKEN = '0x3333333333333333333333333333333333333333';

const readRefetch = jest.fn(async () => undefined);

let requiredBond = BOND;

function installMocks() {
  mockedUseReadContract.mockImplementation(
    ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case 'disputePhase':
          return { data: 2, isLoading: false, refetch: readRefetch };
        case 'getDispute':
          return {
            data: {
              disputeId: 0n,
              challenger: '0x0000000000000000000000000000000000000000',
              openedAt: 0n,
            },
            isLoading: false,
            refetch: readRefetch,
          };
        case 'disputeWindow':
          return {
            data: { opensAt: NOW_SECONDS - 3600n, closesAt: NOW_SECONDS + 86_400n },
            isLoading: false,
            refetch: readRefetch,
          };
        case 'requiredDisputeBond':
          return { data: requiredBond, isLoading: false, refetch: readRefetch };
        case 'balanceOf':
          return { data: 100n * BOND, isLoading: false, refetch: readRefetch };
        default:
          return { data: undefined, isLoading: false, refetch: readRefetch };
      }
    }
  );
  mockedUseAccount.mockReturnValue({ address: WALLET, isConnected: true });
  mockedUseChainId.mockReturnValue(CHAIN);
  mockedUseBlockNumber.mockReturnValue({ data: 1234n });
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

function seedStoredDraft(overrides: Record<string, unknown> = {}) {
  window.localStorage.setItem(
    disputeDraftStorageKey(CLAIM),
    JSON.stringify({
      version: DISPUTE_DRAFT_VERSION,
      claimId: CLAIM,
      reason: 'Saved draft reason text.',
      evidence: [{ uri: 'https://example.com/saved' }],
      bondAtDraft: BOND.toString(),
      updatedAt: '2026-10-15T00:00:00.000Z',
      ...overrides,
    })
  );
}

const storedDraftJson = () =>
  window.localStorage.getItem(disputeDraftStorageKey(CLAIM));

const getSubmitButton = () =>
  screen.getByRole('button', { name: /open dispute/i }) as HTMLButtonElement;

beforeEach(() => {
  jest.clearAllMocks();
  requiredBond = BOND;
  installMocks();
  pinEnv();
});

afterEach(() => {
  unpinEnv();
});

describe('DisputeEntryComposition', () => {
  it('offers a stored draft for recovery on mount', async () => {
    seedStoredDraft();
    render(<DisputeEntryComposition claimId={CLAIM} />);

    await waitFor(() =>
      expect(screen.getByTestId('dispute-draft-banner')).toBeInTheDocument()
    );
    expect(screen.getByTestId('dispute-draft-banner')).toHaveTextContent(
      /saved dispute draft/i
    );
  });

  it('never persists prohibited secrets in the draft (acceptance: drafts preserve no prohibited secrets)', async () => {
    const user = userEvent.setup();
    render(<DisputeEntryComposition claimId={CLAIM} />);

    const reasonField = screen.getByLabelText(/reason for dispute/i);
    await user.type(
      reasonField,
      'verifier used my api_key=super-secret-value and password: hunter2'
    );

    await waitFor(() => expect(storedDraftJson()).toBeTruthy());
    const raw = storedDraftJson()!;
    expect(raw).not.toContain('super-secret-value');
    expect(raw).not.toContain('hunter2');
    expect(raw).toContain('[redacted]');
  });

  it('persists and recovers drafts across remounts', async () => {
    const user = userEvent.setup();
    const first = render(<DisputeEntryComposition claimId={CLAIM} />);
    await user.type(
      screen.getByLabelText(/reason for dispute/i),
      REASON
    );
    await waitFor(() => expect(storedDraftJson()).toBeTruthy());
    first.unmount();

    render(<DisputeEntryComposition claimId={CLAIM} />);
    await waitFor(() =>
      expect(screen.getByTestId('dispute-draft-banner')).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: /restore draft/i }));
    expect(screen.getByLabelText(/reason for dispute/i)).toHaveValue(REASON);
  });

  it('hands the mutation to the sink with pinned artifact authority when eligible', async () => {
    const user = userEvent.setup();
    const onOpenDispute = jest.fn();
    render(
      <DisputeEntryComposition claimId={CLAIM} onOpenDispute={onOpenDispute} />
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('dispute-eligibility-notice')
      ).toHaveAttribute('data-status', 'eligible')
    );

    await user.type(screen.getByLabelText(/reason for dispute/i), REASON);
    await waitFor(() => expect(getSubmitButton()).toBeEnabled());
    await user.click(getSubmitButton());

    expect(onOpenDispute).toHaveBeenCalledWith(
      expect.objectContaining({
        claimId: CLAIM,
        reason: REASON,
        bondAmount: BOND.toString(),
        artifact: expect.objectContaining({
          isPinned: true,
          artifactVersion: expect.any(String),
        }),
      })
    );
  });

  it('keeps the mutation unavailable until the contract authority is pinned', async () => {
    unpinEnv();
    const user = userEvent.setup();
    const onOpenDispute = jest.fn();
    render(
      <DisputeEntryComposition claimId={CLAIM} onOpenDispute={onOpenDispute} />
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('dispute-eligibility-notice')
      ).toHaveAttribute('data-status', 'protocol-unpinned')
    );

    await user.type(screen.getByLabelText(/reason for dispute/i), REASON);
    expect(getSubmitButton()).toBeDisabled();
    await user.click(getSubmitButton());
    expect(onOpenDispute).not.toHaveBeenCalled();
  });

  it('blocks the mutation on a contract-side bond change and re-enables it after acknowledgment', async () => {
    requiredBond = 2n * BOND;
    seedStoredDraft();
    const user = userEvent.setup();
    const onOpenDispute = jest.fn();
    render(
      <DisputeEntryComposition claimId={CLAIM} onOpenDispute={onOpenDispute} />
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('dispute-eligibility-notice')
      ).toHaveAttribute('data-status', 'bond-changed')
    );
    expect(getSubmitButton()).toBeDisabled();

    await user.click(
      screen.getByRole('button', { name: /use updated dispute bond/i })
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('dispute-eligibility-notice')
      ).toHaveAttribute('data-status', 'eligible')
    );

    // The acknowledged bond is persisted so reloads do not resurrect the stale one.
    await waitFor(() =>
      expect(storedDraftJson()).toContain((2n * BOND).toString())
    );

    await user.type(screen.getByLabelText(/reason for dispute/i), REASON);
    await waitFor(() => expect(getSubmitButton()).toBeEnabled());
    await user.click(getSubmitButton());
    expect(onOpenDispute).toHaveBeenCalledWith(
      expect.objectContaining({ bondAmount: (2n * BOND).toString() })
    );
  });

  it('discards the stored draft when the user discards it', async () => {
    seedStoredDraft();
    const user = userEvent.setup();
    render(<DisputeEntryComposition claimId={CLAIM} />);

    await waitFor(() =>
      expect(screen.getByTestId('dispute-draft-banner')).toBeInTheDocument()
    );
    await user.click(screen.getByRole('button', { name: /discard draft/i }));

    expect(storedDraftJson()).toBeNull();
    expect(screen.queryByTestId('dispute-draft-banner')).toBeNull();
  });
});
