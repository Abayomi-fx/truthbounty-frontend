import type { Meta, StoryObj } from '@storybook/react';
import { WebSocketStatus, WebSocketIndicator } from '@/components/ui/WebSocketStatus';

const meta: Meta<typeof WebSocketStatus> = {
  title: 'UI/WebSocketStatus',
  component: WebSocketStatus,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    showLabel: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Connected ────────────────────────────────────────────────────────────────

export const Connected: Story = {
  parameters: {
    fixture: { webSocket: 'connected' },
  },
};

// ─── Connecting ──────────────────────────────────────────────────────────────

export const Connecting: Story = {
  parameters: {
    fixture: { webSocket: 'connecting' },
  },
};

// ─── Reconnecting ──────────────────────────────────────────────────────────────

export const Reconnecting: Story = {
  parameters: {
    fixture: { webSocket: 'reconnecting' },
  },
};

// ─── Disconnected ──────────────────────────────────────────────────────────────

export const Disconnected: Story = {
  parameters: {
    fixture: { webSocket: 'disconnected' },
  },
};

// ─── Compact indicator (connected) ────────────────────────────────────────────

export const IndicatorConnected: Story = {
  render: () => <WebSocketIndicator />,
  parameters: {
    fixture: { webSocket: 'connected' },
  },
};

// ─── Compact indicator (connecting, pulse animation) ───────────────────────────

export const IndicatorConnecting: Story = {
  render: () => <WebSocketIndicator />,
  parameters: {
    fixture: { webSocket: 'connecting' },
  },
};

// ─── Compact indicator (reduced motion) ─────────────────────────────────────────

export const IndicatorReducedMotion: Story = {
  render: () => <WebSocketIndicator />,
  parameters: {
    fixture: { webSocket: 'connecting', reducedMotion: true },
    chromatic: { modes: { 'reduced-motion': {} } },
  },
};

// ─── Compact indicator (disconnected) ───────────────────────────────────────────

export const IndicatorDisconnected: Story = {
  render: () => <WebSocketIndicator />,
  parameters: {
    fixture: { webSocket: 'disconnected' },
  },
};
