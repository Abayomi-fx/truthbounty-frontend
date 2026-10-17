import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import {
  APPROVED_BOARDS,
  CANONICAL_ROUTE_EXPECTATIONS,
  DISCOVERED_ROUTE_CLASSIFICATIONS,
  GLOBAL_BOARD_REFS,
  LEGACY_ROUTE_REDIRECTS,
  findCanonicalRoute,
  isApprovedBoard,
  normalizeRoutePattern,
  resolveLegacyRedirect,
} from '../route-authority';

const APP_ROOT = path.join(process.cwd(), 'src', 'app');

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function routeFromPageFile(filePath: string): string {
  const relativeDirectory = path
    .relative(APP_ROOT, path.dirname(filePath))
    .split(path.sep)
    .join('/');

  const segments = relativeDirectory
    .split('/')
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')));

  const pattern = `/${segments
    .map((segment) =>
      segment.startsWith('[') && segment.endsWith(']') ? ':param' : segment,
    )
    .join('/')}`;

  return pattern === '/' ? '/' : pattern.replace(/\/$/, '');
}

function discoverAppRoutes(): string[] {
  const pages = walk(APP_ROOT).filter(
    (filePath) => path.basename(filePath) === 'page.tsx',
  );
  return Array.from(new Set(pages.map(routeFromPageFile))).sort();
}

describe('UI-FE-087 route inventory', () => {
  it('discovers a non-empty route inventory', () => {
    const routes = discoverAppRoutes();
    expect(routes.length).toBeGreaterThan(0);
    expect(routes).toContain('/');
    expect(routes).toContain('/claims');
  });

  it('fails when any shipped page route is missing an authority mapping', () => {
    const routes = discoverAppRoutes();
    const unmapped: string[] = [];

    for (const route of routes) {
      const matches = DISCOVERED_ROUTE_CLASSIFICATIONS.filter(
        (entry) => normalizeRoutePattern(entry.pattern) === route,
      );
      if (matches.length !== 1) {
        unmapped.push(`${route} (${matches.length} mappings)`);
      }
    }

    expect(unmapped).toEqual([]);
  });

  it('maps every canonical and legacy route to an explicit canonical destination', () => {
    for (const classification of DISCOVERED_ROUTE_CLASSIFICATIONS) {
      if (classification.canonicalPath === null) {
        expect(classification.kind).toBe('internal-harness');
        continue;
      }

      const route = findCanonicalRoute(classification.canonicalPath);
      expect(route?.path).toBe(classification.canonicalPath);

      if (classification.kind === 'legacy-alias') {
        const redirect = resolveLegacyRedirect(classification.pattern);
        expect(redirect?.destination).toBe(classification.canonicalPath);
      }
    }
  });

  it('does not classify the same normalized route twice', () => {
    const normalized = DISCOVERED_ROUTE_CLASSIFICATIONS.map((entry) =>
      normalizeRoutePattern(entry.pattern),
    );
    expect(new Set(normalized).size).toBe(normalized.length);
  });

  it('defines every canonical route once', () => {
    const normalized = CANONICAL_ROUTE_EXPECTATIONS.map((route) =>
      normalizeRoutePattern(route.path),
    );
    expect(new Set(normalized).size).toBe(normalized.length);
  });

  it('keeps every legacy redirect destination canonical and non-cyclic', () => {
    const aliases = new Set(LEGACY_ROUTE_REDIRECTS.map((entry) => entry.from));

    for (const redirect of LEGACY_ROUTE_REDIRECTS) {
      expect(aliases.has(redirect.destination)).toBe(false);
      expect(findCanonicalRoute(redirect.destination)).toBeDefined();
      expect(redirect.preserveQuery).toBe(true);
      expect(redirect.preserveHash).toBe(true);
    }
  });

  it('declares each route alias on its canonical destination', () => {
    for (const redirect of LEGACY_ROUTE_REDIRECTS) {
      if (redirect.source !== 'protocol-authority') continue;
      const destination = findCanonicalRoute(redirect.destination);
      expect(destination?.aliases).toContain(redirect.from);
    }
  });
});

describe('UI-FE-087 board-reference completeness', () => {
  it('references only approved protocol boards', () => {
    for (const route of CANONICAL_ROUTE_EXPECTATIONS) {
      for (const boardRef of route.boardRefs) {
        expect(isApprovedBoard(boardRef)).toBe(true);
      }
    }
    for (const boardRef of GLOBAL_BOARD_REFS) {
      expect(isApprovedBoard(boardRef)).toBe(true);
    }
  });

  it('gives every route either a board reference or an explicit sitemap-only reason', () => {
    for (const route of CANONICAL_ROUTE_EXPECTATIONS) {
      if (route.boardAuthority === 'sitemap-only') {
        expect(route.boardRefs).toEqual([]);
      } else {
        expect(route.boardRefs.length).toBeGreaterThan(0);
      }
    }
  });

  it('references every route-specific approved board at least once', () => {
    const referenced = new Set(
      CANONICAL_ROUTE_EXPECTATIONS.flatMap((route) => route.boardRefs),
    );
    const global = new Set(GLOBAL_BOARD_REFS);

    const unreferenced = APPROVED_BOARDS.filter(
      (board) => !global.has(board.path) && !referenced.has(board.path),
    ).map((board) => board.path);

    expect(unreferenced).toEqual([]);
  });

  it('keeps the approved board inventory at the protocol count', () => {
    expect(APPROVED_BOARDS).toHaveLength(58);
    expect(new Set(APPROVED_BOARDS.map((board) => board.path)).size).toBe(58);
  });
});
