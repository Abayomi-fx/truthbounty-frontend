import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadPolicy,
  normalizeHeaders,
  parseCsp,
  parsePermissionsPolicy,
  verifyHeaders,
  runNegativeTests,
  runThirdPartyIntegrationTests,
  verifyConfigDrift,
  generateEnvironmentEvidence,
  verifyDeployedEndpoint,
  DEFAULT_POLICY_PATH,
} from '../verify-security-headers.mjs';

test('Security Headers Gate — Policy Loading & Schema', () => {
  const policy = loadPolicy(DEFAULT_POLICY_PATH);
  assert.equal(typeof policy.policyVersion, 'string');
  assert.ok(policy.environments.local, 'local environment defined');
  assert.ok(policy.environments.preview, 'preview environment defined');
  assert.ok(policy.environments.testnet, 'testnet environment defined');
  assert.ok(policy.environments.production, 'production environment defined');

  assert.equal(policy.boundaries.embedding.policy, 'deny-all');
  assert.equal(policy.boundaries.embedding.xFrameOptions, 'DENY');
  assert.equal(policy.boundaries.embedding.frameAncestors, "'none'");
  assert.ok(Array.isArray(policy.boundaries.permissionsPolicy.denied));
  assert.ok(policy.boundaries.permissionsPolicy.denied.includes('microphone'));
  assert.ok(policy.boundaries.permissionsPolicy.denied.includes('geolocation'));
  assert.ok(policy.boundaries.permissionsPolicy.denied.includes('payment'));
  assert.ok(policy.boundaries.permissionsPolicy.denied.includes('usb'));
});

test('Security Headers Gate — Compliant Document Headers Verification', () => {
  const policy = loadPolicy();
  const compliantHeaders = {
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self "https://id.worldcoin.org"), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), screen-wake-lock=(), accelerometer=(), gyroscope=(), magnetometer=(), midi=(), encrypted-media=()',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Resource-Policy': 'same-site',
    'X-DNS-Prefetch-Control': 'off',
    'Cache-Control': 'no-store, max-age=0, must-revalidate',
    'Pragma': 'no-cache',
    'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'nonce-testnonce123456789' 'strict-dynamic' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https: wss: https://relay.walletconnect.com wss://relay.walletconnect.com https://rpc.walletconnect.com https://verify.walletconnect.com https://verify.walletconnect.org https://explorer-api.walletconnect.com https://id.worldcoin.org https://mainnet.optimism.io; frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org https://id.worldcoin.org; worker-src 'self' blob:; manifest-src 'self'; media-src 'self' blob:; report-to csp-endpoint; report-uri /api/csp-report; upgrade-insecure-requests",
  };

  const result = verifyHeaders(compliantHeaders, {
    environment: 'production',
    surface: 'document',
    url: 'https://truthbounty.io',
    policy,
  });

  assert.equal(result.passed, true);
  assert.ok(result.checks.every((c) => c.status === 'pass'));
});

test('Security Headers Gate — Fails when HSTS is missing or max-age is insufficient', () => {
  const policy = loadPolicy();
  const headersNoHsts = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Permissions-Policy': 'camera=(self "https://id.worldcoin.org"), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; script-src 'self' 'nonce-123456789' 'strict-dynamic' 'wasm-unsafe-eval'; upgrade-insecure-requests",
  };

  const resultMissing = verifyHeaders(headersNoHsts, {
    environment: 'production',
    surface: 'document',
    url: 'https://truthbounty.io',
    policy,
  });
  assert.equal(resultMissing.passed, false);
  assert.ok(resultMissing.checks.some((c) => c.id === 'hsts-present' && c.status === 'fail'));

  const headersShortHsts = {
    ...headersNoHsts,
    'Strict-Transport-Security': 'max-age=3600',
  };
  const resultShort = verifyHeaders(headersShortHsts, {
    environment: 'production',
    surface: 'document',
    url: 'https://truthbounty.io',
    policy,
  });
  assert.equal(resultShort.passed, false);
  assert.ok(resultShort.checks.some((c) => c.id === 'hsts-max-age' && c.status === 'fail'));
});

test('Security Headers Gate — Negative Tests for Framing and Clickjacking', () => {
  const policy = loadPolicy();

  // Negative test: framing allowed via open frame-ancestors
  const vulnerableFramingHeaders = {
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN', // Not DENY
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self "https://id.worldcoin.org"), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()',
    'Content-Security-Policy': "default-src 'self'; frame-ancestors *; script-src 'self' 'nonce-123456789' 'strict-dynamic' 'wasm-unsafe-eval'",
  };

  const negativeResult = runNegativeTests(vulnerableFramingHeaders, {
    environment: 'production',
    policy,
  });
  assert.equal(negativeResult.passed, false);
  assert.ok(negativeResult.negativeChecks.some((c) => c.id === 'negative-framing' && c.status === 'fail'));
});

test('Security Headers Gate — Negative Tests for Disallowed Capabilities & unsafe-eval', () => {
  const policy = loadPolicy();

  // Permissions-Policy leaking microphone and payment
  const leakingPermissionsHeaders = {
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; script-src 'self' 'nonce-123456789' 'strict-dynamic' 'wasm-unsafe-eval' 'unsafe-eval'",
    'Permissions-Policy': 'microphone=*, geolocation=(self), payment=*',
  };

  const result = runNegativeTests(leakingPermissionsHeaders, {
    environment: 'production',
    policy,
  });
  assert.equal(result.passed, false);
  assert.ok(result.negativeChecks.some((c) => c.id === 'negative-permissions-leak' && c.status === 'fail'));
  assert.ok(result.negativeChecks.some((c) => c.id === 'negative-unsafe-eval' && c.status === 'fail'));
});

test('Security Headers Gate — Wallet and Third-Party Integration Verifications', () => {
  const policy = loadPolicy();

  // Testnet integration check
  const testnetHeaders = {
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Permissions-Policy': 'camera=(self "https://id.worldcoin.org")',
    'Content-Security-Policy': "connect-src 'self' https://relay.walletconnect.com wss://relay.walletconnect.com https://rpc.walletconnect.com https://verify.walletconnect.com https://verify.walletconnect.org https://explorer-api.walletconnect.com https://id.worldcoin.org https://sepolia.optimism.io; frame-src https://verify.walletconnect.com https://verify.walletconnect.org https://id.worldcoin.org",
  };

  const testnetResult = runThirdPartyIntegrationTests(testnetHeaders, {
    environment: 'testnet',
    policy,
  });
  assert.equal(testnetResult.passed, true);
  assert.ok(testnetResult.integrationChecks.some((c) => c.id === 'testnet-rpc-endpoint' && c.status === 'pass'));

  // Missing WalletConnect origin triggers actionable failure
  const brokenWcHeaders = {
    'Cross-Origin-Opener-Policy': 'same-origin', // Breaks popups
    'Permissions-Policy': 'camera=()', // Breaks Worldcoin camera
    'Content-Security-Policy': "connect-src 'self'; frame-src 'self'",
  };

  const brokenResult = runThirdPartyIntegrationTests(brokenWcHeaders, {
    environment: 'production',
    policy,
  });
  assert.equal(brokenResult.passed, false);
  assert.ok(brokenResult.integrationChecks.some((c) => c.id === 'walletconnect-connect-src' && c.status === 'fail'));
  assert.ok(brokenResult.integrationChecks.some((c) => c.id === 'walletconnect-coop' && c.status === 'fail'));
  assert.ok(brokenResult.integrationChecks.some((c) => c.id === 'worldcoin-camera-permission' && c.status === 'fail'));
});

test('Security Headers Gate — Caching Boundaries for Document, API, and Static Surfaces', () => {
  const policy = loadPolicy();

  // Document surface must reject cacheable responses
  const cacheableDocHeaders = {
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Permissions-Policy': 'camera=(self "https://id.worldcoin.org"), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()',
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; script-src 'self' 'nonce-123456789' 'strict-dynamic' 'wasm-unsafe-eval'; upgrade-insecure-requests",
    'Cache-Control': 'public, max-age=86400', // Unsafe for dynamic dApp document
  };

  const docRes = verifyHeaders(cacheableDocHeaders, {
    environment: 'production',
    surface: 'document',
    policy,
  });
  assert.equal(docRes.passed, false);
  assert.ok(docRes.checks.some((c) => c.id === 'cache-control-anti-caching' && c.status === 'fail'));

  // API surface requires no-store
  const compliantApiHeaders = {
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Cache-Control': 'no-store, max-age=0, must-revalidate',
    'Pragma': 'no-cache',
  };
  const apiRes = verifyHeaders(compliantApiHeaders, {
    environment: 'production',
    surface: 'api',
    policy,
  });
  assert.equal(apiRes.passed, true);

  // Static assets require immutable caching
  const compliantStaticHeaders = {
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=31536000, immutable',
  };
  const staticRes = verifyHeaders(compliantStaticHeaders, {
    environment: 'production',
    surface: 'static',
    policy,
  });
  assert.equal(staticRes.passed, true);
});

test('Security Headers Gate — Configuration Drift Detection against Repository', () => {
  const policy = loadPolicy();
  const drift = verifyConfigDrift({ policy });
  assert.equal(drift.passed, true, `Configuration drift found: ${drift.driftErrors.join(', ')}`);
});

test('Security Headers Gate — Preview, Testnet, and Production Evidence Generation', () => {
  const policy = loadPolicy();

  const previewEvidence = generateEnvironmentEvidence({ environment: 'preview', policy });
  assert.equal(previewEvidence.overallStatus, 'PASS');
  assert.equal(previewEvidence.environment, 'preview');
  assert.ok(previewEvidence.integrityDigest.startsWith('sha256-'));

  const testnetEvidence = generateEnvironmentEvidence({ environment: 'testnet', policy });
  assert.equal(testnetEvidence.overallStatus, 'PASS');
  assert.equal(testnetEvidence.environment, 'testnet');
  assert.equal(testnetEvidence.targetChainId, 11155420);
  assert.ok(testnetEvidence.integrityDigest.startsWith('sha256-'));

  const prodEvidence = generateEnvironmentEvidence({ environment: 'production', policy });
  assert.equal(prodEvidence.overallStatus, 'PASS');
  assert.equal(prodEvidence.environment, 'production');
  assert.equal(prodEvidence.targetChainId, 10);
  assert.ok(prodEvidence.integrityDigest.startsWith('sha256-'));

  // Separate evidencing assertion
  assert.notEqual(testnetEvidence.integrityDigest, prodEvidence.integrityDigest);
});

test('Security Headers Gate — Live Endpoint Verification via Mock Fetch', async () => {
  const policy = loadPolicy();
  const mockHeaders = new Headers({
    'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(self "https://id.worldcoin.org"), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), screen-wake-lock=(), accelerometer=(), gyroscope=(), magnetometer=(), midi=(), encrypted-media=()',
    'cross-origin-opener-policy': 'same-origin-allow-popups',
    'cross-origin-resource-policy': 'same-site',
    'cache-control': 'no-store, max-age=0, must-revalidate',
    'content-security-policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'nonce-livemocknonce123456789' 'strict-dynamic' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https: wss: https://relay.walletconnect.com wss://relay.walletconnect.com https://rpc.walletconnect.com https://verify.walletconnect.com https://verify.walletconnect.org https://explorer-api.walletconnect.com https://id.worldcoin.org https://mainnet.optimism.io; frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org https://id.worldcoin.org; worker-src 'self' blob:; manifest-src 'self'; media-src 'self' blob:; report-to csp-endpoint; report-uri /api/csp-report; upgrade-insecure-requests",
  });

  const mockFetch = async () => ({
    ok: true,
    headers: mockHeaders,
  });

  const result = await verifyDeployedEndpoint({
    url: 'https://truthbounty.io',
    environment: 'production',
    policy,
    fetchImpl: mockFetch,
  });

  assert.equal(result.passed, true);
  assert.equal(result.docVerification.passed, true);
  assert.equal(result.negativeTests.passed, true);
  assert.equal(result.integrationTests.passed, true);
});

