import { test, expect, type Page } from '@playwright/test';
import { requiredProviderUsage } from '../src/lib/security/provider-usage.mjs';
import { providers } from '../src/lib/security/provider-policy.mjs';
import { verifyObservedUsage } from '../scripts/provider-usage-verification.mjs';

type Observation = { scenario: string; origin: string; directive: string; success: boolean };
type Action = { role: 'button' | 'link'; name: string };
type Flow = { route: string; clicks: Action[]; visible: Action };
const requiredScenarios = ['rpc', 'projection', 'walletconnect', 'world-id', 'evidence'] as const;
const baseURL = 'http://127.0.0.1:4317';

function loadFlows(): Record<string, Flow[]> {
  if (!process.env.CSP_FLOW_PROFILE) {
    throw new Error('CSP_FLOW_PROFILE is required: supply reviewed real app routes/actions for RPC, projection, WalletConnect, World ID and evidence. No mocked fallback is permitted.');
  }
  const flows = JSON.parse(process.env.CSP_FLOW_PROFILE) as Record<string, Flow[]>;
  const actionValid = (action: Action) => action && ['button', 'link'].includes(action.role) && typeof action.name === 'string' && action.name.length > 0;
  for (const scenario of requiredScenarios) {
    if (!Array.isArray(flows[scenario]) || !flows[scenario].length) throw new Error(`Missing production flow: ${scenario}`);
    for (const flow of flows[scenario]) {
      if (!flow.route.startsWith('/') || new URL(flow.route, baseURL).origin !== baseURL || !Array.isArray(flow.clicks) || !flow.clicks.every(actionValid) || !actionValid(flow.visible)) {
        throw new Error(`Invalid production flow configuration: ${scenario}`);
      }
    }
  }
  return flows;
}

async function assertProductionDocument(page: Page, route = '/') {
  const response = await page.goto(route);
  expect(response, 'Next app must return a document').not.toBeNull();
  expect(response!.ok(), 'Production route must be available').toBe(true);
  const policy = response!.headers()['content-security-policy'];
  expect(policy).toBeTruthy();
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).toContain('upgrade-insecure-requests');
  expect(policy).not.toMatch(/\*|(?:^|\s)(?:https:|wss:)(?:\s|;)|'unsafe-eval'/);
  const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
  expect(nonce).toBeTruthy();
  const scripts = await page.locator('script').evaluateAll((nodes) => nodes
    .filter((node) => !node.getAttribute('type') || ['module', 'text/javascript'].includes(node.getAttribute('type')!))
    .map((node) => ({ nonce: (node as HTMLScriptElement).nonce, src: (node as HTMLScriptElement).src })));
  expect(scripts.length, 'Next bootstrap must be present, not an intercepted fixture').toBeGreaterThan(0);
  expect(scripts.some((script) => script.src.includes('/_next/'))).toBe(true);
  for (const script of scripts) expect(script.nonce, 'Middleware nonce must reach Next bootstrap scripts').toBe(nonce);
  return nonce;
}

test('real production middleware attaches fresh nonces to Next documents and bootstrap', async ({ page }) => {
  const first = await assertProductionDocument(page);
  const second = await assertProductionDocument(page);
  expect(second).not.toBe(first);
});

test('installed integrations exercise every permitted origin/directive through the production UI', async ({ browser }) => {
  const flows = loadFlows();
  const observations: Observation[] = [];
  for (const scenario of requiredScenarios) {
    // Fresh contexts prevent cached images from masquerading as current request evidence.
    const context = await browser.newContext({ baseURL, serviceWorkers: 'block', storageState: process.env.CSP_STORAGE_STATE || undefined });
    const page = await context.newPage();
    const violations: string[] = [];
    const pending = new Set<Promise<void>>();
    const captureErrors: string[] = [];
    await page.exposeFunction('recordCspDirective', (directive: string) => violations.push(directive));
    await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (event) => {
      void (window as unknown as { recordCspDirective: (value: string) => Promise<void> }).recordCspDirective(event.effectiveDirective);
    }));
    page.on('requestfinished', (request) => {
      const check = (async () => {
        if (request.serviceWorker()) return;
        const type = request.resourceType();
        const frame = request.frame();
        // Subresources owned by a third-party iframe do not prove our document's permissions.
        const directive = type === 'document' && frame.parentFrame() === page.mainFrame() ? 'frame-src'
          : frame === page.mainFrame() ? ({ fetch: 'connect-src', xhr: 'connect-src', eventsource: 'connect-src', image: 'img-src', font: 'font-src', stylesheet: 'style-src' } as Record<string, string>)[type] : undefined;
        if (!directive) return;
        const origin = new URL(request.url()).origin;
        if (origin === baseURL || !/^https?:/.test(origin)) return;
        const response = await request.response();
        observations.push({ scenario, origin, directive, success: Boolean(response?.ok()) });
      })().catch(() => { captureErrors.push('Unable to classify an application request'); });
      pending.add(check);
      void check.finally(() => pending.delete(check));
    });
    page.on('websocket', (socket) => {
      // A created socket alone is not a successful relay connection.
      socket.once('framereceived', () => observations.push({ scenario, origin: new URL(socket.url()).origin, directive: 'connect-src', success: true }));
    });
    try {
      for (const flow of flows[scenario]) {
        await assertProductionDocument(page, flow.route);
        for (const action of flow.clicks) await page.getByRole(action.role, { name: action.name, exact: true }).click();
        await expect(page.getByRole(flow.visible.role, { name: flow.visible.name, exact: true })).toBeVisible();
        // Allow actual SDK callbacks, image decode and relay messages to complete.
        await page.waitForLoadState('networkidle');
        await Promise.all(pending);
        if (scenario === 'evidence') {
          const images = page.locator('img[src^="https://ipfs.io/"], img[src^="https://dweb.link/"]');
          expect(await images.count(), 'Reviewed evidence fixture must render a gateway image').toBeGreaterThan(0);
          for (const image of await images.all()) await expect(image).toHaveJSProperty('complete', true);
          expect(await images.evaluateAll((nodes) => nodes.every((node) => (node as HTMLImageElement).naturalWidth > 0))).toBe(true);
        }
      }
      await expect.poll(() => {
        try {
          const entries = providers.filter((entry) => requiredProviderUsage.some((row) => row.provider === entry.id && row.scenario === scenario));
          verifyObservedUsage(entries, observations, requiredProviderUsage.filter((row) => row.scenario === scenario));
          return true;
        } catch { return false; }
      }, { timeout: 30_000, message: `${scenario}: each permission must have a successful browser observation` }).toBe(true);
      expect(captureErrors).toEqual([]);
      expect(violations, `${scenario} must not be broken by the narrowed CSP`).toEqual([]);
    } finally {
      await context.close();
      await Promise.all(pending);
    }
  }
  // No allowlist tuple is accepted merely because an SDK import appears in source.
  verifyObservedUsage(providers, observations);
});

test('production page preserves local workers and real analytics consent behavior', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { analyticsEvents: number }).analyticsEvents = 0;
    window.addEventListener('truthbounty:analytics', () => (window as unknown as { analyticsEvents: number }).analyticsEvents++);
  });
  await assertProductionDocument(page);
  const worker = await page.evaluate(() => new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(new Blob(['postMessage("ready")'], { type: 'text/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = (event) => { resolve(event.data); worker.terminate(); URL.revokeObjectURL(url); };
    worker.onerror = () => { worker.terminate(); URL.revokeObjectURL(url); reject(new Error('Production CSP blocked blob worker')); };
  }));
  expect(worker).toBe('ready');
  expect(await page.evaluate(() => (window as unknown as { analyticsEvents: number }).analyticsEvents)).toBe(0);
  await page.getByRole('button', { name: 'Allow optional analytics', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { analyticsEvents: number }).analyticsEvents)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Manage analytics preferences', exact: true }).click();
  await page.getByRole('button', { name: 'Reject optional analytics', exact: true }).click();
  await expect(page.getByText('Optional analytics is off.', { exact: true })).toBeVisible();
});
