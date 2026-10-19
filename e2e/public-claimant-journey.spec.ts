import { test, expect, type Page } from '@playwright/test';

const STORY_ID = 'testing-public-and-claimant-journey';

const SCENARIO = {
  happyPath: 'happy-path',
  walletRejected: 'wallet-rejected',
  reverted: 'reverted',
  replaced: 'replaced',
  indexingDelay: 'indexing-delay',
  reorg: 'reorg',
  evidenceOutage: 'evidence-outage',
  reloadRecovery: 'reload-recovery',
  unsupportedChain: 'unsupported-chain',
  guest: 'guest',
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
      name: /Optimism Sepolia public and claimant journey/i,
    }),
  ).toBeVisible({ timeout: 90_000 });
}

function claimsTable(page: Page) {
  return page.getByRole('table', { name: 'Active claims' });
}

function transactionCenter(page: Page) {
  return page.getByRole('region', { name: 'Persisted transactions' });
}

test.describe('UI-FE-066 — Optimism Sepolia public and claimant journeys', () => {
  test('pins the release, chain, and test account', async ({ page }) => {
    await open(page, SCENARIO.happyPath);

    const release = page.getByTestId('pinned-release');
    await expect(release).toContainText('v2.0.0-sepolia');
    await expect(release).toContainText('11155420');
    await expect(release).toContainText('2.0.0');
    await expect(page.getByTestId('test-account')).toContainText(
      '0x742d35Cc6634C0532925a3b844Bc9e7595f0eB1E',
    );
  });

  test('public exploration filters and searches claims without a wallet', async ({
    page,
  }) => {
    await open(page, SCENARIO.happyPath);

    const table = claimsTable(page);
    const rows = table.locator(':scope > tbody > tr');
    await expect(table).toBeVisible();
    await expect(rows).toHaveCount(3);
    await expect(table).toContainText(
      'Optimism Sepolia claimant journey claim',
    );

    await page.getByRole('button', { name: 'Verified', exact: true }).click();
    await expect(rows).toHaveCount(1);
    await expect(table).toContainText('Evidence outage recovery claim');

    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.getByLabel('Search claims').fill('reorg');
    await expect(rows).toHaveCount(1);
    await expect(table).toContainText('Reorg settlement claim');
  });

  test('claim detail shows canonical funding, evidence, verification, and finality', async ({
    page,
  }) => {
    await open(page, SCENARIO.happyPath);

    const detail = page.getByRole('region', {
      name: /Claim detail, evidence, funding, and settlement/i,
    });
    await expect(detail).toBeVisible();
    await expect(page.getByLabel('Status: Verified')).toBeVisible();
    await expect(page.getByText('100 ETH', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('500 ETH', { exact: true }).first()).toBeVisible();
    await expect(
      detail.getByRole('heading', { name: 'Verification Breakdown' }),
    ).toBeVisible();
    await expect(
      detail.getByRole('heading', { name: 'Settlement', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Finalized', { exact: true }).first()).toBeVisible();
    await expect(
      detail.getByRole('heading', { name: 'Evidence', exact: true }),
    ).toBeVisible();
  });

  test('claim detail keeps provisional settlement distinct from finalized state', async ({
    page,
  }) => {
    await open(page, SCENARIO.reorg);

    await expect(page.getByLabel('Status: Disputed')).toBeVisible();
    await expect(page.getByText('Confirming Settlement')).toBeVisible();
    await expect(
      page.getByText('Settlement is pending finalization. This may take a few minutes.'),
    ).toBeVisible();
  });

  test('claimant dashboard exposes personal metrics and actions', async ({
    page,
  }) => {
    await open(page, SCENARIO.happyPath);

    await expect(page.getByTestId('claimant-dashboard')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Personal claimant metrics' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'What Needs Your Attention' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Recent Owned Claims' }),
    ).toBeVisible();
    await expect(
      page.getByText('Claimable Rewards', { exact: true }),
    ).toBeVisible();
  });

  test('guest and unsupported-chain contexts fail closed', async ({ page }) => {
    await open(page, SCENARIO.guest);
    await expect(
      page.getByText('Connect Wallet for Claimant Metrics'),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Connect & Verify/i }),
    ).toBeVisible();

    await open(page, SCENARIO.unsupportedChain);
    await expect(page.getByText(/Unsupported Network \(Ethereum\)/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Switch to Optimism' }),
    ).toBeVisible();
  });

  test('claim draft is prefilled and review remains gated on evidence', async ({
    page,
  }) => {
    await open(page, SCENARIO.happyPath);

    await expect(page.getByLabel(/^Title/)).toHaveValue(
      'Optimism Sepolia claimant evidence claim',
    );
    await expect(page.getByLabel(/^Category/)).toHaveValue('Technology');
    await expect(page.getByLabel(/^Impact Level/)).toHaveValue('High');
    await expect(page.getByLabel(/^Source URL/)).toHaveValue(
      'https://evidence.example.test/claim-source',
    );
    await expect(
      page.getByRole('button', { name: 'Submit to Blockchain' }),
    ).toBeEnabled();
    await expect(page.getByText('Claim Created Successfully!')).toBeVisible();
    await expect(
      page.getByText('claim-639', { exact: true }),
    ).toBeVisible();

    await open(page, SCENARIO.evidenceOutage);
    await expect(
      page.getByText(
        'Evidence integrity could not be verified. Re-upload before submitting.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Submit to Blockchain' }),
    ).toBeDisabled();
  });

  test('evidence outage, integrity failure, and retry are explicit', async ({
    page,
  }) => {
    await open(page, SCENARIO.evidenceOutage);

    await expect(
      page.getByText(
        'The connection failed. You can retry without choosing the file again.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Retry upload' }),
    ).toBeVisible();
    await expect(
      page.getByText(/Integrity check failed:/),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Choose file again' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Upload verified: the stored data matches your file.',
      ),
    ).toBeVisible();
  });

  test('wallet rejection, revert, and replacement expose recovery', async ({
    page,
  }) => {
    await open(page, SCENARIO.walletRejected);
    await expect(page.getByText('Transaction rejected.')).toBeVisible();
    await expect(
      page.getByText('Wallet rejected the transaction request.').first(),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Retry transaction' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Submission Failed' }),
    ).toBeVisible();

    await open(page, SCENARIO.reverted);
    await expect(page.getByText('Transaction reverted.').first()).toBeVisible();
    await expect(
      page.getByText('Execution reverted by the contract.').first(),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Retry transaction' }),
    ).toBeVisible();

    await open(page, SCENARIO.replaced);
    await expect(
      page.getByText('Transaction was replaced.').first(),
    ).toBeVisible();
    await expect(
      page.getByText('Replaced by a higher-fee transaction.').first(),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Retry transaction' }),
    ).toBeVisible();
  });

  test('indexing delay and reorg keep confirmation separate from finality', async ({
    page,
  }) => {
    await open(page, SCENARIO.indexingDelay);
    await expect(
      page.getByText('Transaction confirmed; waiting for indexing.'),
    ).toBeVisible();
    await expect(page.getByText('Protocol Data May Be Stale')).toBeVisible();
    await expect(
      transactionCenter(page),
    ).toContainText(
      'Projection lag. Chain evidence is preserved while the API catches up.',
    );

    await open(page, SCENARIO.reorg);
    await expect(
      page.getByText(
        'Transaction was affected by a chain reorganization.',
      ).first(),
    ).toBeVisible();
    await expect(
      page.getByText('Receipt orphaned by a chain reorganization.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Retry transaction' }),
    ).toBeVisible();
    await expect(page.getByText('Partial Data Degradation')).toBeVisible();
    await expect(transactionCenter(page)).toContainText('Reorg recovery:');
  });

  test('transaction center restores saved references after reload', async ({
    page,
  }) => {
    await open(page, SCENARIO.reloadRecovery);

    const center = transactionCenter(page);
    await expect(center).toBeVisible();
    await expect(
      page.getByText(
        /Saved references survive reload and reconnect on this browser/,
      ),
    ).toBeVisible();
    await expect(center.locator('article')).toHaveCount(7);
    await expect(center).toContainText('Optimism Sepolia');
    await expect(center).toContainText('Recovery details for');
    await expect(page.getByLabel(/^Title/)).toHaveValue(
      'Optimism Sepolia claimant evidence claim',
    );
  });

  test('public exploration and claim draft are keyboard reachable', async ({
    page,
  }) => {
    await open(page, SCENARIO.happyPath);

    const search = page.getByLabel('Search claims');
    await search.focus();
    await expect(search).toBeFocused();
    await search.fill('claim');
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Clear search' }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Filter' }),
    ).toBeFocused();

    const title = page.getByLabel(/^Title/);
    await title.focus();
    await expect(title).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel(/^Category/)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel(/^Impact Level/)).toBeFocused();

    await page.getByRole('button', { name: 'Edit Details' }).focus();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Cancel' }).nth(1),
    ).toBeFocused();

    await page
      .getByRole('button', { name: 'View Claim', exact: true })
      .focus();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Create Another' }).first(),
    ).toBeFocused();
  });

  test('journey reflows without horizontal overflow at approved widths', async ({
    page,
  }) => {
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await open(page, SCENARIO.happyPath);

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
