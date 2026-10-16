import { test, expect } from '@playwright/test';
import { buildSecurityHeaders } from '../src/lib/security/headers';

// Browser enforcement of production headers, not a live wallet transaction.
test('wallet, IPFS, image, worker and analytics egress obey production CSP', async ({ page }) => {
  const nonce = 'cspSmokeNonce123';
  await page.route('https://csp-smoke.invalid/**', (route) => route.fulfill({
    contentType: 'text/html', headers: buildSecurityHeaders({ nonce }),
    body: `<html><body><script nonce="${nonce}">window.violations=[]; document.addEventListener('securitypolicyviolation', e => window.violations.push(e.effectiveDirective));</script></body></html>`,
  }));
  await page.route('https://rpc.walletconnect.com/**', (route) => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, body: '{}' }));
  await page.route('https://ipfs.io/**', (route) => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, body: 'evidence' }));
  await page.route('https://explorer-api.walletconnect.com/**', (route) => route.fulfill({
    contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6LcAAAAAASUVORK5CYII=', 'base64'),
  }));
  let unexpectedNetwork = 0;
  await page.route('https://undeclared.invalid/**', (route) => { unexpectedNetwork++; return route.abort(); });
  await page.goto('https://csp-smoke.invalid/');
  const result = await page.evaluate(async () => {
    const wallet = (await fetch('https://rpc.walletconnect.com/v1')).ok;
    const ipfs = await (await fetch('https://ipfs.io/ipfs/example')).text();
    const image = await new Promise<boolean>((resolve) => {
      const img = new Image(); img.onload = () => resolve(true); img.onerror = () => resolve(false);
      img.src = 'https://explorer-api.walletconnect.com/icon.png';
    });
    const worker = await new Promise<string>((resolve, reject) => {
      const url = URL.createObjectURL(new Blob(['postMessage("ready")'], { type: 'text/javascript' }));
      const worker = new Worker(url);
      worker.onmessage = (event) => { resolve(event.data); worker.terminate(); URL.revokeObjectURL(url); };
      worker.onerror = reject;
    });
    const analyticsBlocked = await fetch('https://undeclared.invalid/analytics', { method: 'POST', body: '{}' }).then(() => false, () => true);
    const imageBlocked = await new Promise<boolean>((resolve) => {
      const img = new Image(); img.onload = () => resolve(false); img.onerror = () => resolve(true);
      img.src = 'https://undeclared.invalid/tracker.png';
    });
    return { wallet, ipfs, image, worker, analyticsBlocked, imageBlocked };
  });
  expect(result).toEqual({ wallet: true, ipfs: 'evidence', image: true, worker: 'ready', analyticsBlocked: true, imageBlocked: true });
  expect(unexpectedNetwork).toBe(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as { violations: string[] }).violations)).toEqual(expect.arrayContaining(['connect-src', 'img-src']));
});
