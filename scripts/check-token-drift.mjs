#!/usr/bin/env node
/**
 * check-token-drift.mjs  (UI-FE-091 / #665)
 *
 * Static, deterministic, non-mutating scanner that detects:
 *   1. Forbidden raw visual values in shared component source
 *      (src/components/**) where approved design tokens exist.
 *   2. Growth of the exception allowlist beyond the approved baseline.
 *   3. Accidental duplicate primitive implementations outside the
 *      canonical src/components/ui/primitives/ location.
 *   4. Deprecated API props used without a migration note on file.
 *
 * Exit codes:
 *   0  — clean (or all findings are allowlisted)
 *   1  — violations found; details written to stdout
 *
 * Usage:
 *   node scripts/check-token-drift.mjs [--report-file <path>]
 *
 * The optional --report-file flag writes a JSON summary that CI can
 * upload as an artifact for actionable file + token/API locations.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const COMPONENT_GLOB_ROOT = path.join(ROOT, 'src', 'components');
const PRIMITIVES_DIR = path.join(
  ROOT,
  'src',
  'components',
  'ui',
  'primitives',
);
const ALLOWLIST_PATH = path.join(__dirname, 'token-drift-allowlist.json');

/**
 * Raw-value patterns forbidden inside src/components/**
 * Each entry has: { id, description, regex }
 */
const FORBIDDEN_PATTERNS = [
  {
    id: 'raw-hex-color',
    description: 'Raw hex colour (use a semantic token utility instead)',
    // Matches hex in className strings / JSX attribute values, not in comments.
    regex: /(?<![/]{2}[^\n]*)(?:className|class)=["'`][^"'`]*#[0-9a-fA-F]{3,8}[^"'`]*["'`]/g,
  },
  {
    id: 'raw-rgb-color',
    description: 'Raw rgb/rgba colour (use a semantic token utility instead)',
    regex: /(?<![/]{2}[^\n]*)rgba?\s*\(/g,
  },
  {
    id: 'raw-hsl-color',
    description: 'Raw hsl/hsla colour (use a semantic token utility instead)',
    regex: /(?<![/]{2}[^\n]*)hsla?\s*\(/g,
  },
  {
    id: 'raw-oklch-in-classname',
    description:
      'Raw oklch() inside a className string (use a CSS variable token instead)',
    // oklch( in a JS/TS string that is part of a className or style prop.
    regex: /(?:className|style)\s*=\s*["'`][^"'`]*oklch\s*\(/g,
  },
  {
    id: 'inline-px-margin',
    description:
      'Inline px margin (use Tailwind spacing scale or a layout token instead)',
    regex: /style\s*=\s*\{\s*\{[^}]*margin[^}]*\d+px[^}]*\}\s*\}/g,
  },
  {
    id: 'inline-px-padding',
    description:
      'Inline px padding (use Tailwind spacing scale or a layout token instead)',
    regex: /style\s*=\s*\{\s*\{[^}]*padding[^}]*\d+px[^}]*\}\s*\}/g,
  },
  {
    id: 'arbitrary-px-radius',
    description:
      'Arbitrary-value border-radius (use rounded-{sm,md,lg,xl} scale instead)',
    // e.g. rounded-[12px]
    regex: /rounded-\[\d+px\]/g,
  },
];

/**
 * Canonical data-slot values that identify shared primitives.
 * Files outside PRIMITIVES_DIR that contain these are flagged as duplicate impls.
 */
const CANONICAL_SLOTS = ['card', 'status-badge', 'token-amount'];

/**
 * Deprecated prop names that require a migration note on file.
 * Format: { prop, component, migrationDoc }
 */
const DEPRECATED_PROPS = [
  // Add entries here as APIs are deprecated, e.g.:
  // { prop: 'variant="legacy"', component: 'Button', migrationDoc: 'docs/design-system/migrations/2026-10-17-button-legacy-variant.md' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Walk a directory recursively and return all file paths matching the filter.
 * @param {string} dir
 * @param {(f: string) => boolean} filter
 * @returns {string[]}
 */
function walk(dir, filter) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full, filter));
    } else if (entry.isFile() && filter(full)) {
      results.push(full);
    }
  }
  return results;
}

/** Source files we care about: .tsx / .ts / .jsx / .js, not test/stories. */
function isSourceFile(f) {
  return (
    /\.(tsx?|jsx?)$/.test(f) &&
    !f.includes('__tests__') &&
    !f.includes('.test.') &&
    !f.includes('.spec.') &&
    !f.includes('.stories.')
  );
}

/**
 * Check whether a file path matches a glob-like pattern from the allowlist.
 * Supports simple `**` and `*` wildcards only.
 * @param {string} filePath  absolute path
 * @param {string} pattern   relative-to-root glob pattern
 */
function matchesAllowlistGlob(filePath, pattern) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  // Convert glob to regex
  const re = new RegExp(
    '^' +
      pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '<<STARSTAR>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<STARSTAR>>/g, '.*') +
      '$',
  );
  return re.test(rel);
}

/**
 * Get the line number of a match index inside source text.
 * @param {string} src
 * @param {number} index
 */
function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let reportFile = null;
{
  const rfIdx = args.indexOf('--report-file');
  if (rfIdx !== -1) reportFile = args[rfIdx + 1] ?? null;
}

// ---------------------------------------------------------------------------
// Load allowlist
// ---------------------------------------------------------------------------

let allowlist = { baseline: 0, approved: 0, exceptions: [] };
try {
  allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
} catch {
  console.warn(
    '[token-drift] Warning: could not read token-drift-allowlist.json; treating allowlist as empty.',
  );
}

// ---------------------------------------------------------------------------
// Collect source files
// ---------------------------------------------------------------------------

const componentFiles = walk(COMPONENT_GLOB_ROOT, isSourceFile);

// ---------------------------------------------------------------------------
// Run checks
// ---------------------------------------------------------------------------

/** @type {{ file: string, line: number, rule: string, description: string, snippet: string }[]} */
const violations = [];

for (const filePath of componentFiles) {
  const src = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');

  // --- 1. Forbidden raw-value patterns ---
  for (const rule of FORBIDDEN_PATTERNS) {
    let match;
    rule.regex.lastIndex = 0;
    while ((match = rule.regex.exec(src)) !== null) {
      // Check allowlist: pattern field is a pipe-separated list of rule IDs
      const isAllowlisted = allowlist.exceptions.some((ex) => {
        if (!matchesAllowlistGlob(filePath, ex.file)) return false;
        const allowedRuleIds = ex.pattern ? ex.pattern.split('|') : [];
        return allowedRuleIds.includes(rule.id);
      });
      if (!isAllowlisted) {
        violations.push({
          file: rel,
          line: lineOf(src, match.index),
          rule: rule.id,
          description: rule.description,
          snippet: match[0].slice(0, 120),
        });
      }
    }
  }

  // --- 2. Duplicate primitive detection ---
  // Only flag files that are OUTSIDE the canonical primitives dir
  if (!filePath.startsWith(PRIMITIVES_DIR + path.sep) &&
      !filePath.startsWith(PRIMITIVES_DIR + '/')) {
    for (const slot of CANONICAL_SLOTS) {
      // Look for data-slot="<slot>" or data-slot='<slot>'
      const slotRe = new RegExp(`data-slot=["']${slot}["']`, 'g');
      let slotMatch;
      slotRe.lastIndex = 0;
      while ((slotMatch = slotRe.exec(src)) !== null) {
        violations.push({
          file: rel,
          line: lineOf(src, slotMatch.index),
          rule: 'duplicate-primitive',
          description: `Duplicate implementation of "${slot}" primitive. Use the shared component from @/components/ui/primitives instead.`,
          snippet: slotMatch[0],
        });
      }
    }
  }

  // --- 3. Deprecated prop usage ---
  for (const dep of DEPRECATED_PROPS) {
    if (src.includes(dep.prop)) {
      const idx = src.indexOf(dep.prop);
      const migrationExists = fs.existsSync(path.join(ROOT, dep.migrationDoc));
      violations.push({
        file: rel,
        line: lineOf(src, idx),
        rule: 'deprecated-api',
        description: `Deprecated prop "${dep.prop}" on ${dep.component}. See migration note: ${dep.migrationDoc}${migrationExists ? '' : ' (MISSING — create from MIGRATION_TEMPLATE.md)'}`,
        snippet: dep.prop,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Allowlist baseline guard
// ---------------------------------------------------------------------------

const liveExceptionCount = allowlist.exceptions.length;
const baselineExceptionCount = allowlist.baseline ?? 0;
const approvedExceptionCount = allowlist.approved ?? 0;

/** @type {{ rule: string, description: string }[]} */
const baselineViolations = [];

if (liveExceptionCount > approvedExceptionCount) {
  baselineViolations.push({
    rule: 'allowlist-growth',
    description:
      `The exception allowlist has grown from ${approvedExceptionCount} approved entries ` +
      `to ${liveExceptionCount}. New entries require maintainer review: ` +
      `increment both "baseline" and "approved" in scripts/token-drift-allowlist.json ` +
      `and have a maintainer sign off.`,
  });
}

if (liveExceptionCount < baselineExceptionCount) {
  // Exceptions were removed — update the baseline to reflect the improvement.
  console.log(
    `[token-drift] ✓ Exception count decreased from ${baselineExceptionCount} to ${liveExceptionCount}. ` +
      'Update "baseline" in token-drift-allowlist.json to lock in the improvement.',
  );
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const totalViolations = violations.length + baselineViolations.length;

const report = {
  generatedAt: new Date().toISOString(),
  violationCount: totalViolations,
  allowlistExceptionCount: liveExceptionCount,
  violations,
  baselineViolations,
};

if (reportFile) {
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
  console.log(`[token-drift] Report written to: ${reportFile}`);
}

if (totalViolations === 0) {
  console.log(
    `[token-drift] ✓ No token-drift violations detected. ` +
      `(${liveExceptionCount} allowlisted exception(s))`,
  );
  process.exit(0);
}

// Print actionable output
console.error(`\n[token-drift] ✗ ${totalViolations} violation(s) found:\n`);

for (const v of violations) {
  console.error(`  ${v.file}:${v.line}`);
  console.error(`    Rule: ${v.rule}`);
  console.error(`    ${v.description}`);
  if (v.snippet) console.error(`    Snippet: ${v.snippet}`);
  console.error('');
}

for (const v of baselineViolations) {
  console.error(`  [allowlist] Rule: ${v.rule}`);
  console.error(`    ${v.description}`);
  console.error('');
}

console.error(
  '[token-drift] See docs/design-system/COMPONENT_DEPRECATION_POLICY.md for remediation guidance.\n',
);

process.exit(1);
