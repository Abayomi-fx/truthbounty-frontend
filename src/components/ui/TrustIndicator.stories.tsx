import type { Meta, StoryObj } from '@storybook/react-vite';
import TrustIndicator from './TrustIndicator';

const meta: Meta<typeof TrustIndicator> = {
  title: 'UI/TrustIndicator',
  component: TrustIndicator,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '20px', background: '#f5f5f5', borderRadius: '8px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TrustIndicator>;

export const Default: Story = {
  args: {},
};

export const HighReputation: Story = {
  parameters: {
    chromatic: { disable: true },
  },
};

export const MediumReputation: Story = {
  parameters: {
    chromatic: { disable: true },
  },
};

export const LowReputation: Story = {
  parameters: {
    chromatic: { disable: true },
  },
};