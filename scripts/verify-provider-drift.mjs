import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { providers, validateProviders, assertReviewedEndpoint } from '../src/lib/security/provider-policy.mjs';

import { requiredProviderUsage } from '../src/lib/security/provider-usage.mjs';
import { verifyUsageBindings } from './provider-usage-verification.mjs';

const ts = createRequire(import.meta.url)('typescript');
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const digest = (value) => createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex');
const excluded = /(?:^|\/)(?:__tests__|__fixtures__|__mocks__|fixtures|mocks|stories|node_modules)(?:\/|$)|\.(?:test|spec|stories)\./;
const networkCall = /^(?:fetch|http|axios|WebSocket|EventSource|Worker|SharedWorker|XMLHttpRequest|importScripts)$|\.(?:fetch|sendBeacon|open|connect|request|get|post|put|patch|delete|head|http|loadScript)$/;

/** Conservative review inventory, not a proof of arbitrary JS data flow. Runtime CSP remains the enforcement boundary. */
export function inspectSource(source, filename) {
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const observations = new Set();
  function visit(node) {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node)) {
      const value = node.text;
      if (/^(?:https?:|wss?:)?\/\//i.test(value)) {
        // Hash full expressions as well as URLs: changes to destination paths also require review.
        observations.add(`url:${digest(value)}`);
      }
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const expression = node.getText(tree);
      if (/process\s*\.\s*env/.test(expression)) observations.add(`env:${digest(expression)}`);
    }
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && networkCall.test(node.expression.getText(tree))) {
      observations.add(`network:${digest(node.getText(tree))}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return [...observations].sort();
}

export function inventory(directory = root) {
  const result = {};
  function walk(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const file = resolve(folder, entry.name);
      const name = relative(directory, file).replaceAll('\\', '/');
      if (excluded.test(name) || name === 'src/lib/security/provider-policy.mjs') continue;
      if (entry.isDirectory()) { walk(file); continue; }
      const extension = extname(name);
      if (!['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.svg', '.html'].includes(extension)) continue;
      const source = readFileSync(file, 'utf8');
      const observations = ['.css', '.svg', '.html'].includes(extension)
        ? [...source.matchAll(/(?:https?:)?\/\/[^\s"'<>)}]+/g)].map((m) => `asset:${digest(m[0])}`).sort()
        : inspectSource(source, name);
      if (observations.length) result[name] = [...new Set(observations)];
    }
  }
  walk(resolve(directory, 'src'));
  walk(resolve(directory, 'public'));
  for (const name of ['middleware.ts', 'next.config.ts']) {
    result[name] = inspectSource(readFileSync(resolve(directory, name), 'utf8'), name);
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

export function verify(directory = root, entries = providers, requirements = requiredProviderUsage) {
  validateProviders(entries);
  verifyUsageBindings(entries, requirements);
  for (const key of ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_WS_URL', 'NEXT_PUBLIC_OPTIMISM_RPC_URL', 'NEXT_PUBLIC_OPTIMISM_SEPOLIA_RPC_URL']) assertReviewedEndpoint(process.env[key]);
  for (const entry of entries) {
    const source = resolve(directory, entry.source);
    if (!source.startsWith(directory + '/') && !source.startsWith(directory + '\\')) throw new Error('Invalid provider evidence path');
    if (!existsSync(source) || !readFileSync(source, 'utf8').includes(entry.evidence)) throw new Error(`Unused provider: ${entry.id}`);
  }
  const reviewed = JSON.parse(readFileSync(resolve(directory, 'src/lib/security/provider-review.json'), 'utf8'));
  if (!reviewed.owner || !reviewed.purpose) throw new Error('Missing review ownership');
  for (const name of ['package.json', 'pnpm-lock.yaml']) {
    if (digest(readFileSync(resolve(directory, name), 'utf8')) !== reviewed.dependencies[name]) throw new Error(`Dependency drift: review provider behavior before updating ${name}`);
  }
  const actual = inventory(directory);
  const changed = [...new Set([...Object.keys(actual), ...Object.keys(reviewed.sources)])]
    .filter((name) => JSON.stringify(actual[name]) !== JSON.stringify(reviewed.sources[name]));
  if (changed.length) throw new Error(`Provider usage drift requires policy review: ${changed.join(', ')}`);
  return Object.keys(actual).length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(`Provider policy verified (${verify()} source inventories)`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
