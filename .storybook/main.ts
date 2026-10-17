import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-onboarding',
  ],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {
      // Alias production hooks to Storybook mock fixtures via vite.config.ts
      builder: {
        viteConfigPath: '.storybook/vite.config.ts',
      },
    },
  },
  // POSIX path — backslashes break Storybook on Linux / CI runners.
  staticDirs: ['../public'],
  // Exclude docs from the production bundle for faster Chromatic builds.
  docs: {
    autodocs: false,
  },
};
export default config;