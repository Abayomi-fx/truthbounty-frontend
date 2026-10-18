/**
 * UI-FE-029 — Typed governed-change action catalogue.
 *
 * The only configuration changes the UI may compose. Everything here is a
 * maintainer-approved, protocol-level configuration change; the UI never
 * composes an arbitrary target/method/parameter. `resolveGovernedChangeCall`
 * rejects any composition that is not in this catalogue.
 */

import type {
  GovernedChangeCall,
  GovernedChangeCallRejection,
  GovernedChangeTimelockOperation,
} from './types';

export type GovernedChangeParameterType =
  | 'uint256'
  | 'address'
  | 'bytes32'
  | 'boolean';

export interface GovernedChangeParameterSchema {
  readonly key: string;
  readonly label: string;
  readonly type: GovernedChangeParameterType;
}

export interface GovernedChangeCatalogueEntry {
  readonly key: string;
  /** Exact target contract the governed change configures. */
  readonly contract: string;
  /** Exact method on the target contract. */
  readonly method: string;
  /** The timelock operation used to enact the change. */
  readonly timelockOperation: GovernedChangeTimelockOperation;
  readonly label: string;
  readonly description: string;
  readonly parameterSchema: readonly GovernedChangeParameterSchema[];
}

/**
 * Approved configuration changes. These mirror the protocol's configurable
 * parameters; adding a change requires a maintainer-reviewed entry here.
 */
export const GOVERNED_CHANGE_CATALOGUE: readonly GovernedChangeCatalogueEntry[] = [
  {
    key: 'settlement-finality-threshold',
    contract: 'TruthBountyWeighted',
    method: 'setSettlementFinalityThreshold',
    timelockOperation: 'schedule',
    label: 'Settlement finality threshold',
    description:
      'Number of L2 confirmations required before a settlement is treated as safe.',
    parameterSchema: [
      { key: 'threshold', label: 'Threshold (confirmations)', type: 'uint256' },
    ],
  },
  {
    key: 'dispute-window-seconds',
    contract: 'TruthBountyWeighted',
    method: 'setDisputeWindow',
    timelockOperation: 'schedule',
    label: 'Dispute window',
    description: 'Length of the dispute window, in seconds.',
    parameterSchema: [
      { key: 'seconds', label: 'Window (seconds)', type: 'uint256' },
    ],
  },
  {
    key: 'timelock-delay-seconds',
    contract: 'TimelockController',
    method: 'updateDelay',
    timelockOperation: 'updateDelay',
    label: 'Timelock delay',
    description:
      'Minimum delay between scheduling and executing a governed proposal.',
    parameterSchema: [
      { key: 'seconds', label: 'Delay (seconds)', type: 'uint256' },
    ],
  },
] as const;

const ENTRY_BY_KEY: ReadonlyMap<string, GovernedChangeCatalogueEntry> = new Map(
  GOVERNED_CHANGE_CATALOGUE.map((entry) => [entry.key, entry]),
);

export function getGovernedChangeEntry(
  key: string,
): GovernedChangeCatalogueEntry | undefined {
  return ENTRY_BY_KEY.get(key);
}

export function isSupportedGovernedChange(key: string): boolean {
  return ENTRY_BY_KEY.has(key);
}

const UINT256_PATTERN = /^\d+$/;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function isValidParameterValue(
  type: GovernedChangeParameterType,
  value: string,
): boolean {
  switch (type) {
    case 'uint256':
      return UINT256_PATTERN.test(value);
    case 'address':
      return ADDRESS_PATTERN.test(value);
    case 'bytes32':
      return BYTES32_PATTERN.test(value);
    case 'boolean':
      return value === 'true' || value === 'false';
    default:
      return false;
  }
}

/**
 * Reject an arbitrary target/method pair that is not part of the catalogue.
 * The UI must never submit a call outside the approved set.
 */
export function rejectUnsupportedCall(
  contract: string,
  method: string,
): GovernedChangeCallRejection {
  const entry = GOVERNED_CHANGE_CATALOGUE.find(
    (candidate) => candidate.contract === contract && candidate.method === method,
  );
  if (!entry) {
    return {
      code: 'UNSUPPORTED_METHOD',
      reason: `Target "${contract}#${method}" is not an approved governed change.`,
    };
  }
  return {
    code: 'UNKNOWN_CHANGE',
    reason: `Change for "${contract}#${method}" has no catalogue key.`,
  };
}

/**
 * Compose a supported governed call from catalogue values. Fails closed with a
 * precise rejection for any unknown change, unknown/missing parameter, or
 * parameter whose value does not match its declared type.
 */
export function resolveGovernedChangeCall(
  key: string,
  values: Readonly<Record<string, string>>,
): { ok: true; call: GovernedChangeCall } | { ok: false; rejection: GovernedChangeCallRejection } {
  const entry = ENTRY_BY_KEY.get(key);
  if (!entry) {
    return {
      ok: false,
      rejection: {
        code: 'UNKNOWN_CHANGE',
        reason: `Governed change "${key}" is not in the approved catalogue.`,
      },
    };
  }

  const schemaKeys = new Set(entry.parameterSchema.map((param) => param.key));
  for (const providedKey of Object.keys(values)) {
    if (!schemaKeys.has(providedKey)) {
      return {
        ok: false,
        rejection: {
          code: 'UNKNOWN_PARAMETER',
          reason: `Parameter "${providedKey}" is not part of "${key}".`,
        },
      };
    }
  }

  const parameters: string[] = [];
  for (const param of entry.parameterSchema) {
    const value = values[param.key];
    if (value === undefined || value.trim() === '') {
      return {
        ok: false,
        rejection: {
          code: 'MISSING_PARAMETER',
          reason: `Parameter "${param.label}" is required.`,
        },
      };
    }
    if (!isValidParameterValue(param.type, value.trim())) {
      return {
        ok: false,
        rejection: {
          code: 'INVALID_PARAMETER_TYPE',
          reason: `Parameter "${param.label}" must be a ${param.type}.`,
        },
      };
    }
    parameters.push(value.trim());
  }

  return {
    ok: true,
    call: {
      changeKey: entry.key,
      label: entry.label,
      summary: entry.description,
      targetResource: `${entry.contract}#${entry.method}`,
      timelockOperation: entry.timelockOperation,
      target: {
        target: entry.contract,
        method: entry.method,
        parameters,
        selector: null,
      },
    },
  };
}
