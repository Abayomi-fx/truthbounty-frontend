import type { Meta, StoryObj } from '@storybook/react';
import {
  MotionSafeStatus,
  type MotionSafeStatusTone,
} from '@/components/ui/MotionSafeStatus';

const meta: Meta<typeof MotionSafeStatus> = {
  title: 'UI/MotionSafeStatus',
  component: MotionSafeStatus,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    tone: {
      control: { type: 'select' },
      options: ['neutral', 'success', 'error', 'pending'],
    },
    pulse: { control: 'boolean' },
    politeness: {
      control: { type: 'select' },
      options: ['polite', 'assertive'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Loading state ────────────────────────────────────────────────────────────

export const Loading: Story = {
  args: {
    label: 'Loading claim data…',
    detail: 'Fetching the latest projection from the indexer.',
    tone: 'pending',
    pulse: true,
  },
};

// ─── Pending state ─────────────────────────────────────────────────────────────

export const Pending: Story = {
  args: {
    label: 'Transaction pending',
    detail: 'Submitted to mempool, awaiting block inclusion.',
    tone: 'pending',
    pulse: true,
  },
};

// ─── Confirmed state ──────────────────────────────────────────────────────────

export const Confirmed: Story = {
  args: {
    label: 'Confirmed',
    detail: 'Included in block 12,345,678. Awaiting finality threshold.',
    tone: 'success',
    pulse: false,
  },
};

// ─── Finalized state ───────────────────────────────────────────────────────────

export const Finalized: Story = {
  args: {
    label: 'Finalized',
    detail: 'Finality threshold met. Safe in canonical chain state.',
    tone: 'success',
    pulse: false,
  },
};

// ─── Error / failed state ──────────────────────────────────────────────────────

export const Failed: Story = {
  args: {
    label: 'Transaction failed',
    detail: 'Reverted on-chain. Review the error and retry.',
    tone: 'error',
    pulse: false,
    politeness: 'assertive',
  },
};

// ─── Neutral state ─────────────────────────────────────────────────────────────

export const Neutral: Story = {
  args: {
    label: 'Awaiting confirmation',
    tone: 'neutral',
    pulse: false,
  },
};

// ─── Reduced motion ────────────────────────────────────────────────────────────

export const ReducedMotion: Story = {
  args: {
    label: 'Transaction pending',
    detail: 'Submitted to mempool, awaiting block inclusion.',
    tone: 'pending',
    pulse: true,
  },
  parameters: {
    fixture: { reducedMotion: true },
    // Verify pulse is suppressed via chromatic mode
    chromatic: { modes: { 'reduced-motion': {} } },
  },
};
