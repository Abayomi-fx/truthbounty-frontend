/**
 * V2-FE-051 — regression: shared machine public surface must not pull simulators/mocks.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');

const MACHINE_FILES = [
  'src/lib/transaction-machine/transaction-machine.ts',
  'src/lib/transaction-machine/transaction-machine.types.ts',
  'src/lib/transaction-machine/lifecycle-feedback.ts',
  'src/lib/transaction-machine/index.ts',
  'src/hooks/useTransactionMachine.ts',
  'src/hooks/useEvmTransaction.ts',
];

const FORBIDDEN = [
  'transaction-simulator',
  'freighter',
  'soroban',
  '@stellar',
  'mock-wallet',
];

describe('transaction-machine production bundle guard', () => {
  it('does not import simulators, Stellar, or mock-wallet runtimes', () => {
    for (const rel of MACHINE_FILES) {
      const abs = path.join(ROOT, rel);
      const src = fs.readFileSync(abs, 'utf8');
      for (const needle of FORBIDDEN) {
        expect(src.toLowerCase().includes(needle.toLowerCase())).toBe(false);
      }
    }
  });
});
