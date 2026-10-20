import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DocsArticle } from './DocsArticle';
import { docsFixture } from './__fixtures__/docs';

const meta = {
  title: 'Features/Documentation/Article',
  component: DocsArticle,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DocsArticle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReviewedGuidance: Story = {
  args: {
    article: docsFixture[0],
    relatedArticles: [docsFixture[1]],
    nextArticle: docsFixture[1],
  },
};

export const ProtocolDocumentation: Story = {
  args: {
    article: docsFixture[1],
    relatedArticles: [docsFixture[0]],
    previousArticle: docsFixture[0],
  },
};