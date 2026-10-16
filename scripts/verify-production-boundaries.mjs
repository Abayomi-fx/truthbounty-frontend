#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const BUNDLE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".html",
  ".map",
]);
const TEST_ONLY_SEGMENTS = new Set([
  "__tests__",
  "__mocks__",
  "fixtures",
  "mocks",
  "stories",
  ".storybook",
]);
const TEST_ONLY_FILE = /(?:^|\.)(?:test|spec|stories)\.[cm]?[jt]sx?$/i;
const FORBIDDEN_RUNTIME_PACKAGES = [
  "@playwright/test",
  "@storybook/",
  "@testing-library/",
  "@vitest/",
  "jest",
  "jest-mock",
  "msw",
  "vitest",
];

// These values are deliberately unique to test support. If one appears in a
// production artifact, a test fixture or wallet mock crossed the boundary.
export const TEST_ONLY_BUNDLE_MARKERS = [
  "TRUTHBOUNTY_TEST_ONLY_WALLET_MOCK_V2_FE_087",
  "MOCK_TX_HASH_REVERTED",
  "createMockWallet",
  "createMockViemClient",
  "setupMockServer",
];

function normalizeRelative(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.includes(path.extname(filePath));
}

export function isTestOnlyPath(filePath) {
  const normalized = filePath.split(path.sep).join("/");
  const segments = normalized.split("/");
  return (
    segments.some((segment) => TEST_ONLY_SEGMENTS.has(segment)) ||
    TEST_ONLY_FILE.test(path.basename(normalized))
  );
}

function collectFiles(directory, predicate) {
  if (!existsSync(directory)) return [];

  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, predicate));
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

export function extractModuleSpecifiers(source, filePath = "boundary.tsx") {
  const syntaxTree = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const specifiers = new Set();

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.add(node.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      specifiers.add(node.moduleReference.expression.text);
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      (ts.isStringLiteral(node.arguments[0]) ||
        ts.isNoSubstitutionTemplateLiteral(node.arguments[0])) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      specifiers.add(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  }

  visit(syntaxTree);
  return [...specifiers];
}

function isForbiddenRuntimePackage(specifier) {
  return FORBIDDEN_RUNTIME_PACKAGES.some(
    (pkg) =>
      specifier === pkg ||
      specifier.startsWith(pkg.endsWith("/") ? pkg : `${pkg}/`),
  );
}

function resolveLocalImport(rootDir, importer, specifier) {
  let basePath;
  if (specifier.startsWith("@/")) {
    basePath = path.join(rootDir, "src", specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    basePath = path.resolve(path.dirname(importer), specifier);
  } else {
    return null;
  }

  const candidates = [
    basePath,
    ...SOURCE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) =>
      path.join(basePath, `index${extension}`),
    ),
  ];
  return (
    candidates.find(
      (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
    ) ?? basePath
  );
}

export function findSourceBoundaryViolations(rootDir = process.cwd()) {
  const sourceRoot = path.join(rootDir, "src");
  const productionFiles = collectFiles(
    sourceRoot,
    (filePath) =>
      isSourceFile(filePath) &&
      !isTestOnlyPath(normalizeRelative(sourceRoot, filePath)),
  );
  const violations = [];

  for (const filePath of productionFiles) {
    const importer = normalizeRelative(rootDir, filePath);
    const source = readFileSync(filePath, "utf8");
    for (const specifier of extractModuleSpecifiers(source, filePath)) {
      if (isForbiddenRuntimePackage(specifier)) {
        violations.push(`${importer} imports test-only package "${specifier}"`);
        continue;
      }

      const resolved = resolveLocalImport(rootDir, filePath, specifier);
      if (resolved && isTestOnlyPath(normalizeRelative(rootDir, resolved))) {
        violations.push(`${importer} imports test-only module "${specifier}"`);
      }
    }
  }

  return violations.sort();
}

export function findBundleBoundaryViolations(
  rootDir = process.cwd(),
  bundleDirectory = path.join(rootDir, ".next"),
) {
  if (!existsSync(bundleDirectory)) {
    return [
      `Production bundle directory does not exist: ${normalizeRelative(rootDir, bundleDirectory)}`,
    ];
  }

  const violations = [];
  const bundleFiles = collectFiles(bundleDirectory, (filePath) =>
    BUNDLE_EXTENSIONS.has(path.extname(filePath)),
  );
  for (const filePath of bundleFiles) {
    const contents = readFileSync(filePath, "utf8");
    for (const marker of TEST_ONLY_BUNDLE_MARKERS) {
      if (contents.includes(marker)) {
        violations.push(
          `${normalizeRelative(rootDir, filePath)} contains test-only marker "${marker}"`,
        );
      }
    }
  }
  return violations.sort();
}

function readCliOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function printResult(label, violations) {
  if (violations.length === 0) {
    console.log(`Production boundary check passed (${label}).`);
    return;
  }

  console.error(`Production boundary check failed (${label}):`);
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const mode = process.argv[2] ?? "source";
  const rootDir = path.resolve(readCliOption("--root") ?? process.cwd());
  const bundleDirectory = path.resolve(
    rootDir,
    readCliOption("--bundle-dir") ?? ".next",
  );

  if (mode === "source") {
    printResult("source imports", findSourceBoundaryViolations(rootDir));
  } else if (mode === "bundle") {
    printResult(
      "production bundle",
      findBundleBoundaryViolations(rootDir, bundleDirectory),
    );
  } else if (mode === "all") {
    printResult("source imports", findSourceBoundaryViolations(rootDir));
    printResult(
      "production bundle",
      findBundleBoundaryViolations(rootDir, bundleDirectory),
    );
  } else {
    console.error(`Unknown mode "${mode}". Expected source, bundle, or all.`);
    process.exitCode = 2;
  }
}
