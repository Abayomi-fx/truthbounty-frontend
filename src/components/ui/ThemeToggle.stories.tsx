import type { Meta, StoryObj } from '@storybook/react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const meta: Meta<typeof ThemeToggle> = {
  title: 'UI/ThemeToggle',
  component: ThemeToggle,
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

// ─── Default (icon only) ─────────────────────────────────────────────────────

export const Default: Story = {};

// ─── With label ─────────────────────────────────────────────────────────────────

export const WithLabel: Story = {
  args: { showLabel: true },
};

// ─── Dark theme ──────────────────────────────────────────────────────────────────

export const DarkTheme: Story = {
  args: { showLabel: true },
  parameters: {
    fixture: { theme: 'dark' },
  },
  render: (args) => (
    <div style={{ background: '#18181b', padding: 24, borderRadius: 8 }}>
      <ThemeToggle {...args} />
    </div>
  ),
};

// ─── Light theme ─────────────────────────────────────────────────────────────────

export const LightTheme: Story = {
  args: { showLabel: true },
  parameters: {
    fixture: { theme: 'light' },
  },
};
