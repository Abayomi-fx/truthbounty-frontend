import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { providers, validateProviders, assertReviewedEndpoint } from '../../src/lib/security/provider-policy.mjs';
import { inspectSource, verify } from '../verify-provider-drift.mjs';

const policyUrl = new URL('../../src/lib/security/provider-policy.mjs', import.meta.url).href;
async function loadTs(path, replace = (s) => s) {
  const source = replace(readFileSync(new URL(path, import.meta.url), 'utf8'));
  return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
}
const headers = await loadTs('../../src/lib/security/headers.ts', (s) => s.replace('./provider-policy.mjs', policyUrl));
const report = await loadTs('../../src/app/api/csp-report/route.ts', (s) => s.replace('import { NextResponse } from "next/server";', 'const NextResponse = Response;'));

test('production headers contain only scoped sources and preserve nonce controls', () => {
  const csp = headers.buildSecurityHeaders({ nonce: 'abc123' })['Content-Security-Policy'];
  assert.match(csp, /script-src 'self' 'nonce-abc123' 'strict-dynamic'/);
  assert.match(csp, /worker-src 'self' blob:/);
  assert.match(csp, /object-src 'none'/);
  assert.ok(!csp.includes('*'));
  assert.ok(!csp.split(/\s|;/).some((t) => ['https:', 'wss:', "'unsafe-eval'"].includes(t)));
  assert.ok(!csp.includes('fonts.googleapis.com'));
  assert.throws(() => headers.buildContentSecurityPolicy({ nonce: "x'; script-src *" }));
  assert.throws(() => headers.buildContentSecurityPolicy({ nonce: '' }));
  assert.notEqual(headers.createRequestNonce(), headers.createRequestNonce());
});

test('development relaxations never enter production', () => {
  assert.match(headers.buildContentSecurityPolicy({ nonce: 'a', isDevelopment: true }), /localhost:\*/);
  assert.doesNotMatch(headers.buildContentSecurityPolicy({ nonce: 'a' }), /localhost|'unsafe-eval'/);
});

test('wildcard, scheme-wide, path-bearing and ownerless entries fail closed', () => {
  for (const origin of ['https:', '*', 'https://*.walletconnect.com', 'https://ipfs.io/path', 'https://user:password@ipfs.io']) {
    assert.throws(() => validateProviders([{ ...providers[0], origins: [origin] }]));
  }
  assert.throws(() => validateProviders([{ ...providers[0], owner: '' }]));
});

test('environment settings cannot silently authorize a provider or leak keys', () => {
  assertReviewedEndpoint('https://mainnet.optimism.io/key-path?token=private');
  assertReviewedEndpoint('/api');
  for (const value of ['https://new-provider.invalid/secret', '//new-provider.invalid', 'https://user:password@mainnet.optimism.io', 'data:text/plain,secret', 'http://localhost:3001']) {
    assert.throws(() => assertReviewedEndpoint(value), (e) => !e.message.includes('secret') && !e.message.includes('password'));
  }
  assertReviewedEndpoint('http://localhost:3001', 'connect-src', true);
});

test('AST inventory detects undeclared providers, escaped literals, dynamic calls, environment and workers', () => {
  for (const code of [
    'fetch("https://undeclared.invalid")',
    'fetch("https:\\u002f\\u002fundeclared.invalid")',
    'const url = `https://undeclared.invalid/${id}`',
    'new WebSocket(endpoint)', 'new Worker(endpoint)',
    'navigator.sendBeacon(endpoint, data)', 'axios.get(endpoint)',
    'fetch(process.env.NEXT_PUBLIC_NEW_PROVIDER)',
  ]) assert.ok(inspectSource(code, 'example.ts').length, code);
  assert.deepEqual(inspectSource('// https://comment.invalid', 'example.ts'), []);
});

test('unused origins and deliberate source drift fail the actual CI verifier', () => {
  assert.throws(() => verify(undefined, [{ ...providers[0], evidence: 'REMOVED_PROVIDER' }]), /Unused provider/);
  const root = mkdtempSync(join(tmpdir(), 'csp-drift-'));
  try {
    for (const folder of ['src/lib/security', 'public']) mkdirSync(join(root, folder), { recursive: true });
    const original = JSON.parse(readFileSync(new URL('../../src/lib/security/provider-review.json', import.meta.url), 'utf8'));
    for (const name of ['package.json', 'pnpm-lock.yaml']) writeFileSync(join(root, name), readFileSync(new URL(`../../${name}`, import.meta.url)));
    writeFileSync(join(root, 'middleware.ts'), '');
    writeFileSync(join(root, 'next.config.ts'), '');
    writeFileSync(join(root, 'src/lib/security/provider-review.json'), JSON.stringify({ ...original, sources: { 'middleware.ts': [], 'next.config.ts': [] } }));
    verify(root, []);
    writeFileSync(join(root, 'src/new-provider.ts'), 'fetch("https://undeclared.invalid")');
    assert.throws(() => verify(root, []), /Provider usage drift/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('legacy and Reporting API reports cannot put URLs, samples or arbitrary text in logs', async () => {
  const logs = [];
  const original = console.warn;
  console.warn = (...args) => logs.push(args);
  try {
    for (const payload of [
      { 'csp-report': { 'effective-directive': 'connect-src', 'blocked-uri': 'https://secret.invalid/private?token=secret', 'document-uri': 'https://private.invalid/wallet', 'source-file': 'secret', 'script-sample': 'secret', disposition: 'enforce' } },
      [{ body: { effectiveDirective: 'secret', blockedURL: 'secret', documentURL: 'secret', sourceFile: 'secret', disposition: 'secret', statusCode: 'secret' } }],
    ]) {
      const response = await report.POST(new Request('https://app.invalid/api/csp-report', { method: 'POST', body: JSON.stringify(payload) }));
      assert.equal(response.status, 204);
    }
    assert.ok(!JSON.stringify(logs).includes('secret'));
    assert.ok(!JSON.stringify(logs).includes('https:'));
    assert.equal(logs[0][1].effectiveDirective, 'connect-src');
    assert.equal(logs[1][1].effectiveDirective, 'unknown');
  } finally { console.warn = original; }
  assert.equal((await report.POST(new Request('https://app.invalid', { method: 'POST', body: '{}' }))).status, 400);
  assert.equal((await report.POST(new Request('https://app.invalid', { method: 'POST', body: 'a'.repeat(17000) }))).status, 413);
});
