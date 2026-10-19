/**
 * Regression guard: production UI paths must not import mock data.
 *
 * Covers three attack vectors:
 *  1. @/data/mock-data imports via path alias
 *  2. Relative imports of mock-data (../data/mock-data etc.)
 *  3. @/__tests__/fixtures imports landing in production source
 *
 * Bypass regression: the test itself imports from __tests__/fixtures — that
 * must NOT trigger the guard (test files are exempt by path).
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../../');

function readSrc(relative: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relative), 'utf-8');
}

/** True when the normalised path lives inside a test/Storybook boundary. */
function isTestPath(filePath: string): boolean {
  const norm = filePath.split(path.sep).join('/');
  return (
    norm.includes('/__tests__/') ||
    norm.includes('/__mocks__/') ||
    norm.includes('/fixtures/') ||
    norm.includes('/mocks/') ||
    norm.includes('/stories/') ||
    norm.includes('.storybook') ||
    /\.(test|spec|stories)\.[cm]?[jt]sx?$/.test(norm)
  );
}

// The symbols stripped from production in this issue.
const BANNED_SYMBOLS = [
  'platformStats',
  'activityData',
  'verificationNodes',
  'activeClaims',
  'claimableRewards',
];

// The five primary audit targets.
const AUDIT_TARGETS = [
  'components/features/StatsCards.tsx',
  'components/features/ActivityAndNodes.tsx',
  'components/features/VerificationNodes.tsx',
  'components/features/ActiveClaimsTable.tsx',
  'hooks/useRewards.ts',
];

// ─── per-file checks on the five audit targets ───────────────────────────────

describe('no mock-data imports in production UI paths', () => {
  for (const target of AUDIT_TARGETS) {
    it(`${target} does not import from @/data/mock-data (alias path)`, () => {
      expect(readSrc(target)).not.toMatch(/from ['"]@\/data\/mock-data['"]/);
    });

    it(`${target} does not import mock-data via a relative path`, () => {
      // Catches ../data/mock-data, ../../data/mock-data, etc.
      expect(readSrc(target)).not.toMatch(/from ['"][./]+.*mock-data['"]/);
    });

    it(`${target} does not import from the test fixtures directory`, () => {
      expect(readSrc(target)).not.toMatch(/from ['"]@\/__tests__\//);
      expect(readSrc(target)).not.toMatch(/from ['"][./]+.*__tests__\//);
    });
  }

  it('mock-data.ts does not export the banned UI symbols', () => {
    const content = readSrc('data/mock-data.ts');
    for (const symbol of BANNED_SYMBOLS) {
      expect(content).not.toMatch(
        new RegExp(`export\\s+(const|function|type)\\s+${symbol}\\b`)
      );
    }
  });
});

// ─── full-tree walk: no production file may import banned symbols from mock-data ─

describe('codebase-wide production boundary', () => {
  function collectProductionFiles(dir: string): string[] {
    return fs.readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) {
        if (entry === 'node_modules') return [];
        return collectProductionFiles(full);
      }
      if (/\.(ts|tsx)$/.test(entry) && !isTestPath(full)) return [full];
      return [];
    });
  }

  it('no production source imports banned symbols from @/data/mock-data', () => {
    const files = collectProductionFiles(SRC_ROOT);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (!content.includes('mock-data')) continue;
      const hasBanned = BANNED_SYMBOLS.some((sym) => content.includes(sym));
      if (hasBanned) violations.push(path.relative(SRC_ROOT, file));
    }

    expect(violations).toEqual([]);
  });

  it('no production source imports anything from @/__tests__ or relative __tests__ paths', () => {
    const files = collectProductionFiles(SRC_ROOT);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (
        content.includes('@/__tests__/') ||
        /from ['"][./]+.*__tests__\//.test(content)
      ) {
        violations.push(path.relative(SRC_ROOT, file));
      }
    }

    expect(violations).toEqual([]);
  });

  // ── bypass regression: this test file itself imports from fixtures ──────────
  // The guard above must NOT flag __tests__ files — only production source.
  it('bypass: this regression file may import fixtures without triggering the guard', () => {
    // Verify isTestPath correctly classifies this file as a test file.
    expect(isTestPath(__filename)).toBe(true);
  });

  it('bypass: fixture files classified as test-only are excluded from the walk', () => {
    const fixtureFile = path.resolve(SRC_ROOT, '__tests__/fixtures/dashboard-fixtures.ts');
    expect(isTestPath(fixtureFile)).toBe(true);
  });
});

// ─── other production hygiene guards ─────────────────────────────────────────

describe('production source hygiene', () => {
  it('useTrust does not use Math.random for trust values', () => {
    expect(readSrc('components/hooks/useTrust.ts')).not.toContain('Math.random');
  });

  it('useTrust does not read localStorage overrides in production', () => {
    // parseTrustInfoFromStorage must not be called outside of test environments.
    // The function itself is fine to exist, but the hook must be guarded by
    // NODE_ENV so it is dead code in production builds.
    const content = readSrc('components/hooks/useTrust.ts');
    // The localStorage call must only run when NOT in production.
    if (content.includes('parseTrustInfoFromStorage')) {
      expect(content).toMatch(/process\.env\.NODE_ENV|__DEV__|isDevelopment/);
    }
  });
});
