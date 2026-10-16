import type { Preview } from '@storybook/nextjs-vite';
import React from 'react';
import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    layout: 'centered',

    a11y: {
      // 'error' - fail CI on a11y violations
      // 'todo' - show violations in test UI only
      // 'off' - skip a11y checks entirely
      test: 'error',
    },

    viewport: {
      viewports: {
        desktop: { name: 'Desktop', styles: { width: '1280px', height: '800px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        mobile: { name: 'Mobile', styles: { width: '375px', height: '812px' } },
      },
    },

    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#0b0b0b' },
      ],
    },
  },
  decorators: [
    // Add decorator to wrap components with necessary providers
    (Story) =>
      React.createElement(
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
        React.createElement(Story, null),
      ),
  ],
};

export default preview;
