import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { DocsHome } from './DocsHome';
import { docsFixture } from './__fixtures__/docs';

const meta = {
  title: 'Features/Documentation/Home',
  component: DocsHome,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DocsHome>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PublishedGuides: Story = {
  args: { articles: docsFixture },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Claims' }));
    await expect(canvas.getByRole('link', { name: /Publish claim evidence/ })).toBeInTheDocument();
    await expect(canvas.queryByRole('link', { name: /Read transaction states/ })).not.toBeInTheDocument();
  },
};

export const NoApprovedContent: Story = {
  args: { articles: [] },
};

export const SearchWithoutMatches: Story = {
  args: { articles: docsFixture },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('searchbox'), 'no published result');
    await expect(canvas.getByRole('status')).toHaveTextContent('No documentation matches this search.');
  },
};