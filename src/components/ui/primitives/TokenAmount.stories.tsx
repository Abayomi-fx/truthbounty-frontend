import type { Meta, StoryObj } from '@storybook/react';
import { TokenAmount } from './TokenAmount';

const meta: Meta<typeof TokenAmount> = {
  title: 'UI/Primitives/TokenAmount',
  component: TokenAmount,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    amount: { control: 'text' },
    symbol: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    amount: '1,250.00',
    symbol: 'OP',
  },
};

export const WithoutSymbol: Story = {
  args: {
    amount: '1,250.00',
  },
};

export const EthAmount: Story = {
  args: {
    amount: '0.0042',
    symbol: 'ETH',
  },
};

export const UsdAmount: Story = {
  args: {
    amount: '1,250.00',
    symbol: 'USD',
  },
};

export const ZeroAmount: Story = {
  args: {
    amount: '0.00',
    symbol: 'OP',
  },
};

export const LargeAmount: Story = {
  args: {
    amount: '1,234,567.890123',
    symbol: 'TBNT',
  },
};
