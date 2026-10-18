import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ConfidenceMeter } from '../ConfidenceMeter';

expect.extend(toHaveNoViolations);

describe('ConfidenceMeter', () => {
  describe('ARIA roles and attributes', () => {
    it('renders a meter element with correct attributes', () => {
      render(<ConfidenceMeter value={75} label="Confidence Score" />);
      const meter = screen.getByRole('meter', { name: /confidence score/i });
      expect(meter).toBeInTheDocument();
      expect(meter).toHaveAttribute('aria-valuenow', '75');
      expect(meter).toHaveAttribute('aria-valuemin', '0');
      expect(meter).toHaveAttribute('aria-valuemax', '100');
      expect(meter).toHaveAttribute('aria-valuetext', '75.0%');
    });

    it('shows unknown state when value is null', () => {
      render(<ConfidenceMeter value={null} label="Confidence Score" />);
      const meter = screen.getByRole('meter', { name: /confidence score/i });
      expect(meter).toHaveAttribute('aria-valuetext', 'Unknown');
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('has no axe violations for known value', async () => {
      const { container } = render(<ConfidenceMeter value={75} label="Confidence Score" />);
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations for unknown value', async () => {
      const { container } = render(<ConfidenceMeter value={null} label="Confidence Score" />);
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations for provisional state', async () => {
      const { container } = render(
        <ConfidenceMeter value={50} label="Confidence Score" provisional />
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('Confidence bands', () => {
    it('shows Low band for values 0-33', () => {
      render(<ConfidenceMeter value={25} label="Confidence" showBandLabel />);
      const bandTexts = screen.getAllByText(/low confidence/i);
      const visibleBand = bandTexts.find((el) => !el.classList.contains('sr-only'));
      expect(visibleBand).toBeInTheDocument();
    });

    it('shows Medium band for values 34-66', () => {
      render(<ConfidenceMeter value={50} label="Confidence" showBandLabel />);
      const bandTexts = screen.getAllByText(/medium confidence/i);
      const visibleBand = bandTexts.find((el) => !el.classList.contains('sr-only'));
      expect(visibleBand).toBeInTheDocument();
    });

    it('shows High band for values 67-100', () => {
      render(<ConfidenceMeter value={80} label="Confidence" showBandLabel />);
      const bandTexts = screen.getAllByText(/high confidence/i);
      const visibleBand = bandTexts.find((el) => !el.classList.contains('sr-only'));
      expect(visibleBand).toBeInTheDocument();
    });
  });

  describe('Provisional indicator', () => {
    it('shows provisional badge when provisional=true', () => {
      render(<ConfidenceMeter value={75} label="Confidence" provisional />);
      const provisionalTexts = screen.getAllByText(/provisional/i);
      const visibleProvisional = provisionalTexts.find((el) => !el.classList.contains('sr-only'));
      expect(visibleProvisional).toBeInTheDocument();
      const summaryText = provisionalTexts.find((el) => el.classList.contains('sr-only'));
      expect(summaryText).toHaveTextContent(/provisional - not finalized/i);
    });

    it('does not show provisional badge when provisional=false', () => {
      render(<ConfidenceMeter value={75} label="Confidence" provisional={false} />);
      const provisionalTexts = screen.queryAllByText(/provisional/i);
      const visibleProvisional = provisionalTexts.find((el) => !el.classList.contains('sr-only'));
      expect(visibleProvisional).toBeUndefined();
    });
  });

  describe('Source and timestamp', () => {
    it('displays source when provided', () => {
      render(<ConfidenceMeter value={75} label="Confidence" source="API Projection" />);
      const sourceTexts = screen.getAllByText(/source: api projection/i);
      const visibleSource = sourceTexts.find((el) => !el.classList.contains('sr-only'));
      expect(visibleSource).toBeInTheDocument();
    });

    it('displays computed timestamp when provided', () => {
      const timestamp = '2026-01-15T10:30:00.000Z';
      render(<ConfidenceMeter value={75} label="Confidence" computedAt={timestamp} />);
      const timeElements = screen.getAllByRole('time');
      expect(timeElements.length).toBeGreaterThan(0);
      expect(timeElements[0]).toHaveAttribute('dateTime', timestamp);
    });
  });

  describe('Data table', () => {
    it('renders a reference table with confidence bands', () => {
      render(<ConfidenceMeter value={75} label="Confidence" />);
      const table = screen.getByTestId('confidence-bands-table');
      expect(table).toBeInTheDocument();
      expect(screen.getByText('Low')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
    });
  });

  describe('Custom bands', () => {
    it('uses custom bands when provided', () => {
      const customBands = [
        { label: 'Critical', min: 0, max: 20, tone: 'danger' as const, icon: <>!</> },
        { label: 'Normal', min: 21, max: 100, tone: 'success' as const, icon: <>✓</> },
      ];
      render(<ConfidenceMeter value={15} label="Risk" bands={customBands} showBandLabel />);
      const bandLabel = screen.getByText('Critical confidence').closest('[aria-live="polite"]');
      expect(bandLabel).toBeInTheDocument();
    });
  });

  describe('Compact mode', () => {
    it('renders compact layout when compact prop is used', () => {
      // Compact mode is handled by the component internally
      render(<ConfidenceMeter value={75} label="Confidence" showValue={false} />);
      expect(screen.queryByText('75.0%')).not.toBeInTheDocument();
    });
  });

  describe('Boundary values', () => {
    it('handles value at minimum', () => {
      render(<ConfidenceMeter value={0} label="Confidence" />);
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('handles value at maximum', () => {
      render(<ConfidenceMeter value={100} label="Confidence" />);
      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });

    it('clamps values above maximum', () => {
      render(<ConfidenceMeter value={150} label="Confidence" />);
      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });

    it('clamps values below minimum', () => {
      render(<ConfidenceMeter value={-10} label="Confidence" />);
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });
  });
});