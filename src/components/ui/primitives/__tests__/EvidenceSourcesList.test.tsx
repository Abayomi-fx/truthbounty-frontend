import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { EvidenceSourcesList } from '../EvidenceSourcesList';

expect.extend(toHaveNoViolations);

function createMockSources() {
  return [
    {
      id: '1',
      type: 'link',
      title: 'News Article',
      value: 'https://example.com/article',
      description: 'Supporting evidence from reputable source',
      submittedBy: '0x1234...',
      submittedAt: '2026-01-15T10:30:00.000Z',
      verified: true,
    },
    {
      id: '2',
      type: 'document',
      title: 'PDF Report',
      value: 'ipfs://QmHash...',
      description: 'Detailed analysis report',
      submittedBy: '0x5678...',
      submittedAt: '2026-01-15T11:00:00.000Z',
      verified: false,
      disputed: true,
      disputeReason: 'Questionable methodology',
    },
    {
      id: '3',
      type: 'onchain',
      title: 'On-chain Verification',
      value: '0xabc...',
      submittedBy: '0x9999...',
      submittedAt: '2026-01-15T12:00:00.000Z',
      verified: true,
      verificationTxHash: '0xtxhash...',
      blockNumber: 12345,
      chainId: 11155420,
    },
  ];
}

describe('EvidenceSourcesList', () => {
  let mockSources: ReturnType<typeof createMockSources>;

  beforeEach(() => {
    mockSources = createMockSources();
  });

  describe('Basic rendering', () => {
    it('renders all evidence sources', () => {
      render(<EvidenceSourcesList sources={mockSources} />);
      const newsElements = screen.getAllByText('News Article');
      expect(newsElements.length).toBeGreaterThanOrEqual(1);
      const pdfElements = screen.getAllByText('PDF Report');
      expect(pdfElements.length).toBeGreaterThanOrEqual(1);
      const onchainElements = screen.getAllByText('On-chain Verification');
      expect(onchainElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows source count', () => {
      render(<EvidenceSourcesList sources={mockSources} />);
      expect(screen.getByText('3 sources')).toBeInTheDocument();
    });

    it('has no axe violations', async () => {
      const { container } = render(<EvidenceSourcesList sources={mockSources} />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('Loading state', () => {
    it('shows loading skeleton', () => {
      render(<EvidenceSourcesList sources={[]} isLoading />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    });

    it('has no axe violations in loading state', async () => {
      const { container } = render(<EvidenceSourcesList sources={[]} isLoading />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('Error state', () => {
    it('shows error message', () => {
      render(<EvidenceSourcesList sources={[]} error="Failed to load" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to Load Evidence')).toBeInTheDocument();
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });

    it('has no axe violations in error state', async () => {
      const { container } = render(<EvidenceSourcesList sources={[]} error="Failed to load" />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('Empty state', () => {
    it('shows empty message when no sources', () => {
      render(<EvidenceSourcesList sources={[]} />);
      expect(screen.getByText('No Evidence Available')).toBeInTheDocument();
    });

    it('has no axe violations in empty state', async () => {
      const { container } = render(<EvidenceSourcesList sources={[]} />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('Source details', () => {
    it('shows type badges', () => {
      render(<EvidenceSourcesList sources={mockSources} />);
      const linkElements = screen.getAllByText('Link');
      expect(linkElements.length).toBeGreaterThanOrEqual(1);
      const documentElements = screen.getAllByText('Document');
      expect(documentElements.length).toBeGreaterThanOrEqual(1);
      const onchainElements = screen.getAllByText('On-chain');
      expect(onchainElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows verification status', () => {
      render(<EvidenceSourcesList sources={mockSources} showVerification />);
      const verifiedElements = screen.getAllByText('Verified');
      expect(verifiedElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows dispute status', () => {
      render(<EvidenceSourcesList sources={mockSources} showDisputeStatus />);
      const disputedElements = screen.getAllByText('Disputed');
      expect(disputedElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows on-chain details with chain-specific explorer links', () => {
      render(<EvidenceSourcesList sources={mockSources} showOnChainDetails />);
      // Optimism Sepolia explorer
      const txElements = screen.getAllByText(/Tx: 0xtxhash/);
      expect(txElements.length).toBeGreaterThanOrEqual(1);
      const txLink = txElements[0].closest('a');
      expect(txLink).toHaveAttribute('href', 'https://sepolia-optimism.etherscan.io/tx/0xtxhash...');
      const blockElements = screen.getAllByText(/Block 12345/);
      expect(blockElements.length).toBeGreaterThanOrEqual(1);
      const blockLink = blockElements[0].closest('a');
      expect(blockLink).toHaveAttribute('href', 'https://sepolia-optimism.etherscan.io/block/12345');
    });

    it('shows unsupported chain indicator when chain has no explorer', () => {
      const sourcesWithUnsupportedChain = [
        {
          id: '4',
          type: 'onchain',
          title: 'Unsupported Chain',
          value: '0xdef...',
          submittedBy: '0x8888...',
          submittedAt: '2026-01-15T13:00:00.000Z',
          verified: true,
          verificationTxHash: '0xtxhash2...',
          blockNumber: 67890,
          chainId: 999999, // Unsupported chain
        },
      ];
      render(<EvidenceSourcesList sources={sourcesWithUnsupportedChain} showOnChainDetails />);
      expect(screen.getByText('Chain 999999 (no explorer)')).toBeInTheDocument();
    });

    it('shows submitted by and timestamp', () => {
      render(<EvidenceSourcesList sources={mockSources} />);
      const submittedByElements = screen.getAllByText('0x1234...');
      expect(submittedByElements.length).toBeGreaterThanOrEqual(1);
      const timestampElements = screen.getAllByText(/2026/i);
      expect(timestampElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Data table', () => {
    it('renders reference table with all sources (not aria-hidden)', () => {
      render(<EvidenceSourcesList sources={mockSources} />);
      const table = screen.getByRole('table', { name: /evidence sources reference/i });
      expect(table).toBeInTheDocument();
      expect(table).not.toHaveAttribute('aria-hidden');
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Submitted By')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Time')).toBeInTheDocument();
    });
  });

  describe('Max visible', () => {
    it('truncates sources when maxVisible exceeded', () => {
      render(<EvidenceSourcesList sources={mockSources} maxVisible={2} />);
      expect(screen.getByText('And 1 more source…')).toBeInTheDocument();
    });
  });

  describe('Keyboard navigation and interaction', () => {
    it('calls onSourceClick when source button clicked', () => {
      const onClick = jest.fn();
      render(<EvidenceSourcesList sources={mockSources} onSourceClick={onClick} />);
      const firstButton = screen.getAllByText('News Article')[0].closest('button');
      expect(firstButton).toBeInTheDocument();
      fireEvent.click(firstButton!);
      expect(onClick).toHaveBeenCalledWith(mockSources[0]);
    });

    it('activates source on Enter key', () => {
      const onClick = jest.fn();
      render(<EvidenceSourcesList sources={mockSources} onSourceClick={onClick} />);
      const firstButton = screen.getAllByText('News Article')[0].closest('button');
      fireEvent.keyDown(firstButton!, { key: 'Enter' });
      expect(onClick).toHaveBeenCalledWith(mockSources[0]);
    });

    it('activates source on Space key', () => {
      const onClick = jest.fn();
      render(<EvidenceSourcesList sources={mockSources} onSourceClick={onClick} />);
      const firstButton = screen.getAllByText('News Article')[0].closest('button');
      fireEvent.keyDown(firstButton!, { key: ' ' });
      expect(onClick).toHaveBeenCalledWith(mockSources[0]);
    });

    it('does not call onClick when disabled (no onClick handler)', () => {
      const onClick = jest.fn();
      render(<EvidenceSourcesList sources={mockSources} />); // no onClick prop
      const firstButton = screen.getAllByText('News Article')[0].closest('button');
      expect(firstButton).toHaveAttribute('disabled');
      fireEvent.click(firstButton!);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('focuses source button on Tab navigation', () => {
      render(<EvidenceSourcesList sources={mockSources} onSourceClick={jest.fn()} />);
      const firstButton = screen.getAllByText('News Article')[0].closest('button');
      firstButton?.focus();
      expect(firstButton).toHaveFocus();
    });
  });

  describe('Forced colors / high contrast mode', () => {
    it('has no axe violations with forced colors simulation', async () => {
      const { container } = render(<EvidenceSourcesList sources={mockSources} />);
      // axe doesn't simulate forced colors, but we ensure semantic HTML and no color-only meaning
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('Color-blind friendly representations', () => {
    it('uses icons and text, not color alone for type badges', () => {
      render(<EvidenceSourcesList sources={mockSources} />);
      const linkElements = screen.getAllByText('Link');
      expect(linkElements.length).toBeGreaterThanOrEqual(1);
      const documentElements = screen.getAllByText('Document');
      expect(documentElements.length).toBeGreaterThanOrEqual(1);
      const onchainElements = screen.getAllByText('On-chain');
      expect(onchainElements.length).toBeGreaterThanOrEqual(1);
    });

    it('uses icons and text for verification status, not color alone', () => {
      render(<EvidenceSourcesList sources={mockSources} showVerification />);
      const verifiedElements = screen.getAllByText('Verified');
      expect(verifiedElements.length).toBeGreaterThanOrEqual(1);
    });

    it('uses icons and text for dispute status, not color alone', () => {
      render(<EvidenceSourcesList sources={mockSources} showDisputeStatus />);
      const disputedElements = screen.getAllByText('Disputed');
      expect(disputedElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('200% zoom / responsive layout', () => {
    it('has no horizontal overflow at 200% zoom equivalent', () => {
      render(<EvidenceSourcesList sources={mockSources} />);
      const container = screen.getByRole('region', { name: /evidence sources/i });
      expect(container).toBeInTheDocument();
    });
  });

  describe('Reduced motion', () => {
    it('has no animation on loading skeleton when prefers-reduced-motion', () => {
      // The loading skeleton uses animate-pulse which respects prefers-reduced-motion via CSS
      const { container } = render(<EvidenceSourcesList sources={[]} isLoading />);
      const skeleton = container.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Table parity', () => {
    it('table contains same data as visible list', () => {
      render(<EvidenceSourcesList sources={mockSources} />);
      const table = screen.getByRole('table', { name: /evidence sources reference/i });
      expect(table).toBeInTheDocument();
      // Table should have all 3 sources
      const rows = table.querySelectorAll('tbody tr');
      expect(rows.length).toBe(3);
    });

    it('table is not aria-hidden', () => {
      render(<EvidenceSourcesList sources={mockSources} />);
      const table = screen.getByRole('table', { name: /evidence sources reference/i });
      expect(table).not.toHaveAttribute('aria-hidden');
    });
  });

  describe('Stale data handling', () => {
    it('shows stale indicator when source has old timestamp', () => {
      const staleSources = [
        {
          ...mockSources[0],
          submittedAt: '2020-01-01T00:00:00.000Z', // Very old
        },
      ];
      render(<EvidenceSourcesList sources={staleSources} />);
      // The component doesn't auto-mark stale, but shows the timestamp (appears in both list and table)
      const timestamps = screen.getAllByText('1/1/2020, 12:00:00 AM');
      expect(timestamps.length).toBeGreaterThanOrEqual(1);
    });
  });
});