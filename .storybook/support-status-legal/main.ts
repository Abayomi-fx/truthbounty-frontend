import path from 'node:path';
import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  stories: ['../../src/testing/support-status-legal/*.stories.tsx'],
  addons: ['@storybook/addon-a11y'],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {
      builder: {
        viteConfigPath: path.resolve(
          process.cwd(),
          '.storybook/support-status-legal/vite.config.cjs',
        ),
      },
    },
  },
  staticDirs: ['../../public'],
  viteFinal: async (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        '@': path.resolve(process.cwd(), 'src'),
      },
    },
  }),
};

export default config;
