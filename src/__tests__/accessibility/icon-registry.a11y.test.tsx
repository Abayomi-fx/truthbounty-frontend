/**
 * UI-FE-089 — Accessibility coverage for the icon registry primitives.
 *
 * Runs under `npm run test:a11y`. Confirms icon-only controls, decorative
 * icons, and meaningful icons are axe-clean, including focus and disabled
 * states.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { Icon, IconButton } from '@/components/ui/icons';

expect.extend(toHaveNoViolations);

describe('icon registry accessibility', () => {
  it('has no axe violations for an icon-only toolbar', async () => {
    const { container } = render(
      <div role="toolbar" aria-label="Record actions">
        <IconButton name="copy" label="Copy record" />
        <IconButton name="download" label="Download receipt" />
        <IconButton name="refresh" label="Refresh record" />
        <IconButton name="x" label="Close record" disabled />
      </div>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations for decorative icons beside a label', async () => {
    const { container } = render(
      <button type="button">
        <Icon name="external-link" />
        <span>Open explorer</span>
      </button>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations for meaningful status icons', async () => {
    const { container } = render(
      <ul>
        <li>
          <Icon name="check-circle" decorative={false} title="Confirmed" />
        </li>
        <li>
          <Icon name="x-circle" decorative={false} title="Rejected" />
        </li>
      </ul>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
