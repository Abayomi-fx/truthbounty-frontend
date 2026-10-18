/**
 * UI-FE-084 — useUnsavedChangesGuard tests.
 *
 * Covers the three guarded paths: browser unload (refresh/close), internal
 * anchor navigation, and SPA history traversal — including fail-closed
 * behaviour when the user declines.
 */

import { renderHook, waitFor } from '@testing-library/react';

import { useUnsavedChangesGuard } from '../useUnsavedChangesGuard';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// jsdom logs "Not implemented: navigation" when an intentionally-ignored
// anchor fires its default action. That noise is expected here.
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Not implemented: navigation')) return;
    originalConsoleError(...(args as []));
  };
});
afterAll(() => {
  console.error = originalConsoleError;
});

function renderGuard(overrides: Partial<Parameters<typeof useUnsavedChangesGuard>[0]> = {}) {
  const confirm = jest.fn().mockResolvedValue(true);
  const navigate = jest.fn();
  const utils = renderHook(
    (props: { when: boolean }) =>
      useUnsavedChangesGuard({ when: props.when, confirm, navigate, ...overrides }),
    { initialProps: { when: true } },
  );
  return { ...utils, confirm, navigate };
}

function appendAnchor(href: string, attrs: Record<string, string> = {}) {
  const anchor = document.createElement('a');
  anchor.href = href;
  for (const [key, value] of Object.entries(attrs)) anchor.setAttribute(key, value);
  anchor.textContent = 'go';
  document.body.appendChild(anchor);
  return anchor;
}

afterEach(() => {
  document.body.innerHTML = '';
  jest.restoreAllMocks();
});

describe('beforeunload protection', () => {
  it('prevents unload while armed', () => {
    renderGuard({ when: true });
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not prevent unload when disarmed', () => {
    renderGuard({ when: false });
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('internal link protection', () => {
  it('blocks an internal navigation and asks before proceeding', async () => {
    const { confirm, navigate } = renderGuard({ when: true });
    const anchor = appendAnchor('/claims/new');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(anchor.href));
  });

  it('stays put when the user declines', async () => {
    const { confirm, navigate } = renderGuard({ when: true });
    confirm.mockResolvedValue(false);

    const anchor = appendAnchor('/disputes');
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ignores modified clicks, new tabs, downloads, and hash links', () => {
    const { confirm } = renderGuard({ when: true });

    appendAnchor('/claims').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true }),
    );
    appendAnchor('/claims', { target: '_blank' }).dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );
    appendAnchor('/file.pdf', { download: '' }).dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );
    appendAnchor('#section').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );

    expect(confirm).not.toHaveBeenCalled();
  });

  it('does not intercept when disarmed', () => {
    const { confirm } = renderGuard({ when: false });
    const anchor = appendAnchor('/claims/new');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    anchor.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe('SPA history protection', () => {
  it('undoes a back traversal and asks before leaving', async () => {
    const go = jest.spyOn(window.history, 'go').mockImplementation(() => {});
    const back = jest.spyOn(window.history, 'back').mockImplementation(() => {});
    const { confirm } = renderGuard({ when: true });

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(go).toHaveBeenCalledWith(1);
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    await waitFor(() => expect(back).toHaveBeenCalled());
  });

  it('stays when the user declines a back traversal', async () => {
    jest.spyOn(window.history, 'go').mockImplementation(() => {});
    const back = jest.spyOn(window.history, 'back').mockImplementation(() => {});
    const { confirm } = renderGuard({ when: true });
    confirm.mockResolvedValue(false);

    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(back).not.toHaveBeenCalled();
  });

  it('ignores popstate when disarmed', () => {
    const go = jest.spyOn(window.history, 'go').mockImplementation(() => {});
    const { confirm } = renderGuard({ when: false });
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(go).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe('confirmNavigation', () => {
  it('navigates only when the user allows it', async () => {
    const { result, confirm, navigate } = renderGuard({ when: true });
    confirm.mockResolvedValueOnce(true);
    await result.current.confirmNavigation('/claims/1');
    expect(navigate).toHaveBeenCalledWith('/claims/1');

    confirm.mockResolvedValueOnce(false);
    await result.current.confirmNavigation('/claims/2');
    expect(navigate).not.toHaveBeenCalledWith('/claims/2');
  });
});
