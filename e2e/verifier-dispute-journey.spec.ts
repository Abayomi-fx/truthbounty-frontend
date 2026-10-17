import { test, expect, type Page } from '@playwright/test';

const STORY_ID = 'testing-verifier-and-dispute-journey';

const SCENARIO = {
  eligibleCommit: 'eligible-commit',
  ineligible: 'ineligible',
  revealOpen: 'reveal-open',
  missedReveal: 'missed-reveal',
  wrongSalt: 'wrong-salt',
  replaced: 'replaced',
  slashed: 'slashed',
  tieRefund: 'tie-refund',
  expiredDispute: 'expired-dispute',
  indexingDelay: 'indexing-delay',
  reorg: 'reorg',
  appealOpen: 'appeal-open',
  appealResolved: 'appeal-resolved',
} as const;

async function open(
  page: Page,
  scenario: (typeof SCENARIO)[keyof typeof SCENARIO],
) {
  await page.goto(
    `/iframe.html?id=${STORY_ID}--${scenario}&viewMode=story`,
  );
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Optimism Sepolia verifier and dispute journey/i,
    }),
  ).toBeVisible();
}

function queue(page: Page, name: string | RegExp) {
  return page.getByRole('region', { name });
}

function outcomeRegion(page: Page) {
  return page.getByRole('region', { name: 'Recent verification outcomes' });
}

function settlementRegion(page: Page) {
  return page.getByRole('region', { name: /Settlement & payout/i });
}

test.describe('UI-FE-067 — Optimism Sepolia verifier and dispute journeys', () => {
  test('pins one release and keeps deadlines and economics canonical', async ({
    page,
  }) => {
    await open(page, SCENARIO.eligibleCommit);

    const release = page.getByTestId('pinned-release');
    await expect(release).toContainText('v2.0.0-sepolia');
    await expect(release).toContainText('11155420');
    await expect(release).toContainText('2.0.0');

    await expect(
      page.locator('time[datetime="2026-10-14T12:00:00.000Z"]').first(),
    ).toBeVisible();

    const disputeNotice = page.getByTestId('dispute-eligibility-notice');
    await expect(disputeNotice).toHaveAttribute('data-status', 'eligible');
    await expect(disputeNotice).toContainText(
      'Required bond 250000000000000000 wei',
    );
    await expect(disputeNotice).toContainText(
      'dispute window ends 2026-10-15T00:00:00.000Z',
    );

    await expect(
      page.getByRole('region', { name: /Stake weights/i }),
    ).toContainText('1500000000000000000 wei');
    await expect(
      page.getByRole('region', { name: /Stake weights/i }),
    ).toContainText('2000000000000000000 wei');
  });

  test('never infers protected choice or evidence before reveal', async ({
    page,
  }) => {
    await open(page, SCENARIO.eligibleCommit);

    await expect(page.locator('body')).not.toContainText(
      'COMMIT-CHOICE-MUST-STAY-SEALED',
    );
    await expect(page.locator('body')).not.toContainText(
      'COMMIT-EVIDENCE-MUST-STAY-SEALED',
    );
    await expect(
      page.getByText(
        'Your choice is sealed until the reveal phase.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Evidence sealed until the canonical reveal phase.',
        { exact: true },
      ),
    ).toBeVisible();
  });

  test('reveals evidence and choice only during the reveal phase', async ({
    page,
  }) => {
    await open(page, SCENARIO.revealOpen);

    await expect(page.getByText('REVEAL-CHOICE-VISIBLE')).toBeVisible();
    await expect(page.getByText('REVEAL-EVIDENCE-VISIBLE')).toBeVisible();
    await expect(
      queue(page, /Assigned and in-progress commitments/i),
    ).toContainText('In progress');
    await expect(
      page.getByRole('region', { name: 'Phase and deadlines' }),
    ).toContainText('reveal');
  });

  test('distinguishes eligible from ineligible verifier state', async ({
    page,
  }) => {
    await open(page, SCENARIO.eligibleCommit);

    await expect(
      page.getByRole('heading', { name: 'Eligible to verify' }),
    ).toBeVisible();
    await expect(
      queue(page, /Available verification queue/i),
    ).toContainText('Canonical verifier journey claim');

    await open(page, SCENARIO.ineligible);

    await expect(
      page.getByRole('heading', { name: 'Not eligible' }),
    ).toBeVisible();
    await expect(page.getByText(/Stake below the canonical verifier minimum/)).toBeVisible();
    await expect(page.getByText('Hidden claim')).toHaveCount(0);
    await expect(
      page.getByText('Work is hidden because eligibility is not confirmed.').first(),
    ).toBeVisible();
  });

  test('renders missed reveal, wrong salt, replacement, slash, and tie/refund explicitly', async ({
    page,
  }) => {
    const cases = [
      {
        scenario: SCENARIO.missedReveal,
        state: 'Missed reveal',
        outcome: 'Missed reveal — stake forfeited',
      },
      {
        scenario: SCENARIO.wrongSalt,
        state: 'Wrong salt',
        outcome: 'Wrong salt — reveal rejected',
      },
      {
        scenario: SCENARIO.replaced,
        state: 'Replaced',
        outcome: 'Submission replaced before inclusion',
      },
      {
        scenario: SCENARIO.slashed,
        state: 'Slashed',
        outcome: 'Slashed — invalid reveal',
      },
      {
        scenario: SCENARIO.tieRefund,
        state: 'Refunded',
        outcome: 'Tie — bond refunded',
      },
    ] as const;

    for (const entry of cases) {
      await open(page, entry.scenario);
      await expect(
        queue(page, /Assigned and in-progress commitments/i).getByText(
          entry.state,
          { exact: true },
        ),
      ).toBeVisible();
      await expect(outcomeRegion(page)).toContainText(entry.outcome);
    }
  });

  test('expired dispute windows fail closed and terminate explicitly', async ({
    page,
  }) => {
    await open(page, SCENARIO.expiredDispute);

    const notice = page.getByTestId('dispute-eligibility-notice');
    await expect(notice).toHaveAttribute('data-status', 'expired-window');
    await expect(notice).toContainText(
      'The dispute window for this claim closed on 2026-10-13T00:00:00.000Z.',
    );

    const submit = page.getByRole('button', {
      name: /Open dispute \(unavailable\)/i,
    });
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveAttribute('aria-disabled', 'true');
    await expect(
      page.getByTestId('dispute-action-availability'),
    ).toHaveAttribute('data-available', 'false');
  });

  test('indexing delay stays provisional until finality', async ({ page }) => {
    await open(page, SCENARIO.indexingDelay);

    await expect(
      page.getByText('Transaction confirmed; waiting for indexing.'),
    ).toBeVisible();

    const settlement = settlementRegion(page);
    await expect(settlement).toContainText('Confirming');
    await expect(settlement).toContainText('awaiting finality');
    await expect(settlement).not.toContainText('Paid');
  });

  test('a reorg removes success and offers explicit recovery', async ({
    page,
  }) => {
    await open(page, SCENARIO.reorg);

    await expect(
      page.getByText(
        'Transaction was affected by a chain reorganization.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Retry transaction' }),
    ).toBeVisible();

    const settlement = settlementRegion(page);
    await expect(settlement).toContainText('Reorged');
    await expect(settlement).toContainText('reorganised');
    await expect(settlement).not.toContainText('Paid');

    await expect(outcomeRegion(page)).toContainText(
      'Reorged — awaiting canonical outcome',
    );
    await expect(page.getByText(/Round advanced on-chain/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Refresh round' }),
    ).toBeVisible();
  });

  test('distinguishes provisional appeal outcomes from resolved outcomes', async ({
    page,
  }) => {
    await open(page, SCENARIO.appealOpen);

    await expect(
      page.getByRole('heading', { name: 'Appeal round progression' }),
    ).toBeVisible();
    await expect(page.getByText('ACTIVE', { exact: true })).toBeVisible();
    await expect(settlementRegion(page)).toContainText('Appeal pending');

    await open(page, SCENARIO.appealResolved);

    await expect(page.getByText('SETTLED', { exact: true })).toBeVisible();
    await expect(settlementRegion(page)).toContainText('Appeal settled');
    await expect(settlementRegion(page)).toContainText('Payout');
    await expect(settlementRegion(page)).toContainText('0.5');
    await expect(outcomeRegion(page)).toContainText(
      'Appeal resolved — upheld',
    );
  });

  test('tie/refund settlement shows the canonical payout, not a winner', async ({
    page,
  }) => {
    await open(page, SCENARIO.tieRefund);

    const settlement = settlementRegion(page);
    await expect(settlement).toContainText('Settled');
    await expect(settlement).toContainText('Payout');
    await expect(settlement).toContainText('0.25');
  });

  test('dispute form is keyboard reachable and preserves canonical economics', async ({
    page,
  }) => {
    await open(page, SCENARIO.eligibleCommit);

    const reason = page.getByLabel('Reason for dispute');
    await reason.focus();
    await expect(reason).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Remove evidence link 1' }),
    ).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(
      page.getByLabel('Evidence link 1', { exact: true }),
    ).toBeFocused();

    const submit = page.getByRole('button', { name: 'Open dispute' });
    await submit.focus();
    await expect(submit).toBeFocused();
    await expect(submit).toBeEnabled();
  });

  test('journey reflows without horizontal overflow at approved widths', async ({
    page,
  }) => {
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await open(page, SCENARIO.eligibleCommit);

      const overflows = await page.evaluate(() => {
        const doc = document.documentElement;
        return (
          doc.scrollWidth > window.innerWidth ||
          document.body.scrollWidth > window.innerWidth
        );
      });
      expect(overflows, `horizontal overflow at ${width}px`).toBe(false);
    }
  });
});
