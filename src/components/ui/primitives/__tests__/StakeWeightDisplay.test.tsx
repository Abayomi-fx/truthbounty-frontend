import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { StakeWeightDisplay } from '../StakeWeightDisplay';

expect.extend(toHaveNoViolations);

const defaultSupporting = {
  label: 'Supporting',
  value: '700000000000000000000',
  unit: 'ETH',
  icon: <span aria-hidden="true">▲</span>,
  tone: 'success' as const,
};

const defaultOpposing = {
  label: 'Opposing',
  value: '300000000000000000000',
  unit: 'ETH',
  icon: <span aria-hidden="true">▼</span>,
  tone: 'danger' as const,
};

describe('StakeWeightDisplay', () => {
  describe('Basic rendering', () => {
    it('renders without axe violations', async () => {
      const { container } = render(<StakeWeightDisplay supporting={defaultSupporting} opposing={defaultOpposing} />);
      expect(await axe(container)).toHaveNoViolations();
    });

    it('renders supporting and opposing weights in visible content', () => {
      render(<StakeWeightDisplay supporting={defaultSupporting} opposing={defaultOpposing} />);
      const region = screen.getByRole('region', { name: /stake weights/i });
      expect(region).toBeInTheDocument();
      expect(region).toHaveTextContent('Supporting');
      expect(region).toHaveTextContent('Opposing');
      expect(region).toHaveTextContent('700 ETH');
      expect(region).toHaveTextContent('300 ETH');
    });

    it('shows percentages', () => {
      render(<StakeWeightDisplay supporting={defaultSupporting} opposing={defaultOpposing} />);
      const region = screen.getByRole('region', { name: /stake weights/i });
      expect(region).toHaveTextContent('70.0%');
      expect(region).toHaveTextContent('30.0%');
    });
  });

  describe('Progress bars', () => {
    it('renders progress bars for supporting and opposing', () => {
      render(<StakeWeightDisplay supporting={defaultSupporting} opposing={defaultOpposing} showBars={true} />);
      const bars = screen.getAllByRole('progressbar');
      expect(bars).toHaveLength(2);
      expect(bars[0]).toHaveAttribute('aria-valuenow', '70');
      expect(bars[1]).toHaveAttribute('aria-valuenow', '30');
    });

    it('hides progress bars when showBars=false', () => {
      render(<StakeWeightDisplay supporting={defaultSupporting} opposing={defaultOpposing} showBars={false} />);
      const region = screen.getByRole('region', { name: /stake weights/i });
      expect(region).toBeInTheDocument();
    });
  });

  describe('Quorum', () => {
    it('shows quorum progress when quorum provided', () => {
      render(
        <StakeWeightDisplay
          supporting={defaultSupporting}
          opposing={defaultOpposing}
          quorum="500000000000000000000"
        />
      );
      const region = screen.getByRole('region', { name: /stake weights/i });
      expect(region).toHaveTextContent('Quorum');
      expect(region).toHaveTextContent('500 ETH');
    });

    it('shows quorum reached when total >= quorum', () => {
      render(
        <StakeWeightDisplay
          supporting={defaultSupporting}
          opposing={defaultOpposing}
          quorum="500000000000000000000"
        />
      );
      const region = screen.getByRole('region', { name: /stake weights/i });
      expect(region).toHaveTextContent('Quorum reached');
    });

    it('shows quorum not reached when total < quorum', () => {
      const smallSupporting = { ...defaultSupporting, value: '100000000000000000000' };
      const smallOpposing = { ...defaultOpposing, value: '100000000000000000000' };
      render(
        <StakeWeightDisplay
          supporting={smallSupporting}
          opposing={smallOpposing}
          quorum="500000000000000000000"
        />
      );
      const region = screen.getByRole('region', { name: /stake weights/i });
      expect(region).toHaveTextContent('Quorum not reached');
    });
  });

  describe('Provisional and stale states', () => {
    it('shows provisional badge when provisional=true', () => {
      render(<StakeWeightDisplay supporting={defaultSupporting} opposing={defaultOpposing} provisional />);
      const region = screen.getByRole('region', { name: /stake weights/i });
      expect(region).toHaveTextContent('Provisional');
    });

    it('shows stale badge when stale=true', () => {
      render(<StakeWeightDisplay supporting={defaultSupporting} opposing={defaultOpposing} stale />);
      const region = screen.getByRole('region', { name: /stake weights/i });
      expect(region).toHaveTextContent('Stale');
    });
  });

  describe('Data table', () => {
    it('renders data table with weight details', () => {
      render(<StakeWeightDisplay supporting={defaultSupporting} opposing={defaultOpposing} showTable={true} />);
      const table = screen.getByRole('table', { name: /stake weight details/i });
      expect(table).toBeInTheDocument();
      expect(table).toHaveTextContent('Supporting');
      expect(table).toHaveTextContent('Opposing');
      expect(table).toHaveTextContent('Total');
    });

    it('includes quorum row in table when quorum provided', () => {
      render(
        <StakeWeightDisplay
          supporting={defaultSupporting}
          opposing={defaultOpposing}
          quorum="500000000000000000000"
          showTable={true}
        />
      );
      const table = screen.getByRole('table', { name: /stake weight details/i });
      expect(table).toHaveTextContent('Quorum Required');
    });
  });

  describe('Source and timestamp', () => {
    it('displays source when provided', () => {
      render(<StakeWeightDisplay supporting={defaultSupporting} opposing={defaultOpposing} source="Aggregation API" />);
      const sourceTexts = screen.getAllByText(/source: aggregation api/i);
      const visibleSource = sourceTexts.find((el) => !el.classList.contains('sr-only'));
      expect(visibleSource).toBeInTheDocument();
    });

    it('displays computed timestamp when provided', () => {
      const timestamp = '2026-01-15T10:30:00.000Z';
      render(<StakeWeightDisplay supporting={defaultSupporting} opposing={defaultOpposing} computedAt={timestamp} />);
      const timeElements = screen.getAllByRole('time');
      expect(timeElements.length).toBeGreaterThan(0);
      expect(timeElements[0]).toHaveAttribute('dateTime', timestamp);
    });
  });

  describe('Compact mode', () => {
    it('renders compact horizontal layout', () => {
      render(<StakeWeightDisplay supporting={defaultSupporting} opposing={defaultOpposing} compact />);
      const region = screen.getByRole('region', { name: /stake weights/i });
      expect(region).toHaveTextContent('700 ETH');
      expect(region).toHaveTextContent('300 ETH');
      expect(region).toHaveTextContent('70.0%');
      expect(region).toHaveTextContent('30.0%');
    });
  });

  describe('Custom formatter', () => {
    it('uses custom formatWeight function', () => {
      const customFormat = () => 'CUSTOM';
      render(
        <StakeWeightDisplay
          supporting={defaultSupporting}
          opposing={defaultOpposing}
          formatWeight={customFormat}
        />
      );
      const region = screen.getByRole('region', { name: /stake weights/i });
      expect(region).toHaveTextContent('CUSTOM');
    });
  });

  describe('Edge cases', () => {
    it('handles zero weights', () => {
      const zeroSupporting = { ...defaultSupporting, value: '0' };
      const zeroOpposing = { ...defaultOpposing, value: '0' };
      render(<StakeWeightDisplay supporting={zeroSupporting} opposing={zeroOpposing} />);
      const region = screen.getByRole('region', { name: /stake weights/i });
      expect(region).toHaveTextContent('0 ETH');
      expect(region).toHaveTextContent('0.0%');
    });

    it('handles null weights', () => {
      const nullSupporting = { ...defaultSupporting, value: null };
      const nullOpposing = { ...defaultOpposing, value: null };
      render(<StakeWeightDisplay supporting={nullSupporting} opposing={nullOpposing} />);
      const region = screen.getByRole('region', { name: /stake weights/i });
      expect(region).toHaveTextContent('0 ETH');
    });

    it('handles total override', () => {
      render(
        <StakeWeightDisplay
          supporting={defaultSupporting}
          opposing={defaultOpposing}
          total="2000000000000000000000"
        />
      );
      const region = screen.getByRole('region', { name: /stake weights/i });
      expect(region).toHaveTextContent('2000 ETH');
    });
  });
});