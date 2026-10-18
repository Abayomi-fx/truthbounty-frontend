import type { Meta, StoryObj } from '@storybook/react';
import {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard,
} from '@/components/ui/skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'UI/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'circular', 'text'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg', 'xl'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Default skeleton (shimmer) ────────────────────────────────────────────────

export const Default: Story = {
  args: {
    className: 'h-4 w-32',
  },
};

// ─── Circular (avatar) ───────────────────────────────────────────────────────────

export const Circular: Story = {
  args: {
    variant: 'circular',
    width: 40,
    height: 40,
  },
};

// ─── Text lines ───────────────────────────────────────────────────────────────────

export const Text: Story = {
  render: () => <SkeletonText lines={4} />,
};

// ─── Avatar ───────────────────────────────────────────────────────────────────────

export const Avatar: Story = {
  render: () => <SkeletonAvatar size={48} />,
};

// ─── Button ───────────────────────────────────────────────────────────────────────

export const ButtonShape: Story = {
  render: () => <SkeletonButton />,
};

// ─── Card ──────────────────────────────────────────────────────────────────────────

export const Card: Story = {
  render: () => <SkeletonCard />,
};

// ─── Reduced motion (shimmer suppressed) ─────────────────────────────────────────

export const ReducedMotion: Story = {
  args: {
    className: 'h-4 w-32',
  },
  parameters: {
    fixture: { reducedMotion: true },
    chromatic: { modes: { 'reduced-motion': {} } },
  },
};

// ─── Dashboard loading skeleton (composite) ───────────────────────────────────

export const DashboardLoading: Story = {
  render: () => (
    <div className="space-y-6" style={{ width: 600 }}>
      <div className="flex items-center gap-4">
        <SkeletonAvatar size={40} />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonCard />
      <SkeletonCard />
    </div>
  ),
};
