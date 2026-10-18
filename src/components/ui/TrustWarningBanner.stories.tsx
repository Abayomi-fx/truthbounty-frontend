import type { Meta, StoryObj } from '@storybook/react';
import TrustWarningBanner from '@/components/ui/TrustWarningBanner';

const meta: Meta<typeof TrustWarningBanner> = {
  title: 'UI/TrustWarningBanner',
  component: TrustWarningBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Unverified (zero weight) ─────────────────────────────────────────────────

export const Unverified: Story = {
  parameters: {
    fixture: {
      trust: {
        isVerified: false,
        reputation: null,
        accountAgeDays: null,
        suspicious: null,
      },
    },
  },
};

// ─── Low reputation ─────────────────────────────────────────────────────────────

export const LowReputation: Story = {
  parameters: {
    fixture: {
      trust: {
        isVerified: true,
        reputation: 12,
        accountAgeDays: 30,
        suspicious: null,
      },
    },
  },
};

// ─── New wallet ──────────────────────────────────────────────────────────────────

export const NewWallet: Story = {
  parameters: {
    fixture: {
      trust: {
        isVerified: true,
        reputation: 50,
        accountAgeDays: 2,
        suspicious: null,
      },
    },
  },
};

// ─── Suspicious activity ────────────────────────────────────────────────────────

export const Suspicious: Story = {
  parameters: {
    fixture: {
      trust: {
        isVerified: true,
        reputation: 50,
        accountAgeDays: 30,
        suspicious: true,
      },
    },
  },
};

// ─── All warnings (zero weight + low rep + new wallet + suspicious) ──────────────

export const AllWarnings: Story = {
  parameters: {
    fixture: {
      trust: {
        isVerified: false,
        reputation: 5,
        accountAgeDays: 1,
        suspicious: true,
      },
    },
  },
};

// ─── Healthy account (banner hidden) ─────────────────────────────────────────────

export const Healthy: Story = {
  parameters: {
    fixture: {
      trust: {
        isVerified: true,
        reputation: 85,
        accountAgeDays: 120,
        suspicious: false,
      },
    },
  },
};
