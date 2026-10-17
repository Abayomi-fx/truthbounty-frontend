import type { Meta, StoryObj } from '@storybook/react';
import OfflineBanner from '@/components/ui/OfflineBanner';

const meta: Meta<typeof OfflineBanner> = {
  title: 'UI/OfflineBanner',
  component: OfflineBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Online (banner hidden) ──────────────────────────────────────────────────

export const Online: Story = {
  parameters: {
    fixture: { network: 'online' },
  },
};

// ─── Offline ───────────────────────────────────────────────────────────────────

export const Offline: Story = {
  parameters: {
    fixture: { network: 'offline' },
  },
};

// ─── Low bandwidth / data saver ─────────────────────────────────────────────────

export const LowBandwidth: Story = {
  parameters: {
    fixture: { network: 'low-bandwidth' },
  },
};
