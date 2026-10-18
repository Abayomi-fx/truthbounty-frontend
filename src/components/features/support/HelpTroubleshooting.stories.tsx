import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';

import HelpTroubleshooting from './HelpTroubleshooting';
import { troubleshootingContent } from './troubleshootingTopics';

const meta = {
  title: 'Features/Support/HelpTroubleshooting',
  component: HelpTroubleshooting,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof HelpTroubleshooting>;

export default meta;

type Story = StoryObj<typeof HelpTroubleshooting>;

export const Default: Story = {
  args: {
    content: troubleshootingContent,
  },
};

export const RendersAllCategories: Story = {
  args: {
    content: troubleshootingContent,
  },
  play: async () => {
    const canvas = within(document.body);
    for (const category of troubleshootingContent.categories) {
      const tab = await canvas.findBryRole('role', {
        name: category.title,
      });
      await userEvent.click(tab);
      expect(tab.getAttribute('aria-selected')).toBe('true');
    }
  },
};

export const EscalationUnavailable: Story = {
  args: {
    content: troubleshootingContent,
  },
  play: async () => {
    const canvas = within(document.body);
    const escalation = await canvas.findByRole('region', {
      name: /escalation/i,
    });
    expect(escalation).toBeVisible();
    expect(escalation.textContent).toMatch(/unavailable/i);
  },
};

export const KeyboardNavigation: Story = {
  args: {
    content: troubleshootingContent,
  },
  play: async () => {
    const canvas = within(document.body);
    const firstTab = await canvas.findByRole('role', {
      name: troubleshootingContent.categories[0].title,
    });
    firstTab.focus();
    expect(firstTab).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    const secondTab = await canvas.findByRole('role', {
      name: troubleshootingContent.categories[1].title,
    });
    expect(secondTab).toBeDefined();
  },
};
