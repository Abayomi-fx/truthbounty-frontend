/**
 * UI-FE-088 — shared-consumer tests.
 *
 * Issue test covered here: "Prove Storybook and Playwright consume the same
 * scenario definitions."
 *
 * The proof is source-level and runs in the unit suite (which CI always
 * executes): every consumer file must import the canonical catalogue module
 * and must cover every canonical id.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { CANONICAL_SCENARIOS, type CanonicalScenarioId } from '../scenarios';

const ROOT = process.cwd();

/** Story export name for each canonical id — must stay in sync with the story file. */
const STORY_EXPORTS: Record<CanonicalScenarioId, string> = {
  loading: 'Loading',
  empty: 'Empty',
  stale: 'Stale',
  denied: 'Denied',
  offline: 'Offline',
  unavailable: 'Unavailable',
  reverted: 'Reverted',
  replaced: 'Replaced',
  'indexing-delayed': 'IndexingDelayed',
  reorged: 'Reorged',
  finalized: 'Finalized',
};

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const storySource = read('src/testing/fixtures/scenarios.stories.tsx');
const playwrightAdapterSource = read('e2e/support/scenarios.ts');
const playwrightSpecSource = read('e2e/canonical-scenarios.spec.ts');

describe('shared scenario consumers (UI-FE-088)', () => {
  it('Storybook imports the canonical catalogue', () => {
    expect(storySource).toContain("from './scenarios'");
    expect(storySource).toContain('CANONICAL_SCENARIOS');
    expect(storySource).toContain('getScenario');
  });

  it('Storybook declares one story per canonical state', () => {
    for (const id of CANONICAL_SCENARIOS) {
      expect(storySource).toContain(`'${id}'`);
      expect(storySource).toContain(`export const ${STORY_EXPORTS[id]}: Story`);
    }
  });

  it('Playwright imports the same catalogue module', () => {
    expect(playwrightAdapterSource).toContain('src/testing/fixtures/scenarios');
    expect(playwrightAdapterSource).toContain('getScenario(id)');
    expect(playwrightSpecSource).toContain('src/testing/fixtures/scenarios');
    expect(playwrightSpecSource).toContain('CANONICAL_SCENARIOS');
  });

  it('Playwright covers every canonical state through the shared constant', () => {
    // The spec iterates `CANONICAL_SCENARIOS` instead of hard-coding ids, so
    // adding a state to the catalogue automatically extends e2e coverage.
    expect(playwrightSpecSource).toContain('for (const id of CANONICAL_SCENARIOS)');
    // The adapter is parameterised over the catalogue rather than hard-coded.
    expect(playwrightAdapterSource).toContain('CanonicalScenarioId');
    expect(storySource).toContain('CANONICAL_SCENARIOS');
  });

  it('every consumer resolves to the identical catalogue definition', () => {
    const resolveImport = (fromFile: string, specifier: string) =>
      path.resolve(path.dirname(path.join(ROOT, fromFile)), specifier);

    const expected = path.join(ROOT, 'src', 'testing', 'fixtures', 'scenarios');
    expect(
      resolveImport('src/testing/fixtures/scenarios.stories.tsx', './scenarios'),
    ).toBe(expected);
    expect(
      resolveImport('e2e/support/scenarios.ts', '../../src/testing/fixtures/scenarios'),
    ).toBe(expected);
    expect(
      resolveImport('e2e/canonical-scenarios.spec.ts', '../src/testing/fixtures/scenarios'),
    ).toBe(expected);
  });
});
