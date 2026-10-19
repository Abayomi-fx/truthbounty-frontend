/**
 * Board-to-Route & State Conformity Configuration and Manifest Helpers
 * UI-FE-093 (#664)
 *
 * Source of truth:
 *   DigiNodes/truthbounty-protocol @ 60c66b78cf797d8f821089c99ae1bc461009fecc
 *
 * Connects implemented routes, views, and system states back to the 58 approved
 * high-fidelity boards across all 6 design batches.
 */

import manifestData from './board-conformity-manifest.json';

export type ConformityBatchId =
  | 'foundation'
  | 'public-claimant'
  | 'verifier'
  | 'dispute'
  | 'privileged'
  | 'support-legal';

export type ConformityViewportId = 'desktop' | 'tablet' | 'mobile' | 'zoom200';

export type ConformityStateId =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'error'
  | 'stale'
  | 'denied'
  | 'offline'
  | 'unavailable'
  | 'pending'
  | 'confirmed'
  | 'finalized'
  | 'reorged'
  | 'disabled';

export type ConformityImplementationStatus =
  | 'implemented'
  | 'planned'
  | 'unavailable'
  | 'blocked';

export type ConformityApprovalStatus =
  | 'approved'
  | 'variance-approved'
  | 'provisional'
  | 'blocked';

export interface KnownVariance {
  readonly id: string;
  readonly category: string;
  readonly description: string;
  readonly justification: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
}

export interface BoardA11yContract {
  readonly wcagCriteria: readonly string[];
  readonly zeroHorizontalScroll: boolean;
}

export interface ApprovedBoardEntry {
  readonly boardId: string;
  readonly batch: ConformityBatchId;
  readonly batchNumber: number;
  readonly name: string;
  readonly canonicalRoute: string | null;
  readonly implementationStatus: ConformityImplementationStatus;
  readonly approvalStatus: ConformityApprovalStatus;
  readonly blockedReason?: string;
  readonly requiredViewports: readonly ConformityViewportId[];
  readonly relevantStates: readonly ConformityStateId[];
  readonly stableRegions: readonly string[];
  readonly maskedRegions: readonly string[];
  readonly diffThreshold: number;
  readonly knownVariances: readonly KnownVariance[];
  readonly a11yContract?: BoardA11yContract;
}

export interface ConformityBatchInfo {
  readonly id: ConformityBatchId;
  readonly batchNumber: number;
  readonly title: string;
  readonly directory: string;
  readonly boardCount: number;
}

export interface ConformityViewportSpec {
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly deviceScaleFactor: number;
}

export interface BoardConformityManifest {
  readonly protocolAuthority: {
    readonly repository: string;
    readonly commit: string;
    readonly totalApprovedBoards: number;
    readonly batchCount: number;
    readonly sourceReferences: Record<string, string>;
  };
  readonly batches: readonly ConformityBatchInfo[];
  readonly viewports: Record<ConformityViewportId, ConformityViewportSpec>;
  readonly canonicalStates: readonly ConformityStateId[];
  readonly globalDynamicMasks: readonly string[];
  readonly maxAllowedDiffPixelRatio: number;
  readonly defaultDiffThreshold: number;
  readonly boards: readonly ApprovedBoardEntry[];
}

export const BOARD_CONFORMITY_MANIFEST: BoardConformityManifest =
  manifestData as unknown as BoardConformityManifest;

export const PROTOCOL_AUTHORITY_COMMIT =
  BOARD_CONFORMITY_MANIFEST.protocolAuthority.commit;

export const TOTAL_APPROVED_BOARDS =
  BOARD_CONFORMITY_MANIFEST.protocolAuthority.totalApprovedBoards;

/**
 * Returns a board entry by exact board ID path.
 */
export function getBoardEntry(boardId: string): ApprovedBoardEntry | undefined {
  return BOARD_CONFORMITY_MANIFEST.boards.find(
    (entry) => entry.boardId === boardId,
  );
}

/**
 * Returns all board entries mapped to a canonical route.
 */
export function getBoardsForRoute(
  route: string,
): readonly ApprovedBoardEntry[] {
  return BOARD_CONFORMITY_MANIFEST.boards.filter(
    (entry) => entry.canonicalRoute === route,
  );
}

/**
 * Returns all board entries within a batch.
 */
export function getBoardsForBatch(
  batch: ConformityBatchId,
): readonly ApprovedBoardEntry[] {
  return BOARD_CONFORMITY_MANIFEST.boards.filter(
    (entry) => entry.batch === batch,
  );
}

/**
 * Returns all implemented board entries that require visual capture.
 */
export function getImplementedBoards(): readonly ApprovedBoardEntry[] {
  return BOARD_CONFORMITY_MANIFEST.boards.filter(
    (entry) => entry.implementationStatus === 'implemented',
  );
}

/**
 * Returns all planned, unavailable, or blocked board entries.
 */
export function getBlockedOrPlannedBoards(): readonly ApprovedBoardEntry[] {
  return BOARD_CONFORMITY_MANIFEST.boards.filter(
    (entry) => entry.implementationStatus !== 'implemented',
  );
}

/**
 * Validates whether an entry has complete viewport and state coverage.
 */
export function validateBoardEntryIntegrity(entry: ApprovedBoardEntry): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (entry.implementationStatus === 'implemented') {
    const requiredViewports: ConformityViewportId[] = [
      'desktop',
      'tablet',
      'mobile',
      'zoom200',
    ];
    for (const vp of requiredViewports) {
      if (!entry.requiredViewports.includes(vp)) {
        errors.push(`Missing required viewport '${vp}'`);
      }
    }

    if (!entry.relevantStates || entry.relevantStates.length === 0) {
      errors.push('Missing relevant states list');
    }

    if (entry.diffThreshold > BOARD_CONFORMITY_MANIFEST.maxAllowedDiffPixelRatio) {
      errors.push(
        `Diff threshold ${entry.diffThreshold} exceeds max allowed ${BOARD_CONFORMITY_MANIFEST.maxAllowedDiffPixelRatio}`,
      );
    }
  } else {
    if (!entry.blockedReason || entry.blockedReason.trim().length === 0) {
      errors.push('Missing explicit blockedReason for non-implemented board');
    }
  }

  for (const variance of entry.knownVariances) {
    if (!variance.id || !variance.justification || !variance.approvedBy) {
      errors.push(
        `Incomplete variance record: ${variance.id ?? 'unnamed'} requires id, justification, and approvedBy`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
