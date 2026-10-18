/**
 * UI-FE-086 — The single allowlist for optimistic UI.
 *
 * A patch is accepted only when:
 *   1. its operation id appears below,
 *   2. every changed field is explicitly allowed by that operation,
 *   3. no changed path targets a final/economic/permission/dispute outcome,
 *   4. the current canonical snapshot satisfies the operation guard, and
 *   5. every supplied value is one of the explicitly allowed values.
 *
 * The allowlist is intentionally small. "Convenient" status changes that
 * imply settlement, verification, rejection, rewards, or permissions must wait
 * for canonical receipts/projections.
 */

import {
  OptimisticUpdateError,
  type OptimisticEntity,
  type OptimisticOperationId,
} from './types';

export interface OptimisticOperationDefinition {
  readonly id: OptimisticOperationId;
  readonly entity: OptimisticEntity;
  readonly description: string;
  /** Top-level snapshot fields this operation may change. */
  readonly allowedFields: readonly string[];
  /** Explicit values allowed for each field (defence in depth). */
  readonly allowedValues: Readonly<Record<string, readonly unknown[]>>;
  /** The overlay may only start from a snapshot accepted by this guard. */
  readonly canApply: (current: unknown) => boolean;
}

const CLAIM_STATUS_FIELD = 'status';

/**
 * Fields/paths that can never be optimistic, even if a future operation tries
 * to allow them. This is deliberately semantic rather than exhaustive: the
 * positive allowlist is the primary control.
 */
const PROHIBITED_PATH =
  /(?:^|\.)(?:final(?:ity|ized)?|settle(?:ment|d)?|reward(?:s|Amount)?|claimable|payout|balance|permission(?:s)?|role(?:s)?|authorit(?:y|ative|ed)?|outcome|verdict|winner|verified|rejected|dispute(?:Outcome|Status|Result)?|disputed?|txHash|receipt|blockNumber|confirmations?)(?:\.|$)/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectPaths(value: Record<string, unknown>, prefix = ''): string[] {
  const paths: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path);
    if (isPlainObject(child)) {
      paths.push(...collectPaths(child, path));
    }
  }
  return paths;
}

export function isProhibitedOptimisticPath(path: string): boolean {
  return PROHIBITED_PATH.test(path);
}

export const OPTIMISTIC_UPDATE_ALLOWLIST: Readonly<
  Record<OptimisticOperationId, OptimisticOperationDefinition>
> = Object.freeze({
  'claim.status.under_review': Object.freeze({
    id: 'claim.status.under_review',
    entity: 'claim',
    description:
      'Show an in-review presentation for an OPEN claim. Reversible; never an outcome.',
    allowedFields: Object.freeze([CLAIM_STATUS_FIELD]),
    allowedValues: Object.freeze({
      [CLAIM_STATUS_FIELD]: Object.freeze(['UNDER_REVIEW']),
    }),
    canApply: (current: unknown) => {
      if (!isPlainObject(current)) return false;
      const status = current.status;
      // Only a non-final, non-economic status may be anticipated.
      return status === 'OPEN' || status === 'UNDER_REVIEW';
    },
  }),
});

export function isAllowedOptimisticOperationId(
  value: unknown,
): value is OptimisticOperationId {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(OPTIMISTIC_UPDATE_ALLOWLIST, value)
  );
}

export function getOptimisticOperation(
  operationId: string,
): OptimisticOperationDefinition {
  if (!isAllowedOptimisticOperationId(operationId)) {
    throw new OptimisticUpdateError(
      'UNKNOWN_OPERATION',
      `operation "${operationId}" is not in the optimistic allowlist`,
    );
  }
  return OPTIMISTIC_UPDATE_ALLOWLIST[operationId];
}

export function listOptimisticOperations(): readonly OptimisticOperationDefinition[] {
  return Object.values(OPTIMISTIC_UPDATE_ALLOWLIST);
}

export interface ValidatedOptimisticPatch<T extends object> {
  readonly optimistic: T;
  readonly changedFields: readonly string[];
}

/**
 * Validate a patch against the allowlist and derive the optimistic snapshot.
 * Fails closed for missing snapshots, unsafe fields, prohibited outcomes, and
 * no-op patches.
 */
export function validateOptimisticPatch<T extends object>(
  operationId: string,
  current: T,
  patch: Record<string, unknown>,
): ValidatedOptimisticPatch<T> {
  const operation = getOptimisticOperation(operationId);

  if (!isPlainObject(current)) {
    throw new OptimisticUpdateError(
      'MISSING_SNAPSHOT',
      'an optimistic update requires a current canonical snapshot',
    );
  }
  if (!isPlainObject(patch) || Object.keys(patch).length === 0) {
    throw new OptimisticUpdateError(
      'INVALID_PATCH',
      'optimistic patch must be a non-empty object',
    );
  }

  const paths = collectPaths(patch);
  for (const path of paths) {
    if (!operation.allowedFields.includes(path)) {
      throw new OptimisticUpdateError(
        'UNSAFE_FIELD',
        `field "${path}" is not allowed for ${operation.id}`,
      );
    }
    if (isProhibitedOptimisticPath(path)) {
      throw new OptimisticUpdateError(
        'PROHIBITED_OUTCOME',
        `field "${path}" would optimisticize a final or economic outcome`,
      );
    }
  }

  for (const [field, allowedValues] of Object.entries(operation.allowedValues)) {
    if (!(field in patch)) continue;
    const value = patch[field];
    if (!allowedValues.some((allowed) => Object.is(allowed, value))) {
      throw new OptimisticUpdateError(
        'PROHIBITED_OUTCOME',
        `value "${String(value)}" is not an allowed optimistic value for ${field}`,
      );
    }
  }

  if (!operation.canApply(current)) {
    throw new OptimisticUpdateError(
      'PROHIBITED_OUTCOME',
      `current snapshot is ineligible for ${operation.id}; canonical state wins`,
    );
  }

  const currentRecord = current as Record<string, unknown>;
  const changedFields = Object.keys(patch).filter(
    (field) => !Object.is(currentRecord[field], patch[field]),
  );

  if (changedFields.length === 0) {
    throw new OptimisticUpdateError(
      'INVALID_PATCH',
      'optimistic patch does not change the snapshot',
    );
  }

  const optimistic = { ...currentRecord, ...patch } as T;
  return { optimistic, changedFields };
}
