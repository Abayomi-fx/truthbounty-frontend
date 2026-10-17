/**
 * Storybook stories for TransactionStatusBadge
 * 
 * Covers all 11 transaction states with visual and accessibility validation.
 * Each story demonstrates proper ARIA semantics and state-specific UI.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { TransactionStatusBadge, TransactionStatusBadgeCompact } from './TransactionStatusBadge';

const meta = {
  title: 'Transactions/TransactionStatusBadge',
  component: TransactionStatusBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Canonical component for rendering transaction state across all write journeys. Maps transaction-machine states to approved copy and ARIA semantics.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TransactionStatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Idle state
// ---------------------------------------------------------------------------

export const Idle: Story = {
  args: {
    status: 'idle',
  },
  parameters: {
    docs: {
      description: {
        story: 'No action started. Shows eligibility and prerequisites.',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Pending states (user action in progress)
// ---------------------------------------------------------------------------

export const Preparing: Story = {
  args: {
    status: 'preparing',
  },
  parameters: {
    docs: {
      description: {
        story: 'Validating local and chain preconditions before signature request.',
      },
    },
  },
};

export const SignatureRequested: Story = {
  args: {
    status: 'signature-requested',
  },
  parameters: {
    docs: {
      description: {
        story: 'Wallet popup open, waiting for user signature.',
      },
    },
  },
};

export const Submitted: Story = {
  args: {
    status: 'submitted',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  },
  parameters: {
    docs: {
      description: {
        story: 'Transaction broadcast to network, hash available but not yet confirmed.',
      },
    },
  },
};

export const Confirming: Story = {
  args: {
    status: 'confirming',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    confirmations: 2,
  },
  parameters: {
    docs: {
      description: {
        story: 'Transaction included in block, accumulating confirmations.',
      },
    },
  },
};

export const ConfirmingSingle: Story = {
  args: {
    status: 'confirming',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    confirmations: 1,
  },
  parameters: {
    docs: {
      description: {
        story: 'First confirmation received (tests singular grammar).',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Warning states (success but awaiting full finality)
// ---------------------------------------------------------------------------

export const Safe: Story = {
  args: {
    status: 'safe',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    confirmations: 5,
  },
  parameters: {
    docs: {
      description: {
        story: 'Sufficient L2 confirmations received, safe to act on but not yet L1-finalized.',
      },
    },
  },
};

export const Indexing: Story = {
  args: {
    status: 'indexing',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  },
  parameters: {
    docs: {
      description: {
        story: 'Indexer acknowledging transaction, updating backend state.',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Success state (terminal)
// ---------------------------------------------------------------------------

export const Finalized: Story = {
  args: {
    status: 'finalized',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  },
  parameters: {
    docs: {
      description: {
        story: 'L1-finalized and fully indexed. Terminal success state.',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Error states (terminal)
// ---------------------------------------------------------------------------

export const Dropped: Story = {
  args: {
    status: 'dropped',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  },
  parameters: {
    docs: {
      description: {
        story: 'Transaction dropped from mempool (e.g., gas too low, timeout). User may retry.',
      },
    },
  },
};

export const Replaced: Story = {
  args: {
    status: 'replaced',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    replacedBy: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
  },
  parameters: {
    docs: {
      description: {
        story: 'Original transaction replaced by another (speedup/cancellation). Shows replacement hash.',
      },
    },
  },
};

export const Reverted: Story = {
  args: {
    status: 'reverted',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  },
  parameters: {
    docs: {
      description: {
        story: 'Transaction included but EVM execution reverted (status 0x0). User may retry.',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Compact variant stories
// ---------------------------------------------------------------------------

export const CompactVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-3 p-4">
      <div className="text-sm text-slate-400 mb-2">Compact variant for inline use:</div>
      <div className="flex flex-wrap gap-2">
        <TransactionStatusBadgeCompact status="idle" />
        <TransactionStatusBadgeCompact status="preparing" />
        <TransactionStatusBadgeCompact status="signature-requested" />
        <TransactionStatusBadgeCompact status="submitted" />
        <TransactionStatusBadgeCompact status="confirming" />
        <TransactionStatusBadgeCompact status="safe" />
        <TransactionStatusBadgeCompact status="indexing" />
        <TransactionStatusBadgeCompact status="finalized" />
        <TransactionStatusBadgeCompact status="dropped" />
        <TransactionStatusBadgeCompact status="replaced" />
        <TransactionStatusBadgeCompact status="reverted" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Compact badges for use in lists, sidebars, and constrained layouts.',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// State progression example
// ---------------------------------------------------------------------------

export const StateProgression: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4 max-w-md">
      <div className="text-sm text-slate-400 mb-2">Typical successful flow:</div>
      <TransactionStatusBadge status="idle" />
      <TransactionStatusBadge status="preparing" />
      <TransactionStatusBadge status="signature-requested" />
      <TransactionStatusBadge 
        status="submitted" 
        txHash="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      />
      <TransactionStatusBadge 
        status="confirming" 
        txHash="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        confirmations={3}
      />
      <TransactionStatusBadge 
        status="safe" 
        txHash="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        confirmations={5}
      />
      <TransactionStatusBadge 
        status="indexing" 
        txHash="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      />
      <TransactionStatusBadge 
        status="finalized" 
        txHash="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Complete state progression from idle to finalized for a successful transaction.',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Failure scenarios
// ---------------------------------------------------------------------------

export const FailureScenarios: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4 max-w-md">
      <div className="text-sm text-slate-400 mb-2">Possible failure states:</div>
      <div className="space-y-2">
        <div className="text-xs text-slate-500">Dropped from mempool:</div>
        <TransactionStatusBadge 
          status="dropped" 
          txHash="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        />
      </div>
      <div className="space-y-2">
        <div className="text-xs text-slate-500">Replaced (speedup/cancel):</div>
        <TransactionStatusBadge 
          status="replaced" 
          txHash="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
          replacedBy="0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321"
        />
      </div>
      <div className="space-y-2">
        <div className="text-xs text-slate-500">Execution reverted on-chain:</div>
        <TransactionStatusBadge 
          status="reverted" 
          txHash="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Terminal failure states requiring user intervention or retry.',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Accessibility validation
// ---------------------------------------------------------------------------

export const AccessibilityDemo: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4 max-w-2xl">
      <div className="text-sm text-slate-400 mb-2">
        ARIA live region behavior (check with screen reader):
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-xs text-slate-500">Polite announcements:</div>
          <TransactionStatusBadge status="preparing" />
          <TransactionStatusBadge status="submitted" />
          <TransactionStatusBadge status="confirming" confirmations={2} />
        </div>
        <div className="space-y-2">
          <div className="text-xs text-slate-500">Assertive announcements:</div>
          <TransactionStatusBadge status="finalized" />
          <TransactionStatusBadge status="dropped" />
          <TransactionStatusBadge status="reverted" />
        </div>
      </div>
      <div className="text-xs text-slate-500 mt-4">
        All badges have role="status" and appropriate aria-live values.
        Terminal states (success/error) use aria-live="assertive" for immediate feedback.
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates ARIA live region behavior. Use screen reader to verify announcements.',
      },
    },
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
          {
            id: 'aria-allowed-attr',
            enabled: true,
          },
        ],
      },
    },
  },
};
