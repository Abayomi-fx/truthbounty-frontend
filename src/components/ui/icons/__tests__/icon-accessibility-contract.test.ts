/**
 * UI-FE-089 — Static icon accessibility guard.
 *
 * A source-level rule that rejects unnamed icon-only controls and unnamed
 * meaningful icons anywhere in production code, and prevents bypassing the
 * registry by importing the raw glyph map directly. This complements the
 * TypeScript discriminated-union contract and the runtime guard.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(tsx|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function isProductionFile(file: string): boolean {
  const rel = path.relative(ROOT, file);
  return (
    !rel.includes('__tests__') &&
    !rel.includes('__mocks__') &&
    !rel.includes('/fixtures/') &&
    !/\.(test|spec|stories)\./.test(rel)
  );
}

/**
 * Extract the opening tag body for `tagName`, handling nested braces and
 * quoted strings so attribute values containing `>` do not truncate the tag.
 */
function openingTags(source: string, tagName: string): string[] {
  const tags: string[] = [];
  const needle = `<${tagName}`;
  let index = source.indexOf(needle);

  while (index !== -1) {
    let i = index + needle.length;
    let depth = 0;
    let quote: string | null = null;

    for (; i < source.length; i += 1) {
      const char = source[i];
      if (quote) {
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char;
        continue;
      }
      if (char === '{' || char === '(') depth += 1;
      else if (char === '}' || char === ')') depth -= 1;
      else if (char === '>' && depth === 0) break;
    }

    const body = source.slice(index + needle.length, i);
    // Only treat as a real tag if the next non-space character is an attribute
    // or the closing brace — guards against `<IconButtonFoo`.
    if (/^[\s\n]/.test(body) || body === '' || body.startsWith('>')) {
      tags.push(body);
    }
    index = source.indexOf(needle, index + needle.length);
  }

  return tags;
}

function hasAttribute(body: string, name: string): boolean {
  return new RegExp(`(^|[\\s])${name}\\s*=`).test(body);
}

describe('icon accessibility static guard', () => {
  const files = walk(SRC).filter(isProductionFile);

  it('ships production components to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('requires every <IconButton> to declare a label', () => {
    const violations: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const tag of openingTags(source, 'IconButton')) {
        if (!hasAttribute(tag, 'label')) {
          violations.push(`${path.relative(ROOT, file)}: <IconButton> without label`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('requires every meaningful <Icon decorative={false}> to have a name', () => {
    const violations: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const tag of openingTags(source, 'Icon')) {
        const meaningful = /decorative\s*=\s*\{\s*false\s*\}/.test(tag);
        if (
          meaningful &&
          !hasAttribute(tag, 'title') &&
          !hasAttribute(tag, 'aria-label')
        ) {
          violations.push(
            `${path.relative(ROOT, file)}: meaningful <Icon> without title/aria-label`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('prevents production code from importing the raw glyph map', () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = path.relative(ROOT, file);
      if (rel.startsWith(path.join('src', 'components', 'ui', 'icons'))) continue;
      const source = fs.readFileSync(file, 'utf8');
      if (/from\s+['"][^'"]*icons\/icon-map['"]/.test(source)) {
        violations.push(`${rel}: imports icons/icon-map directly`);
      }
    }
    expect(violations).toEqual([]);
  });
});
