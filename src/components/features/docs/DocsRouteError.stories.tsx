import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DocsRouteError } from './DocsRouteError';

const meta = {
  title: 'Features/Documentation/Error',
  component: DocsRouteError,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DocsRouteError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RetryUnavailable: Story = {
  args: { reset: () => undefined },
};