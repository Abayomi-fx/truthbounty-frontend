/**
 * UI-FE-080 Required Test:
 * Pending/replaced/reverted/finalized/reorged receipt snapshots
 * across the 7 canonical actions.
 */

import {
  generateReceipt,
  formatReceiptAsText,
  serializeDeterministicReceiptJson,
} from '../index';
import type { RawReceiptInput } from '../types';

const MOCK_HASH_1 = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const MOCK_HASH_2 = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
const MOCK_BLOCK_HASH = '0x9999888877776666555544443333222211110000aaaabbbbccccddddeeeeffff';

const FIXED_TIMESTAMP = '2026-10-15T12:00:00.000Z';

describe('UI-FE-080: Receipt State Snapshots', () => {
  it('generates deterministic snapshot for PENDING receipt', () => {
    const input: RawReceiptInput = {
      action: 'claim',
      status: 'pending',
      chainId: 11155420,
      txHash: MOCK_HASH_1,
      referenceId: 'claim-101',
      parameters: {
        claimant: '0x1111111111111111111111111111111111111111',
        bountyId: 42,
      },
      timestamp: FIXED_TIMESTAMP,
    };

    const receipt = generateReceipt(input);
    expect(receipt.status).toBe('pending');
    expect(receipt.provenance.consensus.finalityLevel).toBe('none');
    expect(receipt.provenance.consensus.confirmations).toBeNull();

    const serialized = serializeDeterministicReceiptJson(receipt);
    expect(serialized).toMatchSnapshot();
  });

  it('generates deterministic snapshot for REPLACED receipt with visible lineage', () => {
    const input: RawReceiptInput = {
      action: 'retry',
      status: 'replaced',
      chainId: 11155420,
      txHash: MOCK_HASH_1,
      isReplaced: true,
      replacedBy: MOCK_HASH_2,
      originalTxHash: MOCK_HASH_1,
      referenceId: 'retry-speedup-001',
      parameters: {
        newGasPriceGwei: 25,
      },
      timestamp: FIXED_TIMESTAMP,
    };

    const receipt = generateReceipt(input);
    expect(receipt.status).toBe('replaced');
    expect(receipt.provenance.history.isReplaced).toBe(true);
    expect(receipt.provenance.history.replacedBy).toBe(MOCK_HASH_2);

    const serialized = serializeDeterministicReceiptJson(receipt);
    expect(serialized).toMatchSnapshot();
  });

  it('generates deterministic snapshot for REVERTED receipt', () => {
    const input: RawReceiptInput = {
      action: 'dispute',
      status: 'reverted',
      chainId: 11155420,
      txHash: MOCK_HASH_1,
      blockNumber: '1023450',
      blockHash: MOCK_BLOCK_HASH,
      confirmations: 1,
      referenceId: 'dispute-appeal-99',
      notes: 'Execution reverted: DisputePeriodExpired',
      parameters: {
        disputeId: 99,
        revertCode: 'DISPUTE_EXPIRED',
      },
      timestamp: FIXED_TIMESTAMP,
    };

    const receipt = generateReceipt(input);
    expect(receipt.status).toBe('reverted');
    expect(receipt.provenance.consensus.finalityLevel).toBe('none');

    const serialized = serializeDeterministicReceiptJson(receipt);
    expect(serialized).toMatchSnapshot();
  });

  it('generates deterministic snapshot for FINALIZED receipt with full provenance', () => {
    const input: RawReceiptInput = {
      action: 'verification',
      status: 'finalized',
      chainId: 11155420,
      txHash: MOCK_HASH_1,
      blockNumber: '1023400',
      blockHash: MOCK_BLOCK_HASH,
      confirmations: 15, // >= finalizedThreshold (12)
      safeThreshold: 1,
      finalizedThreshold: 12,
      indexerAcknowledged: true,
      referenceId: 'verdict-claim-55',
      targetResource: 'TruthBountyWeighted#submitVerdict',
      parameters: {
        claimId: 55,
        verdict: 'APPROVED',
        payoutAmountWei: '1000000000000000000',
      },
      timestamp: FIXED_TIMESTAMP,
    };

    const receipt = generateReceipt(input);
    expect(receipt.status).toBe('finalized');
    expect(receipt.provenance.consensus.finalityLevel).toBe('finalized');
    expect(receipt.provenance.consensus.indexerAcknowledged).toBe(true);

    const serialized = serializeDeterministicReceiptJson(receipt);
    expect(serialized).toMatchSnapshot();
  });

  it('generates deterministic snapshot for REORGED receipt retaining orphaned history', () => {
    const input: RawReceiptInput = {
      action: 'pause',
      status: 'reorged',
      chainId: 11155420,
      txHash: MOCK_HASH_1,
      blockNumber: '1023390',
      isReorged: true,
      orphanedBlockHash: MOCK_BLOCK_HASH,
      reorgDetectedAt: FIXED_TIMESTAMP,
      referenceId: 'emergency-pause-01',
      parameters: {
        operator: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        action: 'EMERGENCY_PAUSE',
      },
      timestamp: FIXED_TIMESTAMP,
    };

    const receipt = generateReceipt(input);
    expect(receipt.status).toBe('reorged');
    expect(receipt.provenance.history.isReorged).toBe(true);
    expect(receipt.provenance.history.orphanedBlockHash).toBe(MOCK_BLOCK_HASH);
    expect(receipt.provenance.consensus.finalityLevel).toBe('none');

    const serialized = serializeDeterministicReceiptJson(receipt);
    expect(serialized).toMatchSnapshot();
  });

  it('generates plain text snapshot for SUPPORT-REFERENCE action', () => {
    const input: RawReceiptInput = {
      action: 'support-reference',
      status: 'safe',
      chainId: 10,
      txHash: MOCK_HASH_1,
      blockNumber: '25410990',
      blockHash: MOCK_BLOCK_HASH,
      confirmations: 5,
      referenceId: 'TICKET-SUPP-8821',
      notes: 'User reported stuck withdrawal, verified on-chain inclusion',
      parameters: {
        ticketCategory: 'WITHDRAWAL_INQUIRY',
        accountAddress: '0x3333333333333333333333333333333333333333',
      },
      timestamp: FIXED_TIMESTAMP,
    };

    const receipt = generateReceipt(input);
    const plainText = formatReceiptAsText(receipt);
    expect(plainText).toMatchSnapshot();
  });

  it('generates governance proposal decision snapshot', () => {
    const input: RawReceiptInput = {
      action: 'governance',
      status: 'finalized',
      chainId: 10,
      txHash: MOCK_HASH_1,
      blockNumber: '25410000',
      blockHash: MOCK_BLOCK_HASH,
      confirmations: 20,
      indexerAcknowledged: true,
      referenceId: 'prop-gov-12',
      targetResource: 'TimelockController#executeProposal',
      parameters: {
        proposalId: 12,
        proposer: '0x4444444444444444444444444444444444444444',
        parameterKey: 'MAX_BOUNTY_WEIGHT',
        newValue: 500,
      },
      timestamp: FIXED_TIMESTAMP,
    };

    const receipt = generateReceipt(input);
    expect(receipt.action).toBe('governance');
    expect(receipt.status).toBe('finalized');

    const serialized = serializeDeterministicReceiptJson(receipt);
    expect(serialized).toMatchSnapshot();
  });
});
