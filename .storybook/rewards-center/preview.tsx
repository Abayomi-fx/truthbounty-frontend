import type { Preview } from '@storybook/nextjs-vite';
import '@/app/globals.css';

const preview: Preview = {
  parameters: { layout: 'fullscreen', a11y: { test: 'error' } },
  decorators: [
    (Story) => (
      <div
        style={{ padding: 16, background: 'var(--canvas)', minHeight: '100vh' }}
      >
        <Story />
      </div>
    ),
  ],
};
export default preview;
