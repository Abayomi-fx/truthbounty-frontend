/**
 * UI-FE-080: Deterministic Receipt Serialization & SHA-256 Checksum
 *
 * Implements the acceptance criterion:
 * "Export is deterministic for the same canonical record."
 *
 * All object keys are recursively sorted alphabetically so that
 * equivalent receipts serialize to 100% byte-identical JSON strings.
 */

import { createHash } from 'crypto';
import type { CanonicalReceiptRecord } from './types';

/**
 * Recursively sort object keys alphabetically and normalize primitive values.
 */
export function sortKeysAlphabetically(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortKeysAlphabetically);
  }

  const sortedObj: Record<string, unknown> = {};
  const keys = Object.keys(value as Record<string, unknown>).sort();

  for (const key of keys) {
    sortedObj[key] = sortKeysAlphabetically((value as Record<string, unknown>)[key]);
  }

  return sortedObj;
}

/**
 * Compute SHA-256 checksum of a string.
 * Uses Node's crypto or browser fallback.
 */
export function sha256Hex(content: string): string {
  // Normalize line endings before hashing
  const normalized = content.replace(/\r\n/g, '\n');
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Serialize a receipt object to canonical, deterministic JSON.
 * Keys are sorted recursively, 2-space indentation, unix newlines.
 */
export function serializeDeterministicReceiptJson(
  receipt: Omit<CanonicalReceiptRecord, 'checksum'> | CanonicalReceiptRecord,
): string {
  const sorted = sortKeysAlphabetically(receipt);
  return JSON.stringify(sorted, null, 2).replace(/\r\n/g, '\n');
}

/**
 * Calculate the canonical checksum for a receipt record.
 * Checksum is computed over the deterministic JSON of the record EXCLUDING the checksum field itself.
 */
export function computeReceiptChecksum(
  receipt: Omit<CanonicalReceiptRecord, 'checksum'>,
): string {
  // Ensure 'checksum' property is omitted from the hash input
  const { checksum: _discard, ...canonicalData } = receipt as CanonicalReceiptRecord;
  const canonicalJson = serializeDeterministicReceiptJson(canonicalData);
  return sha256Hex(canonicalJson);
}
