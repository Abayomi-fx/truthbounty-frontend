import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DocsNotFound } from './DocsNotFound';

const meta = {
  title: 'Features/Documentation/Not Found',
  component: DocsNotFound,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DocsNotFound>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotApprovedOrMissing: Story = {};