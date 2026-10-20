/**
 * useCanonicalQueryFocus.test.tsx
 *
 * Unit / integration tests for the WCAG 2.2 AA focus-management and
 * aria-live announcement hook: useCanonicalQueryFocus.
 *
 * Coverage matrix:
 *   ✓ First render with no filters — focus NOT moved, no announcement.
 *   ✓ First render with deep-link filters — focus NOT moved, announcement made.
 *   ✓ URL changes after first render — focus IS moved, announcement updated.
 *   ✓ Same URL repeated — no duplicate focus move or announcement.
 *   ✓ Announcement text reflects canonical state per surface.
 *   ✓ Security: announcements never include wallet/session/capability values.
 *   ✓ Mobile / desktop parity — identical behavior at all viewport widths.
 *
 * Surfaces tested: claims, verification, disputes, audit, incidents, docs.
 */

import React, { useRef } from 'react';
import { render, act, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mutable so each test can change the "current URL".
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

// Shim rAF to run synchronously in jsdom.
global.requestAnimationFrame = (cb: FrameRequestCallback) => {
  cb(0);
  return 0;
};

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { useCanonicalQueryFocus } from '../useCanonicalQueryFocus';
import type { QuerySurface } from '../useCanonicalQueryState';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

interface HarnessProps {
  surface: QuerySurface;
  surfaceLabel: string;
}

/**
 * Renders a component that uses useCanonicalQueryFocus.
 * Exposes focus-target and live-region via data-testid.
 */
function FocusHarness({ surface, surfaceLabel }: HarnessProps) {
  const focusTargetRef = useRef<HTMLHeadingElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  useCanonicalQueryFocus(surface, {
    focusTargetRef,
    liveRegionRef,
    surfaceLabel,
  });

  return (
    <>
      <div
        ref={liveRegionRef as React.RefObject<HTMLDivElement>}
        aria-live="polite"
        aria-atomic="true"
        data-testid="live"
      />
      <h1
        ref={focusTargetRef as React.RefObject<HTMLHeadingElement>}
        tabIndex={-1}
        data-testid="focus-target"
      >
        Results
      </h1>
    </>
  );
}

/** Helper: render harness for a surface and return useful DOM nodes. */
function renderFocusHarness(surface: QuerySurface, surfaceLabel: string) {
  const view = render(
    <FocusHarness surface={surface} surfaceLabel={surfaceLabel} />,
  );
  const liveEl = view.getByTestId('live') as HTMLElement;
  const focusTarget = view.getByTestId('focus-target') as HTMLElement;
  return { ...view, liveEl, focusTarget };
}

// ---------------------------------------------------------------------------
// 1. First render — no filters (empty URL)
// ---------------------------------------------------------------------------

describe('useCanonicalQueryFocus — first render with no active filters', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
  });

  it('does NOT move focus on initial render', () => {
    const { focusTarget } = renderFocusHarness('claims', 'Claims feed');
    expect(document.activeElement).not.toBe(focusTarget);
  });

  it('does NOT announce anything on initial render with default state', () => {
    const { liveEl } = renderFocusHarness('claims', 'Claims feed');
    // With empty/default state, the first-render skip path should produce no announcement.
    expect(liveEl.textContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 2. First render — deep-link (filters already in URL)
// ---------------------------------------------------------------------------

describe('useCanonicalQueryFocus — first render with deep-link filters', () => {
  it('announces the deep-link state but does NOT steal focus', () => {
    mockSearchParams = new URLSearchParams('status=OPEN&page=2');
    const { focusTarget, liveEl } = renderFocusHarness('claims', 'Claims feed');

    expect(document.activeElement).not.toBe(focusTarget);
    expect(liveEl.textContent).toContain('Claims feed');
    expect(liveEl.textContent).toContain('status OPEN');
    expect(liveEl.textContent).toContain('page 2');
  });

  it('verification deep link announces phase correctly', () => {
    mockSearchParams = new URLSearchParams('phase=commit&filter=assigned');
    const { focusTarget, liveEl } = renderFocusHarness('verification', 'Verification queue');

    expect(document.activeElement).not.toBe(focusTarget);
    expect(liveEl.textContent).toContain('Verification queue');
    expect(liveEl.textContent).toContain('phase commit');
  });

  it('disputes deep link announces claimId', () => {
    mockSearchParams = new URLSearchParams('claimId=claim-abc&status=active');
    const { liveEl } = renderFocusHarness('disputes', 'Disputes');

    expect(liveEl.textContent).toContain('claim claim-abc');
    expect(liveEl.textContent).toContain('status active');
  });

  it('audit deep link announces action and authority', () => {
    mockSearchParams = new URLSearchParams('action=pause&authority=governance');
    const { liveEl } = renderFocusHarness('audit', 'Audit trail');

    expect(liveEl.textContent).toContain('action "pause"');
    expect(liveEl.textContent).toContain('authority governance');
  });

  it('incidents deep link announces severity and status', () => {
    mockSearchParams = new URLSearchParams('severity=critical&status=active');
    const { liveEl } = renderFocusHarness('incidents', 'Incidents');

    expect(liveEl.textContent).toContain('severity critical');
    expect(liveEl.textContent).toContain('status active');
  });

  it('docs deep link announces search and category', () => {
    mockSearchParams = new URLSearchParams('search=verification+guide&category=verification');
    const { liveEl } = renderFocusHarness('docs', 'Documentation');

    expect(liveEl.textContent).toContain('search "verification guide"');
    expect(liveEl.textContent).toContain('category verification');
  });
});

// ---------------------------------------------------------------------------
// 3. URL change after first render — focus MUST move, announcement MUST update
// ---------------------------------------------------------------------------

describe('useCanonicalQueryFocus — URL change after first render', () => {
  it('moves focus to focusTarget when URL changes', () => {
    mockSearchParams = new URLSearchParams();
    const { rerender, focusTarget } = renderFocusHarness('claims', 'Claims feed');

    // Simulate URL change (as if router.push was called)
    act(() => {
      mockSearchParams = new URLSearchParams('status=VERIFIED');
    });
    rerender(<FocusHarness surface="claims" surfaceLabel="Claims feed" />);

    expect(document.activeElement).toBe(focusTarget);
  });

  it('updates the live-region announcement when URL changes', () => {
    mockSearchParams = new URLSearchParams();
    const { rerender, liveEl } = renderFocusHarness('claims', 'Claims feed');

    act(() => {
      mockSearchParams = new URLSearchParams('search=blockchain&highImpact=true');
    });
    rerender(<FocusHarness surface="claims" surfaceLabel="Claims feed" />);

    expect(liveEl.textContent).toContain('Claims feed');
    expect(liveEl.textContent).toContain('search "blockchain"');
    expect(liveEl.textContent).toContain('high impact only');
  });

  it('updates announcement when navigating back to default state', () => {
    mockSearchParams = new URLSearchParams('status=OPEN');
    const { rerender, liveEl } = renderFocusHarness('claims', 'Claims feed');

    // Simulate navigating back to defaults
    act(() => {
      mockSearchParams = new URLSearchParams();
    });
    rerender(<FocusHarness surface="claims" surfaceLabel="Claims feed" />);

    expect(liveEl.textContent).toBe('Claims feed: showing all results.');
  });
});

// ---------------------------------------------------------------------------
// 4. No duplicate action when URL has not changed
// ---------------------------------------------------------------------------

describe('useCanonicalQueryFocus — no duplicate action on same URL', () => {
  it('does not move focus when URL is unchanged on re-render', () => {
    mockSearchParams = new URLSearchParams('status=OPEN');
    const { rerender } = renderFocusHarness('claims', 'Claims feed');

    // Re-render without changing the URL — focus should not have moved.
    const focusSpy = jest.spyOn(HTMLElement.prototype, 'focus');
    rerender(<FocusHarness surface="claims" surfaceLabel="Claims feed" />);
    rerender(<FocusHarness surface="claims" surfaceLabel="Claims feed" />);

    // The focus call count should not increase after the initial deep-link render.
    // Since first render skips focus even on deep links, focus should be 0 for
    // redundant renders.
    expect(focusSpy).not.toHaveBeenCalled();
    focusSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 5. Announcement message format per surface
// ---------------------------------------------------------------------------

describe('useCanonicalQueryFocus — announcement message format', () => {
  it('claims: "showing all results" when no active filters', () => {
    // Trigger a navigation from a state to default to get an announcement.
    mockSearchParams = new URLSearchParams('status=OPEN');
    const { rerender, liveEl } = renderFocusHarness('claims', 'Claims feed');

    act(() => {
      mockSearchParams = new URLSearchParams();
    });
    rerender(<FocusHarness surface="claims" surfaceLabel="Claims feed" />);

    expect(liveEl.textContent).toBe('Claims feed: showing all results.');
  });

  it('claims: includes all active filter tokens in announcement', () => {
    mockSearchParams = new URLSearchParams();
    const { rerender, liveEl } = renderFocusHarness('claims', 'Claims feed');

    act(() => {
      mockSearchParams = new URLSearchParams(
        'search=test&status=OPEN&highImpact=true&page=3',
      );
    });
    rerender(<FocusHarness surface="claims" surfaceLabel="Claims feed" />);

    const msg = liveEl.textContent ?? '';
    expect(msg).toContain('search "test"');
    expect(msg).toContain('status OPEN');
    expect(msg).toContain('high impact only');
    expect(msg).toContain('page 3');
    expect(msg).toMatch(/^Claims feed: filtered by/);
  });

  it('verification: includes phase and filter in announcement', () => {
    mockSearchParams = new URLSearchParams();
    const { rerender, liveEl } = renderFocusHarness('verification', 'Verification queue');

    act(() => {
      mockSearchParams = new URLSearchParams('phase=reveal&filter=all');
    });
    rerender(<FocusHarness surface="verification" surfaceLabel="Verification queue" />);

    expect(liveEl.textContent).toContain('phase reveal');
    expect(liveEl.textContent).toContain('filter all');
  });

  it('verification: "showing all results" when filter=available (default)', () => {
    mockSearchParams = new URLSearchParams('phase=commit');
    const { rerender, liveEl } = renderFocusHarness('verification', 'Verification queue');

    act(() => {
      mockSearchParams = new URLSearchParams();
    });
    rerender(<FocusHarness surface="verification" surfaceLabel="Verification queue" />);

    expect(liveEl.textContent).toBe('Verification queue: showing all results.');
  });

  it('disputes: shows claimId and status in announcement', () => {
    mockSearchParams = new URLSearchParams();
    const { rerender, liveEl } = renderFocusHarness('disputes', 'Disputes');

    act(() => {
      mockSearchParams = new URLSearchParams('claimId=claim-42&status=open');
    });
    rerender(<FocusHarness surface="disputes" surfaceLabel="Disputes" />);

    expect(liveEl.textContent).toContain('claim claim-42');
    expect(liveEl.textContent).toContain('status open');
  });

  it('audit: shows action and authority in announcement', () => {
    mockSearchParams = new URLSearchParams();
    const { rerender, liveEl } = renderFocusHarness('audit', 'Audit trail');

    act(() => {
      mockSearchParams = new URLSearchParams('action=upgrade&authority=emergency');
    });
    rerender(<FocusHarness surface="audit" surfaceLabel="Audit trail" />);

    expect(liveEl.textContent).toContain('action "upgrade"');
    expect(liveEl.textContent).toContain('authority emergency');
  });

  it('incidents: shows severity and status in announcement', () => {
    mockSearchParams = new URLSearchParams();
    const { rerender, liveEl } = renderFocusHarness('incidents', 'Incidents');

    act(() => {
      mockSearchParams = new URLSearchParams('severity=high&status=monitoring');
    });
    rerender(<FocusHarness surface="incidents" surfaceLabel="Incidents" />);

    expect(liveEl.textContent).toContain('severity high');
    expect(liveEl.textContent).toContain('status monitoring');
  });

  it('docs: shows search and category in announcement', () => {
    mockSearchParams = new URLSearchParams();
    const { rerender, liveEl } = renderFocusHarness('docs', 'Documentation');

    act(() => {
      mockSearchParams = new URLSearchParams('search=ipfs+guide&category=evidence');
    });
    rerender(<FocusHarness surface="docs" surfaceLabel="Documentation" />);

    expect(liveEl.textContent).toContain('search "ipfs guide"');
    expect(liveEl.textContent).toContain('category evidence');
  });
});

// ---------------------------------------------------------------------------
// 6. Security: announcements never include prohibited/wallet data
// ---------------------------------------------------------------------------

describe('useCanonicalQueryFocus — security: announcement never leaks prohibited data', () => {
  const prohibitedQueryStrings = [
    'wallet=0xdeadbeef&search=visible',
    'session=abc123&status=OPEN',
    'token=Bearer+xyz&search=safe',
    'txHash=0xhash&page=2',
    'chainId=10&search=public',
    'privateKey=0xsecret&status=DISPUTED',
    'evidenceUri=ipfs%3A%2F%2Fcid&search=public',
    'signature=0xsig&search=public',
  ];

  it.each(prohibitedQueryStrings)(
    'announcement does not contain prohibited value from "%s"',
    (qs) => {
      // Start with empty state (so URL change triggers announcement on next render)
      mockSearchParams = new URLSearchParams();
      const { rerender, liveEl } = renderFocusHarness('claims', 'Claims feed');

      act(() => {
        mockSearchParams = new URLSearchParams(qs);
      });
      rerender(<FocusHarness surface="claims" surfaceLabel="Claims feed" />);

      const text = liveEl.textContent ?? '';
      // Prohibited parameter *values* must never appear in announcements.
      expect(text).not.toContain('0xdeadbeef');
      expect(text).not.toContain('abc123');
      expect(text).not.toContain('Bearer');
      expect(text).not.toContain('0xhash');
      expect(text).not.toContain('0xsecret');
      expect(text).not.toContain('ipfs://cid');
      expect(text).not.toContain('0xsig');

      // Prohibited parameter *names* must not appear either.
      expect(text).not.toMatch(/\bwallet\b/i);
      expect(text).not.toMatch(/\bsession\b/i);
      expect(text).not.toMatch(/\btoken\b/i);
      expect(text).not.toMatch(/\btxHash\b/i);
      expect(text).not.toMatch(/\bchainId\b/i);
      expect(text).not.toMatch(/\bprivateKey\b/i);
      expect(text).not.toMatch(/\bevidenceUri\b/i);
      expect(text).not.toMatch(/\bsignature\b/i);
    },
  );

  it('announcement from a deep-link with only prohibited params shows "showing all"', () => {
    mockSearchParams = new URLSearchParams('wallet=0xdeadbeef&session=xyz&chainId=10');
    const { liveEl } = renderFocusHarness('claims', 'Claims feed');
    // Prohibited params are stripped before parsing, so state is default.
    // The deep-link branch only announces when currentQs is non-empty —
    // after stripping the result is empty, so no announcement is expected.
    // The live region should remain empty (default = no active filters = no first-render announcement).
    expect(liveEl.textContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 7. Mobile / desktop parity
// ---------------------------------------------------------------------------

describe('useCanonicalQueryFocus — mobile/desktop parity', () => {
  const viewports = [
    { label: 'mobile (390 px)', width: 390, height: 844 },
    { label: 'tablet (768 px)', width: 768, height: 1024 },
    { label: 'desktop (1440 px)', width: 1440, height: 900 },
  ];

  it.each(viewports)(
    '$label: focus moves to focusTarget after URL change',
    ({ width, height }) => {
      Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: height, writable: true });

      mockSearchParams = new URLSearchParams();
      const { rerender, focusTarget } = renderFocusHarness('claims', 'Claims feed');

      act(() => {
        mockSearchParams = new URLSearchParams('status=OPEN');
      });
      rerender(<FocusHarness surface="claims" surfaceLabel="Claims feed" />);

      expect(document.activeElement).toBe(focusTarget);
    },
  );

  it.each(viewports)(
    '$label: live-region announcement is identical regardless of viewport',
    ({ width, height }) => {
      Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: height, writable: true });

      mockSearchParams = new URLSearchParams('status=VERIFIED&page=3');
      const { liveEl } = renderFocusHarness('claims', 'Claims feed');

      // Deep-link announcement should be present
      expect(liveEl.textContent).toContain('Claims feed');
      expect(liveEl.textContent).toContain('status VERIFIED');
      expect(liveEl.textContent).toContain('page 3');
    },
  );

  it.each(viewports)(
    '$label: no focus or announcement on first render with empty URL',
    ({ width, height }) => {
      Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: height, writable: true });

      mockSearchParams = new URLSearchParams();
      const { focusTarget, liveEl } = renderFocusHarness('claims', 'Claims feed');

      expect(document.activeElement).not.toBe(focusTarget);
      expect(liveEl.textContent).toBe('');
    },
  );

  it.each(viewports)(
    '$label: verification surface behaves identically',
    ({ width, height }) => {
      Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: height, writable: true });

      mockSearchParams = new URLSearchParams();
      const { rerender, focusTarget, liveEl } = renderFocusHarness(
        'verification',
        'Verification queue',
      );

      act(() => {
        mockSearchParams = new URLSearchParams('phase=reveal&filter=assigned');
      });
      rerender(<FocusHarness surface="verification" surfaceLabel="Verification queue" />);

      expect(document.activeElement).toBe(focusTarget);
      expect(liveEl.textContent).toContain('phase reveal');
    },
  );
});

// ---------------------------------------------------------------------------
// 8. Surface label appears in every announcement
// ---------------------------------------------------------------------------

describe('useCanonicalQueryFocus — surface label in all announcements', () => {
  const surfaces: { surface: QuerySurface; label: string; qs: string }[] = [
    { surface: 'claims', label: 'Claims feed', qs: 'status=OPEN' },
    { surface: 'verification', label: 'Verification queue', qs: 'phase=commit' },
    { surface: 'disputes', label: 'Disputes register', qs: 'claimId=c1' },
    { surface: 'audit', label: 'Admin audit', qs: 'authority=governance' },
    { surface: 'incidents', label: 'Incidents log', qs: 'severity=high' },
    { surface: 'docs', label: 'Documentation', qs: 'category=evidence' },
  ];

  it.each(surfaces)(
    '$surface: label "$label" always prefixes the announcement',
    ({ surface, label, qs }) => {
      // Trigger via URL change after first render.
      mockSearchParams = new URLSearchParams();
      const { rerender, liveEl } = renderFocusHarness(surface, label);

      act(() => {
        mockSearchParams = new URLSearchParams(qs);
      });
      rerender(<FocusHarness surface={surface} surfaceLabel={label} />);

      expect(liveEl.textContent).toMatch(new RegExp(`^${label}:`));
    },
  );
});
