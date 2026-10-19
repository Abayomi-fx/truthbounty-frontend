/**
 * V2-FE-150 regression gate: no fabricated protocol state in production code.
 *
 * The canonical `TruthBountyWeighted` ABI is the only authority for contract
 * behaviour. Protocol facts that the ABI cannot express (appeal snapshot,
 * deadline, stake bounds, wallet position) must come from the API projection.
 * These tests fail if placeholder values, synthetic calldata, invented gas
 * limits, or fabricated hashes are reintroduced.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = join(process.cwd(), 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === '__tests__') return [];
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

/** Production sources only: tests and fixtures are allowed to hold sample data. */
const PRODUCTION_FILES = walk(SRC).filter(
  (file) => !/\.(test|spec)\.[jt]sx?$/.test(file) && !file.includes('__tests__'),
);

const read = (file: string) => readFileSync(file, 'utf8');
const rel = (file: string) => relative(process.cwd(), file);

/** Server freshness windows are wall-clock by definition, not protocol state. */
const isServerRoute = (file: string) => file.includes(`${sep}app${sep}api${sep}`);

describe('no fabricated protocol state (V2-FE-150)', () => {
  it('finds production sources to scan', () => {
    expect(PRODUCTION_FILES.length).toBeGreaterThan(50);
  });

  describe.each(PRODUCTION_FILES.map((file) => [rel(file), file]))('%s', (_name, file) => {
    const source = read(file);

    it('does not hardcode a transaction hash literal', () => {
      // 0x + 64 hex chars is a transaction hash / signature shape. Uniform
      // words are well-known constants (e.g. viem's maxUint256) and are fine.
      const matches = (source.match(/0x[a-fA-F0-9]{64}/g) ?? []).filter(
        (literal) => !/^0x(.)\1{63}$/.test(literal),
      );
      expect(matches).toEqual([]);
    });

    it('does not hardcode a fabricated gas limit fallback', () => {
      // A bare numeric gas limit outside a constant declaration is a guess.
      expect(source).not.toMatch(/gas(?:Estimate|Limit)?\s*=\s*['"]?\d{4,}/i);
      expect(source).not.toMatch(
        /let\s+gas\w*\s*=\s*['"]\d+['"]/i,
      );
    });

    // Deadline math driven by Date.now() is fabricated; deadlines are
    // projected. Server freshness routes legitimately use wall-clock, so they
    // are asserted separately below rather than skipped.
    if (isServerRoute(file)) {
      it('uses the wall clock only for freshness reporting', () => {
        expect(source).not.toMatch(/APPEAL_PERIOD|blocksRemaining/);
      });
    } else {
      it('does not synthesise protocol state from the local clock', () => {
        expect(source).not.toMatch(
          /new Date\(Date\.now\(\)\s*[-+]\s*\d+\s*\*\s*60/,
        );
      });
    }

    it('does not derive block deadlines from a hardcoded block interval', () => {
      expect(source).not.toMatch(
        /APPEAL_PERIOD_BLOCKS\s*=|OPTIMISM_BLOCK_TIME\s*=/,
      );
    });
  });
});

describe('settlement and appeal writes are ABI-driven', () => {
  const settlement = read(join(SRC, 'hooks', 'useSettlementSubmission.ts'));
  const participation = read(join(SRC, 'hooks', 'useAppealParticipation.ts'));

  it('encodes settlement calldata from the pinned ABI', () => {
    expect(settlement).toMatch(/encodeFunctionData/);
    expect(settlement).not.toMatch(/data:\s*['"]0x[0-9a-fA-F]{8}/);
  });

  it('rejects claim ids that are not canonical 32-byte hex', () => {
    expect(settlement).toMatch(/0x\[0-9a-fA-F\]\{64\}/);
    expect(settlement).not.toMatch(/padStart\(64/);
  });

  it('refuses to submit without a wallet write path', () => {
    expect(participation).toMatch(/useWriteContract\(\)\s*\?\?\s*\{\}/);
    expect(participation).toMatch(/Wallet write path unavailable/);
  });

  it('gates participation on the ABI declaring the entrypoint', () => {
    expect(participation).toMatch(/UNSUPPORTED_ABI/);
    expect(participation).toMatch(/encodeFunctionData|args: \[appealIdBytes32/);
  });
});

describe('dispute submission is ABI-driven', () => {
  const dispute = read(join(SRC, 'hooks', 'useDisputeSubmission.ts'));

  it('contains no hardcoded function selector', () => {
    // A guessed selector for a function the artifact may not declare.
    expect(dispute).not.toMatch(/0x[0-9a-fA-F]{8}(?![0-9a-fA-F])/);
    expect(dispute).not.toMatch(/OPEN_DISPUTE_SELECTOR\s*=/);
  });

  it('discovers the entrypoint from the pinned ABI', () => {
    expect(dispute).toMatch(/DISPUTE_FUNCTIONS/);
    expect(dispute).toMatch(/encodeFunctionData/);
  });

  it('has no hardcoded gas limit and no locally predicted dispute id', () => {
    expect(dispute).not.toMatch(/'200000'/);
    expect(dispute).not.toMatch(/dispute-\$\{/);
    expect(dispute).toMatch(/estimateGas/);
  });

  it('does not claim the contract is unpaused without reading it', () => {
    expect(dispute).not.toMatch(/Mock implementation/);
    expect(dispute).not.toMatch(/return false;\s*\}/);
  });
});

describe('appeal context is projection-owned', () => {
  const hook = read(join(SRC, 'hooks', 'useAppealContext.ts'));

  it('loads every appeal field through the projection read layer', () => {
    expect(hook).toMatch(/loadAppealProjection/);
    expect(hook).not.toMatch(/mockSnapshot|mockDeadline|mockBounds|mockBalance|mockPosition/);
  });

  it('leaves context null and surfaces an error when the projection fails', () => {
    expect(hook).toMatch(/setContext\(null\)/);
  });

  it('does not recompute deadlines from a local block-height effect', () => {
    expect(hook).not.toMatch(/useBlockNumber/);
  });

  it('reads the transport through a ref so inline fetchers cannot refetch-storm', () => {
    expect(hook).toMatch(/fetcherRef/);
  });
});
