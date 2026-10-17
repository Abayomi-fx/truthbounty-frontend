/**
 * UI-FE-088 — production boundary tests for the fixture library.
 *
 * Issue acceptance criteria covered here:
 *  - "No fixture module is bundled into production." (source level; the
 *    `.next` bundle canary is enforced by `verify-production-boundaries.mjs`
 *    and the CI determinism guard.)
 *  - Fixtures must not depend on Storybook/Playwright/Jest themselves.
 *
 * The authoritative gate is `scripts/verify-production-boundaries.mjs`
 * (runs in `prebuild`); this test keeps the same rule close to the fixtures so
 * a regression fails in the unit suite too.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const FIXTURES = path.join(SRC, 'testing', 'fixtures');

/** Mirrors `TEST_ONLY_SEGMENTS` in scripts/verify-production-boundaries.mjs. */
const TEST_ONLY_SEGMENTS = new Set([
  '__tests__',
  '__mocks__',
  'fixtures',
  'mocks',
  'stories',
  '.storybook',
]);
const TEST_ONLY_FILE = /(?:^|\.)(?:test|spec|stories)\.[cm]?[jt]sx?$/i;

function walk(directory: string, files: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (/\.tsx?$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function isTestOnly(filePath: string): boolean {
  const segments = filePath.split(path.sep);
  return (
    segments.some((segment) => TEST_ONLY_SEGMENTS.has(segment)) ||
    TEST_ONLY_FILE.test(path.basename(filePath))
  );
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const pattern = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null = pattern.exec(source);
  while (match) {
    specifiers.push(match[1]);
    match = pattern.exec(source);
  }
  return specifiers;
}

describe('fixture production boundaries (UI-FE-088)', () => {
  it('no production source file imports the fixture library', () => {
    const offenders: string[] = [];

    for (const filePath of walk(SRC)) {
      const relative = path.relative(SRC, filePath);
      if (isTestOnly(filePath)) continue;

      const source = readFileSync(filePath, 'utf8');
      for (const specifier of importSpecifiers(source)) {
        if (!specifier.includes('fixtures')) continue;
        const resolved = specifier.startsWith('@/')
          ? path.join(SRC, specifier.slice(2))
          : path.resolve(path.dirname(filePath), specifier);
        const candidates = [resolved, `${resolved}.ts`, `${resolved}.tsx`, path.join(resolved, 'index.ts')];
        if (candidates.some((candidate) => candidate.startsWith(FIXTURES))) {
          offenders.push(`${relative} → ${specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('fixture modules never import test runners', () => {
    const forbidden = ['@playwright/test', '@storybook/', 'msw', 'jest', 'vitest', '@testing-library/'];
    const offenders: string[] = [];

    for (const filePath of walk(FIXTURES)) {
      if (isTestOnly(filePath)) continue;
      const source = readFileSync(filePath, 'utf8');
      for (const specifier of importSpecifiers(source)) {
        if (forbidden.some((pkg) => specifier.startsWith(pkg))) {
          offenders.push(`${path.relative(ROOT, filePath)} → ${specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps the fixture library inside a test-only directory', () => {
    expect(path.basename(FIXTURES)).toBe('fixtures');
    expect(statSync(FIXTURES).isDirectory()).toBe(true);
  });
});
