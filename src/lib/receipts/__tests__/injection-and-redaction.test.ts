/**
 * UI-FE-080 Required Test:
 * Filename/content injection and redaction tests,
 * plus fail-closed canonical evidence invariants and determinism.
 */

import {
  generateReceipt,
  generateReceiptFilename,
  serializeDeterministicReceiptJson,
  computeReceiptChecksum,
  REDACTED_VALUE,
  ReceiptValidationError,
} from '../index';
import type { RawReceiptInput } from '../types';

describe('UI-FE-080: Filename & Content Injection Tests', () => {
  it('sanitizes path traversal sequences in filenames', () => {
    const malicious = '../../../etc/passwd';
    const filename = generateReceiptFilename({
      action: malicious,
      referenceOrHash: '../../shadow',
      status: 'safe',
      extension: 'json',
    });

    expect(filename).not.toContain('..');
    expect(filename).not.toContain('/');
    expect(filename).not.toContain('\\');
    expect(filename).toMatch(/^truthbounty-receipt-[a-zA-Z0-9_-]+\.json$/);
  });

  it('sanitizes Windows reserved device names in filenames', () => {
    const filename1 = generateReceiptFilename({
      action: 'CON',
      referenceOrHash: 'NUL',
      status: 'finalized',
      extension: 'json',
    });
    expect(filename1).not.toBe('CON.json');
    expect(filename1).toMatch(/^truthbounty-receipt-/);

    const filename2 = generateReceiptFilename({
      action: 'PRN',
      referenceOrHash: 'AUX',
      status: 'pending',
      extension: 'txt',
    });
    expect(filename2).toMatch(/^truthbounty-receipt-/);
  });

  it('sanitizes script tags, control characters, and null bytes in filename', () => {
    const injected = '<script>alert("xss")</script>\x00\x1f';
    const filename = generateReceiptFilename({
      action: injected,
      referenceOrHash: '0x1234567890abcdef',
      status: 'safe',
      extension: 'json',
    });

    expect(filename).not.toContain('<');
    expect(filename).not.toContain('>');
    expect(filename).not.toContain('\x00');
    expect(filename).not.toContain('\x1f');
    expect(filename).not.toContain('script');
  });

  it('neutralizes HTML and script tags in notes and parameter values', () => {
    const input: RawReceiptInput = {
      action: 'dispute',
      status: 'pending',
      chainId: 11155420,
      referenceId: 'disp-injection-test',
      notes: '<script>alert("hacked")</script> CRLF\r\ninjection',
      parameters: {
        payload: '<img src=x onerror=alert(1)>',
      },
    };

    const receipt = generateReceipt(input);
    expect(receipt.actionDetails.notes).not.toContain('\x00');
    expect(receipt.actionDetails.parameters.payload).toBeDefined();
  });
});

describe('UI-FE-080: Redaction of Secrets and Protected Rationale', () => {
  it('strictly excludes secrets, private keys, bearer tokens, and credentials', () => {
    const input: RawReceiptInput = {
      action: 'claim',
      status: 'pending',
      chainId: 11155420,
      referenceId: 'claim-redact-test',
      parameters: {
        privateKey: '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
        apiKey: 'secret_live_abcdef123456',
        password: 'SuperSecretPassword!123',
        authorizationHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ae7H',
        cookieToken: 'session_token=xyz987',
        safePublicId: 1042,
      },
    };

    const receipt = generateReceipt(input);

    expect(receipt.actionDetails.parameters.privateKey).toBe(REDACTED_VALUE);
    expect(receipt.actionDetails.parameters.apiKey).toBe(REDACTED_VALUE);
    expect(receipt.actionDetails.parameters.password).toBe(REDACTED_VALUE);
    expect(receipt.actionDetails.parameters.authorizationHeader).toBe(REDACTED_VALUE);
    expect(receipt.actionDetails.parameters.cookieToken).toBe(REDACTED_VALUE);
    expect(receipt.actionDetails.parameters.safePublicId).toBe(1042);

    const json = serializeDeterministicReceiptJson(receipt);
    expect(json).not.toContain('secret_live_abcdef123456');
    expect(json).not.toContain('SuperSecretPassword');
    expect(json).not.toContain('eyJhbGciOiJIUzI1Ni');
  });

  it('strictly redacts protected, internal, and secret rationale', () => {
    const input: RawReceiptInput = {
      action: 'verification',
      status: 'safe',
      chainId: 11155420,
      confirmations: 2,
      referenceId: 'verdict-confidential-rationale',
      parameters: {
        protectedRationale: 'Secret reviewer deliberation: node disputed based on undisclosed audit',
        privateRationale: 'Confidential reasoning from arbitrator',
        reviewerNotes: 'Internal node rating is flagged',
        voterDeliberation: 'Consensus voting quorum private debate',
        publicFinding: 'Passed automated test verification',
      },
    };

    const receipt = generateReceipt(input);

    expect(receipt.actionDetails.parameters.protectedRationale).toBe(REDACTED_VALUE);
    expect(receipt.actionDetails.parameters.privateRationale).toBe(REDACTED_VALUE);
    expect(receipt.actionDetails.parameters.reviewerNotes).toBe(REDACTED_VALUE);
    expect(receipt.actionDetails.parameters.voterDeliberation).toBe(REDACTED_VALUE);
    expect(receipt.actionDetails.parameters.publicFinding).toBe('Passed automated test verification');

    const json = serializeDeterministicReceiptJson(receipt);
    expect(json).not.toContain('undisclosed audit');
    expect(json).not.toContain('Confidential reasoning');
  });
});

describe('UI-FE-080: Canonical Evidence Invariants (Fail-Closed)', () => {
  it('throws EVIDENCE_EXCEEDED when finalized is claimed with insufficient confirmations', () => {
    const input: RawReceiptInput = {
      action: 'claim',
      status: 'finalized',
      chainId: 11155420,
      confirmations: 3, // < finalizedThreshold (12)
      safeThreshold: 1,
      finalizedThreshold: 12,
      indexerAcknowledged: true,
      referenceId: 'claim-fail-01',
    };

    expect(() => generateReceipt(input)).toThrow(ReceiptValidationError);
    expect(() => generateReceipt(input)).toThrow(/Cannot generate finalized receipt: confirmations/);
  });

  it('throws EVIDENCE_EXCEEDED when finalized is claimed without indexer acknowledgement', () => {
    const input: RawReceiptInput = {
      action: 'claim',
      status: 'finalized',
      chainId: 11155420,
      confirmations: 15,
      safeThreshold: 1,
      finalizedThreshold: 12,
      indexerAcknowledged: false, // missing!
      referenceId: 'claim-fail-02',
    };

    expect(() => generateReceipt(input)).toThrow(ReceiptValidationError);
    expect(() => generateReceipt(input)).toThrow(/indexer has not acknowledged/);
  });

  it('throws REORG_CONTRADICTION when claiming safe or finalized status for a reorged transaction', () => {
    const input: RawReceiptInput = {
      action: 'claim',
      status: 'finalized',
      chainId: 11155420,
      isReorged: true,
      orphanedBlockHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      confirmations: 20,
      indexerAcknowledged: true,
      referenceId: 'claim-fail-03',
    };

    expect(() => generateReceipt(input)).toThrow(ReceiptValidationError);
    expect(() => generateReceipt(input)).toThrow(/Cannot claim safe or finalized status for a reorged transaction/);
  });

  it('throws MISSING_REPLACEMENT_HASH when replaced is claimed without replacement hash', () => {
    const input: RawReceiptInput = {
      action: 'retry',
      status: 'replaced',
      chainId: 11155420,
      isReplaced: true,
      replacedBy: null, // missing!
      referenceId: 'retry-fail-04',
    };

    expect(() => generateReceipt(input)).toThrow(ReceiptValidationError);
    expect(() => generateReceipt(input)).toThrow(/Replaced transactions must preserve the replacedBy/);
  });

  it('throws INVALID_CHAIN when an unauthorized chain ID is provided', () => {
    const input: RawReceiptInput = {
      action: 'claim',
      status: 'pending',
      chainId: 999999, // unsupported
      referenceId: 'claim-fail-05',
    };

    expect(() => generateReceipt(input)).toThrow(ReceiptValidationError);
    expect(() => generateReceipt(input)).toThrow(/Chain ID 999999 is not supported/);
  });
});

describe('UI-FE-080: Deterministic Export', () => {
  it('guarantees identical byte-for-byte serialization across 100 runs on identical records', () => {
    const input: RawReceiptInput = {
      action: 'verification',
      status: 'safe',
      chainId: 11155420,
      txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      blockNumber: '500200',
      confirmations: 3,
      referenceId: 'deterministic-test-run',
      parameters: {
        z_last_key: 'zebra',
        a_first_key: 'apple',
        m_middle_key: 'mango',
        b_number: 42,
      },
      timestamp: '2026-10-15T10:30:00.000Z',
    };

    const baselineReceipt = generateReceipt(input);
    const baselineJson = serializeDeterministicReceiptJson(baselineReceipt);
    const baselineChecksum = computeReceiptChecksum(baselineReceipt);

    for (let i = 0; i < 100; i++) {
      // Re-order parameter keys intentionally to verify order independence
      const shuffledInput: RawReceiptInput = {
        ...input,
        parameters: {
          b_number: 42,
          m_middle_key: 'mango',
          z_last_key: 'zebra',
          a_first_key: 'apple',
        },
      };

      const iterationReceipt = generateReceipt(shuffledInput);
      const iterationJson = serializeDeterministicReceiptJson(iterationReceipt);
      const iterationChecksum = computeReceiptChecksum(iterationReceipt);

      expect(iterationJson).toBe(baselineJson);
      expect(iterationChecksum).toBe(baselineChecksum);
    }
  });
});
