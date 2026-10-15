import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { OutcomeBadge } from '../OutcomeBadge';

expect.extend(toHaveNoViolations);

describe('OutcomeBadge', () => {
  const testOutcomes = [
    'verified',
    'disputed',
    'appealed',
    'inconclusive',
    'provisional',
    'rejected',
    'pending',
  ] as const;

  describe.each(testOutcomes)('%s outcome', (kind) => {
    it('renders without axe violations', async () => {
      const { container } = render(<OutcomeBadge kind={kind} />);
      expect(await axe(container)).toHaveNoViolations();
    });

    it('renders correct label', () => {
      const labels: Record<string, string> = {
        verified: 'Verified',
        disputed: 'Disputed',
        appealed: 'Appealed',
        inconclusive: 'Inconclusive',
        provisional: 'Provisional',
        rejected: 'Rejected',
        pending: 'Pending',
      };
      render(<OutcomeBadge kind={kind} />);
      const badge = screen.getByRole('region');
      const innerBadge = badge.querySelector('[data-outcome="' + kind + '"]');
      expect(innerBadge).toBeInTheDocument();
      expect(innerBadge).toHaveTextContent(labels[kind]);
    });

    it('has region role with accessible name', () => {
      render(<OutcomeBadge kind={kind} />);
      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
      expect(region).toHaveAttribute('aria-label');
    });
  });

  describe('Provisional state', () => {
    it('shows provisional indicator when provisional=true', () => {
      render(<OutcomeBadge kind="verified" provisional />);
      const provisionalBadge = screen.getByRole('region').querySelector('[aria-label="Provisional — not finalized"]');
      expect(provisionalBadge).toBeInTheDocument();
    });

    it('shows provisional for provisional kind', () => {
      render(<OutcomeBadge kind="provisional" />);
      const provisionalBadge = screen.getByRole('region').querySelector('[aria-label="Provisional — not finalized"]');
      expect(provisionalBadge).toBeInTheDocument();
    });
  });

  describe('Custom label and description', () => {
    it('uses custom label when provided', () => {
      render(<OutcomeBadge kind="verified" label="Custom Verified" />);
      const badge = screen.getByRole('region').querySelector('[data-outcome="verified"]');
      expect(badge).toHaveTextContent('Custom Verified');
    });
  });

  describe('Source and timestamp', () => {
    it('displays source when provided', () => {
      render(<OutcomeBadge kind="verified" source="Chain Projection" />);
      const sourceTexts = screen.getAllByText(/source: chain projection/i);
      const visibleSource = sourceTexts.find((el) => !el.classList.contains('sr-only'));
      expect(visibleSource).toBeInTheDocument();
    });

    it('displays determined timestamp when provided', () => {
      const timestamp = '2026-01-15T10:30:00.000Z';
      render(<OutcomeBadge kind="verified" determinedAt={timestamp} />);
      const timeElements = screen.getAllByRole('time');
      expect(timeElements.length).toBeGreaterThan(0);
      expect(timeElements[0]).toHaveAttribute('dateTime', timestamp);
    });
  });

  describe('Compact mode', () => {
    it('renders as inline badge in compact mode', () => {
      render(<OutcomeBadge kind="verified" compact />);
      const badge = screen.getByText('Verified').closest('span[data-outcome]');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('data-outcome', 'verified');
    });

    it('shows provisional attribute in compact mode', () => {
      render(<OutcomeBadge kind="verified" provisional compact />);
      const badge = screen.getByText('Verified').closest('span[data-provisional]');
      expect(badge).toHaveAttribute('data-provisional', 'true');
    });
  });

  describe('Live region', () => {
    it('adds live region attributes when live=true', () => {
      render(<OutcomeBadge kind="verified" live />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Tone styles', () => {
    it('applies success tone for verified', () => {
      render(<OutcomeBadge kind="verified" />);
      const badge = screen.getByRole('region').querySelector('[data-outcome="verified"]');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-success/10');
      expect(badge).toHaveClass('text-success');
    });

    it('applies danger tone for disputed', () => {
      render(<OutcomeBadge kind="disputed" />);
      const badge = screen.getByRole('region').querySelector('[data-outcome="disputed"]');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-destructive/10');
      expect(badge).toHaveClass('text-destructive');
    });

    it('applies warning tone for appealed', () => {
      render(<OutcomeBadge kind="appealed" />);
      const badge = screen.getByRole('region').querySelector('[data-outcome="appealed"]');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-warning/10');
      expect(badge).toHaveClass('text-warning');
    });

    it('applies info tone for inconclusive', () => {
      render(<OutcomeBadge kind="inconclusive" />);
      const badge = screen.getByRole('region').querySelector('[data-outcome="inconclusive"]');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-info/10');
      expect(badge).toHaveClass('text-info');
    });
  });
});