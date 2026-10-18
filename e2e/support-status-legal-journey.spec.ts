import { test, expect, type Page } from '@playwright/test';

const STORY_ID = 'testing-support-status-security-and-legal-journey';

const SCENARIO = {
  supportValid: 'support-valid',
  supportValidation: 'support-validation',
  supportSecret: 'support-secret',
  supportDuplicate: 'support-duplicate',
  statusOperational: 'status-operational',
  statusDegraded: 'status-degraded',
  statusStale: 'status-stale',
  statusUnavailable: 'status-unavailable',
  statusMaintenance: 'status-maintenance',
  incidentFresh: 'incident-fresh',
  incidentStale: 'incident-stale',
  legalCurrent: 'legal-current',
  legalStale: 'legal-stale',
  legalReview: 'legal-review',
  legalRetired: 'legal-retired',
  consent: 'consent',
  disclosures: 'disclosures',
} as const;

async function open(
  page: Page,
  scenario: (typeof SCENARIO)[keyof typeof SCENARIO],
) {
  await page.goto(`/iframe.html?id=${STORY_ID}--${scenario}&viewMode=story`);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Optimism Sepolia support, status, security, and legal journey/i,
    }),
  ).toBeVisible({ timeout: 90_000 });
}

const SECRET = `0x${'ab'.repeat(32)}`;

test.describe('UI-FE-069 — Support, status, security, and legal journeys', () => {
  test('pins the release and keeps no-SLA/no-bounty copy explicit', async ({
    page,
  }) => {
    await open(page, SCENARIO.supportValid);
    await expect(page.getByTestId('pinned-release')).toContainText(
      'v2.0.0-sepolia',
    );
    await expect(page.getByTestId('pinned-release')).toContainText('11155420');
    await expect(
      page.getByTestId('support-expectations'),
    ).toContainText('No SLA and no bounty are promised.');
    await expect(
      page.getByRole('link', { name: 'Responsible disclosure' }),
    ).toBeVisible();

    await open(page, SCENARIO.disclosures);
    await expect(
      page.getByTestId('disclosure-expectations'),
    ).toContainText('No SLA and no bounty are promised.');
    await expect(
      page.getByRole('link', { name: 'Report a bug' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Protocol documentation' }),
    ).toBeVisible();
  });

  test('support validation rejects missing fields and accepts a valid request', async ({
    page,
  }) => {
    await open(page, SCENARIO.supportValidation);

    await page.getByRole('button', { name: 'Submit support request' }).click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Select a request category.')).toBeVisible();
    await expect(page.getByText('Provide at least 10 characters.')).toBeVisible();

    await page.getByLabel('Email').fill('claimant@example.test');
    await page.getByLabel('Category').selectOption('Claim issue');
    await page
      .getByLabel('Message')
      .fill('Please review the indexed claim projection.');
    await page.getByRole('button', { name: 'Submit support request' }).click();
    await expect(
      page.getByText('Support request recorded. Reference: SUP-2026-1014.'),
    ).toBeVisible();
  });

  test('support rejects and clears secret material without echoing it', async ({
    page,
  }) => {
    await open(page, SCENARIO.supportSecret);

    await page.getByLabel('Email').fill('claimant@example.test');
    await page.getByLabel('Category').selectOption('Wallet issue');
    await page.getByLabel('Message').fill(`My key is ${SECRET}`);
    await page.getByRole('button', { name: 'Submit support request' }).click();

    await expect(
      page.getByText(
        'Potential secret material detected. The message was cleared and not submitted.',
      ),
    ).toBeVisible();
    await expect(page.getByLabel('Message')).toHaveValue('');
    await expect(page.locator('body')).not.toContainText(SECRET);
  });

  test('support rejects a duplicate submission', async ({ page }) => {
    await open(page, SCENARIO.supportDuplicate);
    await page.getByRole('button', { name: 'Submit support request' }).click();
    await expect(
      page.getByText('A request with these details was already submitted.'),
    ).toBeVisible();
  });

  test('status states never fabricate uptime or infrastructure controls', async ({
    page,
  }) => {
    const cases = [
      {
        scenario: SCENARIO.statusOperational,
        tone: 'operational',
        message: 'All reported components are operating normally.',
      },
      {
        scenario: SCENARIO.statusDegraded,
        tone: 'degraded',
        message: 'Public API latency is elevated.',
      },
      {
        scenario: SCENARIO.statusStale,
        tone: 'stale',
        message: 'The latest public observation is stale.',
      },
      {
        scenario: SCENARIO.statusUnavailable,
        tone: 'unavailable',
        message: 'No current public observation is available.',
      },
      {
        scenario: SCENARIO.statusMaintenance,
        tone: 'degraded',
        message: 'Scheduled maintenance is in progress.',
      },
    ] as const;

    for (const entry of cases) {
      await open(page, entry.scenario);
      await expect(page.getByText('Service status', { exact: true }).first()).toBeVisible();
      await expect(page.getByTestId(`status-tone-${entry.tone}`).first()).toBeVisible();
      await expect(page.getByText(entry.message, { exact: false }).first()).toBeVisible();
      await expect(page.getByText(/\d+(\.\d+)?%\s*uptime/i)).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: /restart|pause|scale|deploy/i }),
      ).toHaveCount(0);
    }
  });

  test('incident freshness is explicit for fresh and stale observations', async ({
    page,
  }) => {
    await open(page, SCENARIO.incidentFresh);
    await expect(page.getByText('Fresh observation')).toBeVisible();
    await expect(
      page.getByText('RPC provider degraded; fallback active.'),
    ).toBeVisible();
    await expect(
      page.getByText('Within the public freshness window.'),
    ).toBeVisible();

    await open(page, SCENARIO.incidentStale);
    await expect(page.getByText('Stale observation')).toBeVisible();
    await expect(
      page.getByText('Indexer freshness threshold exceeded.'),
    ).toBeVisible();
    await expect(page.getByText('Not current.')).toBeVisible();
  });

  test('legal versions and effective dates are explicit', async ({ page }) => {
    await open(page, SCENARIO.legalCurrent);

    await expect(page.getByText('Version 1.0.0', { exact: false })).toBeVisible();
    await expect(page.getByText('Effective 2026-01-15', { exact: false })).toBeVisible();
    await expect(page.getByText('Published', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText('No service level agreements (SLAs) apply'),
    ).toBeVisible();
    await expect(
      page.getByLabel(
        'This clause is under review and not yet legally effective',
      ),
    ).toBeVisible();
    await expect(page.getByText('Under Review', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText('Draft content cannot be published as approved.'),
    ).toHaveCount(0);
  });

  test('stale and retired legal versions are not presented as current', async ({
    page,
  }) => {
    await open(page, SCENARIO.legalStale);
    await expect(page.getByText('Superseded', { exact: true })).toBeVisible();
    await expect(page.getByText('0.9.0', { exact: true })).toBeVisible();
    await expect(page.getByText(/2025/).first()).toBeVisible();
    await expect(page.getByText('1.0.0', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();

    await open(page, SCENARIO.legalRetired);
    await expect(page.getByText('Retired', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText(/Release v1\.9\.0 is retired/),
    ).toBeVisible();
    await expect(page.getByText(/v2\.0\.0-sepolia/).first()).toBeVisible();
  });

  test('review and draft copy cannot appear as approved policy', async ({
    page,
  }) => {
    await open(page, SCENARIO.legalReview);

    await expect(page.getByText('Under Review', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText(/NOT yet legally effective/),
    ).toBeVisible();
    await expect(
      page.getByText('Draft content cannot be published as approved.'),
    ).toBeVisible();
    await expect(
      page.getByText('Draft Versions (Not Published)'),
    ).toBeVisible();
    await expect(page.getByText('1.1.0-draft', { exact: true })).toBeVisible();
  });

  test('consent can be declined, renewed, and cleared', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {
        // ignore
      }
    });
    await open(page, SCENARIO.consent);

    await expect(page.getByText(/Version v2/)).toBeVisible();
    await expect(
      page.getByText(/effective 2026-10-01T00:00:00.000Z/),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Optional analytics' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Reject optional analytics' }).click();
    await expect(page.getByText('Optional analytics is off.')).toBeVisible();

    await page.getByRole('button', { name: 'Manage analytics preferences' }).click();
    await page.getByRole('button', { name: 'Allow optional analytics' }).click();
    await expect(page.getByText('Optional analytics is on.')).toBeVisible();

    await page.getByRole('button', { name: 'Manage analytics preferences' }).click();
    await page.getByRole('button', { name: 'Clear saved choice' }).click();
    await expect(
      page.getByRole('heading', { name: 'Optional analytics' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Allow optional analytics' }),
    ).toBeVisible();
  });

  test('disclosures fail closed and never promise an SLA or bounty', async ({
    page,
  }) => {
    await open(page, SCENARIO.disclosures);

    await expect(
      page.getByRole('region', { name: /economic/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/Economics unavailable|Bonds, allowances & economic risk/),
    ).toBeVisible();
    await expect(
      page.getByText(/guaranteed response|guaranteed bounty|SLA:/i),
    ).toHaveCount(0);
  });

  test('support form is keyboard reachable', async ({ page }) => {
    await open(page, SCENARIO.supportValidation);

    const email = page.getByLabel('Email');
    await email.focus();
    await expect(email).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Category')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Message')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Submit support request' }),
    ).toBeFocused();
  });

  test('journeys reflow without horizontal overflow at approved widths', async ({
    page,
  }) => {
    for (const width of [375, 768, 1440]) {
      for (const scenario of [
        SCENARIO.supportValid,
        SCENARIO.statusOperational,
        SCENARIO.legalCurrent,
        SCENARIO.consent,
        SCENARIO.disclosures,
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
