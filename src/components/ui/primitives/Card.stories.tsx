import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'UI/Primitives/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="p-6" style={{ width: 320 }}>
      <h3 className="text-lg font-semibold mb-2">Card Title</h3>
      <p className="text-sm text-gray-600">
        Surface-level content container. Presentational only — no
        interactivity implied.
      </p>
    </Card>
  ),
};

export const Elevated: Story = {
  render: () => (
    <Card elevated className="p-6" style={{ width: 320 }}>
      <h3 className="text-lg font-semibold mb-2">Elevated Card</h3>
      <p className="text-sm text-gray-600">
        Uses the elevated surface token for dialogs, popovers, and sticky
        panels.
      </p>
    </Card>
  ),
};

export const WithLandmark: Story = {
  render: () => (
    <Card
      className="p-6"
      role="region"
      aria-labelledby="card-heading"
      style={{ width: 320 }}
    >
      <h3 id="card-heading" className="text-lg font-semibold mb-2">
        Landmark Card
      </h3>
      <p className="text-sm text-gray-600">
        Forwards landmark props for accessible region labelling.
      </p>
    </Card>
  ),
};
