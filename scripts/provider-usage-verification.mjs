import { requiredProviderUsage } from '../src/lib/security/provider-usage.mjs';

const scenarios = new Set(['rpc', 'projection', 'walletconnect', 'world-id', 'evidence']);
const pair = (row) => JSON.stringify([row.provider, row.origin, row.directive]);

/** Every permission requires its own independent, named production-flow obligation. */
export function verifyUsageBindings(providers, requirements = requiredProviderUsage) {
  const expected = new Set(providers.flatMap((p) => p.origins.flatMap((origin) =>
    p.directives.map((directive) => pair({ provider: p.id, origin, directive })))));
  const bound = new Set();
  for (const row of requirements) {
    const key = pair(row);
    if (!expected.has(key) || bound.has(key) || !scenarios.has(row.scenario)) {
      throw new Error('Invalid, duplicate or stale per-origin/directive usage binding');
    }
    bound.add(key);
  }
  for (const key of expected) {
    if (!bound.has(key)) throw new Error(`Missing per-origin/directive usage binding: ${key}`);
  }
}

/** Called by the real-browser suite using successful requests from app UI actions.
 * An obligation alone is not usage evidence. No trace/baseline is accepted as a substitute.
 */
export function verifyObservedUsage(providers, observations, requirements = requiredProviderUsage) {
  verifyUsageBindings(providers, requirements);
  const missing = requirements.filter((row) => !observations.some((seen) =>
    seen.scenario === row.scenario && seen.origin === row.origin &&
    seen.directive === row.directive && seen.success === true));
  if (missing.length) {
    throw new Error(`Unused or unverified CSP permissions: ${missing.map((r) =>
      `${r.provider} ${r.directive} ${r.origin} (${r.scenario})`).join(', ')}`);
  }
}
