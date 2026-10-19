/**
 * useCanonicalQueryState.test.tsx
 *
 * Unit / integration tests for the per-surface canonical URL filter-state hooks.
 *
 * Coverage matrix:
 *   ✓ Back/forward — state is derived from URL; pushing a new URL produces the
 *     expected state change on the next render.
 *   ✓ Deep link — URL pre-populated with filters is parsed into correct state.
 *   ✓ Prohibited params — wallet / session / capability / secret params never
 *     appear in the generated URL and do not affect parsed state.
 *   ✓ hasActiveFilters — true when any non-default filter is set.
 *   ✓ queryString — reflects canonical state, omits defaults.
 *   ✓ resetState — clears the URL and resets to defaults.
 *   ✓ liveRegionRef — announce() sets textContent via requestAnimationFrame.
 *   ✓ Mobile / desktop parity — same hook contract under both viewport widths.
 *
 * Implementation notes:
 *   - next/navigation is fully mocked (no real router needed).
 *   - requestAnimationFrame is shimmed synchronously.
 *   - Each describe block has a fresh mock-state so tests are independent.
 */

import React, { useRef } from 'react';
import { render, act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks — must be at the top level so Jest hoisting works
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
const mockPathname = '/claims';

// We keep a mutable searchParams object so tests can change the URL state.
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

// Shim requestAnimationFrame to run synchronously in jsdom.
global.requestAnimationFrame = (cb: FrameRequestCallback) => {
  cb(0);
  return 0;
};

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  useClaimsQueryState,
  useVerificationQueryState,
  useDisputesQueryState,
  useAuditQueryState,
  useIncidentsQueryState,
  useDocsQueryState,
} from '../useCanonicalQueryState';

// ---------------------------------------------------------------------------
// Test harness helpers
// ---------------------------------------------------------------------------

/** Render a hook that returns the result object and exposes it via a container. */
function renderHook<T>(useHook: () => T) {
  let result!: T;

  function Harness() {
    result = useHook();
    return null;
  }

  const view = render(<Harness />);
  return { getResult: () => result, rerender: view.rerender };
}

/** Live-region harness: wraps a hook and renders an aria-live element. */
function LiveRegionHarness({ useHook }: { useHook: () => ReturnType<typeof useClaimsQueryState> }) {
  const hook = useHook();
  return (
    <>
      <div
        ref={hook.liveRegionRef as React.RefObject<HTMLDivElement>}
        aria-live="polite"
        aria-atomic="true"
        data-testid="live-region"
      />
      <button
        onClick={() => hook.setState({ search: 'updated' } as Parameters<typeof hook.setState>[0])}
        data-testid="set-filter"
      >
        Set filter
      </button>
      <button onClick={() => hook.resetState()} data-testid="reset">
        Reset
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// 1. Initial / default state
// ---------------------------------------------------------------------------

describe('useClaimsQueryState — initial/default state', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockPush.mockReset();
  });

  it('returns default state when URL has no params', () => {
    const { getResult } = renderHook(useClaimsQueryState);
    const { state } = getResult();
    expect(state.search).toBe('');
    expect(state.status).toBeUndefined();
    expect(state.highImpact).toBe(false);
    expect(state.sortField).toBe('createdAt');
    expect(state.sortDirection).toBe('desc');
    expect(state.page).toBe(1);
  });

  it('hasActiveFilters is false with default state', () => {
    const { getResult } = renderHook(useClaimsQueryState);
    expect(getResult().hasActiveFilters).toBe(false);
  });

  it('queryString is empty string with default state', () => {
    const { getResult } = renderHook(useClaimsQueryState);
    expect(getResult().queryString).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 2. Deep link — URL pre-populated with filters
// ---------------------------------------------------------------------------

describe('useClaimsQueryState — deep link', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('parses all claims filters from URL', () => {
    mockSearchParams = new URLSearchParams(
      'search=blockchain&status=OPEN&highImpact=true&sort=title.asc&page=3',
    );
    const { getResult } = renderHook(useClaimsQueryState);
    const { state } = getResult();
    expect(state.search).toBe('blockchain');
    expect(state.status).toBe('OPEN');
    expect(state.highImpact).toBe(true);
    expect(state.sortField).toBe('title');
    expect(state.sortDirection).toBe('asc');
    expect(state.page).toBe(3);
  });

  it('hasActiveFilters is true when non-default filter present', () => {
    mockSearchParams = new URLSearchParams('status=VERIFIED');
    const { getResult } = renderHook(useClaimsQueryState);
    expect(getResult().hasActiveFilters).toBe(true);
  });

  it('queryString reflects the canonical state (no page=1)', () => {
    mockSearchParams = new URLSearchParams('status=OPEN&page=1');
    const { getResult } = renderHook(useClaimsQueryState);
    const qs = getResult().queryString;
    expect(qs).toContain('status=OPEN');
    expect(qs).not.toContain('page=1');
  });

  it('queryString includes page when > 1', () => {
    mockSearchParams = new URLSearchParams('page=5');
    const { getResult } = renderHook(useClaimsQueryState);
    expect(getResult().queryString).toContain('page=5');
  });
});

// ---------------------------------------------------------------------------
// 3. Back/forward — setState pushes canonical URL, state reflects URL
// ---------------------------------------------------------------------------

describe('useClaimsQueryState — setState / back/forward', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockPush.mockReset();
  });

  it('setState calls router.push with canonical URL', () => {
    const { getResult } = renderHook(useClaimsQueryState);
    act(() => {
      getResult().setState({ search: 'climate change' });
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
    const calledUrl: string = mockPush.mock.calls[0][0];
    expect(calledUrl).toContain('search=climate+change');
    expect(calledUrl).toContain(mockPathname);
  });

  it('setState with highImpact=true pushes highImpact param', () => {
    const { getResult } = renderHook(useClaimsQueryState);
    act(() => {
      getResult().setState({ highImpact: true });
    });
    const calledUrl: string = mockPush.mock.calls[0][0];
    expect(calledUrl).toContain('highImpact=true');
  });

  it('setState with page=2 pushes page param', () => {
    const { getResult } = renderHook(useClaimsQueryState);
    act(() => {
      getResult().setState({ page: 2 });
    });
    const calledUrl: string = mockPush.mock.calls[0][0];
    expect(calledUrl).toContain('page=2');
  });

  it('setState uses { scroll: false } to avoid jarring scroll', () => {
    const { getResult } = renderHook(useClaimsQueryState);
    act(() => {
      getResult().setState({ search: 'test' });
    });
    expect(mockPush).toHaveBeenCalledWith(
      expect.any(String),
      { scroll: false },
    );
  });

  it('resetState calls router.push with bare pathname', () => {
    mockSearchParams = new URLSearchParams('search=test&page=3');
    const { getResult } = renderHook(useClaimsQueryState);
    act(() => {
      getResult().resetState();
    });
    expect(mockPush).toHaveBeenCalledWith(mockPathname, { scroll: false });
  });
});

// ---------------------------------------------------------------------------
// 4. Prohibited params never enter the URL
// ---------------------------------------------------------------------------

describe('useClaimsQueryState — prohibited params never emitted', () => {
  const prohibitedCases = [
    'wallet=0xdeadbeef',
    'walletAddress=0xdeadbeef',
    'session=abc123',
    'token=Bearer xyz',
    'authToken=secret',
    'privateKey=0xprivate',
    'txHash=0xhash',
    'chainId=10',
    'nonce=42',
    'capability=create-fund-own-claim',
    'draft=draft-id-123',
    'evidenceUri=ipfs://cid',
    'signature=0xsig',
  ];

  it.each(prohibitedCases)(
    'param %s is not emitted by setState',
    (prohibitedQS) => {
      mockSearchParams = new URLSearchParams(`${prohibitedQS}&search=safe`);
      const { getResult } = renderHook(useClaimsQueryState);
      // The hook should not re-emit the prohibited param in queryString
      const qs = getResult().queryString;
      const [paramName] = prohibitedQS.split('=');
      expect(qs).not.toContain(paramName);
      // Safe param should still be present
      expect(qs).toContain('search=safe');
    },
  );

  it('queryString never contains wallet addresses after setState', () => {
    mockSearchParams = new URLSearchParams('wallet=0xdeadbeef');
    const { getResult } = renderHook(useClaimsQueryState);
    act(() => {
      getResult().setState({ search: 'news' });
    });
    const calledUrl: string = mockPush.mock.calls[0][0];
    expect(calledUrl).not.toContain('wallet');
    expect(calledUrl).toContain('search=news');
  });
});

// ---------------------------------------------------------------------------
// 5. Live-region announcement
// ---------------------------------------------------------------------------

describe('useClaimsQueryState — live-region announcements', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockPush.mockReset();
  });

  it('setState announces "Filters updated" to the live region', async () => {
    render(<LiveRegionHarness useHook={useClaimsQueryState} />);
    const btn = screen.getByTestId('set-filter');
    await userEvent.click(btn);
    const liveRegion = screen.getByTestId('live-region');
    expect(liveRegion.textContent).toBe('Filters updated. Results loading.');
  });

  it('resetState announces "Filters cleared" to the live region', async () => {
    mockSearchParams = new URLSearchParams('search=test');
    render(<LiveRegionHarness useHook={useClaimsQueryState} />);
    const btn = screen.getByTestId('reset');
    await userEvent.click(btn);
    const liveRegion = screen.getByTestId('live-region');
    expect(liveRegion.textContent).toBe('Filters cleared. Showing all results.');
  });
});

// ---------------------------------------------------------------------------
// 6. Malformed / invalid values — fail-closed recovery
// ---------------------------------------------------------------------------

describe('useClaimsQueryState — malformed values recover to defaults', () => {
  it('invalid status is dropped, state has undefined status', () => {
    mockSearchParams = new URLSearchParams('status=INVALID_STATUS');
    const { getResult } = renderHook(useClaimsQueryState);
    expect(getResult().state.status).toBeUndefined();
  });

  it('page=0 clamps to 1', () => {
    mockSearchParams = new URLSearchParams('page=0');
    const { getResult } = renderHook(useClaimsQueryState);
    expect(getResult().state.page).toBe(1);
  });

  it('page=9999999 clamps to 1000', () => {
    mockSearchParams = new URLSearchParams('page=9999999');
    const { getResult } = renderHook(useClaimsQueryState);
    expect(getResult().state.page).toBe(1000);
  });

  it('injection in search is dropped (returns empty)', () => {
    mockSearchParams = new URLSearchParams('search=<script>alert(1)</script>');
    const { getResult } = renderHook(useClaimsQueryState);
    expect(getResult().state.search).toBe('');
  });

  it('injection search does not appear in queryString', () => {
    mockSearchParams = new URLSearchParams('search=javascript:alert(1)');
    const { getResult } = renderHook(useClaimsQueryState);
    expect(getResult().queryString).not.toContain('javascript');
  });
});

// ---------------------------------------------------------------------------
// 7. Verification queue surface
// ---------------------------------------------------------------------------

describe('useVerificationQueryState', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockPush.mockReset();
  });

  it('returns default state for empty URL', () => {
    const { getResult } = renderHook(useVerificationQueryState);
    const { state } = getResult();
    expect(state.phase).toBeUndefined();
    expect(state.filter).toBe('available');
    expect(state.page).toBe(1);
  });

  it('deep link: parses phase and filter', () => {
    mockSearchParams = new URLSearchParams('phase=commit&filter=assigned&page=2');
    const { getResult } = renderHook(useVerificationQueryState);
    const { state } = getResult();
    expect(state.phase).toBe('commit');
    expect(state.filter).toBe('assigned');
    expect(state.page).toBe(2);
  });

  it('hasActiveFilters true when phase is set', () => {
    mockSearchParams = new URLSearchParams('phase=reveal');
    const { getResult } = renderHook(useVerificationQueryState);
    expect(getResult().hasActiveFilters).toBe(true);
  });

  it('setState pushes correct URL for phase change', () => {
    const { getResult } = renderHook(useVerificationQueryState);
    act(() => {
      getResult().setState({ phase: 'reveal' });
    });
    expect(mockPush.mock.calls[0][0]).toContain('phase=reveal');
  });

  it('invalid phase is dropped', () => {
    mockSearchParams = new URLSearchParams('phase=unknown_phase');
    const { getResult } = renderHook(useVerificationQueryState);
    expect(getResult().state.phase).toBeUndefined();
  });

  it('default filter is not emitted in queryString', () => {
    mockSearchParams = new URLSearchParams('filter=available');
    const { getResult } = renderHook(useVerificationQueryState);
    expect(getResult().queryString).not.toContain('filter=available');
  });
});

// ---------------------------------------------------------------------------
// 8. Disputes surface
// ---------------------------------------------------------------------------

describe('useDisputesQueryState', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockPush.mockReset();
  });

  it('returns default state for empty URL', () => {
    const { getResult } = renderHook(useDisputesQueryState);
    const { state } = getResult();
    expect(state.claimId).toBe('');
    expect(state.status).toBeUndefined();
    expect(state.page).toBe(1);
  });

  it('deep link: parses claimId and status', () => {
    mockSearchParams = new URLSearchParams('claimId=claim-abc&status=active');
    const { getResult } = renderHook(useDisputesQueryState);
    const { state } = getResult();
    expect(state.claimId).toBe('claim-abc');
    expect(state.status).toBe('active');
  });

  it('injection in claimId is dropped', () => {
    mockSearchParams = new URLSearchParams('claimId=<script>x</script>');
    const { getResult } = renderHook(useDisputesQueryState);
    expect(getResult().state.claimId).toBe('');
  });

  it('unknown status is dropped', () => {
    mockSearchParams = new URLSearchParams('status=archived');
    const { getResult } = renderHook(useDisputesQueryState);
    expect(getResult().state.status).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 9. Audit surface
// ---------------------------------------------------------------------------

describe('useAuditQueryState', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockPush.mockReset();
  });

  it('returns default state for empty URL', () => {
    const { getResult } = renderHook(useAuditQueryState);
    const { state } = getResult();
    expect(state.action).toBe('');
    expect(state.authority).toBe('');
    expect(state.page).toBe(1);
  });

  it('deep link: parses action and authority', () => {
    mockSearchParams = new URLSearchParams('action=pause&authority=governance&page=3');
    const { getResult } = renderHook(useAuditQueryState);
    const { state } = getResult();
    expect(state.action).toBe('pause');
    expect(state.authority).toBe('governance');
    expect(state.page).toBe(3);
  });

  it('unknown authority is dropped', () => {
    mockSearchParams = new URLSearchParams('authority=attacker');
    const { getResult } = renderHook(useAuditQueryState);
    expect(getResult().state.authority).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 10. Incidents surface
// ---------------------------------------------------------------------------

describe('useIncidentsQueryState', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockPush.mockReset();
  });

  it('returns default state for empty URL', () => {
    const { getResult } = renderHook(useIncidentsQueryState);
    const { state } = getResult();
    expect(state.severity).toBeUndefined();
    expect(state.status).toBeUndefined();
    expect(state.page).toBe(1);
  });

  it('deep link: parses severity and status', () => {
    mockSearchParams = new URLSearchParams('severity=critical&status=active&page=2');
    const { getResult } = renderHook(useIncidentsQueryState);
    const { state } = getResult();
    expect(state.severity).toBe('critical');
    expect(state.status).toBe('active');
    expect(state.page).toBe(2);
  });

  it('unknown severity is dropped', () => {
    mockSearchParams = new URLSearchParams('severity=ultracritical');
    const { getResult } = renderHook(useIncidentsQueryState);
    expect(getResult().state.severity).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 11. Docs surface
// ---------------------------------------------------------------------------

describe('useDocsQueryState', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockPush.mockReset();
  });

  it('returns default state for empty URL', () => {
    const { getResult } = renderHook(useDocsQueryState);
    const { state } = getResult();
    expect(state.search).toBe('');
    expect(state.category).toBeUndefined();
    expect(state.page).toBe(1);
  });

  it('deep link: parses search and category', () => {
    mockSearchParams = new URLSearchParams('search=how+to+verify&category=verification');
    const { getResult } = renderHook(useDocsQueryState);
    const { state } = getResult();
    expect(state.search).toBe('how to verify');
    expect(state.category).toBe('verification');
  });

  it('unknown category is dropped', () => {
    mockSearchParams = new URLSearchParams('category=secrets');
    const { getResult } = renderHook(useDocsQueryState);
    expect(getResult().state.category).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 12. Mobile / desktop parity
// ---------------------------------------------------------------------------

describe('Mobile / desktop parity — same contract at all viewport widths', () => {
  const viewports = [
    { label: 'mobile (390 px)', width: 390, height: 844 },
    { label: 'tablet (768 px)', width: 768, height: 1024 },
    { label: 'desktop (1440 px)', width: 1440, height: 900 },
  ];

  beforeEach(() => {
    mockPush.mockReset();
  });

  it.each(viewports)(
    '$label: claims deep link parsed identically',
    ({ width, height }) => {
      // Simulate viewport (jsdom doesn't truly resize but the hook is pure logic).
      Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: height, writable: true });

      mockSearchParams = new URLSearchParams('search=climate&status=VERIFIED&page=2');
      const { getResult } = renderHook(useClaimsQueryState);
      const { state } = getResult();
      expect(state.search).toBe('climate');
      expect(state.status).toBe('VERIFIED');
      expect(state.page).toBe(2);
    },
  );

  it.each(viewports)(
    '$label: setState pushes the same canonical URL',
    ({ width, height }) => {
      Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: height, writable: true });

      mockSearchParams = new URLSearchParams();
      const { getResult } = renderHook(useClaimsQueryState);
      act(() => {
        getResult().setState({ status: 'OPEN' });
      });

      const calledUrl: string = mockPush.mock.calls[0][0];
      expect(calledUrl).toContain('status=OPEN');
      expect(calledUrl).not.toContain('wallet');
      expect(calledUrl).not.toContain('session');
    },
  );

  it.each(viewports)(
    '$label: prohibited params are excluded from queryString',
    ({ width, height }) => {
      Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: height, writable: true });

      mockSearchParams = new URLSearchParams(
        'wallet=0xdeadbeef&chainId=10&search=visible',
      );
      const { getResult } = renderHook(useClaimsQueryState);
      const qs = getResult().queryString;
      expect(qs).not.toContain('wallet');
      expect(qs).not.toContain('chainId');
      expect(qs).toContain('search=visible');
    },
  );

  it.each(viewports)(
    '$label: hasActiveFilters and queryString are consistent',
    ({ width, height }) => {
      Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: height, writable: true });

      // Default state
      mockSearchParams = new URLSearchParams();
      const { getResult: getDefault } = renderHook(useClaimsQueryState);
      expect(getDefault().hasActiveFilters).toBe(false);
      expect(getDefault().queryString).toBe('');

      // Active filter
      mockSearchParams = new URLSearchParams('status=DISPUTED');
      const { getResult: getActive } = renderHook(useClaimsQueryState);
      expect(getActive().hasActiveFilters).toBe(true);
      expect(getActive().queryString).toContain('status=DISPUTED');
    },
  );

  it.each(viewports)(
    '$label: resetState pushes bare pathname regardless of viewport',
    ({ width, height }) => {
      Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: height, writable: true });

      mockSearchParams = new URLSearchParams('status=OPEN&page=4');
      mockPush.mockReset();
      const { getResult } = renderHook(useClaimsQueryState);
      act(() => {
        getResult().resetState();
      });
      expect(mockPush).toHaveBeenCalledWith(mockPathname, { scroll: false });
    },
  );
});

// ---------------------------------------------------------------------------
// 13. round-trip stability across multiple setState calls
// ---------------------------------------------------------------------------

describe('Round-trip stability', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('the URL produced by setState parses back to the same state', () => {
    mockSearchParams = new URLSearchParams();
    const { getResult } = renderHook(useClaimsQueryState);

    act(() => {
      getResult().setState({ search: 'fact-check', status: 'VERIFIED', highImpact: true, page: 2 });
    });

    const calledUrl: string = mockPush.mock.calls[0][0];
    const qsMatch = calledUrl.split('?')[1] ?? '';
    const parsed = new URLSearchParams(qsMatch);

    // Simulate the hook reading back the pushed URL.
    mockSearchParams = parsed;
    const { getResult: getResult2 } = renderHook(useClaimsQueryState);
    const { state: backState } = getResult2();

    expect(backState.search).toBe('fact-check');
    expect(backState.status).toBe('VERIFIED');
    expect(backState.highImpact).toBe(true);
    expect(backState.page).toBe(2);
  });
});
