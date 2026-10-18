import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { VisualizationWithTable } from '../VisualizationWithTable';

expect.extend(toHaveNoViolations);

interface TestData {
  id: string;
  name: string;
  value: number;
  status: 'active' | 'inactive';
}

const mockData: TestData[] = [
  { id: '1', name: 'Item One', value: 100, status: 'active' },
  { id: '2', name: 'Item Two', value: 200, status: 'inactive' },
  { id: '3', name: 'Item Three', value: 300, status: 'active' },
];

const columns = [
  { key: 'name', header: 'Name', render: (item: TestData) => item.name, align: 'left' as const },
  { key: 'value', header: 'Value', render: (item: TestData) => item.value, align: 'right' as const },
  { key: 'status', header: 'Status', render: (item: TestData) => item.status, align: 'center' as const },
];

describe('VisualizationWithTable', () => {
  describe('Basic rendering', () => {
    it('renders title and visualization', () => {
      render(
        <VisualizationWithTable
          title="Test Visualization"
          visualization={<div data-testid="viz">Chart</div>}
          data={mockData}
          columns={columns}
          getKey={(item) => item.id}
        />
      );
      expect(screen.getByText('Test Visualization')).toBeInTheDocument();
      expect(screen.getByTestId('viz')).toBeInTheDocument();
    });

    it('renders data table with all rows', () => {
      render(
        <VisualizationWithTable
          title="Test Visualization"
          visualization={<div>Chart</div>}
          data={mockData}
          columns={columns}
          getKey={(item) => item.id}
        />
      );
      expect(screen.getByText('Item One')).toBeInTheDocument();
      expect(screen.getByText('Item Two')).toBeInTheDocument();
      expect(screen.getByText('Item Three')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
      expect(screen.getByText('300')).toBeInTheDocument();
      const activeCells = screen.getAllByText('active');
      expect(activeCells.length).toBe(2);
      const inactiveCells = screen.getAllByText('inactive');
      expect(inactiveCells.length).toBe(1);
    });

    it('has no axe violations', async () => {
      const { container } = render(
        <VisualizationWithTable
          title="Test Visualization"
          visualization={<div>Chart</div>}
          data={mockData}
          columns={columns}
          getKey={(item) => item.id}
        />
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('Loading state', () => {
    it('shows loading state', () => {
      render(
        <VisualizationWithTable
          title="Test Visualization"
          visualization={<div>Chart</div>}
          data={[]}
          columns={columns}
          getKey={(item) => item.id}
          isLoading
        />
      );
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('shows error message', () => {
      render(
        <VisualizationWithTable
          title="Test Visualization"
          visualization={<div>Chart</div>}
          data={[]}
          columns={columns}
          getKey={(item) => item.id}
          error="Failed to load data"
        />
      );
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('shows empty message when no data', () => {
      render(
        <VisualizationWithTable
          title="Test Visualization"
          visualization={<div>Chart</div>}
          data={[]}
          columns={columns}
          getKey={(item) => item.id}
          emptyMessage="No items found"
        />
      );
      expect(screen.getByText('No items found')).toBeInTheDocument();
    });
  });

  describe('Provisional and stale indicators', () => {
    it('shows provisional badge', () => {
      render(
        <VisualizationWithTable
          title="Test Visualization"
          visualization={<div>Chart</div>}
          data={mockData}
          columns={columns}
          getKey={(item) => item.id}
          provisional
        />
      );
      const provisionalTexts = screen.getAllByText(/provisional/i);
      const visibleProvisional = provisionalTexts.find((el) => !el.classList.contains('sr-only'));
      expect(visibleProvisional).toBeInTheDocument();
    });

    it('shows stale badge', () => {
      render(
        <VisualizationWithTable
          title="Test Visualization"
          visualization={<div>Chart</div>}
          data={mockData}
          columns={columns}
          getKey={(item) => item.id}
          stale
        />
      );
      const staleTexts = screen.getAllByText(/stale/i);
      const visibleStale = staleTexts.find((el) => !el.classList.contains('sr-only'));
      expect(visibleStale).toBeInTheDocument();
    });

    it('shows both provisional and stale', () => {
      render(
        <VisualizationWithTable
          title="Test Visualization"
          visualization={<div>Chart</div>}
          data={mockData}
          columns={columns}
          getKey={(item) => item.id}
          provisional
          stale
        />
      );
      // Component shows provisional badge when both are true (provisional takes precedence)
      const provisionalTexts = screen.getAllByText(/provisional/i);
      const visibleProvisional = provisionalTexts.find((el) => !el.classList.contains('sr-only'));
      expect(visibleProvisional).toBeInTheDocument();
      // Stale is not shown when provisional is also true (provisional takes precedence)
      const staleTexts = screen.getAllByText(/stale/i);
      const visibleStale = staleTexts.find((el) => !el.classList.contains('sr-only'));
      expect(visibleStale).toBeUndefined();
    });
  });

  describe('Source and timestamp', () => {
    it('displays source when provided', () => {
      render(
        <VisualizationWithTable
          title="Test Visualization"
          visualization={<div>Chart</div>}
          data={mockData}
          columns={columns}
          getKey={(item) => item.id}
          source="API"
        />
      );
      const sourceTexts = screen.getAllByText(/source: api/i);
      const visibleSource = sourceTexts.find((el) => !el.classList.contains('sr-only'));
      expect(visibleSource).toBeInTheDocument();
    });

    it('displays timestamp when provided', () => {
      const timestamp = '2026-01-15T10:30:00.000Z';
      render(
        <VisualizationWithTable
          title="Test Visualization"
          visualization={<div>Chart</div>}
          data={mockData}
          columns={columns}
          getKey={(item) => item.id}
          timestamp={timestamp}
        />
      );
      const timeElements = screen.getAllByRole('time');
      expect(timeElements.length).toBeGreaterThan(0);
      expect(timeElements[0]).toHaveAttribute('dateTime', timestamp);
    });
  });

  describe('Description', () => {
    it('renders description when provided', () => {
      render(
        <VisualizationWithTable
          title="Test Visualization"
          description="This is a test visualization"
          visualization={<div>Chart</div>}
          data={mockData}
          columns={columns}
          getKey={(item) => item.id}
        />
      );
      expect(screen.getByText('This is a test visualization')).toBeInTheDocument();
    });
  });

  describe('Table caption', () => {
    it('uses custom table caption', () => {
      render(
        <VisualizationWithTable
          title="Test Visualization"
          visualization={<div>Chart</div>}
          data={mockData}
          columns={columns}
          getKey={(item) => item.id}
          tableCaption="Custom caption"
        />
      );
      const caption = screen.getByText('Custom caption').closest('caption');
      expect(caption).toBeInTheDocument();
      expect(caption).toHaveClass('sr-only');
    });
  });

  describe('Hide table', () => {
    it('hides table when showTable=false', () => {
      render(
        <VisualizationWithTable
          title="Test Visualization"
          visualization={<div>Chart</div>}
          data={mockData}
          columns={columns}
          getKey={(item) => item.id}
          showTable={false}
        />
      );
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Visualization role', () => {
    it('uses img role by default', () => {
      render(
        <VisualizationWithTable
          title="Test Visualization"
          visualization={<div>Chart</div>}
          data={mockData}
          columns={columns}
          getKey={(item) => item.id}
        />
      );
      const viz = screen.getByRole('img', { name: /test visualization/i });
      expect(viz).toBeInTheDocument();
    });

    it('uses region role when specified', () => {
      render(
        <VisualizationWithTable
          title="Test Visualization"
          visualization={<div>Chart</div>}
          data={mockData}
          columns={columns}
          getKey={(item) => item.id}
          visualizationRole="region"
        />
      );
      const regions = screen.getAllByRole('region', { name: /test visualization/i });
      expect(regions.length).toBeGreaterThanOrEqual(1);
    });
  });

describe('Summary for screen readers', () => {
    it('includes data count in summary', () => {
      const { container } = render(
        <VisualizationWithTable
          title="Test Visualization"
          visualization={<div>Chart</div>}
          data={mockData}
          columns={columns}
          getKey={(item) => item.id}
        />
      );
      // The summary is in an sr-only element - check container text content
      expect(container.textContent).toContain('Test Visualization');
      expect(container.textContent).toContain('data point');
    });
  });
});