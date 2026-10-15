import type { Meta, StoryObj } from '@storybook/react-vite';
import TrustIndicator from './TrustIndicator';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const meta: Meta<typeof TrustIndicator> = {
  title: 'UI/TrustIndicator',
  component: TrustIndicator,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <div style={{ padding: '20px', background: '#18181b', borderRadius: '8px' }}>
            <Story />
          </div>
        </QueryClientProvider>
      </WagmiProvider>
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