import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT_PATH = join(process.cwd(), 'scripts', 'verify-fixture-determinism.mjs');

function makeTempRoot() {
  return mkdtempSync(join(tmpdir(), 'truthbounty-fixture-determinism-'));
}

function writeFixtureFile(root, relative, contents) {
  const fullPath = join(root, 'src', 'testing', 'fixtures', relative);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, contents);
}

function runGuard(root) {
  return spawnSync(process.execPath, [SCRIPT_PATH, '--root', root], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const PINNED_CLOCK = `
export const FIXTURE_EPOCH_MS = Date.parse('2026-10-14T00:00:00.000Z');
export const FIXTURE_BUNDLE_MARKER = 'TRUTHBOUNTY_TEST_ONLY_FIXTURE_FACTORY_UI_FE_088';
`;

test('determinism guard: clean fixture library passes', (t) => {
  const root = makeTempRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  writeFixtureFile(root, 'deterministic.ts', PINNED_CLOCK);
  writeFixtureFile(root, 'factories/claims.ts', `
    export function makeClaim(index) {
      return { id: 'claim-' + index, createdAt: new Date(0).toISOString() };
    }
  `);
  writeFixtureFile(root, 'scenarios.stories.tsx', `
    export const Loading = { args: { id: 'loading' } };
    const drift = Math.random(); // consumers are out of scope, builders are not
  `);

  const result = runGuard(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Fixture determinism check passed/);
});

test('determinism guard: wall-clock and randomness violations fail the build', (t) => {
  const root = makeTempRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  writeFixtureFile(root, 'deterministic.ts', PINNED_CLOCK);
  writeFixtureFile(root, 'factories/claims.ts', `
    export const at = Date.now();
    export const roll = Math.random();
    export const fresh = new Date().toISOString();
    export const uuid = crypto.randomUUID();
  `);

  const result = runGuard(root);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const output = result.stdout + result.stderr;
  assert.match(output, /Math\.random\(\)/);
  assert.match(output, /Date\.now\(\)/);
  assert.match(output, /new Date\(\)/);
  assert.match(output, /crypto\.randomUUID\(\)/);
  assert.match(output, /factories\/claims\.ts:\d+/);
});

test('determinism guard: missing pinned clock fails', (t) => {
  const root = makeTempRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  writeFixtureFile(root, 'deterministic.ts', `export const SOMETHING = 1;\n`);

  const result = runGuard(root);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /FIXTURE_EPOCH_MS/);
});

test('determinism guard: missing fixture library fails loudly', (t) => {
  const root = makeTempRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const result = runGuard(root);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /Fixture directory not found/);
});
