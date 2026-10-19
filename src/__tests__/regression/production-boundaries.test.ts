import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT = path.join(
  process.cwd(),
  "scripts",
  "verify-production-boundaries.mjs",
);

function write(root: string, relativePath: string, contents: string): void {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, "utf8");
}

function run(root: string, mode: "source" | "bundle"): string {
  try {
    return execFileSync(process.execPath, [SCRIPT, mode, "--root", root], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    throw new Error(`${failure.stdout ?? ""}${failure.stderr ?? ""}`);
  }
}

describe("V2-FE-087 production boundaries", () => {
  const temporaryRoots: string[] = [];

  afterEach(() => {
    for (const root of temporaryRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  function createRoot(): string {
    const root = mkdtempSync(path.join(tmpdir(), "truthbounty-boundary-"));
    temporaryRoots.push(root);
    return root;
  }

  it("allows test fixtures to exist when production does not import them", () => {
    const root = createRoot();
    write(root, "src/lib/value.ts", "export const value = 1;");
    write(
      root,
      "src/app/page.ts",
      "import { value } from '@/lib/value'; export { value };",
    );
    write(
      root,
      "src/__tests__/mocks/wallet.ts",
      'export const fakeHash = "0xfixture";',
    );

    expect(run(root, "source")).toContain("passed");
  });

  it("rejects production imports from test-only paths", () => {
    const root = createRoot();
    write(root, "src/__tests__/mocks/wallet.ts", "export const wallet = {};");
    write(
      root,
      "src/app/page.ts",
      "import { wallet } from '@/__tests__/mocks/wallet'; export { wallet };",
    );

    expect(() => run(root, "source")).toThrow(/imports test-only module/);
  });

  it("rejects test tooling imported by production source", () => {
    const root = createRoot();
    write(
      root,
      "src/app/page.ts",
      "import { http } from 'msw'; export { http };",
    );

    expect(() => run(root, "source")).toThrow(
      /imports test-only package "msw"/,
    );
  });

  it("rejects test-tool package subpaths", () => {
    const root = createRoot();
    write(root, "src/app/page.ts", "import { setupServer } from 'msw/node';");

    expect(() => run(root, "source")).toThrow(
      /imports test-only package "msw\/node"/,
    );
  });

  it("rejects compact re-exports from test-only paths", () => {
    const root = createRoot();
    write(root, "src/__tests__/mocks/wallet.ts", "export const wallet = {};");
    write(root, "src/app/page.ts", 'export{wallet}from"@/__tests__/mocks/wallet";');

    expect(() => run(root, "source")).toThrow(/imports test-only module/);
  });

  it("ignores import text inside a string literal", () => {
    const root = createRoot();
    write(root, "src/app/page.ts", 'const example = "import { http } from \'msw\'";');

    expect(run(root, "source")).toContain("passed");
  });

  it("rejects wallet-mock canaries in production build output", () => {
    const root = createRoot();
    write(
      root,
      ".next/static/chunks/app.js",
      "TRUTHBOUNTY_TEST_ONLY_WALLET_MOCK_V2_FE_087",
    );

    expect(() => run(root, "bundle")).toThrow(/contains test-only marker/);
  });

  it("retains the wallet-mock canary when an optimized bundle uses a mock export", () => {
    const root = createRoot();
    const output = execFileSync(
      process.execPath,
      [
        "-e",
        `const { buildSync } = require('esbuild');
         const result = buildSync({
           stdin: {
             contents: "import { createMockWallet } from './src/__tests__/mocks/wagmi/mock-wagmi'; globalThis.wallet = createMockWallet();",
             resolveDir: process.cwd(),
             loader: 'ts',
           },
           bundle: true,
           define: { 'process.env.NODE_ENV': '"production"' },
           external: ['react'],
           minify: true,
           platform: 'browser',
           write: false,
         });
         process.stdout.write(result.outputFiles[0].text);`,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    write(root, ".next/static/chunks/wallet.js", output);

    expect(() => run(root, "bundle")).toThrow(/contains test-only marker/);
  });

  it("passes the repository production import graph", () => {
    expect(run(process.cwd(), "source")).toContain("passed");
  });
});
