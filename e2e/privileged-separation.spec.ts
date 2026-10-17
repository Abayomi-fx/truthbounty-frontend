import { test, expect, type Page } from '@playwright/test';

const STORY_ID = 'testing-privileged-separation-and-emergency-control-journey';

const SCENARIO = {
  operationsAuthorized: 'operations-authorized',
  operationConfirmation: 'operation-confirmation',
  retry: 'retry',
  denied: 'denied',
  revoked: 'revoked',
  expired: 'expired',
  wrongChain: 'wrong-chain',
  governanceAuthorized: 'governance-authorized',
  staleManifest: 'stale-manifest',
  timelockNotReady: 'timelock-not-ready',
  guardianAuthorized: 'guardian-authorized',
  guardianOverreach: 'guardian-overreach',
  emergencyPause: 'emergency-pause',
} as const;

async function open(
  page: Page,
  scenario: (typeof SCENARIO)[keyof typeof SCENARIO],
) {
  await page.goto(`/iframe.html?id=${STORY_ID}--${scenario}&viewMode=story`);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Optimism Sepolia privileged separation and emergency control journey/i,
    }),
  ).toBeVisible({ timeout: 90_000 });
}

function dangerousControls(page: Page) {
  return page.getByRole('button', {
    name: /pause|unpause|withdraw|grant|revoke|settle|upgrade/i,
  });
}

test.describe('UI-FE-068 — Privileged separation and emergency-control journeys', () => {
  test('pins the release and the active principal', async ({ page }) => {
    await open(page, SCENARIO.operationsAuthorized);
    await expect(page.getByTestId('pinned-release')).toContainText(
      'v2.0.0-sepolia',
    );
    await expect(page.getByTestId('pinned-release')).toContainText('11155420');
    await expect(page.getByTestId('active-principal')).toContainText(
      'operations',
    );
    await expect(page.getByTestId('active-principal')).toContainText(
      '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    );

    await open(page, SCENARIO.governanceAuthorized);
    await expect(page.getByTestId('active-principal')).toContainText(
      'governance',
    );
    await expect(page.getByTestId('active-principal')).toContainText(
      '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    );

    await open(page, SCENARIO.guardianAuthorized);
    await expect(page.getByTestId('active-principal')).toContainText('guardian');
    await expect(page.getByTestId('active-principal')).toContainText(
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    );
  });

  test('operations principal sees bounded queues, audit, and telemetry only', async ({
    page,
  }) => {
    await open(page, SCENARIO.operationsAuthorized);

    await expect(page.getByTestId('operations-context')).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'System Health & Protocol Infrastructure',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Security & Governance Invariants' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Read-Only Protocol Configuration',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Immutable Governance Audit References',
      }),
    ).toBeVisible();
    await expect(page.getByText('Retry unavailable').first()).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: /Authorize Retry Failed Event Indexer Batch #4410/i,
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', {
        name: /Authorize Re-sync Stale Dispute State Projection/i,
      }),
    ).toBeEnabled();

    await expect(page.getByTestId('governance-context')).toHaveCount(0);
    await expect(page.getByTestId('guardian-context')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Governed Execution Readiness' }),
    ).toHaveCount(0);
  });

  test('operation confirmation shows exact authority, target, consequence, and CONFIRM gate', async ({
    page,
  }) => {
    await open(page, SCENARIO.operationConfirmation);

    const dialog = page.getByRole('dialog', {
      name: 'Authorize Bounded Operation',
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Re-sync Stale Dispute State Projection');
    await expect(dialog).toContainText('PROTOCOL_OPERATOR');
    await expect(dialog).toContainText(
      'TruthBountyWeighted.sol (Dispute Engine)',
    );
    await expect(dialog).toContainText('Read-only indexing correction');
    await expect(dialog).toContainText(
      'Immutable cryptographic receipt will be generated',
    );

    const confirm = page.getByLabel(/Type CONFIRM to execute/i);
    const execute = dialog.getByRole('button', { name: 'Authorize & Execute' });
    await expect(execute).toBeDisabled();
    await confirm.fill('CONFIRM');
    await expect(execute).toBeEnabled();

    await confirm.focus();
    await expect(confirm).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(execute).toBeFocused();
  });

  test('denied, revoked, expired, and wrong-chain contexts fail closed', async ({
    page,
  }) => {
    const cases = [
      {
        scenario: SCENARIO.denied,
        reason: /not registered as the canonical protocol administrator/i,
      },
      {
        scenario: SCENARIO.revoked,
        reason: /revoked by governance/i,
      },
      {
        scenario: SCENARIO.expired,
        reason: /authorization expired/i,
      },
      {
        scenario: SCENARIO.wrongChain,
        reason: /not the pinned Optimism Sepolia release/i,
      },
    ] as const;

    for (const entry of cases) {
      await open(page, entry.scenario);
      await expect(page.getByTestId('admin-unauthorized-notice')).toBeVisible();
      await expect(page.getByText(entry.reason).first()).toBeVisible();
      await expect(page.getByTestId('system-health-grid')).toHaveCount(0);
      await expect(page.getByTestId('governance-context')).toHaveCount(0);
      await expect(page.getByTestId('guardian-context')).toHaveCount(0);
      await expect(dangerousControls(page)).toHaveCount(0);
    }
  });

  test('governance principal reviews upgrade and governed-unpause evidence only', async ({
    page,
  }) => {
    await open(page, SCENARIO.governanceAuthorized);

    await expect(page.getByTestId('governance-context')).toBeVisible();
    await expect(page.getByTestId('upgrade-review-container')).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Upgrade and Governed-Unpause Review',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Governed Execution Readiness' }),
    ).toBeVisible();
    await expect(page.getByTestId('governed-calls')).toContainText(
      'TimelockController#executeProposal',
    );
    await expect(
      page.getByTestId('current-transaction-lifecycle'),
    ).toContainText('Current Transaction Lifecycle');
    await expect(page.getByTestId('upgrade-affected-operations')).toBeVisible();
    await expect(page.getByText(/Emergency operations are not exposed/i)).toBeVisible();

    await expect(page.getByTestId('operations-context')).toHaveCount(0);
    await expect(page.getByTestId('guardian-context')).toHaveCount(0);
    await expect(
      page.getByRole('heading', {
        name: 'System Health & Protocol Infrastructure',
      }),
    ).toHaveCount(0);
    await expect(dangerousControls(page)).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Authorize & Execute' }),
    ).toHaveCount(0);
  });

  test('a stale manifest blocks governed execution with explicit reasons', async ({
    page,
  }) => {
    await open(page, SCENARIO.staleManifest);

    await expect(page.getByTestId('upgrade-review-blocked')).toBeVisible();
    await expect(
      page.getByText('Upgrade Execution Blocked'),
    ).toBeVisible();
    await expect(page.getByTestId('upgrade-blocking-reasons')).toContainText(
      'candidate manifest is not verified by a maintainer',
    );
    await expect(
      page.getByRole('button', { name: 'Authorize & Execute' }),
    ).toHaveCount(0);
    await expect(dangerousControls(page)).toHaveCount(0);
  });

  test('timelock-not-ready exposes blocking lifecycle reasons', async ({
    page,
  }) => {
    await open(page, SCENARIO.timelockNotReady);

    await expect(
      page.getByTestId('current-transaction-lifecycle'),
    ).toContainText('Timelock not ready');
    await expect(page.getByTestId('lifecycle-blocking-reasons')).toContainText(
      '48-hour timelock delay has not elapsed',
    );
    await expect(page.getByTestId('governed-execution-blocked')).toBeVisible();
    await expect(page.getByTestId('governed-calls')).toContainText(
      'TimelockController#executeProposal',
    );
    await expect(dangerousControls(page)).toHaveCount(0);
  });

  test('guardian principal cannot unpause, upgrade, settle, move treasury, or administer roles', async ({
    page,
  }) => {
    await open(page, SCENARIO.guardianAuthorized);

    await expect(page.getByTestId('guardian-context')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Guardian authority boundaries' }),
    ).toBeVisible();
    await expect(page.getByText('Emergency pause', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Upgrade / governed unpause', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Treasury', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Roles and settlement', { exact: true }),
    ).toBeVisible();

    await expect(page.getByTestId('operations-context')).toHaveCount(0);
    await expect(page.getByTestId('governance-context')).toHaveCount(0);
    await expect(
      page.getByRole('heading', {
        name: 'System Health & Protocol Infrastructure',
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Governed Execution Readiness' }),
    ).toHaveCount(0);
    await expect(dangerousControls(page)).toHaveCount(0);
  });

  test('guardian overreach and emergency pause terminate explicitly', async ({
    page,
  }) => {
    await open(page, SCENARIO.guardianOverreach);
    await expect(page.getByTestId('upgrade-review-unauthorized')).toBeVisible();
    await expect(
      page.getByText(
        'Guardian authority cannot unpause, upgrade, settle, move treasury, or administer roles.',
      ),
    ).toBeVisible();
    await expect(dangerousControls(page)).toHaveCount(0);

    await open(page, SCENARIO.emergencyPause);
    await expect(page.getByTestId('upgrade-review-unauthorized')).toBeVisible();
    await expect(
      page.getByText('Emergency pause is not exposed to the guardian context.'),
    ).toBeVisible();
    await expect(dangerousControls(page)).toHaveCount(0);
  });

  test('cross-role content never leaks between principals', async ({ page }) => {
    await open(page, SCENARIO.operationsAuthorized);
    await expect(page.getByTestId('operations-context')).toBeVisible();
    await expect(page.getByTestId('governance-context')).toHaveCount(0);
    await expect(page.getByTestId('guardian-context')).toHaveCount(0);
    await expect(
      page.getByText('Guardian authority boundaries'),
    ).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Governed Execution Readiness' }),
    ).toHaveCount(0);

    await open(page, SCENARIO.governanceAuthorized);
    await expect(page.getByTestId('governance-context')).toBeVisible();
    await expect(page.getByTestId('operations-context')).toHaveCount(0);
    await expect(page.getByTestId('guardian-context')).toHaveCount(0);
    await expect(
      page.getByRole('heading', {
        name: 'System Health & Protocol Infrastructure',
      }),
    ).toHaveCount(0);
    await expect(page.getByText('Guardian authority boundaries')).toHaveCount(0);

    await open(page, SCENARIO.guardianAuthorized);
    await expect(page.getByTestId('guardian-context')).toBeVisible();
    await expect(page.getByTestId('operations-context')).toHaveCount(0);
    await expect(page.getByTestId('governance-context')).toHaveCount(0);
    await expect(
      page.getByRole('heading', {
        name: 'System Health & Protocol Infrastructure',
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Governed Execution Readiness' }),
    ).toHaveCount(0);
  });

  test('journey reflows without horizontal overflow at approved widths', async ({
    page,
  }) => {
    for (const width of [375, 768, 1440]) {
      for (const scenario of [
        SCENARIO.operationsAuthorized,
        SCENARIO.governanceAuthorized,
        SCENARIO.guardianAuthorized,
      ] as const) {
        await page.setViewportSize({ width, height: 1000 });
        await open(page, scenario);
        const overflows = await page.evaluate(() => {
          const doc = document.documentElement;
          return (
            doc.scrollWidth > window.innerWidth ||
            document.body.scrollWidth > window.innerWidth
          );
        });
        expect(
          overflows,
          `horizontal overflow at ${width}px for ${scenario}`,
        ).toBe(false);
      }
    }
  });
});
