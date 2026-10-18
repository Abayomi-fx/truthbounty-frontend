/**
 * Storybook preview configuration.
 *
 * Fixture isolation: every story is wrapped in `StorybookFixtureProvider`,
 * which injects deterministic mock implementations of wallet, trust,
 * WebSocket, network, and theme providers. Stories make NO network,
 * wallet, analytics, or live adapter calls.
 *
 * Viewport matrix: Chromatic captures each story at three approved widths
 * (desktop 1440, tablet 768, mobile 375) for reproducible visual regression.
 *
 * Accessibility: the a11y addon runs in 'error' mode — CI fails on serious
 * accessibility violations.
 *
 * Chromatic modes: reduced-motion and forced-colors capture modes are
 * configured for every story so that motion and colour adaptations are
 * tested automatically.
 */

import type { Preview } from '@storybook/nextjs-vite';
import React from 'react';
import '../src/app/globals.css';
import { StorybookFixtureProvider } from './StorybookFixtureProvider';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    layout: 'centered',

    // ─── Accessibility ──────────────────────────────────────────────────────
    a11y: {
      // 'error' — fail CI on a11y violations.
      test: 'error',
    },

    // ─── Viewport matrix ───────────────────────────────────────────────────
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile (375px)',
          styles: { width: '375px', height: '812px' },
        },
        tablet: {
          name: 'Tablet (768px)',
          styles: { width: '768px', height: '1024px' },
        },
        desktop: {
          name: 'Desktop (1440px)',
          styles: { width: '1440px', height: '900px' },
        },
      },
      defaultViewport: 'desktop',
    },

    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#0b0b0b' },
      ],
    },

    // ─── Chromatic visual regression ────────────────────────────────────────
    chromatic: {
      // Capture at approved desktop, tablet, and mobile widths.
      viewports: [1440, 768, 375],
      // Fail CI on approved visual regressions.
      diffThreshold: 0.2,
      // Only snapshot changed stories to keep CI fast.
      onlyChanged: true,
      // Capture reduced-motion and forced-colours modes for every story.
      modes: {
        'reduced-motion': {
          // Simulate prefers-reduced-motion: reduce
          css: 'html { --motion: off; } * { animation: none !important; transition: none !important; }',
          // Emulate the media query for hooks reading matchMedia.
          media: '(prefers-reduced-motion: reduce)',
        },
        'forced-colors': {
          // Simulate Windows High Contrast / forced-colors: active.
          media: '(forced-colors: active)',
        },
      },
    },
  },

  decorators: [
    // ─── Fixture isolation wrapper ─────────────────────────────────────────
    (Story, context) => {
      // Read fixture config from story parameters (if provided).
      const fixtureConfig = context.parameters.fixture;

      return React.createElement(
        'div',
        {
          style: {
            minWidth: '320px',
            maxWidth: '100%',
            padding: '24px',
            background: 'var(--color-canvas, #ffffff)',
            color: 'var(--color-ink, #0a0a0a)',
            borderRadius: '8px',
          },
        },
        React.createElement(
          StorybookFixtureProvider,
          { config: fixtureConfig },
          React.createElement(Story, null),
        ),
      );
    },
  ],
};

export default preview;