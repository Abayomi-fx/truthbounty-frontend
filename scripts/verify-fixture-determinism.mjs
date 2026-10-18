#!/usr/bin/env node

/**
 * UI-FE-088 — fixture determinism guard.
 *
 * Fails when a fixture module reaches for a nondeterministic clock or source of
 * randomness, which would silently break the "identical inputs generate
 * identical outputs" guarantee and make Storybook / Jest / Playwright snapshots
 * drift between runs, machines, and CI runners.
 *
 * Dependency-free on purpose: it runs in the CI `artifacts` job, which has no
 * `node_modules`, and in `prebuild` before any bundle exists.
 *
 * Usage:
 *   node scripts/verify-fixture-determinism.mjs [--root <dir>]
 *
 * Exit codes: 0 clean · 1 violations found · 2 usage error
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_SEGMENTS = ['src', 'testing', 'fixtures'];

/** Files that consume fixtures rather than define them. */
const CONSUMER_FILE = /(?:^|\.)(?:test|spec|stories)\.[cm]?[jt]sx?$/i;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs']);

/**
 * Nondeterministic APIs that must never appear in a fixture builder.
 * Each entry is [regex, human explanation].
 */
export const NONDETERMINISTIC_PATTERNS = [
  [/Math\s*\.\s*random\s*\(/, 'Math.random() — derive values from the seeded fixture context instead'],
  [/\bDate\s*\.\s*now\s*\(/, 'Date.now() — use the pinned fixture clock (FIXTURE_EPOCH_MS) instead'],
  [/new\s+Date\s*\(\s*\)/, 'new Date() without an argument reads the wall clock — use ctx.isoAt() instead'],
  [/\bperformance\s*\.\s*now\s*\(/, 'performance.now() — wall-clock sampling is not reproducible'],
  [/\bprocess\s*\.\s*hrtime/, 'process.hrtime() — wall-clock sampling is not reproducible'],
  [/crypto\s*\.\s*randomUUID\s*\(/, 'crypto.randomUUID() — derive ids from the seeded fixture context instead'],
  [/crypto\s*\.\s*getRandomValues\s*\(/, 'crypto.getRandomValues() — derive values from the seeded fixture context instead'],
  [/\brandomBytes\s*\(/, 'randomBytes() — derive values from the seeded fixture context instead'],
  [/\bDate\s*\.\s*parse\s*\(\s*new\s+Date\s*\(/, 'Date.parse(new Date()) — parse a pinned literal instead'],
];

/** One violation: the file, the matched text, and why it is banned. */
export function scanSource(rawSource, filePath = 'fixture.ts') {
  // Comments and string literals are documentation, not code: the fixture
  // modules document the banned APIs in their headers.
  const source = stripCommentsAndStrings(rawSource);
  const violations = [];
  for (const [pattern, explanation] of NONDETERMINISTIC_PATTERNS) {
    const match = pattern.exec(source);
    if (match) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      violations.push(`${filePath}:${line} — ${explanation} (matched "${match[0].trim()}")`);
    }
  }
  return violations;
}

/**
 * Blank out comments and string/template literal contents while preserving
 * line numbers, so reported line numbers still point at the original file.
 */
function stripCommentsAndStrings(source) {
  const pattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|\/\/)/g;
  return source.replace(pattern, (whole, literal, comment) => {
    if (literal !== undefined) {
      // Keep quotes so string-vs-code distinctions stay intact.
      return literal.replace(/[^\r\n]/g, (char) => (char === '"' || char === "'" ? char : ' '));
    }
    return comment.replace(/[^\r\n]/g, ' ');
  });
}

function collectFixtureFiles(directory, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === '__mocks__') continue;
      collectFixtureFiles(fullPath, files);
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
    if (CONSUMER_FILE.test(entry.name)) continue;
    files.push(fullPath);
  }
  return files;
}

/** Scan every fixture builder under `<root>/src/testing/fixtures`. */
export function findDeterminismViolations(rootDir = process.cwd()) {
  const fixtureDir = path.join(rootDir, ...FIXTURE_SEGMENTS);
  if (!existsSync(fixtureDir)) {
    return [
      `Fixture directory not found: ${path.relative(rootDir, fixtureDir) || fixtureDir} — UI-FE-088 fixture library is missing.`,
    ];
  }

  const violations = [];
  for (const filePath of collectFixtureFiles(fixtureDir)) {
    const relative = path.relative(rootDir, filePath).split(path.sep).join('/');
    violations.push(...scanSource(readFileSync(filePath, 'utf8'), relative));
  }

  // The pinned clock and the bundle canary must exist; without them the rest
  // of the determinism contract has nothing to check against.
  const corePath = path.join(fixtureDir, 'deterministic.ts');
  if (existsSync(corePath)) {
    const core = readFileSync(corePath, 'utf8');
    const relative = path.relative(rootDir, corePath).split(path.sep).join('/');
    if (!/export\s+const\s+FIXTURE_EPOCH_MS\b/.test(core)) {
      violations.push(`${relative} — missing pinned clock export FIXTURE_EPOCH_MS.`);
    }
    if (!/export\s+const\s+FIXTURE_BUNDLE_MARKER\b/.test(core)) {
      violations.push(`${relative} — missing FIXTURE_BUNDLE_MARKER canary export.`);
    }
  }

  return violations.sort();
}

function readCliOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const isCli =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const rootDir = path.resolve(readCliOption('--root') ?? process.cwd());
  const violations = findDeterminismViolations(rootDir);

  if (violations.length === 0) {
    console.log(
      `Fixture determinism check passed (${path.relative(rootDir, path.join(rootDir, ...FIXTURE_SEGMENTS)) || 'src/testing/fixtures'}).`,
    );
  } else {
    console.error('Fixture determinism check failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    console.error(
      'Fixture builders must be pure functions of (seed, key): no wall-clock reads, no randomness.',
    );
    process.exitCode = 1;
  }
}
