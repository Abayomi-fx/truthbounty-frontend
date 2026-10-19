/**
 * UI-FE-093 — Approved-Board Conformity & Accessibility Integration Tests
 *
 * Verifies that:
 *   1. Board conformity manifest covers all 58 approved protocol boards across 6 batches.
 *   2. Canonical system-state components pass WCAG 2.1 AA accessibility checks.
 *   3. Pixel similarity does not override accessibility or live protocol state.
 *   4. Dynamic data masks and regression thresholds are valid and bounded.
 */

import React from 'react';
import { describe, it, expect } from '@jest/globals';
import { render } from '@testing-library/react';
import { axe } from '../utils/axe';

import {
  APPROVED_BOARDS,
  CANONICAL_ROUTE_EXPECTATIONS,
} from '@/testing/fixtures/authority/route-authority';
import {
  BOARD_CONFORMITY_MANIFEST,
  getBoardEntry,
  getBoardsForBatch,
  getImplementedBoards,
  getBlockedOrPlannedBoards,
  validateBoardEntryIntegrity,
  type ConformityBatchId,
} from '@/config/board-conformity';

import { SystemState, type SystemStateKind } from '@/components/common/SystemState';
import { AccessDeniedState } from '@/components/common/AccessDeniedState';
import { ApiStaleBanner } from '@/components/common/ApiStaleBanner';
import { RouteErrorFallback } from '@/components/common/RouteErrorFallback';

describe('UI-FE-093 Approved-Board Conformity Manifest', () => {
  it('covers all 58 approved boards from route-authority fixture', () => {
    expect(BOARD_CONFORMITY_MANIFEST.boards.length).toBe(58);
    expect(APPROVED_BOARDS.length).toBe(58);

    for (const board of APPROVED_BOARDS) {
      const entry = getBoardEntry(board.path);
      expect(entry).toBeDefined();
      expect(entry?.boardId).toBe(board.path);
    }
  });

  it('maps all six batches with exact board counts', () => {
    const expectedBatches: { id: ConformityBatchId; count: number }[] = [
      { id: 'foundation', count: 8 },
      { id: 'public-claimant', count: 11 },
      { id: 'verifier', count: 7 },
      { id: 'dispute', count: 6 },
      { id: 'privileged', count: 13 },
      { id: 'support-legal', count: 13 },
    ];

    for (const batch of expectedBatches) {
      const boardsInBatch = getBoardsForBatch(batch.id);
      expect(boardsInBatch.length).toBe(batch.count);
    }
  });

  it('maps every canonical route to approved boards or explicit sitemap authority', () => {
    for (const route of CANONICAL_ROUTE_EXPECTATIONS) {
      if (route.boardAuthority === 'sitemap-only') {
        expect(['/treasury', '/analytics']).toContain(route.path);
        continue;
      }

      expect(route.boardRefs.length).toBeGreaterThan(0);
      for (const boardRef of route.boardRefs) {
        const entry = getBoardEntry(boardRef);
        expect(entry).toBeDefined();
      }
    }
  });

  it('asserts that every implemented board has complete viewports and bounded threshold', () => {
    const implemented = getImplementedBoards();
    expect(implemented.length).toBeGreaterThan(0);

    for (const board of implemented) {
      const { valid, errors } = validateBoardEntryIntegrity(board);
      expect(errors).toEqual([]);
      expect(valid).toBe(true);

      // Verify all 4 required viewports
      expect(board.requiredViewports).toContain('desktop');
      expect(board.requiredViewports).toContain('tablet');
      expect(board.requiredViewports).toContain('mobile');
      expect(board.requiredViewports).toContain('zoom200');

      // Verify threshold <= 0.005
      expect(board.diffThreshold).toBeLessThanOrEqual(0.005);
      expect(board.stableRegions.length).toBeGreaterThan(0);
    }
  });

  it('asserts that every planned or blocked board has an explicit reason record', () => {
    const blocked = getBlockedOrPlannedBoards();
    expect(blocked.length).toBeGreaterThan(0);

    for (const board of blocked) {
      const { valid, errors } = validateBoardEntryIntegrity(board);
      expect(errors).toEqual([]);
      expect(valid).toBe(true);
      expect(board.blockedReason).toBeDefined();
      expect(board.blockedReason!.length).toBeGreaterThan(10);
    }
  });

  it('validates that dynamic data masks are valid CSS selectors', () => {
    const masks = BOARD_CONFORMITY_MANIFEST.globalDynamicMasks;
    expect(masks.length).toBeGreaterThan(0);

    for (const mask of masks) {
      expect(() => {
        document.querySelector(mask);
      }).not.toThrow();
    }
  });
});

describe('UI-FE-093 Accessibility Precedence (A11y Runs Alongside Visual Evidence)', () => {
  const CANONICAL_STATES: SystemStateKind[] = [
    'loading',
    'empty',
    'stale',
    'offline',
    'unavailable',
    'error',
    'denied',
    'not-found',
  ];

  for (const state of CANONICAL_STATES) {
    it(`system-state "${state}" has zero WCAG 2.1 AA violations`, async () => {
      const { container } = render(
        <SystemState
          state={state}
          title={`Canonical ${state} test title`}
          description={`Description for ${state} system state`}
        />,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  }

  it('AccessDeniedState component has zero WCAG 2.1 AA violations', async () => {
    const { container } = render(
      <AccessDeniedState
        reason="wallet-disconnected"
        title="Wallet Disconnected"
        message="Please connect your wallet to access this surface."
      />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('ApiStaleBanner component has zero WCAG 2.1 AA violations', async () => {
    const { container } = render(
      <ApiStaleBanner
        isStale={true}
        lastUpdated={Date.now() - 3600000}
      />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('RouteErrorFallback component has zero WCAG 2.1 AA violations', async () => {
    const { container } = render(
      <RouteErrorFallback
        error={new Error('Simulated network disruption')}
        reset={() => {}}
      />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
