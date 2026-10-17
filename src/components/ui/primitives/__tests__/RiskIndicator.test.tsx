import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { RiskIndicator } from '../RiskIndicator';

expect.extend(toHaveNoViolations);

const mockFactors = [
  {
    id: '1',
    label: 'Low Stake Participation',
    description: 'Only 15% of required stake has participated',
    level: 'high' as const,
  },
  {
    id: '2',
    label: 'Single Verifier Dominance',
    description: 'One verifier controls 60% of supporting weight',
    level: 'medium' as const,
    mitigated: true,
    mitigation: 'Per-wallet weight cap enforced',
  },
  {
    id: '3',
    label: 'Stale Data Risk',
    description: 'Projection is 45 seconds old',
    level: 'low' as const,
  },
];

describe('RiskIndicator', () => {
  const testLevels = ['none', 'low', 'medium', 'high', 'critical'] as const;

  describe.each(testLevels)('%s level', (level) => {
    it('renders correct label', () => {
      const labels: Record<string, string> = {
        none: 'No Risk',
        low: 'Low Risk',
        medium: 'Medium Risk',
        high: 'High Risk',
        critical: 'Critical Risk',
      };
      render(<RiskIndicator level={level} label={labels[level]} />);
      expect(screen.getByText(labels[level])).toBeInTheDocument();
    });

    it('has no axe violations', async () => {
      const { container } = render(<RiskIndicator level={level} label={labels[level]} />);
      expect(await axe(container)).toHaveNoViolations();
    });

it('applies correct tone styles', () => {
      render(<RiskIndicator level={level} label="Test" />);
      const badge = screen.getByTestId('risk-badge') ?? screen.getByRole('region').querySelector('[data-risk-level]') ?? document.querySelector('[data-risk-level]');
      expect(badge).toBeInTheDocument();
      const styles: Record<string, { bg: string; text: string; border: string }> = {
        none: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' },
        low: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/30' },
        medium: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' },
        high: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30' },
        critical: { bg: 'bg-destructive/20', text: 'text-destructive', border: 'border-destructive/50' },
      };
      expect(badge).toHaveClass(styles[level].bg);
      expect(badge).toHaveClass(styles[level].text);
      expect(badge).toHaveClass(styles[level].border);
    });
  });

  const labels: Record<string, string> = {
    none: 'No Risk',
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
    critical: 'Critical Risk',
  };

  describe('Progress bar', () => {
    it('shows progress bar when showProgress=true', () => {
      render(<RiskIndicator level="medium" label="Medium Risk" showProgress />);
      const progress = screen.getByRole('progressbar', { name: /risk level/i });
      expect(progress).toBeInTheDocument();
      expect(progress).toHaveAttribute('aria-valuenow', '50');
    });

    it('hides progress bar when showProgress=false', () => {
      render(<RiskIndicator level="medium" label="Medium Risk" showProgress={false} />);
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('shows 0% for none level', () => {
      render(<RiskIndicator level="none" label="No Risk" showProgress />);
      const progress = screen.getByRole('progressbar');
      expect(progress).toHaveAttribute('aria-valuenow', '0');
    });

    it('shows 100% for critical level', () => {
      render(<RiskIndicator level="critical" label="Critical Risk" showProgress />);
      const progress = screen.getByRole('progressbar');
      expect(progress).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('Risk factors', () => {
    it('renders risk factors when showFactors=true', () => {
      render(<RiskIndicator level="high" label="High Risk" factors={mockFactors} showFactors />);
      expect(screen.getByText('Low Stake Participation')).toBeInTheDocument();
      expect(screen.getByText('Single Verifier Dominance')).toBeInTheDocument();
      expect(screen.getByText('Stale Data Risk')).toBeInTheDocument();
    });

it('shows mitigated badge for mitigated factors', () => {
      render(<RiskIndicator level="high" label="High Risk" factors={mockFactors} showFactors />);
      expect(screen.getByText('Mitigated')).toBeInTheDocument();
    });

    it('shows check icon for mitigated factors', () => {
      render(<RiskIndicator level="high" label="High Risk" factors={mockFactors} showFactors />);
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('hides factors when showFactors=false', () => {
      render(<RiskIndicator level="high" label="High Risk" factors={mockFactors} showFactors={false} />);
      expect(screen.queryByText('Risk Factors')).not.toBeInTheDocument();
    });
  });

  describe('Provisional state', () => {
    it('shows provisional badge when provisional=true', () => {
      render(<RiskIndicator level="medium" label="Medium Risk" provisional />);
      const provisionalTexts = screen.getAllByText(/provisional/i);
      const visibleProvisional = provisionalTexts.find((el) => !el.classList.contains('sr-only'));
      expect(visibleProvisional).toBeInTheDocument();
    });
  });

  describe('Source and timestamp', () => {
    it('displays source when provided', () => {
      render(<RiskIndicator level="medium" label="Medium Risk" source="Risk Engine" />);
      const sourceTexts = screen.getAllByText(/source: risk engine/i);
      const visibleSource = sourceTexts.find((el) => !el.classList.contains('sr-only'));
      expect(visibleSource).toBeInTheDocument();
    });

    it('displays assessed timestamp when provided', () => {
      const timestamp = '2026-01-15T10:30:00.000Z';
      render(<RiskIndicator level="medium" label="Medium Risk" assessedAt={timestamp} />);
      const timeElements = screen.getAllByRole('time');
      expect(timeElements.length).toBeGreaterThan(0);
      expect(timeElements[0]).toHaveAttribute('dateTime', timestamp);
    });
  });

  describe('Compact mode', () => {
    it('renders as inline badge in compact mode', () => {
      render(<RiskIndicator level="medium" label="Medium Risk" compact />);
      const badge = screen.getByText('Medium Risk').closest('span[data-risk-level]');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('data-risk-level', 'medium');
    });
  });

  describe('Live region', () => {
    it('adds live region attributes when live=true', () => {
      render(<RiskIndicator level="medium" label="Medium Risk" live />);
      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Custom icon', () => {
    it('uses custom icon when provided', () => {
      render(<RiskIndicator level="medium" label="Medium Risk" icon={<span aria-hidden="true">★</span>} />);
      expect(screen.getByText('★')).toBeInTheDocument();
    });
  });
});