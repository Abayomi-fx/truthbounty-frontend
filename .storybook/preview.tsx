import type { Preview } from '@storybook/nextjs-vite';
import React from 'react';

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
            background: '#ffffff',
            borderRadius: '8px',
          },
        },
        React.createElement(Story, null),
      ),
  ],
};

export default preview;