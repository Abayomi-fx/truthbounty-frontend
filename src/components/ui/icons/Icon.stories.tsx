import type { Meta, StoryObj } from '@storybook/react';

import { ICON_NAMES, getIconDefinition } from './catalogue';
import { Icon, ICON_SIZES } from './Icon';
import { IconButton } from './IconButton';

/**
 * UI-FE-089 — Approved icon catalogue.
 *
 * Every production icon is registered with a semantic name. Decorative icons
 * are hidden from assistive technology; meaningful icons and icon-only
 * controls always carry an accessible name. Chromatic captures reduced-motion
 * and forced-colours contexts for every story.
 */
const meta: Meta<typeof Icon> = {
  title: 'UI/Icons/Icon',
  component: Icon,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    name: { control: { type: 'select' }, options: ICON_NAMES },
    size: { control: { type: 'inline-radio' }, options: ICON_SIZES },
    tone: {
      control: { type: 'select' },
      options: [
        'inherit',
        'neutral',
        'pending',
        'confirmed',
        'finalized',
        'orphaned',
        'success',
        'warning',
        'danger',
        'info',
      ],
    },
    decorative: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Icon>;

export const Default: Story = {
  args: { name: 'shield-check', size: 'md' },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {ICON_SIZES.map((size) => (
        <Icon key={size} name="shield-check" size={size} />
      ))}
    </div>
  ),
};

export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      {(
        ['neutral', 'pending', 'confirmed', 'finalized', 'success', 'warning', 'danger', 'info'] as const
      ).map((tone) => (
        <Icon key={tone} name="alert-triangle" tone={tone} size="lg" />
      ))}
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Icon name="ban" size="lg" />
      <Icon name="ban" size="lg" disabled />
    </div>
  ),
};

/** Meaningful icons expose an accessible name via `title`. */
export const Meaningful: Story = {
  render: () => <Icon name="shield-check" decorative={false} title="Verified" size="lg" />,
};

export const FocusState: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <IconButton name="refresh" label="Refresh" />
      <IconButton
        name="refresh"
        label="Refresh (focused)"
        className="ring-[3px] ring-ring/50 ring-offset-1"
      />
    </div>
  ),
};

export const IconOnlyControls: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <IconButton name="copy" label="Copy value" />
      <IconButton name="download" label="Download receipt" variant="solid" />
      <IconButton name="settings" label="Settings" variant="outline" />
      <IconButton name="ban" label="Blocked" disabled />
    </div>
  ),
};

/** Reduced-motion context: the loader is static when motion is not safe. */
export const ReducedMotionLoader: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Icon name="loader" size="lg" />
      <IconButton name="loader" label="Working" />
    </div>
  ),
};

export const Catalogue: Story = {
  render: () => (
    <ul className="grid grid-cols-4 gap-4">
      {ICON_NAMES.map((name) => (
        <li key={name} className="flex flex-col items-center gap-1 text-center">
          <Icon name={name} size="lg" tone="neutral" />
          <span className="font-mono text-[10px] text-ink-muted">{name}</span>
          <span className="text-[10px] text-ink-secondary">
            {getIconDefinition(name).label}
          </span>
        </li>
      ))}
    </ul>
  ),
};
